"""Business / PIUP map pins — claimable pins for businesses or private sectors.

Coexists with the Google Places layer:
- Google supplies generic POIs (hospitals, police, government buildings).
- This module supplies user-owned business pins backed by Bruno Cards.

Endpoints:
- POST /api/map-pins/claim    → claim or update a business pin tied to a card
- DELETE /api/map-pins/{id}   → remove your pin
- GET /api/map-pins           → fetch pins within bounding box (public)
- GET /api/map-pins/mine      → fetch the current user's pins (auth)
- GET /api/map-pins/{id}      → public single pin detail (taps a pin)
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import logging

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/map-pins", tags=["map-pins"])


# ─── Models ──────────────────────────────────────────────────────────────────

CATEGORY_PRESETS = {
    "commerce":   {"label": "Comercio",          "icon": "🛍",  "color": "#FF5A00"},
    "restaurant": {"label": "Restaurante",       "icon": "🍽",  "color": "#FF8C42"},
    "service":    {"label": "Servicios",         "icon": "🔧",  "color": "#FFB54C"},
    "health":     {"label": "Salud",             "icon": "🏥",  "color": "#26C281"},
    "education":  {"label": "Educacion",         "icon": "🎓",  "color": "#3B82F6"},
    "office":     {"label": "Oficinas",          "icon": "🏢",  "color": "#7C3AED"},
    "personal":   {"label": "Personal / Pro",    "icon": "👤",  "color": "#EC4899"},
    "event":      {"label": "Evento",            "icon": "🎉",  "color": "#F43F5E"},
    "other":      {"label": "Otro",              "icon": "📍",  "color": "#6B7280"},
}


class MapPinClaim(BaseModel):
    card_id: str
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    title: Optional[str] = None
    subtitle: Optional[str] = None
    category: str = "personal"           # one of CATEGORY_PRESETS keys
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    opening_hours: Optional[str] = None
    is_public: bool = True               # appears on the public map
    nfc_id: Optional[str] = None         # optional link to a physical PIUP


class MapPinUpdate(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    opening_hours: Optional[str] = None
    is_public: Optional[bool] = None


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _public_view(pin: dict, owner: Optional[dict] = None, card: Optional[dict] = None) -> dict:
    cat = pin.get("category", "personal")
    preset = CATEGORY_PRESETS.get(cat, CATEGORY_PRESETS["other"])
    return {
        "id": pin["id"],
        "card_id": pin.get("card_id"),
        "user_id": pin.get("user_id"),
        "lat": pin.get("lat"),
        "lng": pin.get("lng"),
        "title": pin.get("title") or (card or {}).get("title", ""),
        "subtitle": pin.get("subtitle") or (card or {}).get("subtitle", ""),
        "category": cat,
        "category_label": preset["label"],
        "category_icon": preset["icon"],
        "category_color": preset["color"],
        "address": pin.get("address"),
        "phone": pin.get("phone"),
        "website": pin.get("website"),
        "opening_hours": pin.get("opening_hours"),
        "is_public": pin.get("is_public", True),
        "nfc_id": pin.get("nfc_id"),
        "owner_name": (owner or {}).get("name"),
        "avatar_url": (card or {}).get("avatar_url") or (owner or {}).get("avatar_url"),
        "banner_url": (card or {}).get("banner_url"),
        "background_color": (card or {}).get("background_color"),
        "verified": pin.get("verified", False),
        "claimed_at": pin.get("claimed_at"),
    }


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/categories")
async def list_categories():
    """Return the public list of pin categories for the picker UI."""
    return {
        "categories": [
            {"id": k, **v} for k, v in CATEGORY_PRESETS.items()
        ],
    }


@router.post("/claim")
async def claim_pin(payload: MapPinClaim, current_user: User = Depends(get_current_user)):
    """Claim a new business map pin, or update an existing one for the same card.

    A user can have multiple pins, but only ONE per (user_id, card_id).
    Reclaiming the same card just updates the existing pin (idempotent).
    """
    card = await db.cards.find_one({"id": payload.card_id, "user_id": current_user.id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found or not yours")

    if payload.category not in CATEGORY_PRESETS:
        raise HTTPException(status_code=400, detail=f"Invalid category. Valid: {list(CATEGORY_PRESETS.keys())}")

    existing = await db.map_pins.find_one({
        "user_id": current_user.id,
        "card_id": payload.card_id,
    })

    now_iso = datetime.now(timezone.utc).isoformat()
    pin_doc = {
        "user_id": current_user.id,
        "card_id": payload.card_id,
        "lat": payload.lat,
        "lng": payload.lng,
        "title": payload.title or card.get("title", ""),
        "subtitle": payload.subtitle or card.get("subtitle", ""),
        "category": payload.category,
        "address": payload.address,
        "phone": payload.phone,
        "website": payload.website,
        "opening_hours": payload.opening_hours,
        "is_public": payload.is_public,
        "nfc_id": payload.nfc_id,
        "updated_at": now_iso,
    }

    if existing:
        await db.map_pins.update_one({"id": existing["id"]}, {"$set": pin_doc})
        refreshed = await db.map_pins.find_one({"id": existing["id"]}, {"_id": 0})
        return {"status": "updated", "pin": _public_view(refreshed, card=card)}
    else:
        pin_doc["id"] = str(uuid.uuid4())
        pin_doc["claimed_at"] = now_iso
        pin_doc["verified"] = False
        await db.map_pins.insert_one(pin_doc)
        # remove the _id mongo added
        pin_doc.pop("_id", None)
        return {"status": "claimed", "pin": _public_view(pin_doc, card=card)}


@router.delete("/{pin_id}")
async def delete_pin(pin_id: str, current_user: User = Depends(get_current_user)):
    pin = await db.map_pins.find_one({"id": pin_id})
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    if pin.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not your pin")
    await db.map_pins.delete_one({"id": pin_id})
    return {"status": "deleted"}


@router.get("/mine")
async def my_pins(current_user: User = Depends(get_current_user)):
    rows = await db.map_pins.find({"user_id": current_user.id}, {"_id": 0}).to_list(500)
    cards = {c["id"]: c async for c in db.cards.find(
        {"id": {"$in": [r["card_id"] for r in rows if r.get("card_id")]}},
        {"_id": 0},
    )}
    return {"pins": [_public_view(r, card=cards.get(r.get("card_id"))) for r in rows]}


@router.get("")
async def list_pins(
    min_lat: float = Query(..., ge=-90, le=90),
    max_lat: float = Query(..., ge=-90, le=90),
    min_lng: float = Query(..., ge=-180, le=180),
    max_lng: float = Query(..., ge=-180, le=180),
    category: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=500),
):
    """Public: pins within a bounding box, optionally filtered by category.

    Used by the map to fetch visible pins when the user pans/zooms.
    """
    if min_lat > max_lat or min_lng > max_lng:
        raise HTTPException(status_code=400, detail="Invalid bounding box")

    query: dict = {
        "is_public": True,
        "lat": {"$gte": min_lat, "$lte": max_lat},
        "lng": {"$gte": min_lng, "$lte": max_lng},
    }
    if category and category in CATEGORY_PRESETS:
        query["category"] = category

    pins = await db.map_pins.find(query, {"_id": 0}).limit(limit).to_list(limit)

    # Fetch associated cards in one batch
    card_ids = [p["card_id"] for p in pins if p.get("card_id")]
    cards = {}
    if card_ids:
        async for c in db.cards.find({"id": {"$in": card_ids}}, {"_id": 0}):
            cards[c["id"]] = c

    return {
        "pins": [_public_view(p, card=cards.get(p.get("card_id"))) for p in pins],
        "count": len(pins),
        "limit": limit,
    }


@router.get("/{pin_id}")
async def get_pin(pin_id: str):
    """Public: detailed view of one pin — used when a user taps a pin on the map."""
    pin = await db.map_pins.find_one({"id": pin_id, "is_public": True}, {"_id": 0})
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    card = None
    if pin.get("card_id"):
        card = await db.cards.find_one({"id": pin["card_id"]}, {"_id": 0})
    owner = None
    if pin.get("user_id"):
        owner = await db.users.find_one({"id": pin["user_id"]}, {"_id": 0, "name": 1, "avatar_url": 1})
    return {"pin": _public_view(pin, owner=owner, card=card)}


@router.patch("/{pin_id}")
async def update_pin(
    pin_id: str,
    payload: MapPinUpdate,
    current_user: User = Depends(get_current_user),
):
    pin = await db.map_pins.find_one({"id": pin_id})
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    if pin.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not your pin")
    if payload.category and payload.category not in CATEGORY_PRESETS:
        raise HTTPException(status_code=400, detail="Invalid category")

    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.map_pins.update_one({"id": pin_id}, {"$set": updates})
    refreshed = await db.map_pins.find_one({"id": pin_id}, {"_id": 0})
    return {"status": "updated", "pin": _public_view(refreshed)}
