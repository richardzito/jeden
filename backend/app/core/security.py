"""Authentication dependency.

Production path: verifies a Supabase-issued JWT (HS256, signed with the
project's JWT secret) and reads the user id from the `sub` claim.

Local development path (DEV_AUTH_BYPASS=true, never enabled in production):
accepts an `X-Dev-User-Id` header (or a fixed default) and auto-provisions a
`users` row for it, so the full stack can be exercised without wiring up a
real Supabase project.
"""

import uuid

from fastapi import Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.core.config import get_settings
from app.core.db import get_db
from app.core.logging import get_logger
from app.models.models import User

logger = get_logger(__name__)

DEV_DEFAULT_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
DEV_DEFAULT_EMAIL = "dev@local.test"


async def _get_or_create_user(db: AsyncSession, user_id: uuid.UUID, email: str) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(id=user_id, email=email, locale=get_settings().default_locale)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


async def get_current_user(
    authorization: str | None = Header(default=None),
    x_dev_user_id: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    settings = get_settings()

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        if not settings.supabase_jwt_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="SUPABASE_JWT_SECRET not configured on the server",
            )
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except JWTError as exc:
            logger.warning("jwt_verification_failed", error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
            ) from exc

        sub = payload.get("sub")
        email = payload.get("email", "")
        if not sub:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing sub")
        return await _get_or_create_user(db, uuid.UUID(sub), email)

    if settings.dev_auth_bypass and settings.env != "production":
        user_id = uuid.UUID(x_dev_user_id) if x_dev_user_id else DEV_DEFAULT_USER_ID
        email = DEV_DEFAULT_EMAIL if user_id == DEV_DEFAULT_USER_ID else f"dev-{user_id}@local.test"
        return await _get_or_create_user(db, user_id, email)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header"
    )
