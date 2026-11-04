"""Verificación de correo al registrarse y aviso de inicio de sesión desde dispositivo nuevo (BRUNO)."""
import asyncio
import hashlib
import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from utils.database import db
from utils.security import get_current_user, client_ip
from models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

VERIFY_TTL_HOURS = 24
VERIFY_MAX_PER_HOUR = 3


def _now():
    return datetime.now(timezone.utc)


def _h(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()


def _base_url() -> str:
    return (os.environ.get("FRONTEND_URL") or os.environ.get("PUBLIC_BASE_URL") or "").rstrip("/")


async def _mark_verified(user_id: str, email: str):
    await db.users.update_one({"id": user_id}, {"$set": {"email_verified": True, "email_verified_at": _now().isoformat()}})
    await db.email_verifications.update_many({"user_id": user_id, "used": False}, {"$set": {"used": True}})
    logger.info(f"email verified for {email}")


async def send_verification(user: dict, ip: str = "") -> bool:
    """Crea un enlace + código de un solo uso (solo se guardan hashes) y envía el correo. Devuelve False si el proveedor falló."""
    raw = secrets.token_urlsafe(32)
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = _now()
    await db.email_verifications.update_many({"user_id": user["id"], "used": False}, {"$set": {"used": True}})
    await db.email_verifications.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "email": user["email"], "token_hash": _h(raw), "code_hash": _h(code),
                                             "attempts": 0, "used": False, "ip": ip, "created_at": now.isoformat(), "expires_at": now + timedelta(hours=VERIFY_TTL_HOURS)})
    try:
        from utils.email import send_email, verify_email_html
        await send_email(to=user["email"], subject="Confirma tu correo de BRUNO", html=verify_email_html(name=user.get("name") or "", verify_url=f"{_base_url()}/verify-email?token={raw}", code=code, hours=VERIFY_TTL_HOURS))
        return True
    except Exception as e:
        logger.warning(f"verification email failed for {user['email']}: {getattr(e, 'detail', e)}")
        await db.email_verifications.update_one({"token_hash": _h(raw)}, {"$set": {"email_error": str(getattr(e, 'detail', e))[:200]}})
        return False


class VerifyBody(BaseModel):
    token: Optional[str] = None
    code: Optional[str] = None


@router.post("/verify-email")
async def verify_email(body: VerifyBody, request: Request):
    """Enlace del correo (público, un solo uso) → confirma la cuenta. Abrirlo no inicia sesión."""
    if not body.token:
        raise HTTPException(status_code=400, detail="Enlace incompleto")
    doc = await db.email_verifications.find_one({"token_hash": _h(body.token)}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=400, detail="El enlace no es válido. Pide uno nuevo desde tu perfil.")
    user = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0, "email": 1, "email_verified": 1})
    if not user:
        raise HTTPException(status_code=400, detail="La cuenta ya no existe")
    if user.get("email_verified"):
        return {"verified": True, "email": user["email"], "already": True}
    if doc.get("used") or doc["expires_at"].replace(tzinfo=timezone.utc) < _now():
        raise HTTPException(status_code=400, detail="El enlace caducó o ya fue usado. Pide uno nuevo desde tu perfil.")
    await _mark_verified(doc["user_id"], user["email"])
    return {"verified": True, "email": user["email"]}


