"""Servicio «Creamos tu tarjeta» (BRUNO + OVC): país del edge, solicitudes con adjuntos privados y correo a bruno@brunocard.com."""
import asyncio
import base64
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from html import escape
from typing import List, Optional
from urllib.parse import urlparse

import cloudinary
import cloudinary.uploader
import cloudinary.utils
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile

from models.user import User
from utils.database import db
from utils.security import get_current_user, get_current_user_optional

logger = logging.getLogger("bruno.service")
router = APIRouter(prefix="/bruno-service", tags=["bruno-service"])

RECIPIENT = "bruno@brunocard.com"
OFFERS = {"CO": {"currency": "COP", "amount": 30000, "label": "COP $30.000"}, "US": {"currency": "USD", "amount": 30, "label": "US$30"}}
TYPES = {"Personal", "Negocio / empresa", "Currículum", "Guardián", "Mascota"}
DOC_TYPES = {"application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx"}
IMG_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_FILE, MAX_TOTAL = 5 * 1024 * 1024, 20 * 1024 * 1024
LIMITS = {"documents": 2, "logo": 1, "gallery": 8}
MAGIC = {"pdf": (b"%PDF",), "docx": (b"PK\x03\x04",), "jpg": (b"\xff\xd8\xff",), "png": (b"\x89PNG",), "webp": (b"RIFF",)}
ALLOWED_HOSTS = {"brunocard.com", "www.brunocard.com", "localhost"}
_rate: dict = {}


def _now():
    return datetime.now(timezone.utc)


# ---------- país aproximado desde la infraestructura (nunca un header libre del navegador) ----------
@router.get("/locale")
async def locale(request: Request, response: Response):
    response.headers["Cache-Control"] = "private, no-store"
    # Solo CF-IPCountry: Cloudflare (delante de BRUNO) lo sobrescribe en el edge, así que un cliente no puede falsificarlo.
    # Otros headers (X-Country-Code, etc.) llegan tal cual desde el navegador y NO se aceptan.
    v = (request.headers.get("cf-ipcountry") or "").upper()
    if v in OFFERS:
        return {"country": v}
    return {"country": None}


# ---------- utilidades ----------
def _origin_ok(request: Request) -> bool:
    origin = request.headers.get("origin") or request.headers.get("referer")
    if not origin:
        return False
    host = (urlparse(origin).hostname or "").lower()
    req_host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(":")[0].lower()
    return host in ALLOWED_HOSTS or (req_host and host == req_host) or host.endswith(".emergentagent.com") or host.endswith(".emergent.host")


def _client_ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (request.client.host if request.client else "?")


def _rate_ok(key: str, limit: int, window: int) -> bool:
    now = time.time()
    hits = [t for t in _rate.get(key, []) if now - t < window]
    if len(hits) >= limit:
        _rate[key] = hits
        return False
    hits.append(now)
    _rate[key] = hits
    return True


def _clean(v: Optional[str], n: int) -> str:
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", (v or "")).strip()[:n]


async def _read_files(files: List[UploadFile], field: str, allowed: dict, total: List[int]) -> list:
    files = [f for f in files if f and f.filename]
    if len(files) > LIMITS[field]:
        raise HTTPException(status_code=400, detail={"error": "Hay demasiados archivos. Máximo: 2 documentos, 1 logo y 8 imágenes.", "errorEn": "Too many files. Maximum: 2 documents, 1 logo and 8 gallery images."})
    out = []
    for f in files:
        data = await f.read()
        if len(data) > MAX_FILE:
            raise HTTPException(status_code=400, detail={"error": "Máximo 5 MB por archivo.", "errorEn": "Maximum 5 MB per file."})
        total[0] += len(data)
        if total[0] > MAX_TOTAL:
            raise HTTPException(status_code=400, detail={"error": "Los archivos superan el máximo total de 20 MB.", "errorEn": "Files exceed the 20 MB total limit."})
        ext = allowed.get((f.content_type or "").lower())
        if not ext or not any(data.startswith(m) for m in MAGIC[ext]) or (ext == "webp" and data[8:12] != b"WEBP"):
            raise HTTPException(status_code=400, detail={"error": f"Formato no permitido en {field}. Usa PDF/DOCX para documentos y JPG/PNG/WebP para imágenes.", "errorEn": f"File type not allowed in {field}. Use PDF/DOCX for documents and JPG/PNG/WebP for images."})
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(f.filename))[:80]
        out.append({"field": field, "name": safe, "ext": ext, "mime": f.content_type, "size": len(data), "bytes": data})
    return out


