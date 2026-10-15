"""Recuperación de contraseña por correo (BRUNO / OVC)."""
import os
import hashlib
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from utils.database import db
from utils.security import get_password_hash

router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Recuperación de contraseña (token aleatorio, guardado hasheado, 60 min, un solo uso, sin revelar si el correo existe) ───
RESET_TTL_MIN = 60
RESET_MAX_PER_HOUR = 3


class ForgotBody(BaseModel):
    email: str


class ResetBody(BaseModel):
    token: str
    new_password: str


def _hash_token(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()


@router.post("/forgot-password")
async def forgot_password(body: ForgotBody, request: Request):
    email = body.email.strip().lower()
    generic = {"sent": True, "message": "Si el correo está registrado, te enviamos un enlace para restablecer la contraseña."}
    if "@" not in email:
        return generic
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()
    since = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    recent = await db.password_reset_tokens.count_documents({"$or": [{"email": email}, {"ip": ip}], "created_at": {"$gte": since}})
    if recent >= RESET_MAX_PER_HOUR:
        return generic
    user = await db.users.find_one({"email": email}, {"_id": 0, "id": 1, "name": 1, "email": 1, "auth_provider": 1})
    await db.password_reset_tokens.insert_one({"email": email, "ip": ip, "created_at": datetime.now(timezone.utc).isoformat(), "user_id": (user or {}).get("id"), "token_hash": None})
    if not user:
        return generic
    raw = secrets.token_urlsafe(32)
    await db.password_reset_tokens.update_one({"email": email, "token_hash": None, "user_id": user["id"]}, {"$set": {
        "token_hash": _hash_token(raw), "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=RESET_TTL_MIN)).isoformat(), "used": False}})
    base = (os.environ.get("FRONTEND_URL") or os.environ.get("PUBLIC_BASE_URL") or "").rstrip("/")
    reset_url = f"{base}/reset-password?token={raw}"
    try:
        from utils.email import send_email, reset_password_html
        await send_email(to=email, subject="Restablece tu contraseña de BRUNO", html=reset_password_html(name=user.get("name") or "", reset_url=reset_url, minutes=RESET_TTL_MIN))
    except HTTPException as e:
        if e.status_code in (503, 502, 500, 400):
            # Proveedor caído o correo no entregable: respuesta genérica (sin revelar si la cuenta existe) y registro para soporte
            await db.password_reset_tokens.update_one({"email": email, "user_id": user["id"]}, {"$set": {"email_error": str(e.detail)[:200]}})
            if e.status_code != 400:
                raise HTTPException(status_code=503, detail="No pudimos enviar el correo ahora mismo. Inténtalo en unos minutos.")
    return generic


@router.get("/reset-password/validate")
async def validate_reset_token(token: str):
    doc = await db.password_reset_tokens.find_one({"token_hash": _hash_token(token), "used": False}, {"_id": 0, "expires_at": 1, "email": 1})
    if not doc or doc["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=400, detail="El enlace no es válido o ya caducó. Solicita uno nuevo.")
    e = doc["email"]
    masked = e[0] + "***" + e[e.index("@") - 1:] if "@" in e and len(e) > 3 else "***"
    return {"valid": True, "email_hint": masked}


@router.post("/reset-password")
async def reset_password(body: ResetBody):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    now = datetime.now(timezone.utc).isoformat()
    doc = await db.password_reset_tokens.find_one_and_update(
        {"token_hash": _hash_token(body.token), "used": False, "expires_at": {"$gt": now}},
        {"$set": {"used": True, "used_at": now}}, projection={"_id": 0})
    if not doc:
        raise HTTPException(status_code=400, detail="El enlace no es válido o ya caducó. Solicita uno nuevo.")
    await db.users.update_one({"id": doc["user_id"]}, {"$set": {"hashed_password": get_password_hash(body.new_password), "password_changed_at": now, "tokens_valid_after": (datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat()}})
    await db.password_reset_tokens.update_many({"user_id": doc["user_id"], "used": False}, {"$set": {"used": True, "used_at": now}})
    return {"reset": True, "message": "Contraseña actualizada. Ya puedes iniciar sesión."}
