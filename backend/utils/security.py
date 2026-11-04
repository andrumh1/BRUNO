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
import hashlib
import os
import secrets
import time
import uuid

from utils.database import db
from models.user import User

SECRET_KEY = os.environ['SECRET_KEY']
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # access token corto; la sesión vive en el refresh token rotatorio
REFRESH_TOKEN_TTL_DAYS = 365  # rolling: cada uso extiende la sesión; solo caduca tras un año sin abrir BRUNO
REFRESH_REUSE_GRACE_SECONDS = 60  # reintentos de red con el token recién rotado no cierran la sesión
REFRESH_COOKIE = "bruno_refresh"

LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCK_MINUTES = 15

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

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
        if payload.get("fam") and await db.revoked_families.find_one({"family_id": payload["fam"]}, {"_id": 0, "family_id": 1}):
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
    await db.refresh_tokens.update_many({"user_id": user_id, "revoked": {"$ne": True}}, {"$set": {"revoked": True, "revoked_at": datetime.now(timezone.utc).isoformat(), "revoke_reason": "all_devices"}})


# ---------- refresh tokens rotatorios (sesión persistente) ----------
def _hash_refresh(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def issue_token_pair(user_doc: dict, platform: str = "web", family_id: Optional[str] = None, ip: str = "", ua: str = "") -> dict:
    """Access JWT corto + refresh opaco (solo se guarda su hash). `family_id` agrupa todas las rotaciones de un mismo dispositivo."""
    now = datetime.now(timezone.utc)
    family_id = family_id or uuid.uuid4().hex
    refresh = secrets.token_urlsafe(48)
    doc = {"id": uuid.uuid4().hex, "user_id": user_doc["id"], "family_id": family_id, "token_hash": _hash_refresh(refresh), "platform": platform or "web",
           "created_at": now.isoformat(), "expires_at": (now + timedelta(days=REFRESH_TOKEN_TTL_DAYS)).isoformat(), "expires_dt": now + timedelta(days=REFRESH_TOKEN_TTL_DAYS),
           "revoked": False, "used_at": None, "replaced_by": None, "ip": ip[:64], "ua": ua[:200]}
    await db.refresh_tokens.insert_one(doc)
    access = create_access_token({"sub": user_doc["email"], "uid": user_doc["id"], "plt": platform or "web", "fam": family_id})
    return {"access_token": access, "refresh_token": refresh, "family_id": family_id, "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60}


async def revoke_refresh_family(family_id: Optional[str], reason: str = "logout") -> None:
    if family_id:
        now = datetime.now(timezone.utc)
        await db.refresh_tokens.update_many({"family_id": family_id, "revoked": {"$ne": True}}, {"$set": {"revoked": True, "revoked_at": now.isoformat(), "revoke_reason": reason}})
        # los access tokens vivos de esa familia dejan de valer de inmediato (TTL = vida máxima de un access token)
        await db.revoked_families.update_one({"family_id": family_id}, {"$set": {"family_id": family_id, "revoked_at": now, "expires_at": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES + 5)}}, upsert=True)


async def revoke_refresh_token_value(token: Optional[str], reason: str = "logout") -> None:
    if token:
        rec = await db.refresh_tokens.find_one({"token_hash": _hash_refresh(token)}, {"_id": 0, "family_id": 1})
        if rec:
            await revoke_refresh_family(rec.get("family_id"), reason)


async def rotate_refresh_token(token: str, platform: str = "web", ip: str = "", ua: str = "") -> dict:
    """Valida y rota el refresh token. Reuso tardío de un token ya rotado = robo → se revoca toda la familia.
    Reuso dentro del periodo de gracia (reintento de red, dos pestañas) → se rota de nuevo sin cerrar la sesión."""
    now = datetime.now(timezone.utc)
    rec = await db.refresh_tokens.find_one({"token_hash": _hash_refresh(token)}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=401, detail={"code": "refresh_invalid", "message": "Sesión no válida"})
    if rec.get("revoked"):
        raise HTTPException(status_code=401, detail={"code": "refresh_revoked", "message": "Sesión cerrada"})
    exp = _parse_dt(rec.get("expires_at"))
    if not exp or exp < now:
        await revoke_refresh_family(rec.get("family_id"), "expired")
        raise HTTPException(status_code=401, detail={"code": "refresh_expired", "message": "Sesión caducada"})
    if rec.get("used_at"):
        used = _parse_dt(rec["used_at"])
        if not used or (now - used).total_seconds() > REFRESH_REUSE_GRACE_SECONDS:
            await revoke_refresh_family(rec.get("family_id"), "reuse_detected")
            raise HTTPException(status_code=401, detail={"code": "refresh_reused", "message": "Sesión invalidada por seguridad"})
        if rec.get("replaced_by"):
            await db.refresh_tokens.update_one({"id": rec["replaced_by"]}, {"$set": {"revoked": True, "revoked_at": now.isoformat(), "revoke_reason": "superseded_grace"}})
    user_doc = await db.users.find_one({"id": rec["user_id"]}, {"_id": 0})
    if not user_doc or user_doc.get("is_active") is False:
        await revoke_refresh_family(rec.get("family_id"), "user_inactive")
        raise HTTPException(status_code=401, detail={"code": "user_inactive", "message": "Cuenta no disponible"})
    valid_after = _parse_dt(user_doc.get("tokens_valid_after"))
    created = _parse_dt(rec.get("created_at"))
    if valid_after and created and created < valid_after:
        await revoke_refresh_family(rec.get("family_id"), "password_changed")
        raise HTTPException(status_code=401, detail={"code": "refresh_revoked", "message": "Sesión cerrada por seguridad"})
    pair = await issue_token_pair(user_doc, platform or rec.get("platform") or "web", family_id=rec.get("family_id"), ip=ip, ua=ua)
    new_rec = await db.refresh_tokens.find_one({"token_hash": _hash_refresh(pair["refresh_token"])}, {"_id": 0, "id": 1})
    await db.refresh_tokens.update_one({"id": rec["id"]}, {"$set": {"used_at": rec.get("used_at") or now.isoformat(), "replaced_by": new_rec["id"]}})
    pair["user"] = {k: v for k, v in user_doc.items() if k not in ("hashed_password", "password")}
    return pair


def set_refresh_cookie(response, token: str, persistent: bool = True) -> None:
    kwargs = {"key": REFRESH_COOKIE, "value": token, "httponly": True, "secure": True, "samesite": "lax", "path": "/api/auth"}
    if persistent:
        kwargs["max_age"] = REFRESH_TOKEN_TTL_DAYS * 86400
    response.set_cookie(**kwargs)


def clear_refresh_cookie(response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth", httponly=True, secure=True, samesite="lax")


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


SESSION_COOKIE = "bruno_session"


def set_session_cookie(response, token: str, persistent: bool = True, max_age_seconds: int = ACCESS_TOKEN_EXPIRE_MINUTES * 60) -> None:
    """httpOnly cookie del access token (misma vida que el JWT) para el navegador; el refresh va en otra cookie limitada a /api/auth."""
    kwargs = {"key": SESSION_COOKIE, "value": token, "httponly": True, "secure": True, "samesite": "lax", "path": "/api"}
    if persistent:
        kwargs["max_age"] = max_age_seconds
    response.set_cookie(**kwargs)


def clear_session_cookie(response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/api", httponly=True, secure=True, samesite="lax")


def token_from_request(request: Optional[Request], credentials: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    if credentials and credentials.credentials:
        return credentials.credentials
    return request.cookies.get(SESSION_COOKIE) if request is not None else None


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[User]:
    token = token_from_request(request, credentials)
    if not token:
        return None
    return await resolve_user_from_token(token)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    user = await resolve_user_from_token(token_from_request(request, credentials))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
