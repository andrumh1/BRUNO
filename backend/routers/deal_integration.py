"""DEAL App Integration - Hybrid Architecture.

BRUNO acts as marketplace, catalog, partner system, and sale origin.
Communication is exclusively via API/Webhooks - no shared database.

Outbound: BRUNO → DEAL (send orders on purchase/service request)
Inbound:  DEAL → BRUNO (webhook for payment confirmations)
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Header
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import hashlib
import hmac
import os
import httpx

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from models.user import User
from routers.push_notifications import send_push_notification, NotificationPayload

router = APIRouter(prefix="/deal", tags=["deal-integration"])

DEAL_API_URL = os.environ.get("DEAL_API_URL", "")
DEAL_API_KEY = os.environ.get("DEAL_API_KEY", "")
DEAL_WEBHOOK_SECRET = os.environ.get("DEAL_WEBHOOK_SECRET", "")


# ─── Models ───────────────────────────────────────────────────────────────────

class DealOrderRequest(BaseModel):
    """Data sent from frontend to BRUNO backend to initiate a DEAL order."""
    product_id: str
    product_name: str
    product_type: str = "product"  # product | service
    price: float
    currency: str = "USD"
    quantity: int = 1
    partner_id: Optional[str] = None
    referral_code: Optional[str] = None


class DealOrderOut(BaseModel):
    """Response returned to the frontend after order is sent to DEAL."""
    id: str
    deal_id: Optional[str] = None
    status: str
    product_name: str
    price: float
    currency: str
    created_at: str


class DealWebhookPayload(BaseModel):
    """Payload received from DEAL on payment confirmation."""
    deal_id: str
    order_id: str
    payment_status: str  # paid | failed | refunded
    amount_paid: float
    partner_id: Optional[str] = None
    commission_amount: Optional[float] = None
    service_status: Optional[str] = None  # active | pending | cancelled


# ─── Helpers ──────────────────────────────────────────────────────────────────

def verify_webhook_signature(payload_body: bytes, signature: str) -> bool:
    """Verify HMAC-SHA256 signature from DEAL webhook."""
    if not DEAL_WEBHOOK_SECRET:
        return True  # Skip verification if secret not configured yet
    expected = hmac.new(
        DEAL_WEBHOOK_SECRET.encode(),
        payload_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def send_to_deal_api(order_data: dict) -> dict:
    """Send order to DEAL API. Returns DEAL's response or raises."""
    if not DEAL_API_URL:
        return {"deal_id": None, "message": "DEAL API URL not configured - order stored locally"}

    headers = {"Content-Type": "application/json"}
    if DEAL_API_KEY:
        headers["X-API-Key"] = DEAL_API_KEY

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{DEAL_API_URL.rstrip('/')}/orders",
            json=order_data,
            headers=headers
        )
        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=502,
                detail=f"DEAL API error: {response.status_code} - {response.text}"
            )
        return response.json()


# ─── Webhook Handlers ─────────────────────────────────────────────────────────

PAYMENT_STATUS_MAP = {
    "paid": "paid",
    "failed": "payment_failed",
    "refunded": "refunded",
}


async def _update_order_status(order_id: str, payload: DealWebhookPayload, now: str):
    """Update the local order with DEAL's payment info."""
    update_fields = {
        "deal_id": payload.deal_id,
        "payment_status": payload.payment_status,
        "amount_paid": payload.amount_paid,
        "updated_at": now,
    }
    status = PAYMENT_STATUS_MAP.get(payload.payment_status)
    if status:
        update_fields["status"] = status
    if payload.service_status:
        update_fields["service_status"] = payload.service_status
    if payload.commission_amount is not None:
        update_fields["commission_amount"] = payload.commission_amount

    await db.deal_orders.update_one({"id": order_id}, {"$set": update_fields})


async def _register_commission(payload: DealWebhookPayload, order: dict, now: str):
    """Register partner commission if payment is successful."""
    if payload.payment_status != "paid" or not payload.partner_id or not payload.commission_amount:
        return
    await db.deal_commissions.insert_one({
        "id": str(uuid.uuid4()),
        "deal_id": payload.deal_id,
        "order_id": order["id"],
        "partner_id": payload.partner_id,
        "amount": payload.commission_amount,
        "currency": order.get("currency", "USD"),
        "status": "earned",
        "created_at": now,
    })


