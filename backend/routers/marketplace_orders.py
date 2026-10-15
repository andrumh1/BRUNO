"""Marketplace checkout + orders (community sellers). One Stripe payment for the whole cart; BRUNO splits to each seller.

Single seller  → destination charge (transfer_data + application_fee) exactly like the rest of BRUNO.
Several sellers → charge on BRUNO + one stripe.Transfer per seller (source_transaction = charge) when the payment is confirmed.
Ledger: one parent entry (kind=marketplace_order, is_parent) + one child entry per seller (kind=marketplace) so earnings,
refunds and reports stay per seller. PIUP (OVC) never goes through here: it is a platform sale (routers/piup.py).
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import stripe

from utils.database import db
from utils.security import get_current_user
from models.user import User
from routers import money

router = APIRouter(prefix="/marketplace", tags=["marketplace-orders"])

ORDER_STATUSES = ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded", "partially_refunded", "disputed", "failed", "expired"]
SELLER_TRANSITIONS = {"paid": ["processing", "shipped", "cancelled"], "processing": ["shipped", "cancelled"], "shipped": ["delivered"]}
STATUS_LABEL = {"pending_payment": "Pendiente de pago", "paid": "Pagado", "processing": "Preparando", "shipped": "Enviado", "delivered": "Entregado", "cancelled": "Cancelado",
                "refunded": "Reembolsado", "partially_refunded": "Reembolso parcial", "disputed": "En disputa", "failed": "Pago rechazado", "expired": "Expirado"}
CARRIERS: List[dict] = []  # Se llenará cuando OVC contrate transportadoras; la UI muestra el espacio reservado.


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class CartQty(BaseModel):
    quantity: int = Field(..., ge=1, le=50)


class Address(BaseModel):
    name: str
    phone: Optional[str] = None
    line1: str
    line2: Optional[str] = None
    city: str
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "CO"
    notes: Optional[str] = None


class CheckoutBody(BaseModel):
    origin_url: str
    delivery: dict = {}  # seller_id -> "ship" | "chat"
    address: Optional[Address] = None
    discount_code: Optional[str] = None


class StatusBody(BaseModel):
    status: str
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    note: Optional[str] = None


@router.put("/cart/{product_id}")
async def set_cart_quantity(product_id: str, body: CartQty, current_user: User = Depends(get_current_user)):
    p = await db.marketplace_products.find_one({"id": product_id}, {"_id": 0, "stock": 1})
    if p and p.get("stock") is not None and p["stock"] < body.quantity:
        raise HTTPException(status_code=400, detail=f"Solo quedan {p['stock']} unidades")
    res = await db.shopping_carts.update_one({"user_id": current_user.id, "items.product_id": product_id}, {"$set": {"items.$.quantity": body.quantity}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Producto no está en el carrito")
    return {"status": "updated"}


async def _cart_groups(user_id: str):
    """Cart grouped by seller, with live product data, stock and seller payout readiness."""
    cart = await db.shopping_carts.find_one({"user_id": user_id}, {"_id": 0}) or {"items": []}
    groups, problems, currency = {}, [], None
    for it in cart.get("items", []):
        p = await db.marketplace_products.find_one({"id": it["product_id"]}, {"_id": 0})
        if not p or p.get("status") != "active":
            problems.append({"product_id": it["product_id"], "issue": "unavailable", "message": "Ya no está disponible"})
            continue
        if p.get("stock") is not None and p["stock"] < it["quantity"]:
            problems.append({"product_id": p["id"], "issue": "stock", "message": f"Solo quedan {p['stock']} unidades de {p['title']}"})
        cur = (p.get("currency") or "USD").lower()
        currency = currency or cur
        if cur != currency:
            problems.append({"product_id": p["id"], "issue": "currency", "message": "Todos los productos deben estar en la misma moneda"})
        sid = p["seller_id"]
        g = groups.setdefault(sid, {"seller_id": sid, "items": [], "subtotal": 0.0, "shipping": 0.0, "can_ship": True, "can_chat": True, "currency": cur})
        line = {"product_id": p["id"], "title": p["title"], "image": (p.get("images") or [None])[0], "price": float(p["price"]), "quantity": it["quantity"], "subtotal": round(float(p["price"]) * it["quantity"], 2),
                "stock": p.get("stock"), "shipping_available": bool(p.get("shipping_available")), "shipping_cost": float(p.get("shipping_cost") or 0), "chat_delivery": p.get("chat_delivery", True)}
        g["items"].append(line)
        g["subtotal"] = round(g["subtotal"] + line["subtotal"], 2)
        g["can_ship"] = g["can_ship"] and line["shipping_available"]
        g["can_chat"] = g["can_chat"] and bool(line["chat_delivery"])
        g["shipping"] = round(g["shipping"] + (line["shipping_cost"] if line["shipping_available"] else 0), 2)
    for sid, g in groups.items():
        u = await db.users.find_one({"id": sid}, {"_id": 0, "name": 1, "username": 1, "avatar_url": 1})
        acct = await db.connected_accounts.find_one({"user_id": sid}, {"_id": 0, "transfers_active": 1, "payouts_enabled": 1, "account_id": 1})
        g["seller"] = {"id": sid, "name": (u or {}).get("name") or "Vendedor", "username": (u or {}).get("username"), "avatar_url": (u or {}).get("avatar_url")}
        g["seller_ready"] = bool(acct and (acct.get("transfers_active") or acct.get("payouts_enabled")))
        g["account_id"] = (acct or {}).get("account_id")
    return list(groups.values()), problems, currency or "usd"


@router.get("/cart/summary")
async def cart_summary(current_user: User = Depends(get_current_user)):
    groups, problems, currency = await _cart_groups(current_user.id)
    fees = await money.get_fees()
    return {"groups": groups, "problems": problems, "currency": currency, "carriers": CARRIERS, "bruno_fee_pct": fees["marketplace_pct"],
            "subtotal": round(sum(g["subtotal"] for g in groups), 2), "items_count": sum(len(g["items"]) for g in groups)}


@router.post("/checkout")
async def marketplace_checkout(body: CheckoutBody, current_user: User = Depends(get_current_user)):
    groups, problems, cur = await _cart_groups(current_user.id)
    if not groups:
        raise HTTPException(status_code=400, detail="Tu carrito está vacío")
    if problems:
        raise HTTPException(status_code=400, detail={"code": "cart_problems", "problems": problems})
    not_ready = [g["seller"]["name"] for g in groups if not g["seller_ready"]]
    if not_ready:
        raise HTTPException(status_code=409, detail={"code": "seller_not_ready", "message": f"Estos vendedores aún no activaron sus cobros en BRUNO: {', '.join(not_ready)}. Elimina sus productos del carrito o espera a que los activen."})
    fees = await money.get_fees()
    pct = fees["marketplace_pct"]
    order_id = str(uuid.uuid4())
    line_items, children, total_minor, fee_total = [], [], 0, 0
    for g in groups:
        mode = body.delivery.get(g["seller_id"]) or ("ship" if g["can_ship"] else "chat")
        if mode == "ship" and not g["can_ship"]:
            raise HTTPException(status_code=400, detail=f"{g['seller']['name']} no ofrece envío a domicilio para todos sus productos")
        if mode == "ship" and not body.address:
            raise HTTPException(status_code=400, detail="Indica la dirección de envío")
        if mode == "chat" and not g["can_chat"]:
            raise HTTPException(status_code=400, detail=f"{g['seller']['name']} solo entrega por envío")
        sub_minor = sum(money.to_minor(i["subtotal"], cur) for i in g["items"])
        ship_minor = money.to_minor(g["shipping"], cur) if mode == "ship" else 0
        fee = int(round(sub_minor * pct / 100))
        for i in g["items"]:
            line_items.append({"price_data": {"currency": cur, "unit_amount": money.to_minor(i["price"], cur), "product_data": {"name": i["title"][:120]}}, "quantity": i["quantity"]})
        if ship_minor:
            line_items.append({"price_data": {"currency": cur, "unit_amount": ship_minor, "product_data": {"name": f"Envío · {g['seller']['name']}"[:120]}}, "quantity": 1})
        children.append({"id": str(uuid.uuid4()), "seller_id": g["seller_id"], "seller_account": g["account_id"], "items": g["items"], "subtotal_minor": sub_minor, "shipping_minor": ship_minor, "fee_minor": fee,
                         "seller_net_minor": sub_minor - fee + ship_minor, "total_minor": sub_minor + ship_minor, "delivery_mode": mode, "name": ", ".join(i["title"] for i in g["items"])[:140]})
        total_minor += sub_minor + ship_minor
        fee_total += fee
    if total_minor < money.MIN_CHARGE.get(cur, 50):
        raise HTTPException(status_code=400, detail="Importe inferior al mínimo permitido")
    single = children[0] if len(children) == 1 else None
    origin = body.origin_url.rstrip("/")
    kwargs = dict(mode="payment", line_items=line_items, client_reference_id=order_id,
                  success_url=f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&kind=marketplace_order&ref={order_id}",
                  cancel_url=f"{origin}/payment/cancel?kind=marketplace_order&ref={order_id}",
                  metadata={"ledger_id": order_id, "kind": "marketplace_order", "buyer_id": current_user.id},
                  payment_intent_data={"metadata": {"ledger_id": order_id, "kind": "marketplace_order"}, "transfer_group": order_id})
    if single:
        kwargs["payment_intent_data"].update({"application_fee_amount": single["fee_minor"], "transfer_data": {"destination": single["seller_account"]}})
    try:
        session = stripe.checkout.Session.create(**kwargs, idempotency_key=f"mkt-{order_id}")
    except stripe.error.StripeError as e:
        raise money._stripe_unavailable(e)
    ts = now_iso()
    base = {"buyer_id": current_user.id, "currency": cur, "status": "initiated", "session_id": session.id, "payment_intent": None, "refunded_minor": 0, "disputed": False, "discount_minor": 0, "discount_code": None,
            "quantity": 1, "fee_pct": pct, "created_at": ts, "updated_at": ts, "fee_snapshot": fees, "origin_url": origin}
    parent = {**base, "id": order_id, "kind": "marketplace_order", "ref_id": order_id, "seller_id": None, "seller_account": None, "is_parent": True, "subtotal_minor": total_minor - sum(c["shipping_minor"] for c in children),
              "shipping_minor": sum(c["shipping_minor"] for c in children), "total_minor": total_minor, "fee_minor": fee_total, "seller_net_minor": 0, "platform_revenue_minor": fee_total,
              "name": f"Pedido Marketplace · {sum(len(c['items']) for c in children)} productos", "split_mode": "destination" if single else "transfers",
              "meta": {"children": [c["id"] for c in children], "address": body.address.model_dump() if body.address else None}}
    await db.ledger_entries.insert_one(dict(parent))
    for c in children:
        await db.ledger_entries.insert_one({**base, **{k: c[k] for k in ("id", "seller_id", "seller_account", "subtotal_minor", "shipping_minor", "fee_minor", "seller_net_minor", "total_minor", "name")},
                                            "kind": "marketplace", "ref_id": order_id, "parent_id": order_id, "platform_revenue_minor": c["fee_minor"],
                                            "meta": {"order_id": order_id, "items": c["items"], "delivery_mode": c["delivery_mode"], "needs_transfer": not single}})
        await db.marketplace_orders.insert_one({"id": c["id"], "order_id": order_id, "ledger_id": c["id"], "buyer_id": current_user.id, "seller_id": c["seller_id"], "items": c["items"], "currency": cur,
                                                "subtotal_minor": c["subtotal_minor"], "shipping_minor": c["shipping_minor"], "total_minor": c["total_minor"], "bruno_fee_minor": c["fee_minor"], "seller_net_minor": c["seller_net_minor"],
                                                "delivery_mode": c["delivery_mode"], "address": body.address.model_dump() if (body.address and c["delivery_mode"] == "ship") else None,
                                                "status": "pending_payment", "history": [{"status": "pending_payment", "at": ts, "by": current_user.id}], "carrier": None, "tracking_number": None,
                                                "paid_in_bruno": True, "created_at": ts, "updated_at": ts})
    return {"checkout_url": session.url, "session_id": session.id, "order_id": order_id, "total": money.fmt_minor(total_minor, cur), "currency": cur, "sellers": len(children)}


def _order_out(o: dict) -> dict:
    cur = o["currency"]
    return {**o, "status_label": STATUS_LABEL.get(o["status"], o["status"]), "subtotal": money.fmt_minor(o["subtotal_minor"], cur), "shipping": money.fmt_minor(o["shipping_minor"], cur),
            "total": money.fmt_minor(o["total_minor"], cur), "bruno_fee": money.fmt_minor(o["bruno_fee_minor"], cur), "seller_net": money.fmt_minor(o["seller_net_minor"], cur),
            "refunded": money.fmt_minor(int(o.get("refunded_minor") or 0), cur)}


async def _with_people(orders: List[dict]) -> List[dict]:
    ids = {o["buyer_id"] for o in orders} | {o["seller_id"] for o in orders}
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": list(ids)}}, {"_id": 0, "id": 1, "name": 1, "username": 1, "avatar_url": 1}).to_list(len(ids) or 1)}
    out = []
    for o in orders:
        out.append({**_order_out(o), "buyer": users.get(o["buyer_id"], {"id": o["buyer_id"], "name": "Comprador"}), "seller": users.get(o["seller_id"], {"id": o["seller_id"], "name": "Vendedor"})})
    return out


@router.get("/orders/mine")
async def my_orders(current_user: User = Depends(get_current_user)):
    rows = await db.marketplace_orders.find({"buyer_id": current_user.id, "status": {"$nin": ["pending_payment", "expired", "failed"]}}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"orders": await _with_people(rows), "statuses": STATUS_LABEL}


@router.get("/orders/sales")
async def my_sales(status: Optional[str] = None, current_user: User = Depends(get_current_user)):
    q = {"seller_id": current_user.id, "status": {"$nin": ["pending_payment", "expired", "failed"]}}
    if status:
        q["status"] = status
    rows = await db.marketplace_orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(300)
    counts = {}
    async for d in db.marketplace_orders.aggregate([{"$match": {"seller_id": current_user.id}}, {"$group": {"_id": "$status", "n": {"$sum": 1}}}]):
        counts[d["_id"]] = d["n"]
    return {"orders": await _with_people(rows), "counts": counts, "statuses": STATUS_LABEL, "carriers": CARRIERS}


@router.get("/orders/{order_id}")
async def get_order(order_id: str, current_user: User = Depends(get_current_user)):
    o = await db.marketplace_orders.find_one({"id": order_id}, {"_id": 0})
    if not o or current_user.id not in (o["buyer_id"], o["seller_id"]) and not money.is_admin(current_user):
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return (await _with_people([o]))[0]


@router.get("/orders/by-ledger/{ledger_id}")
async def orders_by_ledger(ledger_id: str, current_user: User = Depends(get_current_user)):
    rows = await db.marketplace_orders.find({"order_id": ledger_id, "buyer_id": current_user.id}, {"_id": 0}).to_list(50)
    return {"orders": await _with_people(rows)}


@router.patch("/orders/{order_id}/status")
async def update_status(order_id: str, body: StatusBody, current_user: User = Depends(get_current_user)):
    o = await db.marketplace_orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    is_seller, is_buyer = o["seller_id"] == current_user.id, o["buyer_id"] == current_user.id
    if is_seller:
        allowed = SELLER_TRANSITIONS.get(o["status"], [])
    elif is_buyer:
        allowed = ["delivered"] if o["status"] in ("shipped", "processing", "paid") else []
    else:
        raise HTTPException(status_code=403, detail="Sin permiso")
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"No puedes pasar de «{STATUS_LABEL.get(o['status'])}» a «{STATUS_LABEL.get(body.status, body.status)}»")
    if body.status == "cancelled" and o["status"] in ("paid", "processing"):
        # El vendedor cancela → reembolso completo al comprador por la vía oficial (Stripe); el estado final lo fija el webhook.
        await money.refund(money.RefundBody(ledger_id=o["ledger_id"], reason=body.note or "Cancelado por el vendedor"), current_user)
    upd = {"status": body.status, "updated_at": now_iso()}
    if body.tracking_number is not None:
        upd["tracking_number"] = body.tracking_number
    if body.carrier is not None:
        upd["carrier"] = body.carrier
    await db.marketplace_orders.update_one({"id": order_id}, {"$set": upd, "$push": {"history": {"status": body.status, "at": now_iso(), "by": current_user.id, "note": body.note}}})
    try:
        target = o["buyer_id"] if is_seller else o["seller_id"]
        notif = {"id": str(uuid.uuid4()), "user_id": target, "actor_id": current_user.id, "type": "order_status", "message": f"Pedido {order_id[:8].upper()} · {STATUS_LABEL.get(body.status, body.status)}",
                 "from_user_id": current_user.id, "target_id": order_id, "target_type": "marketplace_order", "url": "/purchases" if is_seller else "/marketplace/my-products?tab=orders", "is_read": False, "created_at": now_iso()}
        await db.notifications.insert_one(dict(notif))
        from utils.notification_realtime import emit_notification_ws
        await emit_notification_ws(notif)
        from routers.push_notifications import send_push_notification, NotificationPayload
        await send_push_notification(target, NotificationPayload(title="Pedido actualizado", body=notif["message"], url=notif["url"], tag=f"order_{order_id}_{body.status}", data={"category": "order_updates"}))
    except Exception:
        pass
    return (await _with_people([await db.marketplace_orders.find_one({"id": order_id}, {"_id": 0})]))[0]
