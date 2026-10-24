"""Cards CRUD + QR (extracted from server.py).

Handles the digital business cards of Bruno users: create, list mine,
list public, explore, reorder, get single, update, delete, and generate
a branded QR code that deep-links to `/c/{card_id}`.
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import io
import base64
import os
import logging
from pathlib import Path

import qrcode
from PIL import Image

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user, get_current_user_optional
from utils.card_design import ensure_design, DESIGN_VERSION
from models.user import User
from utils import search_sync

router = APIRouter(prefix="/cards", tags=["cards"])
logger = logging.getLogger(__name__)
ROOT_DIR = Path(__file__).parent.parent


# ─── Models (duplicated to keep the router self-contained) ─────────────

class SocialLink(BaseModel):
    type: str
    label: str
    url: str
    icon: Optional[str] = None


class ContactInfo(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    whatsapp: Optional[str] = None
    website: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None


class Card(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    card_type: str
    title: str = ""
    subtitle: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    gallery_photos: List[str] = []
    background_color: str = "#FF6B35"
    text_color: str = "#FFFFFF"
    social_links: Optional[List[SocialLink]] = []
    contact_info: Optional[ContactInfo] = None
    location: Optional[dict] = None
    locations: List[dict] = []
    template_id: str = "default"
    custom_fields: Optional[dict] = None
    is_public: bool = True
    show_in_feed: bool = True
    is_animated: bool = True
    is_draft: bool = False
    card_design: Optional[dict] = None
    card_design_version: int = 1
    links: List[dict] = []
    showcase: Optional[dict] = None
    legacy_template: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    views: int = 0


class CardCreate(BaseModel):
    card_type: str
    title: str = ""
    subtitle: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    gallery_photos: List[str] = []
    background_color: str = "#FF6B35"
    text_color: str = "#FFFFFF"
    social_links: Optional[List[SocialLink]] = []
    contact_info: Optional[ContactInfo] = None
    location: Optional[dict] = None
    locations: List[dict] = []
    template_id: str = "default"
    custom_fields: Optional[dict] = None
    is_public: bool = True
    show_in_feed: bool = True
    is_animated: bool = True
    is_draft: bool = False
    card_design: Optional[dict] = None
    card_design_version: int = 1
    links: List[dict] = []
    showcase: Optional[dict] = None


class CardUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    gallery_photos: Optional[List[str]] = None
    background_color: Optional[str] = None
    text_color: Optional[str] = None
    social_links: Optional[List[SocialLink]] = None
    contact_info: Optional[ContactInfo] = None
    location: Optional[dict] = None
    locations: Optional[List[dict]] = None
    template_id: Optional[str] = None
    custom_fields: Optional[dict] = None
    is_public: Optional[bool] = None
    show_in_feed: Optional[bool] = None
    is_animated: Optional[bool] = None
    is_draft: Optional[bool] = None
    card_design: Optional[dict] = None
    card_design_version: Optional[int] = None
    card_type: Optional[str] = None
    links: Optional[List[dict]] = None
    showcase: Optional[dict] = None


class ReorderRequest(BaseModel):
    card_ids: List[str]


# ─── Helpers ──────────────────────────────────────────────────────────

NOT_DRAFT = {"is_draft": {"$ne": True}}


def _deserialize(card: dict) -> dict:
    """Convert stored ISO strings back to datetimes for Pydantic hydration."""
    if isinstance(card.get('created_at'), str):
        card['created_at'] = datetime.fromisoformat(card['created_at'])
    if isinstance(card.get('updated_at'), str):
        card['updated_at'] = datetime.fromisoformat(card['updated_at'])
    ensure_design(card)
    return card


# ─── Endpoints ────────────────────────────────────────────────────────

@router.post("", response_model=Card, status_code=status.HTTP_201_CREATED)
async def create_card(card_input: CardCreate, current_user: User = Depends(get_current_user)):
    card_dict = card_input.model_dump()
    card_dict['user_id'] = current_user.id
    if card_dict.get('card_design'):
        card_dict['card_design_version'] = DESIGN_VERSION
    card_obj = Card(**card_dict)

    card_doc = card_obj.model_dump()
    card_doc['created_at'] = card_doc['created_at'].isoformat()
    card_doc['updated_at'] = card_doc['updated_at'].isoformat()

    await db.cards.insert_one(card_doc)
    try:
        await search_sync.index_card(card_doc); await search_sync.index_user(current_user.id)
    except Exception:
        pass
    return card_obj


@router.get("")
async def get_my_cards(
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50,
):
    """User's own cards for panel & management."""
    cards = await db.cards.find(
        {"user_id": current_user.id, "production_hidden": {"$ne": True}}, {"_id": 0}
    ).sort([("sort_order", 1), ("created_at", -1)]).skip(skip).limit(limit).to_list(limit)

    return [Card(**_deserialize(c)) for c in cards]


@router.get("/explore")
async def explore_cards(limit: int = 20, offset: int = 0):
    """Public cards for discovery."""
    query = {
        "is_public": True,
        **NOT_DRAFT,
        "$or": [
            {"show_in_feed": True},
            {"show_in_feed": {"$exists": False}},
        ],
    }
    cards = await db.cards.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    return [Card(**_deserialize(c)) for c in cards]


@router.put("/reorder")
async def reorder_cards(req: ReorderRequest, current_user: User = Depends(get_current_user)):
    """Reorder user's cards by array position."""
    for i, card_id in enumerate(req.card_ids):
        await db.cards.update_one(
            {"id": card_id, "user_id": current_user.id},
            {"$set": {"sort_order": i}},
        )
    return {"status": "ok", "count": len(req.card_ids)}


