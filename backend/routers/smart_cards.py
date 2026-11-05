"""Tarjetas inteligentes BRUNO: eventos con álbum colaborativo, invitaciones, conexiones entre tarjetas y modelo comercial
(activación única por país, almacenamiento ampliable, plantillas premium y productos futuros apagados por defecto)."""
import asyncio
import hashlib
import logging
import os
import secrets
import uuid
from datetime import timedelta
from typing import Optional, List
from urllib.parse import urlencode

import cloudinary.uploader
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel

from models.user import User
from utils.database import db
from utils.security import get_current_user, get_current_user_optional
from routers.bruno_service import _now
from routers.bruno_orders import _frontend, _notify_user, _provider_ready, _stripe, _stripe_verify, _wompi_transaction
from routers.bruno_packages import is_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/smart", tags=["smart-cards"])

GB, MB = 1024 ** 3, 1024 ** 2
PRICE_KEYS = ("US", "CO")
CURRENCY = {"US": "USD", "CO": "COP"}

# Valores iniciales editables por el administrador (nada se cobra hasta que `activation.payments_enabled` sea true).
DEFAULT_SETTINGS = {
    "activation": {"payments_enabled": False, "prices": {"US": 9.99, "CO": 39900}, "label": {"es": "Activación única de tarjeta de evento", "en": "One-time event card activation"}},
    "storage": {"included_bytes": 1 * GB, "max_photos": 500, "max_file_bytes": 15 * MB, "retention_days": 730,
                "packs": [{"id": "pack_1gb", "label": "+1 GB · +500 fotos", "bytes": 1 * GB, "photos": 500, "prices": {"US": 4.99, "CO": 19900}, "active": True},
                          {"id": "pack_5gb", "label": "+5 GB · +2.500 fotos", "bytes": 5 * GB, "photos": 2500, "prices": {"US": 14.99, "CO": 59900}, "active": True}]},
    "templates": {"default_price": {"US": 1.99, "CO": 7900}, "items": [
        {"id": "tpl_noche_dorada", "name": "Noche Dorada", "preview_url": "https://static.prod-images.emergentagent.com/jobs/d5c2203f-7366-4e40-a5aa-1a3322d709a0/images/836a6b3965af0ff37752bb973924bf3c3832371ace30242aab3fd6fdaad452c2.jpeg", "prices": {"US": 1.99, "CO": 7900}, "active": True, "exclusive": False,
         "theme": {"bg": "#0f0e0c", "fg": "#f5efe0", "accent": "#d4a53a", "card": "#1a1813", "font": "Georgia, 'Times New Roman', serif", "pattern": "radial-gradient(circle at 20% 10%, rgba(212,165,58,.25), transparent 45%), radial-gradient(circle at 80% 90%, rgba(212,165,58,.18), transparent 50%)"}}]},
    "future_products": [  # preparados; ninguno cobra ni se activa sin configuración comercial aprobada
        {"id": "album_expanded", "label": "Álbumes con almacenamiento ampliado", "enabled": False, "prices": None},
        {"id": "exclusive_templates", "label": "Plantillas exclusivas", "enabled": False, "prices": None},
        {"id": "custom_design", "label": "Personalizaciones especiales", "enabled": False, "prices": None},
        {"id": "organizer_pro", "label": "Funciones avanzadas para organizadores", "enabled": False, "prices": None},
        {"id": "event_stats", "label": "Estadísticas profesionales de eventos", "enabled": False, "prices": None},
        {"id": "promotions", "label": "Promociones comerciales", "enabled": False, "prices": None},
        {"id": "business_packs", "label": "Paquetes de tarjetas para empresas", "enabled": False, "prices": None},
    ],
    "free_policy": {"view_public": True, "connections": True, "basic_interactions": True, "existing_free_cards_unchanged": True},
}


def _price_label(amount, market):
    return f"COP ${int(amount):,}".replace(",", ".") if market == "CO" else f"US${amount:,.2f}"


async def get_settings() -> dict:
    doc = await db.commerce_settings.find_one({"_id": "smart_cards"})
    if not doc:
        doc = {"_id": "smart_cards", **DEFAULT_SETTINGS, "updated_at": _now().isoformat(), "history": []}
        await db.commerce_settings.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


def _public_settings(s: dict) -> dict:
    return {"activation": {"payments_enabled": s["activation"]["payments_enabled"], "prices": s["activation"]["prices"], "labels": {m: _price_label(s["activation"]["prices"][m], m) for m in PRICE_KEYS}},
            "storage": {k: s["storage"][k] for k in ("included_bytes", "max_photos", "max_file_bytes", "retention_days")},
            "packs": [{**p, "labels": {m: _price_label(p["prices"][m], m) for m in PRICE_KEYS}} for p in s["storage"]["packs"] if p.get("active")],
            "templates": {"default_price": s["templates"]["default_price"], "items": [t for t in s["templates"]["items"] if t.get("active")]},
            "future_products": [{"id": f["id"], "label": f["label"], "enabled": f["enabled"]} for f in s["future_products"]],
            "free_policy": s["free_policy"], "providers": {"US": _provider_ready("US"), "CO": _provider_ready("CO")}}


@router.get("/settings")
async def public_settings():
    return _public_settings(await get_settings())


@router.get("/admin/settings")
async def admin_settings(user: User = Depends(get_current_user)):
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    return await get_settings()


class SettingsPatch(BaseModel):
    activation: Optional[dict] = None
    storage: Optional[dict] = None
    templates: Optional[dict] = None
    future_products: Optional[List[dict]] = None


