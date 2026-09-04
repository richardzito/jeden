from fastapi import APIRouter

from app.api import health, sessions, topics, users

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(topics.router)
api_router.include_router(sessions.router)
api_router.include_router(users.router)
