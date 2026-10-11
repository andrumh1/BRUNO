"""Créditos BRUNO (saldo del espectador, USD en centavos) + catálogo de regalos con comisión y precio congelados por operación."""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.security import get_current_user
from utils.database import db
from models.user import User

router = APIRouter(prefix="/api/credits", tags=["credits"])
logger = logging.getLogger(__name__)
now_iso = lambda: datetime.now(timezone.utc).isoformat()

CREDIT_PACKS = {"c5": {"usd": 500, "name": "5 USD en créditos"}, "c10": {"usd": 1000, "name": "10 USD en créditos"}, "c20": {"usd": 2000, "name": "20 USD en créditos"}, "c50": {"usd": 5000, "name": "50 USD en créditos"}}
DEFAULT_GIFTS = [
    ("heart", "Corazón BRUNO", "❤️", 50), ("rose", "Rosa", "🌹", 100), ("clap", "Aplausos", "👏", 200), ("coffee", "Café", "☕", 300), ("star", "Estrella", "⭐", 500),
    ("butterfly", "Mariposa", "🦋", 800), ("fire", "Fuego", "🔥", 1000), ("crown", "Corona", "👑", 1500), ("diamond", "Diamante", "💎", 2500), ("rocket", "Cohete", "🚀", 5000), ("octopus", "Pulpo Dorado", "🐙", 10000),
]


async def ensure_gift_catalog():
    if await db.gift_catalog.count_documents({}) == 0:
        await db.gift_catalog.insert_many([{"id": g[0], "name": g[1], "emoji": g[2], "image_url": None, "animation": "float", "price_minor": g[3], "currency": "usd", "active": True, "sort": i, "created_at": now_iso()} for i, g in enumerate(DEFAULT_GIFTS)])


async def _gift_fee_pct() -> float:
    from routers.money import get_fees as _fees
    return float((await _fees()).get("gift_pct", 20.0))


async def wallet_of(user_id: str) -> dict:
    w = await db.credit_wallets.find_one({"user_id": user_id}, {"_id": 0})
    if not w:
        w = {"user_id": user_id, "balance_minor": 0, "currency": "usd", "created_at": now_iso()}
        await db.credit_wallets.update_one({"user_id": user_id}, {"$setOnInsert": w}, upsert=True)
    return w


async def credit_wallet(user_id: str, amount_minor: int, ledger_id: str, note: str) -> bool:
    """Abono idempotente (una compra verificada = un movimiento)."""
    if await db.credit_movements.find_one({"ledger_id": ledger_id, "kind": "purchase"}, {"_id": 0, "id": 1}):
        return False
    await wallet_of(user_id)
    await db.credit_wallets.update_one({"user_id": user_id}, {"$inc": {"balance_minor": int(amount_minor)}, "$set": {"updated_at": now_iso()}})
    await db.credit_movements.insert_one({"id": str(uuid.uuid4()), "user_id": user_id, "kind": "purchase", "amount_minor": int(amount_minor), "currency": "usd", "ledger_id": ledger_id, "note": note, "created_at": now_iso()})
    return True


@router.get("/packs")
async def packs():
    return [{"id": k, **v} for k, v in CREDIT_PACKS.items()]


@router.get("/gifts")
async def gifts():
    await ensure_gift_catalog()
    docs = await db.gift_catalog.find({"active": True}, {"_id": 0}).sort("sort", 1).to_list(100)
    return {"gifts": docs, "bruno_fee_pct": await _gift_fee_pct(), "currency": "usd"}


@router.get("/wallet")
async def wallet(current_user: User = Depends(get_current_user)):
    w = await wallet_of(current_user.id)
    moves = await db.credit_movements.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).limit(30).to_list(30)
    return {"balance_minor": int(w.get("balance_minor") or 0), "balance": int(w.get("balance_minor") or 0) / 100, "currency": "usd", "movements": moves, "packs": [{"id": k, **v} for k, v in CREDIT_PACKS.items()]}


class GiftBody(BaseModel):
    live_id: str
    gift_id: str
    quantity: int = Field(1, ge=1, le=50)