async def _activate_product(payload: DealWebhookPayload, order: dict, now: str):
    """Activate the product/service after successful payment."""
    if payload.payment_status != "paid":
        return
    await db.deal_activations.insert_one({
        "id": str(uuid.uuid4()),
        "order_id": order["id"],
        "deal_id": payload.deal_id,
        "user_id": order["user_id"],
        "product_id": order.get("product_id"),
        "product_name": order.get("product_name"),
        "product_type": order.get("product_type", "product"),
        "service_status": payload.service_status or "active",
        "activated_at": now,
    })


async def _notify_partner_commission(payload: DealWebhookPayload, order: dict):
    """Send push notification to partner when they earn a commission."""
    if payload.payment_status != "paid" or not payload.partner_id or not payload.commission_amount:
        return
    currency = order.get("currency", "USD")
    product_name = order.get("product_name", "producto")
    try:
        await send_push_notification(payload.partner_id, NotificationPayload(
            title="Nueva comision DEAL",
            body=f"+${payload.commission_amount:.2f} {currency} por venta de {product_name}",
            icon="/bruno-logo.png",
            url="/partner-dashboard",
            tag="deal_commission",
            renotify=True,
            vibrate=[200, 100, 200],
            actions=[{"action": "view_dashboard", "title": "Ver Dashboard"}],
            data={"type": "deal_commission", "order_id": order["id"], "amount": payload.commission_amount},
        ))
    except Exception:
        pass  # Non-blocking


