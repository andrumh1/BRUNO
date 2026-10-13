"""PIUP (OVC) administration: catalog, inventory, orders. Only BRUNO admins. Kept apart from community sellers' data."""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.database import db
from utils.security import get_current_user
from models.user import User
from routers.money import is_admin, fmt_minor
from routers.piup import PIUP_CATALOG, CATEGORY_LABELS, DEFAULT_COLORS, SIZE_TABLE, SHAPE_LABEL

router = APIRouter(prefix="/piup/admin", tags=["piup-admin"])

PIUP_STATUSES = ["pending_payment", "paid", "processing", "encoding", "shipped", "delivered", "cancelled", "refunded", "partially_refunded", "failed", "expired"]
PIUP_STATUS_LABEL = {"pending_payment": "Pendiente de pago", "paid": "Pagado", "processing": "En producción", "encoding": "Grabando NFC", "shipped": "Enviado", "delivered": "Entregado",
                     "cancelled": "Cancelado", "refunded": "Reembolsado", "partially_refunded": "Reembolso parcial", "failed": "Pago rechazado", "expired": "Expirado", "pending": "Solicitud manual"}
TRANSITIONS = {"paid": ["processing", "encoding", "shipped", "cancelled"], "pending": ["processing", "cancelled"], "processing": ["encoding", "shipped", "cancelled"], "encoding": ["shipped", "cancelled"], "shipped": ["delivered"]}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def _admin(user: User):
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores de BRUNO/OVC")


async def ensure_piup_catalog_seeded():
    """Idempotent: copies the static catalog into piup_products once, keeping admin edits afterwards."""
    for p in PIUP_CATALOG:
        await db.piup_products.update_one({"id": p["id"]}, {"$setOnInsert": {**p, "active": True, "stock": None, "sold": 0, "images": [], "description": "", "official": True, "brand": "PIUP · OVC",
                                                                              "created_at": now_iso(), "updated_at": now_iso()}}, upsert=True)


async def db_catalog(include_inactive: bool = False) -> List[dict]:
    q = {} if include_inactive else {"active": {"$ne": False}}
    rows = await db.piup_products.find(q, {"_id": 0}).to_list(500)
    if not rows and not include_inactive:
        await ensure_piup_catalog_seeded()
        rows = await db.piup_products.find(q, {"_id": 0}).to_list(500)
    order = {p["id"]: i for i, p in enumerate(PIUP_CATALOG)}
    rows.sort(key=lambda r: (order.get(r["id"], 999), r.get("name", "")))
    return rows


class ProductBody(BaseModel):
    name: str
    category: str
    base_price: float = Field(..., gt=0)
    styles: List[str] = ["R7"]
    schema_id: Optional[str] = None
    description: Optional[str] = ""
    images: List[str] = []
    stock: Optional[int] = None
    active: bool = True


class ProductPatch(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    base_price: Optional[float] = Field(None, gt=0)
    styles: Optional[List[str]] = None
    description: Optional[str] = None
    images: Optional[List[str]] = None
    stock: Optional[int] = None
    unlimited_stock: Optional[bool] = None
    active: Optional[bool] = None


class StockBody(BaseModel):
    delta: int
    note: Optional[str] = None


class OrderStatusBody(BaseModel):
    status: str
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    note: Optional[str] = None


@router.get("/products")
async def admin_products(current_user: User = Depends(get_current_user)):
    _admin(current_user)
    await ensure_piup_catalog_seeded()
    return {"products": await db_catalog(include_inactive=True), "categories": [{"id": k, "label": v} for k, v in CATEGORY_LABELS.items()], "sizes": SIZE_TABLE, "shapes": SHAPE_LABEL, "colors": DEFAULT_COLORS}


@router.post("/products", status_code=201)
async def admin_create_product(body: ProductBody, current_user: User = Depends(get_current_user)):
    _admin(current_user)
    if body.category not in CATEGORY_LABELS:
        raise HTTPException(status_code=400, detail="Categoría PIUP no válida")
    doc = {"id": f"piup-{uuid.uuid4().hex[:8]}", **body.model_dump(), "sold": 0, "official": True, "brand": "PIUP · OVC", "created_at": now_iso(), "updated_at": now_iso(), "created_by": current_user.id}
    await db.piup_products.insert_one(dict(doc))
    return doc


@router.patch("/products/{product_id}")
async def admin_patch_product(product_id: str, body: ProductPatch, current_user: User = Depends(get_current_user)):
    _admin(current_user)
    upd = {k: v for k, v in body.model_dump().items() if v is not None and k != "unlimited_stock"}
    if body.unlimited_stock:
        upd["stock"] = None
    upd["updated_at"] = now_iso()
    upd["updated_by"] = current_user.id
    res = await db.piup_products.update_one({"id": product_id}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Producto PIUP no encontrado")
    return await db.piup_products.find_one({"id": product_id}, {"_id": 0})


@router.post("/products/{product_id}/stock")
async def admin_adjust_stock(product_id: str, body: StockBody, current_user: User = Depends(get_current_user)):
    _admin(current_user)
    p = await db.piup_products.find_one({"id": product_id}, {"_id": 0, "stock": 1})
    if not p:
        raise HTTPException(status_code=404, detail="Producto PIUP no encontrado")
    new_stock = max(0, int(p.get("stock") or 0) + body.delta)
    await db.piup_products.update_one({"id": product_id}, {"$set": {"stock": new_stock, "updated_at": now_iso()}, "$push": {"stock_log": {"delta": body.delta, "result": new_stock, "note": body.note, "by": current_user.id, "at": now_iso()}}})
    return {"id": product_id, "stock": new_stock}


@router.get("/orders")
async def admin_orders(status: Optional[str] = None, current_user: User = Depends(get_current_user)):
    _admin(current_user)
    q = {"status": status} if status else {"status": {"$nin": ["pending_payment", "expired", "failed"]}}
    rows = await db.piup_orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    ids = list({r["user_id"] for r in rows})
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "name": 1, "username": 1, "email": 1}).to_list(len(ids) or 1)}
    counts = {}
    async for d in db.piup_orders.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]):
        counts[d["_id"]] = d["n"]
    return {"orders": [{**r, "status_label": PIUP_STATUS_LABEL.get(r.get("status"), r.get("status")), "buyer": users.get(r["user_id"], {"id": r["user_id"], "name": "Usuario"})} for r in rows], "counts": counts, "statuses": PIUP_STATUS_LABEL, "carriers": []}