@router.post("/verify-email/code")
async def verify_email_code(body: VerifyBody, user: User = Depends(get_current_user)):
    """Código de 6 dígitos escrito dentro de la app (requiere sesión; máx. 5 intentos por código)."""
    code = re.sub(r"\D", "", body.code or "")
    if len(code) != 6:
        raise HTTPException(status_code=400, detail="El código tiene 6 dígitos")
    doc = await db.email_verifications.find_one({"user_id": user.id, "used": False}, {"_id": 0}, sort=[("created_at", -1)])
    if not doc or doc["expires_at"].replace(tzinfo=timezone.utc) < _now():
        raise HTTPException(status_code=400, detail="El código caducó. Pide uno nuevo.")
    if doc.get("attempts", 0) >= 5:
        await db.email_verifications.update_one({"id": doc["id"]}, {"$set": {"used": True}})
        raise HTTPException(status_code=429, detail="Demasiados intentos. Pide un código nuevo.")
    if doc["code_hash"] != _h(code):
        await db.email_verifications.update_one({"id": doc["id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Código incorrecto")
    await _mark_verified(user.id, user.email)
    return {"verified": True, "email": user.email}


@router.post("/verify-email/resend")
async def resend_verification(request: Request, user: User = Depends(get_current_user)):
    u = await db.users.find_one({"id": user.id}, {"_id": 0, "id": 1, "email": 1, "name": 1, "email_verified": 1})
    if u.get("email_verified"):
        return {"sent": False, "already": True}
    since = (_now() - timedelta(hours=1)).isoformat()
    if await db.email_verifications.count_documents({"user_id": user.id, "created_at": {"$gte": since}}) >= VERIFY_MAX_PER_HOUR:
        raise HTTPException(status_code=429, detail="Ya te enviamos varios correos. Espera un rato antes de pedir otro.")
    ok = await send_verification(u, client_ip(request))
    if not ok:
        raise HTTPException(status_code=503, detail="No pudimos enviar el correo ahora mismo. Inténtalo en unos minutos.")
    return {"sent": True, "email": u["email"]}


# ---------- aviso de inicio de sesión desde dispositivo nuevo ----------
_UA_RULES = [("iphone", "iPhone"), ("ipad", "iPad"), ("android", "Android"), ("windows", "Windows"), ("mac os", "Mac"), ("macintosh", "Mac"), ("linux", "Linux")]
_BROWSERS = [("edg/", "Edge"), ("opr/", "Opera"), ("samsungbrowser", "Samsung Internet"), ("firefox", "Firefox"), ("chrome", "Chrome"), ("crios", "Chrome"), ("safari", "Safari")]


def describe_device(ua: str, platform: str = "web") -> str:
    low = (ua or "").lower()
    os_name = next((v for k, v in _UA_RULES if k in low), "Dispositivo")
    if platform == "native":
        return f"App BRUNO · {os_name}"
    browser = next((v for k, v in _BROWSERS if k in low), "Navegador")
    return f"{browser} · {os_name}"


async def note_login_device(user: dict, request: Request, platform: str = "web") -> None:
    """Registra el dispositivo (UA + plataforma); si es nuevo para una cuenta que ya tenía dispositivos conocidos, avisa por correo y en la app."""
    try:
        ua = request.headers.get("user-agent", "")
        ip = client_ip(request)
        device = describe_device(ua, platform)
        dh = _h(f"{platform}|{device}|{re.sub(r'[0-9._]+', '', ua.lower())[:160]}")
        now = _now().isoformat()
        known = await db.known_devices.count_documents({"user_id": user["id"]})
        existing = await db.known_devices.find_one({"user_id": user["id"], "device_hash": dh}, {"_id": 0, "id": 1})
        if existing:
            await db.known_devices.update_one({"id": existing["id"]}, {"$set": {"last_seen": now, "last_ip": ip}})
            return
        await db.known_devices.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "device_hash": dh, "device": device, "ua": ua[:200], "platform": platform, "first_ip": ip, "last_ip": ip, "first_seen": now, "last_seen": now})
        if known == 0:
            return  # primer dispositivo registrado (cuentas existentes): sin alarma
        asyncio.create_task(_alert_new_login(user, device, ip))
    except Exception as e:
        logger.warning(f"login device tracking failed: {e}")


async def _alert_new_login(user: dict, device: str, ip: str) -> None:
    when = _now().strftime("%d/%m/%Y %H:%M UTC")
    msg = f"Nuevo inicio de sesión desde {device}. Si no fuiste tú, cambia tu contraseña."
    try:
        from utils.notification_realtime import emit_notification_ws
        doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "actor_id": None, "type": "security_login", "message": msg, "target_id": user["id"], "target_type": "security", "url": "/settings", "is_read": False, "created_at": _now().isoformat()}
        await db.notifications.insert_one(dict(doc))
        await emit_notification_ws(doc)
    except Exception as e:
        logger.warning(f"login alert notification failed: {e}")
    try:
        from utils.email import send_email, new_login_html
        await send_email(to=user["email"], subject="Nuevo inicio de sesión en tu cuenta BRUNO", html=new_login_html(name=user.get("name") or "", when=when, device=device, ip=ip or "desconocida", settings_url=f"{_base_url()}/settings"))
        await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "action": "login_alert_sent", "device": device, "ip": ip, "created_at": _now().isoformat()})
    except Exception as e:
        logger.warning(f"login alert email failed for {user['email']}: {getattr(e, 'detail', e)}")
