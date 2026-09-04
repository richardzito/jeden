"""Ephemeral live-session state, kept in Redis rather than Postgres.

A voice session's "where are we in the Lesson Plan right now" position
(current concept, beat index, escalation rung, the question currently
awaiting an answer) is exactly the kind of hot, short-lived, session-scoped
state Redis is for (architecture doc section C: "Redis: cache gorący").
The durable record of what happened (SessionTurn rows, updated mastery,
scheduled reviews) still goes to Postgres as each turn completes -- this is
only the scratchpad needed to resume the state machine on the next message.
"""

import json
import uuid

import redis.asyncio as redis

from app.core.config import get_settings

_SESSION_STATE_TTL_SECONDS = 4 * 60 * 60  # a voice session should never realistically run this long
_redis: redis.Redis | None = None


def _get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(get_settings().redis_url, decode_responses=True)
    return _redis


def _key(session_id: uuid.UUID) -> str:
    return f"session_state:{session_id}"


async def get_state(session_id: uuid.UUID) -> dict | None:
    raw = await _get_redis().get(_key(session_id))
    return json.loads(raw) if raw else None


async def set_state(session_id: uuid.UUID, state: dict) -> None:
    await _get_redis().set(_key(session_id), json.dumps(state, default=str), ex=_SESSION_STATE_TTL_SECONDS)


async def clear_state(session_id: uuid.UUID) -> None:
    await _get_redis().delete(_key(session_id))