@router.put("/admin/settings")
async def update_settings(body: SettingsPatch, user: User = Depends(get_current_user)):
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    cur = await get_settings()
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    for f in patch.get("future_products", []):
        if f.get("enabled") and not (f.get("prices") and all(f["prices"].get(m) for m in PRICE_KEYS)):
            raise HTTPException(status_code=400, detail=f"«{f.get('label', f.get('id'))}» necesita precio en USD y COP antes de activarse")
    def _prices_ok(pr):
        return isinstance(pr, dict) and all(isinstance(pr.get(m), (int, float)) and pr[m] > 0 for m in PRICE_KEYS)
    if "activation" in patch and "prices" in patch["activation"] and not _prices_ok(patch["activation"]["prices"]):
        raise HTTPException(status_code=400, detail="La activación necesita precios mayores que 0 en USD y COP")
    st = patch.get("storage") or {}
    for k in ("included_bytes", "max_photos", "max_file_bytes", "retention_days"):
        if k in st and not (isinstance(st[k], (int, float)) and st[k] > 0):
            raise HTTPException(status_code=400, detail=f"«{k}» debe ser un número mayor que 0")
    for pk in st.get("packs", []):
        if not (pk.get("id") and isinstance(pk.get("bytes"), (int, float)) and pk["bytes"] > 0 and isinstance(pk.get("photos"), (int, float)) and pk["photos"] > 0 and _prices_ok(pk.get("prices"))):
            raise HTTPException(status_code=400, detail=f"El paquete «{pk.get('label', pk.get('id'))}» necesita GB, fotos y precios USD/COP mayores que 0")
    if "templates" in patch and "default_price" in patch["templates"] and not _prices_ok(patch["templates"]["default_price"]):
        raise HTTPException(status_code=400, detail="El precio por defecto de plantillas debe ser mayor que 0 en USD y COP")
    for t in (patch.get("templates") or {}).get("items", []):
        if t.get("prices") is not None and not _prices_ok(t["prices"]):
            raise HTTPException(status_code=400, detail=f"La plantilla «{t.get('name') or t.get('id')}» necesita precios USD/COP mayores que 0")
        t.setdefault("id", f"tpl_{secrets.token_hex(3)}"); t.setdefault("prices", cur["templates"]["default_price"]); t.setdefault("active", False)
    merged = {**cur}
    for k, v in patch.items():
        merged[k] = {**cur[k], **v} if isinstance(v, dict) else v
    hist = {"at": _now().isoformat(), "by": user.id, "changed": list(patch.keys())}
    await db.commerce_settings.update_one({"_id": "smart_cards"}, {"$set": {**{k: merged[k] for k in patch}, "updated_at": hist["at"]}, "$push": {"history": {"$each": [hist], "$slice": -50}}})
    return await get_settings()


