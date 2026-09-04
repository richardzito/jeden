"""arq worker entrypoint. Run with:
    arq app.workers.research_worker.WorkerSettings
(the `worker` service in docker-compose.yml does exactly this).
"""

import uuid

from arq.connections import RedisSettings

from app.core.config import get_settings
from app.core.db import async_session_factory
from app.core.logging import configure_logging, get_logger
from app.workers.pipeline import run_research_pipeline

logger = get_logger(__name__)


async def run_research_pipeline_task(ctx: dict, topic_id: str) -> None:
    async with async_session_factory() as db:
        await run_research_pipeline(uuid.UUID(topic_id), db)


async def on_startup(ctx: dict) -> None:
    configure_logging()
    logger.info("research_worker_startup")


async def on_shutdown(ctx: dict) -> None:
    logger.info("research_worker_shutdown")


class WorkerSettings:
    functions = [run_research_pipeline_task]
    on_startup = on_startup
    on_shutdown = on_shutdown
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    max_jobs = 5
    job_timeout = 900  # research can legitimately take minutes (spec A.1)