@router.get("/{card_id}")
async def get_card(
    card_id: str,
    template: Optional[str] = None,
    lang: str = "es",
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if card_id.startswith("example-"):
        # Tarjeta de ejemplo (ficticia): pública, no editable, sin contar vistas ni analítica
        from routers.card_examples import build_card, find_example
        ex = find_example(card_id)
        if not ex:
            raise HTTPException(status_code=404, detail="Card not found")
        return build_card(ex, template or ex["presets"][0], lang if lang in ("es", "en") else "es")
    card_dict = await db.cards.find_one({"id": card_id}, {"_id": 0})
    if not card_dict:
        raise HTTPException(status_code=404, detail="Card not found")

    if not card_dict.get('is_public', False) or card_dict.get('is_draft'):
        if not current_user or card_dict['user_id'] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    card_dict, migrated = ensure_design(card_dict)
    if migrated:
        await db.cards.update_one({"id": card_id}, {"$set": {
            "card_design": card_dict["card_design"],
            "card_design_version": DESIGN_VERSION,
            "legacy_template": card_dict["legacy_template"],
        }})

    await db.cards.update_one({"id": card_id}, {"$inc": {"views": 1}})
    card_dict['views'] = card_dict.get('views', 0) + 1

    return Card(**_deserialize(card_dict))


@router.put("/{card_id}", response_model=Card)
async def update_card(
    card_id: str,
    card_input: CardUpdate,
    current_user: User = Depends(get_current_user),
):
    existing = await db.cards.find_one({"id": card_id, "user_id": current_user.id})
    if not existing:
        raise HTTPException(status_code=404, detail="Card not found")

    update_data = {k: v for k, v in card_input.model_dump().items() if v is not None}
    if "card_design" in update_data:
        update_data["card_design_version"] = DESIGN_VERSION
        if not existing.get("legacy_template"):
            update_data["legacy_template"] = existing.get("template_id") or "default"
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()

    await db.cards.update_one({"id": card_id}, {"$set": update_data})
    updated = await db.cards.find_one({"id": card_id}, {"_id": 0})
    try:
        await search_sync.index_card(updated)
    except Exception:
        pass
    return Card(**_deserialize(updated))


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(card_id: str, current_user: User = Depends(get_current_user)):
    result = await db.cards.delete_one({"id": card_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    try:
        await search_sync.remove_card(card_id)
    except Exception:
        pass
    return None


@router.get("/{card_id}/qr")
async def get_card_qr(card_id: str, template: Optional[str] = None, lang: Optional[str] = None):
    """Generate a branded QR code (PNG data-URL) that deep-links to the card."""
    frontend_url = os.environ.get('PUBLIC_BASE_URL') or os.environ.get('FRONTEND_URL')
    if card_id.startswith("example-"):
        from routers.card_examples import find_example
        ex = find_example(card_id)
        if not ex:
            raise HTTPException(status_code=404, detail="Card not found")
        card_dict = {"background_color": "#474747"}
        card_url = f"{frontend_url}/c/{card_id}?template={template or ex['presets'][0]}&lang={lang if lang in ('es', 'en') else 'es'}"
    else:
        card_dict = await db.cards.find_one({"id": card_id}, {"_id": 0})
        if not card_dict:
            raise HTTPException(status_code=404, detail="Card not found")
        card_url = f"{frontend_url}/c/{card_id}"
    fill_color = card_dict.get('background_color', '#FF5A00')

    qr = qrcode.QRCode(
        version=2,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=12,
        border=3,
    )
    qr.add_data(card_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color=fill_color, back_color="white").convert('RGB')

    # Overlay BRUNO logo in center (best-effort).
    try:
        logo_path = ROOT_DIR.parent / 'frontend' / 'public' / 'bruno-qr-logo.png'
        if not logo_path.exists():
            logo_path = ROOT_DIR.parent / 'frontend' / 'public' / 'bruno-mascot.png'
        if logo_path.exists():
            logo = Image.open(logo_path)
            qr_w, qr_h = img.size
            max_w = int(qr_w * 0.30)
            max_h = int(qr_h * 0.15)
            lw, lh = logo.size
            ratio = min(max_w / lw, max_h / lh)
            logo = logo.resize((int(lw * ratio), int(lh * ratio)), Image.Resampling.LANCZOS)
            if logo.mode != 'RGBA':
                logo = logo.convert('RGBA')
            pad = 10
            bg = Image.new('RGBA', (logo.size[0] + pad * 2, logo.size[1] + pad * 2), (255, 255, 255, 255))
            bg.paste(logo, (pad, pad), logo)
            pos = ((qr_w - bg.size[0]) // 2, (qr_h - bg.size[1]) // 2)
            final = Image.new('RGB', bg.size, (255, 255, 255))
            final.paste(bg, mask=bg.split()[3])
            img.paste(final, pos)
    except Exception as e:
        logger.warning(f"Could not add logo to QR code: {e}")

    buffer = io.BytesIO()
    img.save(buffer, format='PNG', optimize=True)
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode()

    return {
        "qr_code": f"data:image/png;base64,{img_base64}",
        "card_url": card_url,
        "color": fill_color,
        "note": "QR optimizado para miniatura - funciona incluso impreso pequeño",
    }


# ─── Public-cards endpoint (uses different prefix) ─────────────────────
# Registered as a separate small router in server.py because the path
# is `/public/cards`, outside the `/cards` prefix.

public_router = APIRouter(prefix="/public", tags=["cards"])


@public_router.get("/cards")
async def get_public_cards(skip: int = 0, limit: int = 50):
    """Public cards for the Feed."""
    query = {
        "is_public": True,
        **NOT_DRAFT,
        "$or": [
            {"show_in_feed": True},
            {"show_in_feed": {"$exists": False}},
        ],
    }
    cards = await db.cards.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [Card(**_deserialize(c)) for c in cards]