def _store_private(req_id: str, item: dict) -> dict:
    """Cloudinary `type=private`: sin URL pública; los administradores obtienen enlaces firmados temporales."""
    rtype = "image" if item["ext"] in IMG_TYPES.values() else "raw"
    public_id = f"{item['field']}-{uuid.uuid4().hex[:8]}-{item['name'].rsplit('.', 1)[0]}"
    res = cloudinary.uploader.upload(item["bytes"], folder=f"bruno/service-requests/{req_id}", public_id=public_id, resource_type=rtype, type="private", overwrite=False, invalidate=False)
    return {"field": item["field"], "name": item["name"], "mime": item["mime"], "size": item["size"], "public_id": res["public_id"], "resource_type": rtype, "format": res.get("format") or item["ext"]}


def _signed_url(f: dict, expires_s: int = 900) -> str:
    return cloudinary.utils.private_download_url(f["public_id"], f.get("format") or "", resource_type=f["resource_type"], type="private", expires_at=int(time.time()) + expires_s, attachment=True)


# ---------- correo (destinatario fijo en servidor) ----------
def _email_html(rec: dict) -> str:
    rows = [("Referencia", rec["id"]), ("País de la oferta", rec["market"]), ("Idioma preferido", rec["language"]), ("Moneda", rec["currency"]), ("Valor del servicio", f"{rec['currency']} {rec['amount']:,}".replace(",", ".") if rec["currency"] == "COP" else f"{rec['currency']} {rec['amount']}"),
            ("Fecha", rec["created_at"]), ("Tipo de tarjeta", rec["type"]), ("Nombre del contacto", rec["name"]), ("Correo", rec["email"]), ("WhatsApp", rec["phone"]), ("Nombre de la tarjeta", rec["card_name"]), ("Plantilla", rec["template"]),
            ("Descripción y contenido", rec["description"]), ("Redes y enlaces", rec["links"]), ("Indicaciones adicionales", rec["notes"]), ("Autorización recibida", rec["consent_at"]), ("Adjuntos", f"{len(rec['files'])} archivo(s) guardados de forma privada; se descargan desde Administración → Solicitudes de tarjeta.")]
    body = "".join(f'<tr><td style="padding:6px 10px 6px 0;color:#6c6d64;font-size:13px;vertical-align:top">{escape(k)}</td><td style="padding:6px 0;font-size:14px;white-space:pre-wrap">{escape(str(v) or "No indicado")}</td></tr>' for k, v in rows)
    files = "".join(f"<li>{escape(f['field'])}: {escape(f['name'])} ({f['size'] // 1024} KB)</li>" for f in rec["files"])
    return (f'<div style="font-family:Arial,sans-serif;max-width:640px"><h2 style="margin:0 0 6px">Nueva solicitud · BRUNO + OVC</h2>'
            f'<p style="margin:0 0 14px;color:#6c6d64">Servicio: diseño y configuración de una tarjeta. <b>Esta solicitud no confirma un pago.</b></p><table>{body}</table>'
            f'<p style="margin-top:14px"><b>Archivos adjuntos:</b></p><ul>{files or "<li>Ninguno</li>"}</ul></div>')


