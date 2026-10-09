"""Security utilities — single source of truth for passwords, tokens and session validation.

Tokens are JWTs with `sub` (email), `jti` (unique id) and `iat`. A token is rejected when:
  • the signature/expiry is invalid,
  • its `jti` was revoked (logout),
  • it was issued before the user's `tokens_valid_after` (password change / "cerrar todas las sesiones"),
  • it was issued before the global `auth_settings.min_token_iat` (platform-wide revocation),
  • the user is inactive.
"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timezone, timedelta
from typing import Optional
import os
import time
import uuid

from utils.database import db
from models.user import User

SECRET_KEY = os.environ['SECRET_KEY']
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days

LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCK_MINUTES = 15

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

_global_min_iat_cache = {"value": 0, "checked_at": 0.0}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    to_encode = dict(data)
    to_encode.update({"exp": now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)), "iat": int(now.timestamp()), "jti": uuid.uuid4().hex})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def _parse_dt(v) -> Optional[datetime]:
    if not v:
        return None
    if isinstance(v, str):
        v = datetime.fromisoformat(v.replace("Z", "+00:00"))
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    return v


async def _global_min_iat() -> int:
    now = time.time()
    if now - _global_min_iat_cache["checked_at"] > 30:
        doc = await db.auth_settings.find_one({"key": "auth"}, {"_id": 0, "min_token_iat": 1})
        _global_min_iat_cache["value"] = int((doc or {}).get("min_token_iat") or 0)
        _global_min_iat_cache["checked_at"] = now
    return _global_min_iat_cache["value"]


def _user_from_doc(user_dict: dict) -> User:
    if isinstance(user_dict.get('created_at'), str):
        user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
    return User(**user_dict)


async def resolve_user_from_token(token: str) -> Optional[User]:
    """Validate a bearer token (JWT or Emergent session_token) and return the user, or None."""
    if not token:
        return None
    payload = decode_token(token)
    if payload is not None:
        email = payload.get("sub")
        if not email:
            return None
        iat = int(payload.get("iat") or 0)
        if iat < await _global_min_iat():
            return None
        if payload.get("jti") and await db.revoked_tokens.find_one({"jti": payload["jti"]}, {"_id": 0, "jti": 1}):
            return None
        user_dict = await db.users.find_one({"email": email}, {"_id": 0})
        if not user_dict or user_dict.get("is_active") is False:
            return None
        valid_after = _parse_dt(user_dict.get("tokens_valid_after"))
        if valid_after and iat < int(valid_after.timestamp()):
            return None
        return _user_from_doc(user_dict)

    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session_doc:
        return None
    expires_at = _parse_dt(session_doc.get("expires_at"))
    if not expires_at or expires_at < datetime.now(timezone.utc):
        return None
    user_dict = await db.users.find_one({"id": session_doc["user_id"]}, {"_id": 0})
    if not user_dict or user_dict.get("is_active") is False:
        return None
    return _user_from_doc(user_dict)


async def resolve_user_dict_from_token(token: str) -> Optional[dict]:
    """Same validation as resolve_user_from_token but returns the raw user document (no secrets)."""
    user = await resolve_user_from_token(token)
    if user is None:
        return None
    doc = await db.users.find_one({"id": user.id}, {"_id": 0, "password": 0, "hashed_password": 0})
    return doc


async def revoke_token(token: str, user_id: Optional[str] = None) -> None:
    """Invalidate exactly this session (logout)."""
    payload = decode_token(token)
    if payload and payload.get("jti"):
        exp = payload.get("exp")
        await db.revoked_tokens.update_one({"jti": payload["jti"]}, {"$set": {"jti": payload["jti"], "user_id": user_id, "expires_at": datetime.fromtimestamp(exp, tz=timezone.utc) if exp else None, "revoked_at": datetime.now(timezone.utc)}}, upsert=True)
    else:
        await db.user_sessions.delete_one({"session_token": token})


async def revoke_all_user_tokens(user_id: str) -> None:
    """Invalidate every session of a user (password change, 'cerrar sesión en todos los dispositivos')."""
    await db.users.update_one({"id": user_id}, {"$set": {"tokens_valid_after": datetime.now(timezone.utc).isoformat()}})
    await db.user_sessions.delete_many({"user_id": user_id})


def client_ip(request: Optional[Request]) -> str:
    if request is None:
        return "unknown"
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def check_login_allowed(email: str, ip: str) -> None:
    """Raise 429 when the account or the IP is temporarily locked after repeated failures."""
    now = datetime.now(timezone.utc)
    for key in (f"email:{email.lower()}", f"ip:{ip}"):
        doc = await db.login_attempts.find_one({"key": key}, {"_id": 0})
        if not doc:
            continue
        locked_until = _parse_dt(doc.get("locked_until"))
        if locked_until and locked_until > now:
            minutes = max(1, int((locked_until - now).total_seconds() // 60) + 1)
            raise HTTPException(status_code=429, detail=f"Demasiados intentos. Inténtalo de nuevo en {minutes} min.")


async def record_login_failure(email: str, ip: str) -> None:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=LOGIN_LOCK_MINUTES)
    for key, limit in ((f"email:{email.lower()}", LOGIN_MAX_ATTEMPTS), (f"ip:{ip}", LOGIN_MAX_ATTEMPTS * 4)):
        doc = await db.login_attempts.find_one({"key": key}, {"_id": 0})
        last = _parse_dt((doc or {}).get("last_failure_at"))
        count = (doc or {}).get("count", 0) if last and last > window_start else 0
        count += 1
        update = {"key": key, "count": count, "last_failure_at": now}
        if count >= limit:
            update["locked_until"] = (now + timedelta(minutes=LOGIN_LOCK_MINUTES)).isoformat()
        await db.login_attempts.update_one({"key": key}, {"$set": update}, upsert=True)


async def clear_login_failures(email: str, ip: str) -> None:
    await db.login_attempts.delete_many({"key": {"$in": [f"email:{email.lower()}", f"ip:{ip}"]}})


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[User]:
    if not credentials:
        return None
    return await resolve_user_from_token(credentials.credentials)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    user = await resolve_user_from_token(credentials.credentials if credentials else None)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
