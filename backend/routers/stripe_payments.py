"""
Stripe Payment Router - Handles premium subscriptions (Card Analytics Pro, etc.)
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime, timezone
from jose import jwt
import uuid
import os

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, 
    CheckoutSessionResponse, 
    CheckoutStatusResponse, 
    CheckoutSessionRequest
)

router = APIRouter(prefix="/api/payments", tags=["payments"])
security = HTTPBearer()

db = None

# Premium packages - amounts defined server-side only (security)
PREMIUM_PACKAGES = {
    "analytics_monthly": {
        "name": "Card Analytics Pro - Mensual",
        "amount": 4.99,
        "currency": "usd",
        "duration_days": 30,
        "features": ["Visitantes detallados", "Fuentes de trafico", "Graficos de metricas", "Exportar datos"]
    },
    "analytics_yearly": {
        "name": "Card Analytics Pro - Anual",
        "amount": 39.99,
        "currency": "usd",
        "duration_days": 365,
        "features": ["Todo lo mensual", "Ahorra 20%", "Soporte prioritario"]
    },
    "premium_monthly": {
        "name": "Bruno Premium - Mensual",
        "amount": 9.99,
        "currency": "usd",
        "duration_days": 30,
        "features": ["Card Analytics Pro", "Badge verificado", "Sin anuncios", "Prioridad en feed"]
    }
}

def set_db(database):
    global db
    db = database

async def _get_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    secret = os.environ.get("SECRET_KEY", "bruno-secret-key-2025-change-in-production")
    try:
        payload = jwt.decode(credentials.credentials, secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"email": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------- Get available packages ----------
@router.get("/packages")
async def get_packages():
    """Return available premium packages"""
    return {k: {**v, "id": k} for k, v in PREMIUM_PACKAGES.items()}

# ---------- Create checkout session ----------
class CheckoutRequest(BaseModel):
    package_id: str
    origin_url: str

@router.post("/checkout")
async def create_checkout(req: CheckoutRequest, request: Request, current_user: dict = Depends(_get_user)):
    """Create a Stripe checkout session for a premium package"""
    if req.package_id not in PREMIUM_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = PREMIUM_PACKAGES[req.package_id]
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Build URLs from frontend origin
    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/payment/cancel"

    # Create webhook URL
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/payments/webhook/stripe"

    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    metadata = {
        "user_id": current_user["id"],
        "user_email": current_user.get("email", ""),
        "package_id": req.package_id,
        "package_name": package["name"]
    }

    checkout_req = CheckoutSessionRequest(
        amount=package["amount"],
        currency=package["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata
    )

    try:
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")

    # Create payment transaction record BEFORE redirect
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_email": current_user.get("email", ""),
        "session_id": session.session_id,
        "package_id": req.package_id,
        "package_name": package["name"],
        "amount": package["amount"],
        "currency": package["currency"],
        "payment_status": "pending",
        "status": "initiated",
        "metadata": metadata,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payment_transactions.insert_one(transaction)

    return {"url": session.url, "session_id": session.session_id}

# ---------- Check payment status ----------
@router.get("/status/{session_id}")
async def check_payment_status(session_id: str, request: Request, current_user: dict = Depends(_get_user)):
    """Poll payment status after Stripe redirect"""
    # Find the transaction
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if txn["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your transaction")

    # If already processed, return cached status
    if txn.get("payment_status") == "paid":
        return {
            "status": "complete",
            "payment_status": "paid",
            "package_name": txn.get("package_name", ""),
            "amount": txn.get("amount", 0)
        }

    # Poll Stripe for current status
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/payments/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        return {
            "status": txn.get("status", "unknown"),
            "payment_status": txn.get("payment_status", "pending"),
            "package_name": txn.get("package_name", ""),
            "amount": txn.get("amount", 0)
        }

    # Update transaction if payment completed (prevent duplicate processing)
    if status.payment_status == "paid" and txn.get("payment_status") != "paid":
        now = datetime.now(timezone.utc).isoformat()
        package = PREMIUM_PACKAGES.get(txn.get("package_id", ""))
        duration_days = package["duration_days"] if package else 30
        
        await db.payment_transactions.update_one(
            {"session_id": session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {
                "payment_status": "paid",
                "status": "complete",
                "paid_at": now,
                "updated_at": now
            }}
        )

        # Activate premium for user
        from datetime import timedelta
        expires = datetime.now(timezone.utc) + timedelta(days=duration_days)
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {
                "subscription_tier": txn.get("package_id", "premium"),
                "subscription_expires": expires.isoformat(),
                "updated_at": now
            }}
        )
    elif status.status == "expired":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": "expired",
                "status": "expired",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )

    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "package_name": txn.get("package_name", ""),
        "amount": txn.get("amount", 0)
    }

# ---------- User subscription info ----------
@router.get("/subscription")
async def get_subscription(current_user: dict = Depends(_get_user)):
    """Get current user subscription status"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    tier = user.get("subscription_tier", "free")
    expires = user.get("subscription_expires")
    
    is_active = False
    if tier != "free" and expires:
        try:
            exp_date = datetime.fromisoformat(expires)
            is_active = exp_date > datetime.now(timezone.utc)
        except Exception:
            pass
    
    # Get payment history
    history = await db.payment_transactions.find(
        {"user_id": current_user["id"], "payment_status": "paid"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)

    return {
        "tier": tier,
        "is_active": is_active,
        "expires": expires,
        "payment_history": history
    }

# ---------- Webhook handler ----------
@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/payments/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    try:
        event = await stripe_checkout.handle_webhook(body, signature)
        
        if event.payment_status == "paid":
            # Update transaction
            await db.payment_transactions.update_one(
                {"session_id": event.session_id, "payment_status": {"$ne": "paid"}},
                {"$set": {
                    "payment_status": "paid",
                    "status": "complete",
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Activate premium
            txn = await db.payment_transactions.find_one({"session_id": event.session_id}, {"_id": 0})
            if txn:
                package = PREMIUM_PACKAGES.get(txn.get("package_id", ""))
                duration_days = package["duration_days"] if package else 30
                from datetime import timedelta
                expires = datetime.now(timezone.utc) + timedelta(days=duration_days)
                await db.users.update_one(
                    {"id": txn["user_id"]},
                    {"$set": {
                        "subscription_tier": txn.get("package_id", "premium"),
                        "subscription_expires": expires.isoformat()
                    }}
                )
        
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
