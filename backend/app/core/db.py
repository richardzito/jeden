from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()

# NullPool: each checkout opens a fresh asyncpg connection instead of
# reusing one from a pool. Without it, a connection created under one
# asyncio event loop gets reused (and fails) under another -- which bites
# both pytest-asyncio's per-test event loops and worker-process restarts.
# For this app's traffic volume the extra connect() per request is cheap.
engine = create_async_engine(settings.database_url, poolclass=NullPool, future=True)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
