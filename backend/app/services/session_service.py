"""Orchestrates a live voice session by wiring Tutor (content/decisions),
Quizmaster (question generation/evaluation), MemoryManager (mastery update)
and ReviewPlanner (FSRS scheduling) together against the DB and the
Redis-backed session state (app/core/session_state.py).

Two session types, two state machines sharing one `_run` loop:

- LEARN walks the pre-built Lesson Plan beats for each curriculum concept
  in order: explain -> ask_question -> await_answer -> feedback ->
  transition -> next concept. A wrong-enough answer triggers the
  escalation ladder (app/agents/tutor.py) instead of moving on.
- REVIEW skips straight to ask_question for each due concept (no
  re-explanation, no escalation ladder -- spec section H: "krótkie,
  zróżnicowane prompty"), generating a fresh question live each time via
  Quizmaster rather than reading a script.

Every method returns a list of turns to deliver in order; the caller
(REST for the first turn, WebSocket for the rest) is responsible for
actually sending them (text now, TTS audio streamed alongside/after).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.memory_manager import MasteryState, update_mastery
from app.agents.quizmaster import Quizmaster, choose_question_type
from app.agents.review_planner import record_review
from app.agents.tutor import EscalationRung, Tutor, next_escalation_rung
from app.core.logging import get_logger
from app.core.session_state import clear_state, get_state, set_state
from app.integrations.anthropic_client import AnthropicClient
from app.integrations.exceptions import ExternalServiceError
from app.models.models import (
    Answer,
    BeatType,
    Concept,
    CurriculumItem,
    LessonPlanBeat,
    Question,
    Session as SessionRow,
    SessionTurn,
    SessionType,
    Topic,
    TurnRole,
    TurnType,
    User,
    UserConceptMastery,
)

logger = get_logger(__name__)

CORRECT_THRESHOLD = 0.7
PARTIAL_THRESHOLD = 0.4
REVIEW_BATCH_SIZE = 10


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class TurnOutput:
    turn_type: TurnType
    text: str
    concept_id: uuid.UUID | None = None
    session_complete: bool = False


class SessionNotAwaitingAnswerError(Exception):
    pass


class SessionService:
    def __init__(self, db: AsyncSession, client: AnthropicClient):
        self._db = db
        self._client = client
        self._quizmaster = Quizmaster(client)
        self._tutor = Tutor(client)

    # --- Session start ------------------------------------------------

    async def start_session(
        self, user: User, topic_id: uuid.UUID, session_type: SessionType
    ) -> tuple[SessionRow, list[TurnOutput]]:
        topic = await self._db.get(Topic, topic_id)
        if topic is None or topic.user_id != user.id:
            raise ValueError("Topic not found")

        session_row = SessionRow(user_id=user.id, topic_id=topic_id, type=session_type, started_at=_now())
        self._db.add(session_row)
        await self._db.commit()
        await self._db.refresh(session_row)

        if session_type == SessionType.review:
            state = await self._init_review_state(user, topic_id)
        else:
            state = await self._init_learn_state(topic_id, user.id)

        if state is None:
            no_content_turn = TurnOutput(
                turn_type=TurnType.explain,
                text=self._no_content_message(session_type),
                session_complete=True,
            )
            await self._finalize_session(session_row, "Brak dostępnej treści dla tej sesji.")
            await self._persist_turn(session_row.id, TurnRole.agent, no_content_turn)
            return session_row, [no_content_turn]

        turns = await self._run(session_row, state)
        return session_row, turns

    def _no_content_message(self, session_type: SessionType) -> str:
        if session_type == SessionType.review:
            return "Nie masz teraz żadnych powtórek do zrobienia. Wróć później!"
        return "Ten temat nie ma jeszcze gotowych konceptów do nauki. Spróbuj ponownie za chwilę."

    async def _init_learn_state(self, topic_id: uuid.UUID, user_id: uuid.UUID) -> dict | None:
        result = await self._db.execute(
            select(CurriculumItem).where(CurriculumItem.topic_id == topic_id).order_by(CurriculumItem.order_index)
        )
        items = result.scalars().all()
        concept_ids_with_beats = []
        for item in items:
            has_beats = await self._db.execute(
                select(LessonPlanBeat.id).where(LessonPlanBeat.concept_id == item.concept_id).limit(1)
            )
            if has_beats.scalar_one_or_none() is not None:
                concept_ids_with_beats.append(str(item.concept_id))

        if not concept_ids_with_beats:
            return None

        return {
            "mode": "learn",
            "curriculum": concept_ids_with_beats,
            "curriculum_pos": 0,
            "concept_id": concept_ids_with_beats[0],
            "phase": "explain",
            "escalation_rung": None,
            "pending_question": None,
            "concepts_needing_return": [],
        }

    async def _init_review_state(self, user: User, topic_id: uuid.UUID) -> dict | None:
        concept_ids_result = await self._db.execute(select(Concept.id).where(Concept.topic_id == topic_id))
        concept_ids = [row[0] for row in concept_ids_result.all()]
        if not concept_ids:
            return None

        due_result = await self._db.execute(
            select(UserConceptMastery)
            .where(
                UserConceptMastery.user_id == user.id,
                UserConceptMastery.concept_id.in_(concept_ids),
                UserConceptMastery.next_review_at <= _now(),
            )
            .order_by(UserConceptMastery.next_review_at)
            .limit(REVIEW_BATCH_SIZE)
        )
        due = [row.concept_id for row in due_result.scalars().all()]
        if not due:
            return None

        return {
            "mode": "review",
            "curriculum": [str(c) for c in due],
            "curriculum_pos": 0,
            "concept_id": str(due[0]),
            "phase": "ask_question",
            "escalation_rung": None,
            "pending_question": None,
            "concepts_needing_return": [],
        }

    # --- Answer submission ----------------------------------------------

    async def submit_answer(self, session_row: SessionRow, transcript: str) -> list[TurnOutput]:
        state = await get_state(session_row.id)
        if state is None or state["phase"] != "await_answer" or state.get("pending_question") is None:
            raise SessionNotAwaitingAnswerError("No question is currently awaiting an answer")

        await self._persist_turn(
            session_row.id,
            TurnRole.user,
            TurnOutput(turn_type=TurnType.answer, text=transcript, concept_id=uuid.UUID(state["concept_id"])),
        )

        pending = state["pending_question"]
        outcome = await self._quizmaster.evaluate_answer(
            pending["text"], pending["rubric"], transcript, topic_id=session_row.topic_id, session_id=session_row.id
        )

        if outcome.needs_clarification:
            turn = TurnOutput(
                turn_type=TurnType.checkin,
                text=outcome.feedback_text,
                concept_id=uuid.UUID(state["concept_id"]),
            )
            await self._persist_turn(session_row.id, TurnRole.agent, turn)
            await set_state(session_row.id, state)
            return [turn]

        await self._record_answer_and_mastery(session_row, state, pending, transcript, outcome)

        feedback_turns = await self._resolve_after_evaluation(session_row, state, outcome)
        remaining_turns = await self._run(session_row, state, already_have=feedback_turns)
        return remaining_turns

    async def _record_answer_and_mastery(self, session_row, state, pending, transcript, outcome) -> None:
        concept_id = uuid.UUID(state["concept_id"])
        question_id = pending.get("question_id")
        if question_id:
            self._db.add(
                Answer(
                    question_id=uuid.UUID(question_id),
                    session_id=session_row.id,
                    user_id=session_row.user_id,
                    transcript=transcript,
                    evaluation_json={
                        "key_points_hit": outcome.key_points_hit,
                        "key_points_missed": outcome.key_points_missed,
                        "llm_confidence": outcome.llm_confidence,
                    },
                    correctness=outcome.correctness,
                    feedback_text=outcome.feedback_text,
                )
            )

        mastery_result = await self._db.execute(
            select(UserConceptMastery).where(
                UserConceptMastery.user_id == session_row.user_id,
                UserConceptMastery.concept_id == concept_id,
            )
        )
        mastery_row = mastery_result.scalar_one_or_none()
        if mastery_row is None:
            mastery_row = UserConceptMastery(user_id=session_row.user_id, concept_id=concept_id)
            self._db.add(mastery_row)
            await self._db.flush()

        current = MasteryState(
            exposure_count=mastery_row.exposure_count,
            comprehension=mastery_row.comprehension,
            recall=mastery_row.recall,
            confidence=mastery_row.confidence,
            mastery=mastery_row.mastery,
            error_count=mastery_row.error_count,
            misconception_flags=list(mastery_row.misconception_flags or []),
        )
        updated = update_mastery(current, correctness=outcome.correctness, misconception=outcome.misconception)
        mastery_row.exposure_count = updated.exposure_count
        mastery_row.comprehension = updated.comprehension
        mastery_row.recall = updated.recall
        mastery_row.confidence = updated.confidence
        mastery_row.mastery = updated.mastery
        mastery_row.error_count = updated.error_count
        mastery_row.misconception_flags = updated.misconception_flags

        mastery_row, review = record_review(mastery_row, outcome.correctness)
        self._db.add(review)
        await self._db.commit()

    async def _resolve_after_evaluation(self, session_row, state, outcome) -> list[TurnOutput]:
        pending = state["pending_question"]
        concept_id = uuid.UUID(state["concept_id"])

        if outcome.correctness >= CORRECT_THRESHOLD:
            text = pending.get("follow_up", {}).get("if_correct") or outcome.feedback_text
            state["phase"] = "transition" if state["mode"] == "learn" else "ask_question"
            state["pending_question"] = None
            state["escalation_rung"] = None
            turn = TurnOutput(TurnType.feedback, self._tutor.enforce_length(text), concept_id)
            await self._persist_turn(session_row.id, TurnRole.agent, turn)
            return [turn]

        if outcome.correctness >= PARTIAL_THRESHOLD or state["mode"] == "review":
            text = pending.get("follow_up", {}).get("if_partial") or outcome.feedback_text
            state["phase"] = "transition" if state["mode"] == "learn" else "ask_question"
            state["pending_question"] = None
            state["escalation_rung"] = None
            turn = TurnOutput(TurnType.feedback, self._tutor.enforce_length(text), concept_id)
            await self._persist_turn(session_row.id, TurnRole.agent, turn)
            return [turn]

        # Low correctness in a LEARN session: escalate.
        current_rung = EscalationRung(state["escalation_rung"]) if state["escalation_rung"] else None
        next_rung = next_escalation_rung(current_rung)

        if next_rung == EscalationRung.exhausted:
            state["concepts_needing_return"].append(state["concept_id"])
            text = pending.get("follow_up", {}).get("if_incorrect") or outcome.feedback_text
            text = text + " Wrócimy do tego później."
            state["phase"] = "transition"
            state["pending_question"] = None
            state["escalation_rung"] = None
            turn = TurnOutput(TurnType.feedback, self._tutor.enforce_length(text), concept_id)
            await self._persist_turn(session_row.id, TurnRole.agent, turn)
            return [turn]

        concept = await self._db.get(Concept, concept_id)
        try:
            escalation_text = await self._tutor.generate_escalation_text(
                concept.name, concept.definition, next_rung, topic_id=session_row.topic_id, session_id=session_row.id
            )
        except ExternalServiceError as exc:
            logger.warning("escalation_generation_failed", error=str(exc))
            escalation_text = pending.get("follow_up", {}).get("if_incorrect") or outcome.feedback_text

        state["escalation_rung"] = next_rung.value
        state["phase"] = "await_answer"  # re-ask the same question after this explanation
        explanation_turn = TurnOutput(TurnType.explain, escalation_text, concept_id)
        await self._persist_turn(session_row.id, TurnRole.agent, explanation_turn)

        reask_turn = TurnOutput(TurnType.question, self._tutor.enforce_length(pending["text"]), concept_id)
        await self._persist_turn(session_row.id, TurnRole.agent, reask_turn)
        return [explanation_turn, reask_turn]

    # --- Core loop --------------------------------------------------------

    async def _run(self, session_row: SessionRow, state: dict, already_have: list[TurnOutput] | None = None) -> list[TurnOutput]:
        turns: list[TurnOutput] = list(already_have or [])

        while True:
            phase = state["phase"]

            if phase == "explain":
                beat = await self._get_beat(state["concept_id"], BeatType.explain)
                turn = TurnOutput(TurnType.explain, self._tutor.enforce_length(beat.content.get("text", "")), uuid.UUID(state["concept_id"]))
                turns.append(turn)
                await self._persist_turn(session_row.id, TurnRole.agent, turn)
                state["phase"] = "ask_question"
                continue

            if phase == "ask_question":
                turn, pending = await self._produce_question_turn(session_row, state)
                turns.append(turn)
                await self._persist_turn(session_row.id, TurnRole.agent, turn)
                state["pending_question"] = pending
                state["phase"] = "await_answer"
                await set_state(session_row.id, state)
                return turns  # need learner input now

            if phase == "await_answer":
                # Re-entering _run with phase already await_answer only
                # happens right after start/advance -- state was just set,
                # nothing new to emit.
                await set_state(session_row.id, state)
                return turns

            if phase == "transition":
                beat = await self._get_beat(state["concept_id"], BeatType.transition)
                if beat is not None:
                    turn = TurnOutput(TurnType.transition, self._tutor.enforce_length(beat.content.get("text", "")), uuid.UUID(state["concept_id"]))
                    turns.append(turn)
                    await self._persist_turn(session_row.id, TurnRole.agent, turn)
                state["curriculum_pos"] += 1
                if state["curriculum_pos"] < len(state["curriculum"]):
                    state["concept_id"] = state["curriculum"][state["curriculum_pos"]]
                    state["phase"] = "explain" if state["mode"] == "learn" else "ask_question"
                else:
                    state["phase"] = "done"
                continue

            if phase == "done":
                turn = TurnOutput(
                    turn_type=TurnType.transition,
                    text=self._wrap_up_message(state),
                    session_complete=True,
                )
                turns.append(turn)
                await self._persist_turn(session_row.id, TurnRole.agent, turn)
                await self._finalize_session(session_row, self._build_summary(state))
                return turns

            raise AssertionError(f"Unknown session phase: {phase}")

    def _wrap_up_message(self, state: dict) -> str:
        if state.get("concepts_needing_return"):
            return "To wszystko na dziś! Do niektórych zagadnień wrócimy następnym razem."
        return "Świetna robota! To wszystko na dziś."

    def _build_summary(self, state: dict) -> str:
        covered = len(state["curriculum"])
        skipped = len(state.get("concepts_needing_return") or [])
        return f"Omówiono {covered} zagadnień, {skipped} do powtórzenia następnym razem."

    async def _produce_question_turn(self, session_row: SessionRow, state: dict) -> tuple[TurnOutput, dict]:
        concept_id = uuid.UUID(state["concept_id"])
        if state["mode"] == "learn":
            beat = await self._get_beat(state["concept_id"], BeatType.question)
            rubric_beat = await self._get_beat(state["concept_id"], BeatType.expected_answer_rubric)
            follow_up_beat = await self._get_beat(state["concept_id"], BeatType.follow_up)
            text = self._tutor.enforce_length(beat.content.get("text", ""))

            # The pipeline persists one Question row per prefetched
            # "question" beat (app.workers.pipeline._generate_and_persist_lesson_plan)
            # so answers can be linked to it; look it up by concept.
            question_row_result = await self._db.execute(
                select(Question.id).where(Question.concept_id == concept_id).order_by(Question.created_at).limit(1)
            )
            question_id = question_row_result.scalar_one_or_none()

            pending = {
                "text": beat.content.get("text", ""),
                "rubric": rubric_beat.content if rubric_beat else {"key_points": [], "min_points_for_pass": 1, "sample_good_answer": ""},
                "follow_up": follow_up_beat.content if follow_up_beat else {},
                "question_id": str(question_id) if question_id else None,
            }
            return TurnOutput(TurnType.question, text, concept_id), pending

        concept = await self._db.get(Concept, concept_id)
        mastery_result = await self._db.execute(
            select(UserConceptMastery).where(
                UserConceptMastery.user_id == session_row.user_id, UserConceptMastery.concept_id == concept_id
            )
        )
        mastery_row = mastery_result.scalar_one_or_none()
        q_type = choose_question_type(
            comprehension=mastery_row.comprehension if mastery_row else 0.0,
            recall=mastery_row.recall if mastery_row else 0.0,
            mastery=mastery_row.mastery if mastery_row else 0.0,
            exposure_count=mastery_row.exposure_count if mastery_row else 0,
        )
        generated = await self._quizmaster.generate_question(
            concept.name, concept.definition, q_type, topic_id=session_row.topic_id, session_id=session_row.id
        )
        question_row = Question(
            concept_id=concept_id,
            type=q_type,
            text=generated.text,
            difficulty=0.5,
            generated_by_session_id=session_row.id,
        )
        self._db.add(question_row)
        await self._db.commit()
        await self._db.refresh(question_row)

        pending = {
            "text": generated.text,
            "rubric": generated.rubric.model_dump(),
            "follow_up": {},
            "question_id": str(question_row.id),
        }
        return TurnOutput(TurnType.question, self._tutor.enforce_length(generated.text), concept_id), pending

    async def _get_beat(self, concept_id: str, beat_type: BeatType) -> LessonPlanBeat | None:
        result = await self._db.execute(
            select(LessonPlanBeat)
            .where(LessonPlanBeat.concept_id == uuid.UUID(concept_id), LessonPlanBeat.beat_type == beat_type)
            .order_by(LessonPlanBeat.order_index)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _persist_turn(self, session_id: uuid.UUID, role: TurnRole, turn: TurnOutput) -> None:
        self._db.add(
            SessionTurn(
                session_id=session_id,
                role=role,
                turn_type=turn.turn_type,
                content_text=turn.text,
                concept_id=turn.concept_id,
            )
        )
        await self._db.commit()

    async def _finalize_session(self, session_row: SessionRow, summary: str) -> None:
        session_row.ended_at = _now()
        session_row.summary = summary
        await self._db.commit()
        await clear_state(session_row.id)

    async def end_session(self, session_row: SessionRow) -> None:
        if session_row.ended_at is not None:
            return
        state = await get_state(session_row.id)
        summary = self._build_summary(state) if state else "Sesja zakończona wcześniej przez użytkownika."
        await self._finalize_session(session_row, summary)