async def _notify_buyer_payment(payload: DealWebhookPayload, order: dict):
    """Send push notification to buyer about payment status."""
    user_id = order.get("user_id")
    if not user_id:
        return
    product_name = order.get("product_name", "producto")

    if payload.payment_status == "paid":
        title = "Pago confirmado"
        body = f"Tu compra de {product_name} fue procesada exitosamente"
        tag = "deal_payment_success"
    elif payload.payment_status == "failed":
        title = "Pago fallido"
        body = f"No se pudo procesar el pago de {product_name}. Intenta de nuevo."
        tag = "deal_payment_failed"
    elif payload.payment_status == "refunded":
        title = "Reembolso procesado"
        body = f"Se ha reembolsado tu compra de {product_name}"
        tag = "deal_refund"
    else:
        return

    try:
        await send_push_notification(user_id, NotificationPayload(
            title=title,
            body=body,
            icon="/bruno-logo.png",
            url="/marketplace",
            tag=tag,
            vibrate=[100, 50, 100],
            data={"type": "deal_payment", "order_id": order["id"], "status": payload.payment_status},
        ))
    except Exception:
        pass  # Non-blocking


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/send-order", response_model=DealOrderOut)
async def send_order_to_deal(
    req: DealOrderRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Called when user clicks 'Comprar' or 'Solicitar Servicio'.
    Creates a local deal_order record and forwards to DEAL API.
    """
    order_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Build the payload for DEAL
    deal_payload = {
        "order_id": order_id,
        "cliente": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
        },
        "producto": {
            "id": req.product_id,
            "name": req.product_name,
            "type": req.product_type,
            "quantity": req.quantity,
        },
        "precio": req.price * req.quantity,
        "currency": req.currency,
        "partner_id": req.partner_id,
        "referral_code": req.referral_code,
        "origen": "Bruno",
        "estado": "pending_payment",
    }

    # Store order locally first
    local_order = {
        "id": order_id,
        "user_id": current_user.id,
        "deal_id": None,
        "product_id": req.product_id,
        "product_name": req.product_name,
        "product_type": req.product_type,
        "price": req.price,
        "quantity": req.quantity,
        "total": req.price * req.quantity,
        "currency": req.currency,
        "partner_id": req.partner_id,
        "referral_code": req.referral_code,
        "status": "pending_payment",
        "payment_status": None,
        "commission_amount": None,
        "service_status": None,
        "origen": "Bruno",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.deal_orders.insert_one(local_order)

    # Forward to DEAL API
    try:
        deal_response = await send_to_deal_api(deal_payload)
        deal_id = deal_response.get("deal_id") or deal_response.get("id")
        if deal_id:
            await db.deal_orders.update_one(
                {"id": order_id},
                {"$set": {"deal_id": deal_id, "updated_at": now.isoformat()}}
            )
            local_order["deal_id"] = deal_id
    except HTTPException:
        pass  # Order stored locally, DEAL sync will retry
    except Exception:
        pass  # Non-blocking — order is safely stored

    return DealOrderOut(
        id=local_order["id"],
        deal_id=local_order.get("deal_id"),
        status="pending_payment",
        product_name=req.product_name,
        price=req.price * req.quantity,
        currency=req.currency,
        created_at=now.isoformat(),
    )


@router.post("/webhook")
async def deal_webhook(request: Request, x_deal_signature: Optional[str] = Header(None)):
    """
    Webhook endpoint called by DEAL to confirm payment status.
    Updates order, registers partner commission, and activates product/service.
    """
    body = await request.body()

    if x_deal_signature and not verify_webhook_signature(body, x_deal_signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = DealWebhookPayload(**(await request.json()))

    order = await db.deal_orders.find_one(
        {"$or": [{"id": payload.order_id}, {"deal_id": payload.deal_id}]},
        {"_id": 0}
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    now = datetime.now(timezone.utc).isoformat()

    await _update_order_status(order["id"], payload, now)
    await _register_commission(payload, order, now)
    await _activate_product(payload, order, now)

    return {"status": "ok", "order_id": order["id"], "payment_status": payload.payment_status}


@router.get("/orders")
async def get_deal_orders(current_user: User = Depends(get_current_user)):
    """Get all DEAL orders for the current user."""
    orders = await db.deal_orders.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return orders


@router.get("/orders/{order_id}")
async def get_deal_order(order_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific DEAL order."""
    order = await db.deal_orders.find_one(
        {"id": order_id, "user_id": current_user.id},
        {"_id": 0}
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/commissions")
async def get_partner_commissions(current_user: User = Depends(get_current_user)):
    """Get commissions earned as a partner."""
    commissions = await db.deal_commissions.find(
        {"partner_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return commissions


@router.get("/partner/dashboard")
async def get_partner_dashboard(current_user: User = Depends(get_current_user)):
    """Get partner dashboard with metrics, commissions, and performance data."""
    partner_id = current_user.id

    # Commissions
    commissions = await db.deal_commissions.find(
        {"partner_id": partner_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    total_earned = sum(c.get("amount", 0) for c in commissions)
    total_orders = len(commissions)

    # Orders originated by this partner
    partner_orders = await db.deal_orders.find(
        {"partner_id": partner_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    paid_orders = [o for o in partner_orders if o.get("status") == "paid"]
    pending_orders = [o for o in partner_orders if o.get("status") == "pending_payment"]
    total_sales_volume = sum(o.get("total", 0) for o in paid_orders)

    # Monthly breakdown (last 6 months)
    from collections import defaultdict
    monthly = defaultdict(lambda: {"revenue": 0, "commissions": 0, "orders": 0})
    for c in commissions:
        month = c.get("created_at", "")[:7]  # "2026-05"
        if month:
            monthly[month]["commissions"] += c.get("amount", 0)
            monthly[month]["orders"] += 1
    for o in paid_orders:
        month = o.get("created_at", "")[:7]
        if month:
            monthly[month]["revenue"] += o.get("total", 0)

    monthly_data = [{"month": k, **v} for k, v in sorted(monthly.items(), reverse=True)[:6]]

    # Top products
    product_stats = defaultdict(lambda: {"count": 0, "revenue": 0, "name": ""})
    for o in paid_orders:
        pid = o.get("product_id", "unknown")
        product_stats[pid]["count"] += 1
        product_stats[pid]["revenue"] += o.get("total", 0)
        product_stats[pid]["name"] = o.get("product_name", "N/A")

    top_products = sorted(product_stats.values(), key=lambda x: x["revenue"], reverse=True)[:5]

    return {
        "summary": {
            "total_earned": round(total_earned, 2),
            "total_orders": total_orders,
            "total_sales_volume": round(total_sales_volume, 2),
            "pending_orders": len(pending_orders),
            "paid_orders": len(paid_orders),
            "conversion_rate": round(len(paid_orders) / max(len(partner_orders), 1) * 100, 1),
        },
        "monthly": monthly_data,
        "top_products": top_products,
        "recent_commissions": commissions[:10],
        "recent_orders": partner_orders[:10],
    }