@router.post("/gift")
async def send_gift(body: GiftBody, current_user: User = Depends(get_current_user)):
    """Gasto de créditos: débito atómico (sin saldo negativo ni doble gasto) + regalo + ingreso del creador en una operación."""
    from routers.lives import _broadcast
    live = await db.lives.find_one({"id": body.live_id, "status": "live"}, {"_id": 0, "id": 1, "host_id": 1, "allow_gifts": 1, "banned_user_ids": 1, "is_private": 1})
    if not live:
        raise HTTPException(status_code=404, detail="El live no está activo")
    if live.get("allow_gifts") is False:
        raise HTTPException(status_code=403, detail="El anfitrión desactivó los regalos")
    if live["host_id"] == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes regalarte a ti mismo")
    if current_user.id in (live.get("banned_user_ids") or []):
        raise HTTPException(status_code=403, detail="No puedes interactuar en este live")
    if live.get("is_private") and not await db.live_access.find_one({"live_id": live["id"], "user_id": current_user.id, "revoked": {"$ne": True}}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=403, detail="No tienes acceso a este live")
    await ensure_gift_catalog()
    g = await db.gift_catalog.find_one({"id": body.gift_id, "active": True}, {"_id": 0})
    if not g:
        raise HTTPException(status_code=404, detail="Regalo no disponible")
    total = int(g["price_minor"]) * body.quantity
    pct = await _gift_fee_pct()
    fee = int(round(total * pct / 100))
    w = await wallet_of(current_user.id)
    debited = await db.credit_wallets.find_one_and_update({"user_id": current_user.id, "balance_minor": {"$gte": total}}, {"$inc": {"balance_minor": -total}, "$set": {"updated_at": now_iso()}})
    if not debited:
        raise HTTPException(status_code=402, detail={"code": "credits_required", "message": "Saldo insuficiente", "balance_minor": int(w.get("balance_minor") or 0), "needed_minor": total, "currency": "usd"})
    ts = now_iso()
    ledger = {"id": str(uuid.uuid4()), "kind": "gift", "ref_id": live["id"], "buyer_id": current_user.id, "seller_id": live["host_id"], "seller_account": None, "currency": "usd", "subtotal_minor": total, "discount_minor": 0, "discount_code": None,
              "shipping_minor": 0, "total_minor": total, "fee_pct": pct, "fee_minor": fee, "seller_net_minor": total - fee, "platform_revenue_minor": fee, "refunded_minor": 0, "disputed": False, "status": "paid", "paid_via": "credits",
              "session_id": None, "payment_intent": f"credits:{uuid.uuid4().hex[:12]}", "meta": {"live_id": live["id"], "gift_id": g["id"], "quantity": body.quantity, "gift_price_minor": g["price_minor"]}, "name": f"{g['emoji']} {g['name']} ×{body.quantity}",
              "quantity": body.quantity, "created_at": ts, "paid_at": ts, "updated_at": ts}
    await db.ledger_entries.insert_one(dict(ledger))
    await db.credit_movements.insert_one({"id": str(uuid.uuid4()), "user_id": current_user.id, "kind": "gift", "amount_minor": -total, "currency": "usd", "ledger_id": ledger["id"], "live_id": live["id"], "note": ledger["name"], "created_at": ts})
    gift_doc = {"id": str(uuid.uuid4()), "live_id": live["id"], "from_user_id": current_user.id, "sender_name": current_user.name, "receiver_id": live["host_id"], "gift_id": g["id"], "gift_type": g["id"], "emoji": g["emoji"], "name": g["name"],
                "quantity": body.quantity, "amount_minor": total, "fee_pct": pct, "fee_minor": fee, "creator_net_minor": total - fee, "currency": "usd", "paid": True, "paid_via": "credits", "ledger_id": ledger["id"], "created_at": ts}
    await db.live_gifts.insert_one(dict(gift_doc))
    await db.lives.update_one({"id": live["id"]}, {"$inc": {"total_gifts": body.quantity, "paid_gift_revenue_minor": total, "gift_creator_net_minor": total - fee}})
    await _broadcast(live["id"], {"type": "gift", "gift_type": g["id"], "emoji": g["emoji"], "name": g["name"], "amount": body.quantity, "value": total / 100, "paid": True, "currency": "usd", "user_name": current_user.name or "Alguien", "animation": g.get("animation", "float")})
    return {"sent": True, "gift": {"id": g["id"], "name": g["name"], "emoji": g["emoji"]}, "quantity": body.quantity, "total_minor": total, "balance_minor": int(debited.get("balance_minor", 0)) - total}


class GiftPatch(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    image_url: Optional[str] = None
    animation: Optional[str] = None
    price: Optional[float] = Field(None, ge=0.5)
    active: Optional[bool] = None
    sort: Optional[int] = None


@router.get("/admin/gifts")
async def admin_gifts(current_user: User = Depends(get_current_user)):
    from routers.money import is_admin
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo administración")
    await ensure_gift_catalog()
    return await db.gift_catalog.find({}, {"_id": 0}).sort("sort", 1).to_list(200)


@router.patch("/admin/gifts/{gift_id}")
async def admin_patch_gift(gift_id: str, body: GiftPatch, current_user: User = Depends(get_current_user)):
    from routers.money import is_admin
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo administración")
    changes = {k: v for k, v in body.model_dump().items() if v is not None and k != "price"}
    if body.price is not None:
        changes["price_minor"] = int(round(body.price * 100))
    if not changes:
        raise HTTPException(status_code=400, detail="Nada que cambiar")
    changes["updated_at"] = now_iso()
    r = await db.gift_catalog.update_one({"id": gift_id}, {"$set": changes})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Regalo no encontrado")
    return await db.gift_catalog.find_one({"id": gift_id}, {"_id": 0})
