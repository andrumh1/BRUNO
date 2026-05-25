"""PIUP (Physical NFC) module — manager + catalog + activation flow.

Owns three responsibilities:
1. Catalog of 19 physical PIUP products with shape/size codes (C/U/R + 1..7)
2. Aggregated "My Tags" view (joins users' cards with nfc_cards to mark
   which ones have a physical PIUP linked vs. only digital).
3. Activation by QR scan: links a physical NFC tag to a Bruno card or
   profile, ensuring NFC + QR resolve to the same URL.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import List, Optional, Dict
import os
import uuid
import asyncio
import logging

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/piup", tags=["piup"])


# ─── Size & Shape mapping ────────────────────────────────────────────────────
# C = Circulo, U = Cuadrado, R = Rectangulo
# Numbers 1..7 map to physical dimensions:
SIZE_TABLE: Dict[str, Dict] = {
    "1": {"label": "1x1 cm",   "shapes": ["C", "U"]},
    "2": {"label": "3x3 cm",   "shapes": ["C", "U"]},
    "3": {"label": "5x5 cm",   "shapes": ["C", "U"]},
    "4": {"label": "7x7 cm",   "shapes": ["C", "U"]},
    "5": {"label": "3x5 cm",   "shapes": ["R"]},
    "6": {"label": "4x7 cm",   "shapes": ["R"]},
    "7": {"label": "ID (85x55 mm)", "shapes": ["R"]},
}

SHAPE_LABEL = {"C": "Circulo", "U": "Cuadrado", "R": "Rectangulo"}

# Available colors per product (all share a base palette; some can be filtered)
DEFAULT_COLORS = [
    {"id": "black",        "name": "Negro",       "hex": "#0F0F0F"},
    {"id": "white",        "name": "Blanco",      "hex": "#FFFFFF"},
    {"id": "orange",       "name": "Naranja",     "hex": "#FF5A00"},
    {"id": "gold",         "name": "Dorado",      "hex": "#D4AF37"},
    {"id": "silver",       "name": "Plateado",    "hex": "#C0C0C0"},
    {"id": "blue",         "name": "Azul",        "hex": "#2563EB"},
    {"id": "green",        "name": "Verde",       "hex": "#16A34A"},
    {"id": "red",          "name": "Rojo",        "hex": "#DC2626"},
    {"id": "holographic",  "name": "Holografico", "hex": "linear-gradient(135deg,#ff6b6b,#4ecdc4,#45b7d1,#f7b733)"},
]


# ─── Catalog (19 PIUP products) ──────────────────────────────────────────────
PIUP_CATALOG: List[dict] = [
    # HOGAR
    {"id": "piup-wifi-clave",        "name": "Clave de WiFi",                "category": "hogar",        "schema_id": "nfc-wifi-home",       "styles": ["C1","C2","U1","U2","R7"],                            "base_price": 6.99},
    {"id": "piup-despensa",          "name": "Listado de despensa",          "category": "hogar",        "schema_id": "nfc-despensa",        "styles": ["C2","C3","U2","U3","R7"],                            "base_price": 6.99},
    {"id": "piup-alarma",            "name": "Activacion de alarmas",        "category": "hogar",        "schema_id": "nfc-alarma",          "styles": ["C1","C2","U1","U2","R7"],                            "base_price": 7.99},
    {"id": "piup-mensajes",          "name": "Envio instantaneo de mensajes","category": "hogar",        "schema_id": "nfc-redes-sociales",  "styles": ["C1","C2","U1","U2","R7"],                            "base_price": 6.99},
    {"id": "piup-llavero-gps",       "name": "Llavero GPS",                  "category": "hogar",        "schema_id": "nfc-llavero-gps",     "styles": ["C1","U1"],                                          "base_price": 12.99},

    # RESTAURANTES Y COMERCIOS
    {"id": "piup-menu-virtual",      "name": "Descarga de menu virtual",     "category": "restaurantes", "schema_id": "nfc-menu-qr",         "styles": ["C2","C3","C4","U2","U3","U4","R5","R6"],            "base_price": 9.99},
    {"id": "piup-redes-sociales",    "name": "Redes sociales con QR",        "category": "restaurantes", "schema_id": "nfc-redes-sociales",  "styles": ["C2","C3","C4","U2","U3","U4","R5","R6","R7"],       "base_price": 8.99},
    {"id": "piup-ar-productos",      "name": "QR para AR (Realidad Aumentada)","category": "restaurantes","schema_id": "nfc-ar-productos",   "styles": ["C1","U1"],                                          "base_price": 11.99},

    # OFICINAS
    {"id": "piup-sacar-citas",       "name": "Sacar citas",                  "category": "oficinas",     "schema_id": "nfc-citas",           "styles": ["C2","C3","U2","U3","R5","R6","R7"],                 "base_price": 8.99},
    {"id": "piup-apps",              "name": "Descarga de aplicaciones",     "category": "oficinas",     "schema_id": "nfc-apps",            "styles": ["C2","C3","C4","U2","U3","U4","R5","R6","R7"],       "base_price": 8.99},
    {"id": "piup-calendario-citas",  "name": "Calendario de citas",          "category": "oficinas",     "schema_id": "nfc-citas",           "styles": ["C2","C3","U2","U3","R5","R6","R7"],                 "base_price": 8.99},
    {"id": "piup-pagos",             "name": "Metodos de pago",              "category": "oficinas",     "schema_id": "nfc-pagos",           "styles": ["C2","C3","C4","U2","U3","U4","R5","R6","R7"],       "base_price": 9.99},
    {"id": "piup-paginas-web",       "name": "Paginas web",                  "category": "oficinas",     "schema_id": "nfc-apps",            "styles": ["C2","C3","C4","U2","U3","U4","R5","R6","R7"],       "base_price": 7.99},
    {"id": "piup-inventario",        "name": "Control de inventario",        "category": "oficinas",     "schema_id": "nfc-inventario",      "styles": ["C1","C2","U1","U2","R7"],                            "base_price": 7.99},
    {"id": "piup-acceso",            "name": "Claves de acceso",             "category": "oficinas",     "schema_id": "nfc-acceso",          "styles": ["C1","C2","U1","U2","R7"],                            "base_price": 8.99},
    {"id": "piup-archivos",          "name": "Presentacion de archivos",     "category": "oficinas",     "schema_id": "nfc-apps",            "styles": ["C1","C2","U1","U2","R7"],                            "base_price": 7.99},
    {"id": "piup-tarjeta-presentacion","name": "Tarjeta de presentacion",    "category": "oficinas",     "schema_id": "nfc-card-orange",     "styles": ["R7"],                                                "base_price": 14.99},
    {"id": "piup-carnet",            "name": "Carnet",                       "category": "oficinas",     "schema_id": "nfc-carnet",          "styles": ["R7"],                                                "base_price": 12.99},

    # MASCOTAS
    {"id": "piup-collar-gps",        "name": "Collar con placa NFC + GPS",   "category": "mascotas",     "schema_id": "nfc-collar-completo", "styles": ["C1","U1"],                                          "base_price": 19.99},
]

CATEGORY_LABELS = {
    "hogar":        "Hogar",
    "restaurantes": "Restaurantes y comercios",
    "oficinas":     "Oficinas",
    "mascotas":     "Mascotas",
}


def _enrich_product(p: dict) -> dict:
    """Add derived display fields to a catalog entry."""
    styles_detail = []
    for code in p["styles"]:
        shape = code[0]
        idx = code[1:]
        size = SIZE_TABLE.get(idx, {})
        styles_detail.append({
            "code": code,
            "shape": shape,
            "shape_label": SHAPE_LABEL.get(shape, shape),
            "size_id": idx,
            "size_label": size.get("label", ""),
        })
    return {
        **p,
        "category_label": CATEGORY_LABELS.get(p["category"], p["category"]),
        "styles_detail": styles_detail,
        "colors": DEFAULT_COLORS,
        "style_count": len(p["styles"]),
    }


# ─── Models ──────────────────────────────────────────────────────────────────

class PiupRequest(BaseModel):
    product_id: str
    style: str                       # e.g. "C2", "R7"
    color_id: str = "black"
    card_id: Optional[str] = None    # which Bruno card to pre-link
    shipping_address: Optional[dict] = None
    quantity: int = Field(default=1, ge=1, le=20)


class PiupActivate(BaseModel):
    nfc_id: str                       # Decoded from the printed QR/NFC chip
    card_id: str                      # Target Bruno card to link
    product_id: Optional[str] = None  # Optional product context


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/catalog")
async def get_catalog(category: Optional[str] = None, style: Optional[str] = None):
    """Return the full PIUP catalog. Optionally filter by category or style code.

    `style` is the shape+size code (e.g. "C2", "R7").
    """
    items = [_enrich_product(p) for p in PIUP_CATALOG]
    if category:
        items = [p for p in items if p["category"] == category]
    if style:
        items = [p for p in items if style in p["styles"]]
    return {
        "products": items,
        "categories": [{"id": k, "label": v} for k, v in CATEGORY_LABELS.items()],
        "shapes": [{"id": k, "label": v} for k, v in SHAPE_LABEL.items()],
        "sizes": SIZE_TABLE,
        "colors": DEFAULT_COLORS,
        "total": len(items),
    }


@router.get("/sizes")
async def get_sizes():
    """Return the shape+size mapping table (C/U/R x 1..7)."""
    return {"sizes": SIZE_TABLE, "shapes": SHAPE_LABEL, "colors": DEFAULT_COLORS}


@router.get("/my-tags")
async def my_tags(current_user: User = Depends(get_current_user)):
    """Return all the user's cards, marked with their physical PIUP status.

    Each card has:
      - is_physical: True if at least one nfc_cards row links to it
      - physical_tags: list of {nfc_id, product_id, configured_at}
      - qr_url: full URL to the public card view (matches NFC redirect target)
    """
    cards = await db.cards.find({"user_id": current_user.id}, {"_id": 0}).to_list(500)

    card_ids = [c["id"] for c in cards]
    nfc_rows = []
    if card_ids:
        nfc_rows = await db.nfc_cards.find(
            {"user_id": current_user.id, "card_id": {"$in": card_ids}},
            {"_id": 0},
        ).to_list(1000)

    # Group NFC rows by card_id
    by_card: Dict[str, list] = {}
    for row in nfc_rows:
        by_card.setdefault(row["card_id"], []).append({
            "nfc_id": row.get("nfc_id"),
            "product_id": row.get("product_id"),
            "product_type": row.get("product_type"),
            "is_active": row.get("is_active", False),
            "is_locked": row.get("is_locked", True),
            "configured_at": row.get("configured_at"),
            "activated_at": row.get("activated_at"),
        })

    frontend_url = os.environ.get('FRONTEND_URL', '')
    result = []
    for c in cards:
        tags = by_card.get(c["id"], [])
        result.append({
            "card_id": c["id"],
            "title": c.get("title", ""),
            "subtitle": c.get("subtitle", ""),
            "avatar_url": c.get("avatar_url"),
            "banner_url": c.get("banner_url"),
            "card_type": c.get("card_type", "personal"),
            "background_color": c.get("background_color", "#FF5A00"),
            "qr_url": f"{frontend_url}/c/{c['id']}",
            "is_physical": len(tags) > 0,
            "physical_tag_count": len(tags),
            "physical_tags": tags,
        })

    # Sort: physical cards first, then by title
    result.sort(key=lambda r: (not r["is_physical"], r["title"].lower()))

    return {
        "tags": result,
        "summary": {
            "total_cards": len(result),
            "physical": sum(1 for r in result if r["is_physical"]),
            "digital_only": sum(1 for r in result if not r["is_physical"]),
        },
    }


@router.post("/request-physical")
async def request_physical_piup(
    payload: PiupRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a physical PIUP order — saved into store_orders for fulfillment.

    Validates product+style; computes total; links card_id when provided so
    fulfillment knows which Bruno profile to encode.
    """
    product = next((p for p in PIUP_CATALOG if p["id"] == payload.product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="PIUP product not found")

    if payload.style not in product["styles"]:
        raise HTTPException(
            status_code=400,
            detail=f"Style {payload.style} is not available for {product['name']}. Available: {product['styles']}",
        )

    color = next((c for c in DEFAULT_COLORS if c["id"] == payload.color_id), None)
    if not color:
        raise HTTPException(status_code=400, detail=f"Invalid color: {payload.color_id}")

    if payload.card_id:
        card = await db.cards.find_one({"id": payload.card_id, "user_id": current_user.id})
        if not card:
            raise HTTPException(status_code=404, detail="Linked Bruno card not found")

    style_code = payload.style
    shape = style_code[0]
    size = SIZE_TABLE.get(style_code[1:], {})

    unit_price = float(product["base_price"])
    total_price = round(unit_price * payload.quantity, 2)

    order_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "kind": "piup_physical",
        "product_id": payload.product_id,
        "product_name": product["name"],
        "category": product["category"],
        "style": style_code,
        "shape": shape,
        "shape_label": SHAPE_LABEL.get(shape, shape),
        "size_label": size.get("label", ""),
        "color_id": payload.color_id,
        "color_name": color["name"],
        "quantity": payload.quantity,
        "unit_price": unit_price,
        "total_price": total_price,
        "currency": "USD",
        "card_id": payload.card_id,
        "shipping_address": payload.shipping_address or {},
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.piup_orders.insert_one(order_doc)

    # Drop the _id Mongo added (insert_one mutates the doc)
    order_doc.pop("_id", None)
    return {"message": "PIUP order created", "order": order_doc}


@router.get("/orders")
async def my_piup_orders(current_user: User = Depends(get_current_user)):
    """Return the user's PIUP physical orders."""
    rows = await db.piup_orders.find(
        {"user_id": current_user.id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    return {"orders": rows, "total": len(rows)}


async def _broadcast_activation(user_id: str, payload: dict) -> None:
    """Best-effort WS broadcast so the manager UI updates in real-time."""
    try:
        from server import ws_manager  # local import to avoid cycle
        await ws_manager.send_personal_message({"type": "piup_activated", **payload}, user_id)
    except Exception:
        pass


@router.post("/activate-by-qr")
async def activate_by_qr(payload: PiupActivate, current_user: User = Depends(get_current_user)):
    """Activate a physical PIUP after scanning its printed QR.

    Steps:
      1. Verify the chosen Bruno card belongs to the user.
      2. Upsert nfc_cards row linking nfc_id ↔ card_id under this user.
      3. (Unification) Both QR and NFC now resolve to the same target:
         - NFC: GET /api/nfc/go/{nfc_id} → 302 → /c/{card_id}
         - QR (printed): same redirect or direct /c/{card_id}
      4. Fire WS event so the manager refreshes in real-time.
    """
    card = await db.cards.find_one({"id": payload.card_id, "user_id": current_user.id})
    if not card:
        raise HTTPException(status_code=404, detail="Bruno card not found or not yours")

    product_meta = None
    if payload.product_id:
        product_meta = next((p for p in PIUP_CATALOG if p["id"] == payload.product_id), None)

    existing = await db.nfc_cards.find_one({"nfc_id": payload.nfc_id})
    now_iso = datetime.now(timezone.utc).isoformat()

    if existing and existing.get("user_id") and existing["user_id"] != current_user.id:
        # Another user already owns this tag.
        raise HTTPException(status_code=409, detail="This PIUP is already activated by another user")

    set_data = {
        "card_id": payload.card_id,
        "user_id": current_user.id,
        "product_id": payload.product_id or (existing or {}).get("product_id"),
        "product_type": (product_meta or {}).get("category") or (existing or {}).get("product_type"),
        "is_active": True,
        "is_locked": True,
        "activated_at": now_iso,
        "configured_at": now_iso,
        "configured_via": "bruno_app",
    }

    if existing:
        await db.nfc_cards.update_one({"nfc_id": payload.nfc_id}, {"$set": set_data})
    else:
        new_doc = {
            "id": str(uuid.uuid4()),
            "nfc_id": payload.nfc_id,
            "created_at": now_iso,
            **set_data,
        }
        await db.nfc_cards.insert_one(new_doc)

    frontend_url = os.environ.get('FRONTEND_URL', '')
    response = {
        "message": "PIUP activated successfully",
        "nfc_id": payload.nfc_id,
        "card_id": payload.card_id,
        "card_title": card.get("title", ""),
        # Unified destinations — printed QR + NFC chip should both point here
        "redirect_url": f"{frontend_url}/c/{payload.card_id}",
        "nfc_endpoint": f"{frontend_url}/api/nfc/go/{payload.nfc_id}",
    }

    # Real-time refresh for any open manager tabs
    asyncio.create_task(_broadcast_activation(current_user.id, response))

    return response


# ─── Stripe Checkout for PIUP physical orders ────────────────────────────────

class PiupCheckoutRequest(BaseModel):
    product_id: str
    style: str
    color_id: str = "black"
    card_id: Optional[str] = None
    shipping_address: Optional[dict] = None
    quantity: int = Field(default=1, ge=1, le=20)
    origin_url: str  # frontend origin so we can build success/cancel URLs


@router.post("/checkout")
async def piup_stripe_checkout(
    req: PiupCheckoutRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Create a Stripe checkout session for a PIUP physical order.

    1. Validates product + style + color.
    2. Creates an internal piup_orders row in `pending_payment` status.
    3. Spawns a Stripe Checkout session (amount calculated server-side).
    4. Stores session_id on the order so the webhook can mark paid.
    """
    product = next((p for p in PIUP_CATALOG if p["id"] == req.product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="PIUP product not found")
    if req.style not in product["styles"]:
        raise HTTPException(
            status_code=400,
            detail=f"Style {req.style} not available for {product['name']}",
        )
    color = next((c for c in DEFAULT_COLORS if c["id"] == req.color_id), None)
    if not color:
        raise HTTPException(status_code=400, detail=f"Invalid color: {req.color_id}")

    if req.card_id:
        card = await db.cards.find_one({"id": req.card_id, "user_id": current_user.id})
        if not card:
            raise HTTPException(status_code=404, detail="Linked Bruno card not found")

    unit_price = float(product["base_price"])
    total_price = round(unit_price * req.quantity, 2)

    style_code = req.style
    shape = style_code[0]
    size = SIZE_TABLE.get(style_code[1:], {})

    # Create the order in pending_payment state
    order_id = str(uuid.uuid4())
    order_doc = {
        "id": order_id,
        "user_id": current_user.id,
        "kind": "piup_physical",
        "product_id": req.product_id,
        "product_name": product["name"],
        "category": product["category"],
        "style": style_code,
        "shape": shape,
        "shape_label": SHAPE_LABEL.get(shape, shape),
        "size_label": size.get("label", ""),
        "color_id": req.color_id,
        "color_name": color["name"],
        "quantity": req.quantity,
        "unit_price": unit_price,
        "total_price": total_price,
        "currency": "USD",
        "card_id": req.card_id,
        "shipping_address": req.shipping_address or {},
        "status": "pending_payment",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.piup_orders.insert_one(order_doc)

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        # Mark order so admin can fulfill manually; UI receives a soft error.
        await db.piup_orders.update_one(
            {"id": order_id},
            {"$set": {"status": "pending", "payment_status": "manual"}},
        )
        raise HTTPException(status_code=503, detail="Pagos no configurados — pedido guardado para revision manual")

    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest,
    )

    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/piup?tab=my-tags&piup_session={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/piup?tab=store"
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/piup/webhook/stripe"

    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    metadata = {
        "user_id": current_user.id,
        "order_id": order_id,
        "product_id": req.product_id,
        "product_name": product["name"],
        "kind": "piup_physical",
    }

    try:
        session = await stripe_checkout.create_checkout_session(CheckoutSessionRequest(
            amount=total_price,
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
        ))
    except Exception as e:
        logger.error(f"Stripe error creating PIUP session: {e}")
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")

    await db.piup_orders.update_one(
        {"id": order_id},
        {"$set": {"stripe_session_id": session.session_id, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    return {
        "checkout_url": session.url,
        "session_id": session.session_id,
        "order_id": order_id,
        "amount": total_price,
        "currency": "USD",
    }


@router.get("/checkout/status/{session_id}")
async def piup_checkout_status(
    session_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Polls Stripe for the checkout session status; updates the order on success."""
    order = await db.piup_orders.find_one(
        {"stripe_session_id": session_id, "user_id": current_user.id},
        {"_id": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.get("payment_status") == "paid":
        return {"status": "complete", "payment_status": "paid", "order": order}

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        return {"status": "unknown", "payment_status": order.get("payment_status", "pending"), "order": order}

    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/piup/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    try:
        st = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.warning(f"Failed to poll Stripe: {e}")
        return {"status": "pending", "payment_status": order.get("payment_status", "pending"), "order": order}

    new_payment_status = "paid" if st.payment_status == "paid" else "pending"
    new_order_status = "paid" if new_payment_status == "paid" else order.get("status", "pending_payment")

    await db.piup_orders.update_one(
        {"stripe_session_id": session_id},
        {"$set": {
            "payment_status": new_payment_status,
            "status": new_order_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    refreshed = await db.piup_orders.find_one({"stripe_session_id": session_id}, {"_id": 0})
    return {
        "status": st.status,
        "payment_status": new_payment_status,
        "order": refreshed,
    }


# ─── Stripe Webhook for PIUP orders ──────────────────────────────────────────

@router.post("/webhook/stripe")
async def piup_stripe_webhook(request: Request):
    """Receives Stripe events for PIUP physical orders.

    Triggered when a customer completes (or fails) checkout. Marks the
    matching `piup_orders` row as paid and dispatches a realtime notification
    so the user's manager refreshes automatically.

    NOTE: Stripe must be configured with the public URL of this endpoint:
      <FRONTEND_BACKEND_URL>/api/piup/webhook/stripe
    plus the matching webhook secret stored in Stripe's dashboard. When using
    Emergent's StripeCheckout helper the signature is verified inside
    `handle_webhook`.
    """
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/piup/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")

    try:
        event = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        logger.error(f"PIUP Stripe webhook signature/parse error: {e}")
        raise HTTPException(status_code=400, detail="Invalid Stripe payload")

    session_id = getattr(event, "session_id", None)
    payment_status = getattr(event, "payment_status", None) or "unknown"

    if not session_id:
        return {"received": True, "ignored": True}

    order = await db.piup_orders.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not order:
        # Webhook fired for a non-PIUP session — ignore politely
        return {"received": True, "matched": False}

    new_payment_status = "paid" if payment_status == "paid" else payment_status
    new_status = "paid" if new_payment_status == "paid" else order.get("status", "pending_payment")

    await db.piup_orders.update_one(
        {"stripe_session_id": session_id},
        {"$set": {
            "payment_status": new_payment_status,
            "status": new_status,
            "stripe_event_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    # Fire a realtime notification to the buyer so PIUPManager refreshes
    if new_payment_status == "paid":
        try:
            from server import ws_manager
            await ws_manager.send_personal_message({
                "type": "piup_payment_received",
                "order_id": order["id"],
                "product_name": order.get("product_name", "PIUP"),
                "amount": order.get("total_price", 0),
                "currency": order.get("currency", "USD"),
            }, order["user_id"])
        except Exception as _e:
            logger.warning(f"Failed to dispatch piup_payment_received realtime event: {_e}")

    return {
        "received": True,
        "matched": True,
        "payment_status": new_payment_status,
        "order_id": order["id"],
    }
