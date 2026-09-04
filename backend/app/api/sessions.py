import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.logging import get_logger
from app.core.security import get_current_user as get_current_user_ws
from app.integrations.anthropic_client import AnthropicClient
from app.integrations.deepgram import create_temporary_token
from app.integrations.exceptions import ExternalServiceError
from app.models.models import Session as SessionRow, User
from app.schemas.api import (
    DeepgramTokenResponse,
    SessionAnswerRequest,
    SessionAnswerResponse,
    SessionCreateRequest,
    SessionCreateResponse,
    SessionTurnOut,
)
from app.services.session_service import SessionNotAwaitingAnswerError, SessionService, TurnOutput

logger = get_logger(__name__)
router = APIRouter(prefix="/sessions", tags=["sessions"])


def _to_out(turns: list[TurnOutput]) -> list[SessionTurnOut]:
    return [
        SessionTurnOut(
            turn_type=t.turn_type.value,
            content_text=t.text,
            concept_id=t.concept_id,
            session_complete=t.session_complete,
        )
        for t in turns
    ]


async def _get_owned_session(db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID) -> SessionRow:
    session_row = await db.get(SessionRow, session_id)
    if session_row is None or session_row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_row


@router.post("", response_model=SessionCreateResponse, status_code=201)
async def create_session(
    payload: SessionCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionCreateResponse:
    client = AnthropicClient(db=db)
    service = SessionService(db, client)
    try:
        session_row, turns = await service.start_session(user, payload.topic_id, payload.type)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ExternalServiceError as exc:
        logger.error("session_start_failed", error=str(exc))
        raise HTTPException(status_code=502, detail="Nie udało się rozpocząć sesji, spróbuj ponownie.") from exc

    return SessionCreateResponse(session_id=session_row.id, type=session_row.type, turns=_to_out(turns))


@router.post("/{session_id}/answer", response_model=SessionAnswerResponse)
async def submit_answer(
    session_id: uuid.UUID,
    payload: SessionAnswerRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionAnswerResponse:
    """Text-fallback path for submitting a learner's answer (also used by
    automated tests that simulate a session without real audio -- spec
    section 11's Playwright happy path is a "session odbyta tekstowo").
    The WebSocket endpoint below is the primary voice path."""
    session_row = await _get_owned_session(db, session_id, user.id)
    if session_row.ended_at is not None:
        raise HTTPException(status_code=400, detail="Session already ended")

    client = AnthropicClient(db=db)
    service = SessionService(db, client)
    try:
        turns = await service.submit_answer(session_row, payload.transcript)
    except SessionNotAwaitingAnswerError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ExternalServiceError as exc:
        logger.error("session_answer_failed", error=str(exc))
        raise HTTPException(status_code=502, detail="Nie udało się przetworzyć odpowiedzi.") from exc

    return SessionAnswerResponse(turns=_to_out(turns))


@router.post("/{session_id}/end")
async def end_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    session_row = await _get_owned_session(db, session_id, user.id)
    client = AnthropicClient(db=db)
    service = SessionService(db, client)
    await service.end_session(session_row)
    return {"status": "ended", "summary": session_row.summary}


@router.get("/stt-token", response_model=DeepgramTokenResponse)
async def get_stt_token(user: User = Depends(get_current_user)) -> DeepgramTokenResponse:
    try:
        token = await create_temporary_token()
    except ExternalServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return DeepgramTokenResponse(access_token=token.access_token, expires_in=token.expires_in)


@router.websocket("/{session_id}/stream")
async def session_stream(websocket: WebSocket, session_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    """Bidirectional live-session stream. Client sends
    `{"type": "answer", "transcript": "..."}` messages (final STT
    transcripts); server sends `{"type": "turn", ...}` messages, one per
    agent turn, ending with `session_complete: true` when the session is
    over. Audio (TTS) streaming and partial-transcript handling are left
    as documented follow-ups -- see README "Known limitations": this
    environment has no live Deepgram/ElevenLabs credentials to validate
    against, so the text-turn protocol below is exercised by the
    integration tests and the REST fallback above, while the audio layer
    is wired through app/integrations/{deepgram,elevenlabs}.py ready for a
    real key.
    """
    x_dev_user_id = websocket.headers.get("x-dev-user-id")
    authorization = websocket.headers.get("authorization")
    try:
        user = await get_current_user_ws(authorization=authorization, x_dev_user_id=x_dev_user_id, db=db)
    except Exception:
        await websocket.close(code=4401)
        return

    session_row = await db.get(SessionRow, session_id)
    if session_row is None or session_row.user_id != user.id:
        await websocket.close(code=4404)
        return

    await websocket.accept()
    client = AnthropicClient(db=db)
    service = SessionService(db, client)

    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") != "answer":
                continue
            transcript = message.get("transcript", "")
            try:
                turns = await service.submit_answer(session_row, transcript)
            except SessionNotAwaitingAnswerError:
                await websocket.send_json({"type": "error", "detail": "not_awaiting_answer"})
                continue
            except ExternalServiceError as exc:
                logger.error("session_ws_answer_failed", error=str(exc))
                await websocket.send_json({"type": "error", "detail": "processing_failed"})
                continue

            for turn in turns:
                await websocket.send_json(
                    {
                        "type": "turn",
                        "turn_type": turn.turn_type.value,
                        "content_text": turn.text,
                        "concept_id": str(turn.concept_id) if turn.concept_id else None,
                        "session_complete": turn.session_complete,
                    }
                )
            if any(t.session_complete for t in turns):
                await websocket.close(code=1000)
                return
    except WebSocketDisconnect:
        logger.info("session_ws_disconnected", session_id=str(session_id))
