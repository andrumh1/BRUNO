"""User saved-data + subscription plans (extracted from server.py).

Groups the small legacy user-metadata endpoints and the subscription
plan/checkout endpoints. These were spread over ~155 lines in server.py.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import os

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from models.user import User

router = APIRouter(tags=["user-data"])

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")


# ─── Models (duplicated so the router is self-contained) ────────────

class SocialLink(BaseModel):
    type: str
    label: str
    url: str
    icon: Optional[str] = None


class ShippingAddress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str = "Home"
    full_name: str
    phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: Optional[str] = None
    postal_code: str
    country: str
    is_default: bool = False


class SavedPaymentMethod(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = "card"
    last_four: str
    brand: str
    exp_month: int
    exp_year: int
    is_default: bool = False
    stripe_payment_method_id: Optional[str] = None


class UserSavedData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_id: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    bio: Optional[str] = None
    profession: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    social_links: List[SocialLink] = []
    addresses: List[ShippingAddress] = []
    payment_methods: List[SavedPaymentMethod] = []
    photos: List[str] = []
    work_references: List[dict] = []
    custom_fields: dict = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ─── Seed function (idempotent) ─────────────────────────────────────

async def seed_subscription_plans():
    """Seed default subscription plans."""
    plans = [
        {
            "id": "free",
            "name": "Gratis",
            "price_monthly": 0,
            "price_yearly": 0,
            "currency": "USD",
            "features": [
                "1 tarjeta digital", "Código QR básico", "1 plantilla estándar",
                "Perfil público", "Compartir por link", "Soporte por email",
            ],
            "limits": {
                "max_cards": 1, "max_photos": 3, "max_social_links": 5,
                "analytics": False, "custom_domain": False,
                "remove_branding": False, "nfc_support": False,
            },
            "is_active": True,
        },
        {
            "id": "pro",
            "name": "Pro",
            "price_monthly": 9.99,
            "price_yearly": 99.00,
            "currency": "USD",
            "features": [
                "5 tarjetas digitales", "Código QR personalizado con logo",
                "Todas las plantillas", "Estadísticas de visitas",
                "Perfil verificado ✓", "Soporte NFC básico",
                "Sin marca BRUNO en tarjeta", "Exportar contactos VCF",
                "Integración calendario", "Soporte prioritario",
            ],
            "limits": {
                "max_cards": 5, "max_photos": 20, "max_social_links": 20,
                "analytics": True, "custom_domain": False,
                "remove_branding": True, "nfc_support": True,
            },
            "is_active": True,
        },
        {
            "id": "business",
            "name": "Business",
            "price_monthly": 29.99,
            "price_yearly": 299.00,
            "currency": "USD",
            "features": [
                "Tarjetas ilimitadas", "Todo de Pro incluido",
                "Panel de administración de equipo", "Dominio personalizado",
                "API access", "Estadísticas avanzadas",
                "Múltiples administradores", "Integración CRM",
                "Soporte 24/7", "Onboarding personalizado",
                "Facturación empresarial",
            ],
            "limits": {
                "max_cards": -1, "max_photos": -1, "max_social_links": -1,
                "analytics": True, "custom_domain": True,
                "remove_branding": True, "nfc_support": True,
                "team_management": True, "api_access": True,
            },
            "is_active": True,
        },
    ]
    for plan in plans:
        await db.subscription_plans.update_one(
            {"id": plan["id"]}, {"$set": plan}, upsert=True,
        )


# ─── User saved-data endpoints ─────────────────────────────────────

@router.get("/user/saved-data")
async def get_user_saved_data(current_user: User = Depends(get_current_user)):
    data = await db.user_saved_data.find_one({"user_id": current_user.id}, {"_id": 0})
    if not data:
        data = UserSavedData(user_id=current_user.id).model_dump()
        data['created_at'] = data['created_at'].isoformat()
        data['updated_at'] = data['updated_at'].isoformat()
        await db.user_saved_data.insert_one(data)
    return data


@router.put("/user/saved-data")
async def update_user_saved_data(
    updates: dict,
    current_user: User = Depends(get_current_user),
):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.user_saved_data.update_one(
        {"user_id": current_user.id},
        {"$set": updates},
        upsert=True,
    )
    return {"message": "Data saved successfully"}


@router.post("/user/addresses")
async def add_user_address(
    address: dict,
    current_user: User = Depends(get_current_user),
):
    address_obj = ShippingAddress(**address)
    address_dict = address_obj.model_dump()

    existing = await db.user_saved_data.find_one({"user_id": current_user.id}, {"_id": 0})
    if not existing or not existing.get("addresses"):
        address_dict["is_default"] = True

    await db.user_saved_data.update_one(
        {"user_id": current_user.id},
        {
            "$push": {"addresses": address_dict},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        },
        upsert=True,
    )
    return {"message": "Address added", "address": address_dict}


@router.delete("/user/addresses/{address_id}")
async def delete_user_address(
    address_id: str,
    current_user: User = Depends(get_current_user),
):
    await db.user_saved_data.update_one(
        {"user_id": current_user.id},
        {
            "$pull": {"addresses": {"id": address_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        },
    )
    return {"message": "Address deleted"}


@router.post("/user/social-links")
async def add_saved_social_link(
    link: dict,
    current_user: User = Depends(get_current_user),
):
    social_link = SocialLink(**link)
    await db.user_saved_data.update_one(
        {"user_id": current_user.id},
        {
            "$push": {"social_links": social_link.model_dump()},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        },
        upsert=True,
    )
    return {"message": "Social link saved"}


# ─── Subscription plan endpoints ───────────────────────────────────

@router.get("/plans")
async def get_subscription_plans():
    plans = await db.subscription_plans.find({"is_active": True}, {"_id": 0}).to_list(100)
    if not plans:
        await seed_subscription_plans()
        plans = await db.subscription_plans.find({"is_active": True}, {"_id": 0}).to_list(100)
    return plans


@router.get("/user/subscription")
async def get_user_subscription(current_user: User = Depends(get_current_user)):
    sub = await db.user_subscriptions.find_one({"user_id": current_user.id}, {"_id": 0})
    if not sub:
        return {
            "plan_id": "free",
            "status": "active",
            "billing_cycle": None,
            "features": ["1 tarjeta digital", "QR básico", "Plantilla estándar"],
        }
    return sub


@router.post("/subscribe/{plan_id}")
async def create_subscription_checkout(
    plan_id: str,
    billing_cycle: str = "monthly",
    current_user: User = Depends(get_current_user),
):
    plan = await db.subscription_plans.find_one({"id": plan_id, "is_active": True}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan_id == "free":
        raise HTTPException(status_code=400, detail="Free plan doesn't require payment")

    price = plan["price_monthly"] if billing_cycle == "monthly" else plan["price_yearly"]

    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
    frontend_url = os.environ.get('FRONTEND_URL')
    checkout_request = CheckoutSessionRequest(
        success_url=f"{frontend_url}/subscription/success?plan={plan_id}",
        cancel_url=f"{frontend_url}/pricing",
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {"name": f"BRUNO {plan['name']} - {billing_cycle.capitalize()}"},
                "unit_amount": int(price * 100),
                "recurring": {"interval": "month" if billing_cycle == "monthly" else "year"},
            },
            "quantity": 1,
        }],
        mode="subscription",
        metadata={
            "plan_id": plan_id,
            "user_id": current_user.id,
            "billing_cycle": billing_cycle,
        },
    )
    checkout_response = stripe_checkout.create_checkout_session(checkout_request)
    return {"checkout_url": checkout_response.url, "session_id": checkout_response.session_id}