@router.patch("/orders/{order_id}/status")
async def admin_order_status(order_id: str, body: OrderStatusBody, current_user: User = Depends(get_current_user)):
    _admin(current_user)
    o = await db.piup_orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido PIUP no encontrado")
    cur = o.get("status")
    if body.status not in TRANSITIONS.get(cur, []):
        raise HTTPException(status_code=400, detail=f"No puedes pasar de «{PIUP_STATUS_LABEL.get(cur, cur)}» a «{PIUP_STATUS_LABEL.get(body.status, body.status)}»")
    if body.status == "cancelled" and o.get("ledger_id") and o.get("payment_status") == "paid":
        from routers.money import refund, RefundBody
        await refund(RefundBody(ledger_id=o["ledger_id"], reason=body.note or "Cancelado por OVC"), current_user)
    upd = {"status": body.status, "updated_at": now_iso()}
    if body.tracking_number is not None:
        upd["tracking_number"] = body.tracking_number
    if body.carrier is not None:
        upd["carrier"] = body.carrier
    await db.piup_orders.update_one({"id": order_id}, {"$set": upd, "$push": {"history": {"status": body.status, "at": now_iso(), "by": current_user.id, "note": body.note}}})
    try:
        notif = {"id": str(uuid.uuid4()), "user_id": o["user_id"], "actor_id": current_user.id, "type": "order_status", "message": f"Tu pedido PIUP {order_id[:8].upper()} · {PIUP_STATUS_LABEL.get(body.status, body.status)}",
                 "from_user_id": current_user.id, "target_id": order_id, "target_type": "piup_order", "url": "/piup?tab=my-tags", "is_read": False, "created_at": now_iso()}
        await db.notifications.insert_one(dict(notif))
        from utils.notification_realtime import emit_notification_ws
        await emit_notification_ws(notif)
    except Exception:
        pass
    return await db.piup_orders.find_one({"id": order_id}, {"_id": 0})


@router.get("/stats")
async def admin_stats(current_user: User = Depends(get_current_user)):
    _admin(current_user)
    entries = await db.ledger_entries.find({"kind": "piup", "status": {"$in": ["paid", "partially_refunded", "refunded"]}}, {"_id": 0, "currency": 1, "total_minor": 1, "refunded_minor": 1, "paid_at": 1}).to_list(5000)
    rev = {}
    for e in entries:
        c = rev.setdefault(e["currency"], {"gross": 0, "refunds": 0, "count": 0})
        c["gross"] += e["total_minor"]
        c["refunds"] += int(e.get("refunded_minor") or 0)
        c["count"] += 1
    for cur, c in rev.items():
        c["net"] = fmt_minor(c["gross"] - c["refunds"], cur)
        c["gross"] = fmt_minor(c["gross"], cur)
        c["refunds"] = fmt_minor(c["refunds"], cur)
    by_status = {}
    async for d in db.piup_orders.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]):
        by_status[d["_id"]] = d["n"]
    top = await db.piup_products.find({}, {"_id": 0, "id": 1, "name": 1, "sold": 1, "stock": 1, "active": 1}).sort("sold", -1).to_list(10)
    low = await db.piup_products.find({"stock": {"$ne": None, "$lte": 5}}, {"_id": 0, "id": 1, "name": 1, "stock": 1}).to_list(50)
    return {"revenue": rev, "orders_by_status": by_status, "top_products": top, "low_stock": low, "note": "Ingresos PIUP = ventas comerciales de OVC; no incluyen comisiones ni ventas de usuarios del Marketplace."}
