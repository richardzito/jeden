import os
import uuid

os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://audiotutor:audiotutor@localhost:5432/audiotutor_test"
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("DEV_AUTH_BYPASS", "true")
os.environ.setdefault("ENV", "test")

import pytest
import pytest_asyncio
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.db import Base, engine  # noqa: E402
from app.models import models  # noqa: E402,F401

# Schema setup runs synchronously (psycopg2) at collection time rather than
# through an async fixture: it sidesteps pytest-asyncio event-loop-scope
# bookkeeping entirely, and resets the test database once per test run so
# stray rows committed by a previous run (llm_calls, etc.) don't leak into
# assertions that count rows.
_sync_url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql+psycopg2://")
_sync_engine = create_engine(_sync_url)
Base.metadata.drop_all(_sync_engine)
Base.metadata.create_all(_sync_engine)
_sync_engine.dispose()


@pytest_asyncio.fixture
async def db_session():
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture(autouse=True)
async def _reset_arq_pool():
    # Like the SQLAlchemy engine, arq's redis pool and the session-state
    # redis client are module-level singletons created lazily on first use
    # and bound to whatever event loop is running then. pytest-asyncio
    # gives each test its own loop by default, so a pool/client created in
    # one test can't be reused in the next. Dropping the references lets
    # them be recreated fresh per test.
    import app.core.queue as queue_module
    import app.core.session_state as session_state_module

    queue_module._pool = None
    session_state_module._redis = None
    yield
    queue_module._pool = None
    session_state_module._redis = None


@pytest.fixture
def new_uuid():
    return uuid.uuid4