async def _send_email(rec: dict) -> dict:
    """Resend con adjuntos si hay RESEND_API_KEY+EMAIL_FROM; si no, correo gestionado de BRUNO (resumen + descarga privada)."""
    subject = f"Solicitud BRUNO · {rec['type']} · {rec['card_name'][:100]}"
    rk, rf = os.environ.get("RESEND_API_KEY"), os.environ.get("EMAIL_FROM")
    if rk and rf:
        attachments = []
        for f in rec["files"]:
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.get(_signed_url(f, 300))
            if r.status_code == 200:
                attachments.append({"filename": f["name"], "content": base64.b64encode(r.content).decode()})
        payload = {"from": rf, "to": [RECIPIENT], "reply_to": rec["email"], "subject": subject, "html": _email_html(rec), "attachments": attachments}
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {rk}", "Idempotency-Key": f"bruno-request-{rec['id']}"}, json=payload)
        if r.status_code < 300 and r.json().get("id"):
            return {"status": "accepted", "provider": "resend", "provider_id": r.json()["id"]}
        return {"status": "failed", "provider": "resend", "error": r.text[:200]}
    from utils.email import send_email
    try:
        pid = await send_email(to=RECIPIENT, subject=subject, html=_email_html(rec), reply_to=rec["email"])
        return {"status": "accepted", "provider": "emergent", "provider_id": pid}
    except HTTPException as e:
        return {"status": "pending_configuration" if e.status_code == 503 and "no configurado" in str(e.detail) else "failed", "provider": "emergent", "error": str(e.detail)[:200]}


async def _deliver(req_id: str, attempts: int = 3):
    """Entrega persistente con reintentos; nunca duplica: solo envía si el estado no es `accepted`."""
    for i in range(attempts):
        rec = await db.service_requests.find_one({"id": req_id}, {"_id": 0})
        if not rec or rec.get("email_status") == "accepted":
            return
        res = await _send_email(rec)
        await db.service_requests.update_one({"id": req_id}, {"$set": {"email_status": res["status"], "email_provider": res.get("provider"), "email_provider_id": res.get("provider_id"), "email_error": res.get("error"), "email_last_attempt": _now().isoformat()}, "$inc": {"email_attempts": 1}})
        if res["status"] in ("accepted", "pending_configuration"):
            return
        await asyncio.sleep(5 * (i + 1))


