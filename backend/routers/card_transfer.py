"""Card transfer phone-to-phone (NFC tap / QR / link): short-lived tokens that let another
person save a Digital Business Card into their BRUNO wallet."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import base64
import io
import os
import secrets
import logging

import qrcode

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user, get_current_user_optional
from models.user import User

router = APIRouter(tags=["card-transfer"])
logger = logging.getLogger(__name__)

TOKEN_TTL_MIN = 15


def _frontend_url() -> str:
    return (os.environ.get("FRONTEND_URL") or "").rstrip("/")


def _qr_data_url(url: str, color: str) -> str:
    qr = qrcode.QRCode(version=2, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color=color or "#FF5A00", back_color="white").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


async def _sender_brief(user_id: str) -> dict:
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1, "email": 1}) or {}
    p = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0, "display_name": 1, "avatar_url": 1}) or {}
    name = u.get("name") or (u.get("email") or "Usuario").split("@")[0]
    return {"id": user_id, "name": p.get("display_name") or name, "avatar_url": p.get("avatar_url")}


@router.post("/cards/{card_id}/transfer-token")
async def create_transfer_token(card_id: str, current_user: User = Depends(get_current_user)):
    card = await db.cards.find_one({"id": card_id, "user_id": current_user.id}, {"_id": 0, "id": 1, "background_color": 1})
    if not card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(6)
    url = f"{_frontend_url()}/t/{token}"
    doc = {"token": token, "card_id": card_id, "from_user_id": current_user.id, "created_at": now.isoformat(),
           "expires_at": (now + timedelta(minutes=TOKEN_TTL_MIN)).isoformat(), "accepted_by": [], "opens": 0}
    await db.card_transfers.insert_one(dict(doc))
    return {"token": token, "url": url, "expires_at": doc["expires_at"], "ttl_seconds": TOKEN_TTL_MIN * 60,
            "qr_code": _qr_data_url(url, card.get("background_color"))}


@router.get("/transfer/{token}")
async def resolve_transfer(token: str, current_user: Optional[User] = Depends(get_current_user_optional)):
    t = await db.card_transfers.find_one({"token": token}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")
    expired = t["expires_at"] <= datetime.now(timezone.utc).isoformat()
    card = await db.cards.find_one({"id": t["card_id"]}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="La tarjeta ya no existe")
    await db.card_transfers.update_one({"token": token}, {"$inc": {"opens": 1}})
    already = bool(current_user and current_user.id in (t.get("accepted_by") or []))
    is_owner = bool(current_user and current_user.id == t["from_user_id"])
    receivers = []
    if is_owner and t.get("accepted_by"):
        async for u in db.users.find({"id": {"$in": t["accepted_by"]}}, {"_id": 0, "id": 1, "name": 1}):
            receivers.append({"id": u["id"], "name": u.get("name") or "Usuario"})
    return {"token": token, "expired": expired, "expires_at": t["expires_at"], "card": card,
            "sender": await _sender_brief(t["from_user_id"]), "is_owner": is_owner,
            "already_saved": already, "accepted_count": len(t.get("accepted_by") or []), "receivers": receivers}


@router.post("/transfer/{token}/accept")
async def accept_transfer(token: str, via: str = "link", current_user: User = Depends(get_current_user)):
    t = await db.card_transfers.find_one({"token": token}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")
    if t["expires_at"] <= datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=410, detail="Esta transferencia expiró. Pide que la vuelvan a compartir.")
    if t["from_user_id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Esta tarjeta ya es tuya")
    now = datetime.now(timezone.utc).isoformat()
    await db.received_cards.update_one(
        {"user_id": current_user.id, "card_id": t["card_id"]},
        {"$set": {"from_user_id": t["from_user_id"], "received_at": now, "via": via}, "$setOnInsert": {"first_received_at": now}},
        upsert=True)
    await db.card_transfers.update_one({"token": token}, {"$addToSet": {"accepted_by": current_user.id}})
    try:
        from routers.posts_feed import _push_notification
        await _push_notification(user_id=t["from_user_id"], actor_id=current_user.id, ntype="card_received", target_id=t["card_id"], target_type="card",
                                 message=f"{current_user.name or 'Alguien'} guardó tu tarjeta")
    except Exception as e:
        logger.warning(f"card_received notification failed: {e}")
    return {"saved": True, "card_id": t["card_id"]}


@router.get("/transfer/received/mine")
async def my_received_cards(current_user: User = Depends(get_current_user)):
    rows = await db.received_cards.find({"user_id": current_user.id}, {"_id": 0}).sort("received_at", -1).to_list(200)
    ids = [r["card_id"] for r in rows]
    cards = {c["id"]: c async for c in db.cards.find({"id": {"$in": ids}}, {"_id": 0})}
    out = []
    for r in rows:
        c = cards.get(r["card_id"])
        if c:
            out.append({**c, "received_at": r["received_at"], "via": r.get("via"), "sender": await _sender_brief(r["from_user_id"])})
    return out


@router.delete("/transfer/received/{card_id}")
async def remove_received_card(card_id: str, current_user: User = Depends(get_current_user)):
    res = await db.received_cards.delete_one({"user_id": current_user.id, "card_id": card_id})
    return {"deleted": res.deleted_count}