# ---------- eventos ----------
class EventIn(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None
    market: Optional[str] = "US"
    organizer_card_id: Optional[str] = None
    company_card_id: Optional[str] = None
    template_id: Optional[str] = None
    allow_guest_uploads: Optional[bool] = True
    show_guest_cards: Optional[bool] = True


def _ref():
    return f"EV-{secrets.token_hex(3).upper()}"


async def _get_event(eid: str) -> dict:
    e = await db.events.find_one({"id": eid}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return e


def _storage_view(e: dict, s: dict) -> dict:
    st = e["storage"]
    total_b = st["included_bytes"] + st.get("extra_bytes", 0)
    total_p = st["max_photos"] + st.get("extra_photos", 0)
    return {**st, "total_bytes": total_b, "total_photos": total_p, "free_bytes": max(0, total_b - st.get("used_bytes", 0)), "free_photos": max(0, total_p - st.get("photo_count", 0)),
            "full": st.get("used_bytes", 0) >= total_b or st.get("photo_count", 0) >= total_p}


async def _card_brief(card_id: Optional[str]) -> Optional[dict]:
    if not card_id:
        return None
    c = await db.cards.find_one({"id": card_id, "is_public": True, "is_draft": {"$ne": True}}, {"_id": 0, "id": 1, "user_id": 1, "title": 1, "subtitle": 1, "card_type": 1, "avatar_url": 1, "background_color": 1})
    return c


async def _own_card(card_id: Optional[str], uid: str):
    if card_id and not await db.cards.find_one({"id": card_id, "user_id": uid}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=403, detail="Esa tarjeta no es tuya")


@router.post("/events")
async def create_event(body: EventIn, user: User = Depends(get_current_user)):
    s = await get_settings()
    await _own_card(body.organizer_card_id, user.id); await _own_card(body.company_card_id, user.id)
    if not (body.title or "").strip():
        raise HTTPException(status_code=400, detail="El evento necesita un título")
    market = body.market if body.market in PRICE_KEYS else "US"
    now = _now()
    e = {"id": str(uuid.uuid4()), "ref": _ref(), "owner_id": user.id, **body.model_dump(exclude={"market"}), "market": market,
         "activation": {"status": "pending", "required": True, "price": s["activation"]["prices"][market], "currency": CURRENCY[market]},
         "storage": {"included_bytes": s["storage"]["included_bytes"], "max_photos": s["storage"]["max_photos"], "max_file_bytes": s["storage"]["max_file_bytes"], "retention_days": s["storage"]["retention_days"],
                     "extra_bytes": 0, "extra_photos": 0, "used_bytes": 0, "photo_count": 0, "retain_until": (now + timedelta(days=s["storage"]["retention_days"])).isoformat()},
         "status": "draft", "views": 0, "templates_owned": [], "created_at": now.isoformat(), "updated_at": now.isoformat()}
    await db.events.insert_one(dict(e))
    return _owner_view(e, s)


def _owner_view(e: dict, s: dict) -> dict:
    return {**e, "storage": _storage_view(e, s), "public_url": f"{_frontend()}/e/{e['id']}", "price_label": _price_label(e["activation"]["price"], e["market"])}


@router.get("/events/mine")
async def my_events(user: User = Depends(get_current_user)):
    s = await get_settings()
    rows = await db.events.find({"owner_id": user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [_owner_view(e, s) for e in rows]


@router.get("/events/{eid}/manage")
async def manage_event(eid: str, user: User = Depends(get_current_user)):
    e = await _get_event(eid)
    if e["owner_id"] != user.id and not is_admin(user):
        raise HTTPException(status_code=403, detail="Sin acceso")
    s = await get_settings()
    inv = await db.event_invitations.find({"event_id": eid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    purchases = await db.event_purchases.find({"event_id": eid}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {**_owner_view(e, s), "invitations": inv, "purchases": purchases, "settings": _public_settings(s)}


@router.put("/events/{eid}")
async def update_event(eid: str, body: EventIn, user: User = Depends(get_current_user)):
    e = await _get_event(eid)
    if e["owner_id"] != user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    await _own_card(body.organizer_card_id, user.id); await _own_card(body.company_card_id, user.id)
    data = body.model_dump(exclude={"market"}, exclude_unset=True)
    if data.get("template_id"):
        s = await get_settings()
        tpl = next((t for t in s["templates"]["items"] if t["id"] == data["template_id"] and t.get("active")), None)
        if not tpl:
            raise HTTPException(status_code=404, detail="Plantilla no disponible")
        if data["template_id"] not in (e.get("templates_owned") or []) and not is_admin(user):
            raise HTTPException(status_code=402, detail={"code": "template_required", "message": f"La plantilla «{tpl['name']}» es premium: cómprala para usarla"})
    await db.events.update_one({"id": eid}, {"$set": {**data, "updated_at": _now().isoformat()}})
    return _owner_view(await _get_event(eid), await get_settings())


@router.post("/events/{eid}/publish")
async def publish_event(eid: str, user: User = Depends(get_current_user)):
    e = await _get_event(eid)
    if e["owner_id"] != user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    if e["activation"]["status"] not in ("paid", "granted"):
        raise HTTPException(status_code=402, detail={"code": "activation_required", "message": "Activa la tarjeta de evento para publicarla"})
    await db.events.update_one({"id": eid}, {"$set": {"status": "active", "published_at": _now().isoformat()}})
    return {"status": "active"}


@router.post("/admin/events/{eid}/grant")
async def grant_activation(eid: str, user: User = Depends(get_current_user)):
    """Activación manual por un administrador (cortesía, pago fuera de línea o pruebas); queda auditada."""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    e = await _get_event(eid)
    await db.events.update_one({"id": eid}, {"$set": {"activation.status": "granted", "activation.granted_by": user.id, "activation.at": _now().isoformat()}})
    await _notify_user(e["owner_id"], "event_activated", f"Tu tarjeta de evento «{e['title']}» ya está activa.", eid, f"/events/{eid}/manage", "BRUNO · Eventos")
    return {"status": "granted"}


# ---------- invitaciones ----------
class InvitationIn(BaseModel):
    guest_name: str
    message: Optional[str] = None
    seats: Optional[int] = 1


@router.post("/events/{eid}/invitations")
async def create_invitation(eid: str, body: InvitationIn, user: User = Depends(get_current_user)):
    e = await _get_event(eid)
    if e["owner_id"] != user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    inv = {"id": str(uuid.uuid4()), "event_id": eid, "guest_name": body.guest_name.strip()[:80], "message": (body.message or "").strip()[:400], "seats": max(1, min(20, body.seats or 1)),
           "rsvp": "pending", "linked_user_id": None, "linked_card_id": None, "show_card": False, "views": 0, "created_at": _now().isoformat()}
    await db.event_invitations.insert_one(dict(inv))
    return {**inv, "url": f"{_frontend()}/e/{eid}/i/{inv['id']}"}


@router.delete("/events/{eid}/invitations/{iid}")
async def delete_invitation(eid: str, iid: str, user: User = Depends(get_current_user)):
    e = await _get_event(eid)
    if e["owner_id"] != user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    await db.event_invitations.delete_one({"id": iid, "event_id": eid})
    return {"deleted": True}


class RsvpIn(BaseModel):
    rsvp: Optional[str] = None
    card_id: Optional[str] = None
    show_card: Optional[bool] = None


@router.post("/invitations/{iid}/respond")
async def respond_invitation(iid: str, body: RsvpIn, user: User = Depends(get_current_user)):
    """Requiere sesión: confirmar asistencia y/o vincular la tarjeta personal del invitado (autorizando o no mostrarla en conexiones)."""
    inv = await db.event_invitations.find_one({"id": iid}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    if inv.get("linked_user_id") and inv["linked_user_id"] != user.id:
        raise HTTPException(status_code=409, detail="Esta invitación ya fue vinculada por otra cuenta")
    e = await _get_event(inv["event_id"])
    if e["owner_id"] == user.id:
        raise HTTPException(status_code=403, detail="El organizador no puede responder sus propias invitaciones")
    upd = {"linked_user_id": user.id, "linked_at": _now().isoformat()}
    if body.rsvp in ("yes", "no", "maybe"):
        upd["rsvp"] = body.rsvp
    if body.card_id is not None:
        if body.card_id:
            await _own_card(body.card_id, user.id)
        upd["linked_card_id"] = body.card_id or None
    if body.show_card is not None:
        upd["show_card"] = bool(body.show_card)
    await db.event_invitations.update_one({"id": iid}, {"$set": upd})
    if upd.get("rsvp"):
        await _notify_user(e["owner_id"], "event_rsvp", f"{inv['guest_name']} respondió «{ {'yes': 'asistiré', 'no': 'no asistiré', 'maybe': 'quizás'}[upd['rsvp']] }» a «{e['title']}».", e["id"], f"/events/{e['id']}/manage", "BRUNO · Eventos")
    return await db.event_invitations.find_one({"id": iid}, {"_id": 0})


# ---------- vistas públicas (sin cuenta) ----------
def _event_public(e: dict, s: dict) -> dict:
    keep = ("id", "ref", "title", "date", "end_date", "location", "description", "cover_url", "status", "template_id", "allow_guest_uploads", "show_guest_cards", "owner_id", "created_at")
    tpl = next((t for t in s["templates"]["items"] if t["id"] == e.get("template_id")), None) if e.get("template_id") else None
    return {**{k: e.get(k) for k in keep}, "theme": (tpl or {}).get("theme"), "storage": {k: v for k, v in _storage_view(e, s).items() if k in ("total_photos", "photo_count", "free_photos", "full", "max_file_bytes", "free_bytes")}}


async def _connections_for_event(e: dict) -> List[dict]:
    """Empresa → Evento → Invitación → Organizador → Tarjeta personal. Solo tarjetas públicas y vinculaciones autorizadas."""
    out = []
    org = await _card_brief(e.get("organizer_card_id"))
    if org:
        out.append({"role": "organizer", "label": "Organiza", **org})
    comp = await _card_brief(e.get("company_card_id"))
    if comp:
        out.append({"role": "company", "label": "Empresa", **comp})
    if org:
        others = await db.cards.find({"user_id": org["user_id"], "id": {"$nin": [org["id"], e.get("company_card_id")]}, "is_public": True, "is_draft": {"$ne": True}}, {"_id": 0, "id": 1, "user_id": 1, "title": 1, "subtitle": 1, "card_type": 1, "avatar_url": 1, "background_color": 1}).limit(4).to_list(4)
        out += [{"role": "service", "label": "Servicios del organizador", **c} for c in others]
    if e.get("show_guest_cards", True):
        inv = await db.event_invitations.find({"event_id": e["id"], "show_card": True, "linked_card_id": {"$ne": None}}, {"_id": 0, "linked_card_id": 1}).limit(12).to_list(12)
        for i in inv:
            c = await _card_brief(i["linked_card_id"])
            if c:
                out.append({"role": "guest", "label": "Invitado", **c})
    return out


@router.get("/events/{eid}/public")
async def public_event(eid: str, request: Request, user: Optional[User] = Depends(get_current_user_optional)):
    e = await _get_event(eid)
    is_owner = bool(user and user.id == e["owner_id"])
    if e["status"] != "active" and not is_owner and not (user and is_admin(user)):
        raise HTTPException(status_code=404, detail="Este evento aún no está publicado")
    s = await get_settings()
    if not is_owner:
        await db.events.update_one({"id": eid}, {"$inc": {"views": 1}})
    photos = await db.event_photos.find({"event_id": eid, "hidden": {"$ne": True}}, {"_id": 0, "id": 1, "url": 1, "thumb_url": 1, "caption": 1, "uploader_name": 1, "uploader_id": 1, "created_at": 1, "bytes": 1}).sort("created_at", -1).limit(60).to_list(60)
    guests = await db.event_invitations.count_documents({"event_id": eid, "rsvp": "yes"})
    return {"event": _event_public(e, s), "photos": photos, "going": guests, "connections": await _connections_for_event(e), "viewer": {"logged_in": bool(user), "is_owner": is_owner},
            "join_benefits": ["Sube tus fotos al álbum del evento", "Confirma tu asistencia y vincula tu tarjeta", "Crea tu propia tarjeta digital gratis", "Descubre perfiles y servicios conectados"]}


@router.get("/events/{eid}/photos")
async def event_photos(eid: str, before: Optional[str] = None, limit: int = 40, user: Optional[User] = Depends(get_current_user_optional)):
    e = await _get_event(eid)
    if e["status"] != "active" and not (user and (user.id == e["owner_id"] or is_admin(user))):
        raise HTTPException(status_code=404, detail="Evento no publicado")
    q = {"event_id": eid, "hidden": {"$ne": True}}
    if before:
        q["created_at"] = {"$lt": before}
    return await db.event_photos.find(q, {"_id": 0, "id": 1, "url": 1, "thumb_url": 1, "caption": 1, "uploader_name": 1, "uploader_id": 1, "created_at": 1}).sort("created_at", -1).limit(min(limit, 100)).to_list(100)


@router.get("/invitations/{iid}/public")
async def public_invitation(iid: str, user: Optional[User] = Depends(get_current_user_optional)):
    inv = await db.event_invitations.find_one({"id": iid}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    e = await _get_event(inv["event_id"])
    is_owner = bool(user and user.id == e["owner_id"])
    if e["status"] != "active" and not is_owner and not (user and is_admin(user)):
        raise HTTPException(status_code=404, detail="Este evento aún no está publicado")
    s = await get_settings()
    if not is_owner:
        await db.event_invitations.update_one({"id": iid}, {"$inc": {"views": 1}})
    mine = bool(user and inv.get("linked_user_id") == user.id)
    pub = {k: inv.get(k) for k in ("id", "event_id", "guest_name", "message", "seats", "rsvp", "created_at")}
    pub["linked"] = bool(inv.get("linked_user_id")); pub["linked_card_id"] = inv.get("linked_card_id") if (mine or inv.get("show_card")) else None; pub["show_card"] = inv.get("show_card", False); pub["is_mine"] = mine
    return {"invitation": pub, "event": _event_public(e, s), "connections": await _connections_for_event(e), "viewer": {"logged_in": bool(user), "is_owner": is_owner, "can_respond": bool(user) and not is_owner and (not inv.get("linked_user_id") or mine)},
            "join_benefits": ["Confirma tu asistencia en un toque", "Vincula tu tarjeta personal y deja que te descubran", "Sube fotos al álbum del evento", "Tu tarjeta digital BRUNO es gratis"]}


# ---------- álbum colaborativo ----------
@router.post("/events/{eid}/photos")
async def upload_photo(eid: str, file: UploadFile = File(...), caption: str = Form(""), user: User = Depends(get_current_user)):
    """Invitados y organizador suben gratis mientras haya capacidad. Nunca se borran fotos al llegar al límite: solo se bloquean nuevas subidas."""
    e = await _get_event(eid)
    s = await get_settings()
    is_owner = user.id == e["owner_id"]
    if e["status"] != "active" and not is_owner:
        raise HTTPException(status_code=404, detail="Evento no publicado")
    if not is_owner and not e.get("allow_guest_uploads", True):
        raise HTTPException(status_code=403, detail="El organizador cerró las subidas de invitados")
    if (file.content_type or "").split("/")[0] != "image":
        raise HTTPException(status_code=400, detail="Solo se admiten imágenes")
    data = await file.read()
    size = len(data)
    st = _storage_view(e, s)
    if size > st["max_file_bytes"]:
        raise HTTPException(status_code=413, detail=f"La foto supera el máximo de {st['max_file_bytes'] // MB} MB")
    if st["full"] or size > st["free_bytes"] or st["free_photos"] < 1:
        raise HTTPException(status_code=409, detail={"code": "album_full", "message": "El álbum alcanzó su capacidad. El organizador puede ampliarlo sin perder las fotos existentes."})
    try:
        up = await asyncio.to_thread(cloudinary.uploader.upload, data, folder=f"bruno/events/{eid}", resource_type="image", quality="auto", fetch_format="auto")
    except Exception as ex:
        logger.warning(f"event photo upload failed: {ex}")
        raise HTTPException(status_code=502, detail="No pudimos guardar la foto. Inténtalo de nuevo.")
    bytes_stored = int(up.get("bytes") or size)
    thumb = up["secure_url"].replace("/upload/", "/upload/c_fill,w_400,h_400,q_auto,f_auto/")
    doc = {"id": str(uuid.uuid4()), "event_id": eid, "uploader_id": user.id, "uploader_name": user.name, "url": up["secure_url"], "thumb_url": thumb, "public_id": up.get("public_id"), "bytes": bytes_stored, "caption": caption.strip()[:200], "hidden": False, "created_at": _now().isoformat()}
    await db.event_photos.insert_one(dict(doc))
    await db.events.update_one({"id": eid}, {"$inc": {"storage.used_bytes": bytes_stored, "storage.photo_count": 1}})
    doc.pop("public_id", None)
    return doc


@router.delete("/events/{eid}/photos/{pid}")
async def delete_photo(eid: str, pid: str, user: User = Depends(get_current_user)):
    e = await _get_event(eid)
    ph = await db.event_photos.find_one({"id": pid, "event_id": eid}, {"_id": 0})
    if not ph:
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    if user.id not in (e["owner_id"], ph["uploader_id"]) and not is_admin(user):
        raise HTTPException(status_code=403, detail="Solo el organizador o quien la subió puede borrarla")
    await db.event_photos.delete_one({"id": pid})
    await db.events.update_one({"id": eid}, {"$inc": {"storage.used_bytes": -ph["bytes"], "storage.photo_count": -1}})
    if ph.get("public_id"):
        asyncio.create_task(asyncio.to_thread(cloudinary.uploader.destroy, ph["public_id"]))
    return {"deleted": True}


# ---------- conexiones desde cualquier tarjeta ----------
@router.get("/cards/{card_id}/connections")
async def card_connections(card_id: str):
    """Tarjeta personal/empresa → eventos públicos que organiza o respalda + invitaciones autorizadas + otras tarjetas públicas del mismo dueño."""
    c = await _card_brief(card_id)
    if not c:
        return {"items": []}
    items = []
    evs = await db.events.find({"status": "active", "$or": [{"organizer_card_id": card_id}, {"company_card_id": card_id}]}, {"_id": 0, "id": 1, "title": 1, "date": 1, "cover_url": 1, "organizer_card_id": 1}).sort("date", -1).limit(6).to_list(6)
    items += [{"role": "event", "label": "Organiza" if ev.get("organizer_card_id") == card_id else "Respalda", "type": "event", "id": ev["id"], "title": ev["title"], "subtitle": ev.get("date"), "avatar_url": ev.get("cover_url")} for ev in evs]
    inv = await db.event_invitations.find({"linked_card_id": card_id, "show_card": True}, {"_id": 0, "event_id": 1}).limit(6).to_list(6)
    for i in inv:
        ev = await db.events.find_one({"id": i["event_id"], "status": "active"}, {"_id": 0, "id": 1, "title": 1, "date": 1, "cover_url": 1})
        if ev:
            items.append({"role": "attends", "label": "Asiste a", "type": "event", "id": ev["id"], "title": ev["title"], "subtitle": ev.get("date"), "avatar_url": ev.get("cover_url")})
    others = await db.cards.find({"user_id": c["user_id"], "id": {"$ne": card_id}, "is_public": True, "is_draft": {"$ne": True}}, {"_id": 0, "id": 1, "title": 1, "subtitle": 1, "card_type": 1, "avatar_url": 1, "background_color": 1}).limit(4).to_list(4)
    items += [{"role": "sibling", "label": "Más del mismo perfil", "type": "card", **o} for o in others]
    return {"items": items}


# ---------- compras: activación y ampliaciones (Stripe EE. UU. / Wompi Colombia) ----------
class PurchaseIn(BaseModel):
    kind: str  # activation | storage_pack | template
    pack_id: Optional[str] = None
    template_id: Optional[str] = None


@router.post("/events/{eid}/checkout")
async def event_checkout(eid: str, body: PurchaseIn, user: User = Depends(get_current_user)):
    e = await _get_event(eid)
    if e["owner_id"] != user.id:
        raise HTTPException(status_code=403, detail="Solo el organizador puede comprar")
    s = await get_settings()
    market = e["market"]
    if not s["activation"]["payments_enabled"]:
        raise HTTPException(status_code=503, detail={"code": "payments_disabled", "message": "Los pagos de tarjetas de evento aún no están habilitados. Escríbenos a bruno@brunocard.com."})
    if not _provider_ready(market):
        raise HTTPException(status_code=503, detail={"code": "provider_unavailable", "message": "El pago en línea no está disponible para tu país en este momento."})
    if body.kind == "activation":
        if e["activation"]["status"] in ("paid", "granted"):
            raise HTTPException(status_code=409, detail="Esta tarjeta ya está activa")
        amount, label = s["activation"]["prices"][market], s["activation"]["label"]["es"]
    elif body.kind == "storage_pack":
        pack = next((p for p in s["storage"]["packs"] if p["id"] == body.pack_id and p.get("active")), None)
        if not pack:
            raise HTTPException(status_code=404, detail="Paquete no disponible")
        amount, label = pack["prices"][market], f"Ampliación de álbum {pack['label']}"
    elif body.kind == "template":
        tpl = next((t for t in s["templates"]["items"] if t["id"] == body.template_id and t.get("active")), None)
        if not tpl:
            raise HTTPException(status_code=404, detail="Plantilla no disponible")
        if body.template_id in (e.get("templates_owned") or []):
            raise HTTPException(status_code=409, detail="Ya tienes esta plantilla")
        amount, label = (tpl.get("prices") or s["templates"]["default_price"])[market], f"Plantilla premium «{tpl['name']}»"
    else:
        raise HTTPException(status_code=400, detail="Producto no válido")
    cents = int(round(amount * 100))
    provider = "wompi" if market == "CO" else "stripe"
    purchase = {"id": str(uuid.uuid4()), "event_id": eid, "user_id": user.id, "kind": body.kind, "pack_id": body.pack_id, "template_id": body.template_id, "amount": amount, "currency": CURRENCY[market], "provider": provider, "status": "initiated", "created_at": _now().isoformat()}
    await db.event_purchases.insert_one(dict(purchase))
    att = {"id": str(uuid.uuid4()), "event_purchase_id": purchase["id"], "order_id": None, "package_id": None, "provider": provider, "amount": amount, "currency": CURRENCY[market], "status": "initiated", "created_at": _now().isoformat()}
    await db.service_payments.insert_one(dict(att))
    base = f"{_frontend()}/events/{eid}/pay"
    if provider == "stripe":
        _stripe()
        session = await asyncio.to_thread(stripe.checkout.Session.create, mode="payment", line_items=[{"quantity": 1, "price_data": {"currency": "usd", "unit_amount": cents, "product_data": {"name": f"BRUNO · {label}", "description": f"Evento {e['ref']} · Octopus Vision Company"}}}],
                                          customer_email=user.email, client_reference_id=purchase["id"], metadata={"order_id": purchase["id"], "attempt_id": att["id"], "kind": "bruno_event"}, payment_intent_data={"metadata": {"order_id": purchase["id"], "kind": "bruno_event"}},
                                          success_url=f"{base}?session_id={{CHECKOUT_SESSION_ID}}&purchase={purchase['id']}", cancel_url=f"{base}?cancel=1&purchase={purchase['id']}", expires_at=int(_now().timestamp()) + 3600)
        await db.service_payments.update_one({"id": att["id"]}, {"$set": {"provider_ref": session.id, "status": "created"}})
        url = session.url
    else:
        reference = f"BE-{purchase['id'][:8].upper()}-{secrets.token_hex(3).upper()}"
        sig = hashlib.sha256(f"{reference}{cents}COP{os.environ['WOMPI_INTEGRITY_SECRET']}".encode()).hexdigest()
        params = {"public-key": os.environ["WOMPI_PUBLIC_KEY"], "currency": "COP", "amount-in-cents": str(cents), "reference": reference, "signature:integrity": sig, "redirect-url": f"{base}?purchase={purchase['id']}", "customer-data:email": user.email, "customer-data:full-name": (user.name or "")[:60]}
        await db.service_payments.update_one({"id": att["id"]}, {"$set": {"provider_ref": reference, "status": "created"}})
        url = "https://checkout.wompi.co/p/?" + urlencode(params)
    await db.event_purchases.update_one({"id": purchase["id"]}, {"$set": {"status": "processing", "provider_ref": att.get("provider_ref")}})
    return {"url": url, "provider": provider, "purchase_id": purchase["id"], "amount": amount, "currency": CURRENCY[market], "label": _price_label(amount, market), "merchant": "Octopus Vision Company (OVC)"}


async def _fulfill(purchase: dict, provider: str, tx_id: str, by: Optional[str]) -> bool:
    """Idempotente: activa la tarjeta o suma capacidad una sola vez; nunca toca las fotos existentes."""
    r = await db.event_purchases.find_one_and_update({"id": purchase["id"], "status": {"$ne": "paid"}}, {"$set": {"status": "paid", "paid_at": _now().isoformat(), "transaction_id": tx_id}})
    if not r:
        return False
    e = await _get_event(purchase["event_id"])
    if purchase["kind"] == "activation":
        await db.events.update_one({"id": e["id"]}, {"$set": {"activation.status": "paid", "activation.at": _now().isoformat(), "activation.provider": provider, "activation.transaction_id": tx_id, "activation.purchase_id": purchase["id"]}})
        await _notify_user(e["owner_id"], "event_activated", f"Pago confirmado: tu tarjeta de evento «{e['title']}» ya está activa.", e["id"], f"/events/{e['id']}/manage", "BRUNO · Eventos")
    elif purchase["kind"] == "template":
        await db.events.update_one({"id": e["id"]}, {"$addToSet": {"templates_owned": purchase["template_id"]}, "$set": {"template_id": purchase["template_id"]}})
        await _notify_user(e["owner_id"], "event_template", f"Plantilla premium aplicada a «{e['title']}».", e["id"], f"/events/{e['id']}/manage", "BRUNO · Eventos")
    else:
        s = await get_settings()
        pack = next((p for p in s["storage"]["packs"] if p["id"] == purchase.get("pack_id")), None) or {"bytes": 0, "photos": 0}
        await db.events.update_one({"id": e["id"]}, {"$inc": {"storage.extra_bytes": pack["bytes"], "storage.extra_photos": pack["photos"]}, "$push": {"storage.packs": {"pack_id": purchase.get("pack_id"), "bytes": pack["bytes"], "photos": pack["photos"], "purchase_id": purchase["id"], "at": _now().isoformat()}}})
        await _notify_user(e["owner_id"], "event_storage", f"Ampliación aplicada al álbum de «{e['title']}».", e["id"], f"/events/{e['id']}/manage", "BRUNO · Eventos")
    return True


async def apply_stripe_event(att: dict, s: dict, by: Optional[str]):
    p = await db.event_purchases.find_one({"id": att["event_purchase_id"]}, {"_id": 0})
    ok = bool(p) and s["paid"] and s["amount"] == int(round(p["amount"] * 100)) and s["currency"] == "USD" and s["order_id"] == p["id"]
    st = "paid" if ok else ("expired" if s["status"] == "expired" else ("mismatch" if s["paid"] else "pending"))
    await db.service_payments.update_one({"id": att["id"]}, {"$set": {"status": st, "payment_intent": s.get("payment_intent"), "verified_at": _now().isoformat()}})
    if ok:
        await _fulfill(p, "stripe", s["id"], by)
    return {"attempt": st}


async def apply_wompi_event(att: dict, tx: dict, by: Optional[str]):
    p = await db.event_purchases.find_one({"id": att["event_purchase_id"]}, {"_id": 0})
    status = tx.get("status")
    ok = bool(p) and status == "APPROVED" and tx.get("amount_in_cents") == int(round(p["amount"] * 100)) and tx.get("currency") == "COP"
    st = "paid" if ok else {"PENDING": "pending", "DECLINED": "failed", "VOIDED": "voided", "ERROR": "failed"}.get(status, "pending")
    await db.service_payments.update_one({"id": att["id"]}, {"$set": {"status": st, "transaction_id": tx.get("id"), "verified_at": _now().isoformat(), "provider_status": status}})
    if ok:
        await _fulfill(p, "wompi", tx["id"], by)
    elif p and st in ("failed", "voided"):
        await db.event_purchases.update_one({"id": p["id"], "status": {"$ne": "paid"}}, {"$set": {"status": "failed"}})
    return {"attempt": st}


@router.get("/events/{eid}/payment-status")
async def event_payment_status(eid: str, purchase: str, session_id: Optional[str] = None, id: Optional[str] = None, cancel: Optional[int] = None, user: User = Depends(get_current_user)):
    e = await _get_event(eid)
    if e["owner_id"] != user.id and not is_admin(user):
        raise HTTPException(status_code=403, detail="Sin acceso")
    p = await db.event_purchases.find_one({"id": purchase, "event_id": eid}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    if p["status"] != "paid":
        try:
            if session_id:
                s = await _stripe_verify(session_id)
                att = await db.service_payments.find_one({"provider": "stripe", "provider_ref": session_id, "event_purchase_id": purchase}, {"_id": 0})
                if att:
                    await apply_stripe_event(att, s, user.id)
            elif id and _provider_ready("CO"):
                tx = await _wompi_transaction(id)
                att = await db.service_payments.find_one({"provider": "wompi", "provider_ref": tx.get("reference"), "event_purchase_id": purchase}, {"_id": 0})
                if att:
                    await apply_wompi_event(att, tx, user.id)
            elif cancel:
                await db.event_purchases.update_one({"id": purchase, "status": "processing"}, {"$set": {"status": "cancelled"}})
        except HTTPException as ex:
            logger.info(f"event payment verify: {ex.detail}")
        except Exception as ex:
            logger.warning(f"event payment verify error: {ex}")
    p = await db.event_purchases.find_one({"id": purchase}, {"_id": 0})
    e = await _get_event(eid)
    return {"purchase": p, "activation": e["activation"]["status"], "storage": _storage_view(e, await get_settings())}


# ---------- reacciones y comentarios en fotos (con sesión; el organizador puede ocultar) ----------
class CommentIn(BaseModel):
    text: str


async def _photo_ctx(eid: str, pid: str):
    e = await _get_event(eid)
    ph = await db.event_photos.find_one({"id": pid, "event_id": eid, "hidden": {"$ne": True}}, {"_id": 0})
    if not ph:
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    return e, ph


@router.get("/events/{eid}/photos/{pid}/social")
async def photo_social(eid: str, pid: str, user: Optional[User] = Depends(get_current_user_optional)):
    e, ph = await _photo_ctx(eid, pid)
    if e["status"] != "active" and not (user and (user.id == e["owner_id"] or is_admin(user))):
        raise HTTPException(status_code=404, detail="Evento no publicado")
    is_owner = bool(user and user.id == e["owner_id"])
    q = {"photo_id": pid} if is_owner else {"photo_id": pid, "hidden": {"$ne": True}}
    comments = await db.event_photo_comments.find(q, {"_id": 0}).sort("created_at", 1).limit(200).to_list(200)
    likes = await db.event_photo_reactions.count_documents({"photo_id": pid})
    liked = bool(user and await db.event_photo_reactions.find_one({"photo_id": pid, "user_id": user.id}, {"_id": 0, "id": 1}))
    return {"likes": likes, "liked": liked, "comments": comments, "viewer": {"logged_in": bool(user), "is_owner": is_owner, "id": user.id if user else None}}


@router.post("/events/{eid}/photos/{pid}/react")
async def toggle_reaction(eid: str, pid: str, user: User = Depends(get_current_user)):
    e, ph = await _photo_ctx(eid, pid)
    key = {"photo_id": pid, "user_id": user.id}
    if await db.event_photo_reactions.find_one(key, {"_id": 0, "id": 1}):
        await db.event_photo_reactions.delete_one(key); liked = False
    else:
        await db.event_photo_reactions.insert_one({"id": str(uuid.uuid4()), **key, "event_id": eid, "emoji": "heart", "created_at": _now().isoformat()}); liked = True
    return {"liked": liked, "likes": await db.event_photo_reactions.count_documents({"photo_id": pid})}


@router.post("/events/{eid}/photos/{pid}/comments")
async def add_comment(eid: str, pid: str, body: CommentIn, user: User = Depends(get_current_user)):
    e, ph = await _photo_ctx(eid, pid)
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Escribe un comentario")
    if await db.event_photo_comments.count_documents({"photo_id": pid, "user_id": user.id, "created_at": {"$gte": (_now() - timedelta(minutes=1)).isoformat()}}) >= 5:
        raise HTTPException(status_code=429, detail="Demasiados comentarios seguidos")
    c = {"id": str(uuid.uuid4()), "photo_id": pid, "event_id": eid, "user_id": user.id, "name": user.name, "text": text[:300], "hidden": False, "created_at": _now().isoformat()}
    await db.event_photo_comments.insert_one(dict(c))
    if ph["uploader_id"] != user.id:
        await _notify_user(ph["uploader_id"], "event_comment", f"{user.name} comentó tu foto en «{e['title']}».", eid, f"/e/{eid}", "BRUNO · Eventos")
    return c


@router.patch("/events/{eid}/photos/{pid}/comments/{cid}")
async def moderate_comment(eid: str, pid: str, cid: str, hidden: bool = True, user: User = Depends(get_current_user)):
    """Solo el organizador (o admin) oculta/restaura; quien escribió el comentario puede borrarlo con DELETE."""
    e = await _get_event(eid)
    if user.id != e["owner_id"] and not is_admin(user):
        raise HTTPException(status_code=403, detail="Solo el organizador puede moderar")
    r = await db.event_photo_comments.update_one({"id": cid, "photo_id": pid}, {"$set": {"hidden": hidden, "moderated_by": user.id, "moderated_at": _now().isoformat()}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    return {"id": cid, "hidden": hidden}


@router.delete("/events/{eid}/photos/{pid}/comments/{cid}")
async def delete_comment(eid: str, pid: str, cid: str, user: User = Depends(get_current_user)):
    c = await db.event_photo_comments.find_one({"id": cid, "photo_id": pid}, {"_id": 0, "user_id": 1})
    if not c:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    if c["user_id"] != user.id and not is_admin(user):
        raise HTTPException(status_code=403, detail="Solo puedes borrar tus comentarios")
    await db.event_photo_comments.delete_one({"id": cid})
    return {"deleted": True}