# ---------- solicitud pública protegida ----------
@router.post("/requests", status_code=201)
async def create_request(request: Request, requestId: str = Form(...), type: str = Form(...), name: str = Form(...), email: str = Form(...), phone: str = Form(""), cardName: str = Form(...), template: str = Form(""),
                         description: str = Form(""), links: str = Form(""), notes: str = Form(""), consent: str = Form(""), market: str = Form("US"), language: str = Form("es"), website_extra: str = Form(""),
                         documents: List[UploadFile] = File([]), logo: List[UploadFile] = File([]), gallery: List[UploadFile] = File([]), user: Optional[User] = Depends(get_current_user_optional)):
    err = lambda es, en, code=400: HTTPException(status_code=code, detail={"error": es, "errorEn": en})  # noqa: E731
    if not _origin_ok(request):
        raise err("Origen no permitido.", "Origin not allowed.", 403)
    if website_extra:  # honeypot
        raise err("Solicitud rechazada.", "Request rejected.")
    ip = _client_ip(request)
    if not _rate_ok(f"ip:{ip}", 5, 3600) or (user and not _rate_ok(f"u:{user.id}", 5, 3600)):
        raise err("Has alcanzado el límite de solicitudes por ahora. Inténtalo más tarde o escribe a bruno@brunocard.com.", "You have reached the request limit for now. Try later or email bruno@brunocard.com.", 429)
    try:
        req_id = str(uuid.UUID(requestId))
    except ValueError:
        raise err("Referencia inválida.", "Invalid reference.")
    if await db.service_requests.find_one({"id": req_id}, {"_id": 1}):  # idempotencia
        return {"id": req_id, "emailStatus": (await db.service_requests.find_one({"id": req_id}, {"_id": 0, "email_status": 1}))["email_status"]}
    if consent != "on":
        raise err("Debes autorizar el uso de tus materiales para continuar.", "You must authorize the use of your materials to continue.")
    if type not in TYPES:
        raise err("Tipo de tarjeta inválido.", "Invalid card type.")
    if market not in OFFERS:
        raise err("Selecciona Colombia o Estados Unidos para conocer la oferta disponible.", "Select Colombia or United States to see the available offer.")
    email_c = _clean(email, 120).lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$", email_c):
        raise err("Correo inválido.", "Invalid email.")
    total = [0]
    items = await _read_files(documents, "documents", DOC_TYPES, total) + await _read_files(logo, "logo", IMG_TYPES, total) + await _read_files(gallery, "gallery", IMG_TYPES, total)
    stored = [await asyncio.to_thread(_store_private, req_id, it) for it in items]
    offer = OFFERS[market]  # importe calculado en servidor: se ignora cualquier amount/currency del cliente
    rec = {"id": req_id, "created_at": _now().isoformat(), "market": market, "language": "en" if language == "en" else "es", "currency": offer["currency"], "amount": offer["amount"],
           "type": type, "name": _clean(name, 120), "email": email_c, "phone": _clean(phone, 40), "card_name": _clean(cardName, 120), "template": _clean(template, 60), "description": _clean(description, 4000),
           "links": _clean(links, 2000), "notes": _clean(notes, 2000), "consent_at": _now().isoformat(), "files": stored, "user_id": user.id if user else None, "ip_hash": __import__("hashlib").sha256(ip.encode()).hexdigest()[:16],
           "payment_status": "unpaid", "email_status": "pending", "email_attempts": 0, "recipient": RECIPIENT}
    await db.service_requests.insert_one(dict(rec))
    await _deliver(req_id, attempts=1)
    rec2 = await db.service_requests.find_one({"id": req_id}, {"_id": 0, "email_status": 1})
    if rec2["email_status"] == "failed":
        asyncio.create_task(_deliver(req_id, attempts=3))
    return {"id": req_id, "emailStatus": rec2["email_status"]}


# ---------- administración (acceso privado) ----------
def _admin(user: User):
    if getattr(user, "role", None) not in ("admin", "superadmin") and not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Solo administradores")


@router.get("/requests")
async def list_requests(status: Optional[str] = None, user: User = Depends(get_current_user)):
    _admin(user)
    q = {"email_status": status} if status else {}
    rows = await db.service_requests.find(q, {"_id": 0, "files.public_id": 0}).sort("created_at", -1).to_list(200)
    return rows


@router.get("/requests/{req_id}/files")
async def request_files(req_id: str, user: User = Depends(get_current_user)):
    _admin(user)
    rec = await db.service_requests.find_one({"id": req_id}, {"_id": 0, "files": 1})
    if not rec:
        raise HTTPException(status_code=404, detail="No encontrada")
    return [{"field": f["field"], "name": f["name"], "size": f["size"], "url": _signed_url(f)} for f in rec["files"]]


@router.post("/requests/{req_id}/resend")
async def resend_request(req_id: str, user: User = Depends(get_current_user)):
    _admin(user)
    if not await db.service_requests.find_one({"id": req_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="No encontrada")
    await _deliver(req_id, attempts=1)
    return await db.service_requests.find_one({"id": req_id}, {"_id": 0, "id": 1, "email_status": 1, "email_attempts": 1, "email_error": 1})


@router.post("/requests/{req_id}/payment")
async def mark_payment(req_id: str, body: dict, user: User = Depends(get_current_user)):
    """Conciliación administrativa: solo un administrador marca pagado, con referencia del proveedor. Nunca el cliente."""
    _admin(user)
    status = body.get("status")
    if status not in ("unpaid", "paid", "refunded"):
        raise HTTPException(status_code=400, detail="Estado inválido")
    r = await db.service_requests.update_one({"id": req_id}, {"$set": {"payment_status": status, "payment_reference": _clean(body.get("reference"), 120), "payment_marked_by": user.id, "payment_marked_at": _now().isoformat()}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="No encontrada")
    return {"ok": True}
