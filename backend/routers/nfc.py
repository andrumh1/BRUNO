"""NFC routes — activation, resolution, product configuration, and lock state.
Extracted from server.py to reduce monolith size.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import Optional
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

router = APIRouter(prefix="/nfc", tags=["nfc"])


async def _fire_nfc_scan_push(owner_id: str, card: Optional[dict], nfc_id: str) -> None:
    """Best-effort push to the tag owner when their NFC is scanned.
    Swallows all errors so it never blocks the scanning user's redirect.
    """
    try:
        from routers.push_notifications import notify_nfc_scan
        await notify_nfc_scan(
            user_id=owner_id,
            card_id=card.get("id") if card else None,
            card_title=card.get("title") if card else None,
            card_image=(card.get("banner_url") or card.get("avatar_url")) if card else None,
            nfc_id=nfc_id,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"NFC scan push failed for owner={owner_id}: {e}")


# ─── Models ──────────────────────────────────────────────────────────────────

class NFCCard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nfc_id: str
    user_id: str
    card_id: Optional[str] = None
    product_id: Optional[str] = None
    product_type: Optional[str] = None
    config: Optional[dict] = None
    is_active: bool = False
    is_locked: bool = True
    lock_pin: Optional[str] = None
    activated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NFCActivate(BaseModel):
    nfc_id: str
    card_id: str


class NFCProductConfig(BaseModel):
    nfc_id: str
    product_id: str
    config: dict = {}


class NFCLockUpdate(BaseModel):
    nfc_id: str
    lock_pin: Optional[str] = None
    is_locked: bool = True


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.post("/activate")
async def activate_nfc(nfc_input: NFCActivate, current_user: User = Depends(get_current_user)):
    card = await db.cards.find_one({"id": nfc_input.card_id, "user_id": current_user.id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    nfc_card = await db.nfc_cards.find_one({"nfc_id": nfc_input.nfc_id})
    if nfc_card:
        await db.nfc_cards.update_one(
            {"nfc_id": nfc_input.nfc_id},
            {"$set": {
                "card_id": nfc_input.card_id,
                "user_id": current_user.id,
                "is_active": True,
                "activated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
    else:
        nfc_card_obj = NFCCard(
            nfc_id=nfc_input.nfc_id,
            user_id=current_user.id,
            card_id=nfc_input.card_id,
            is_active=True,
            activated_at=datetime.now(timezone.utc),
        )
        nfc_doc = nfc_card_obj.model_dump()
        nfc_doc['created_at'] = nfc_doc['created_at'].isoformat()
        if nfc_doc['activated_at']:
            nfc_doc['activated_at'] = nfc_doc['activated_at'].isoformat()
        await db.nfc_cards.insert_one(nfc_doc)

    return {"message": "NFC card activated successfully", "nfc_id": nfc_input.nfc_id, "card_id": nfc_input.card_id}


@router.get("/resolve/{nfc_id}")
async def resolve_nfc_card(nfc_id: str):
    nfc_card = await db.nfc_cards.find_one({"nfc_id": nfc_id}, {"_id": 0})
    if not nfc_card:
        return {"found": False, "message": "NFC tag not registered", "redirect_url": None, "nfc_id": nfc_id}

    card_id = nfc_card.get("card_id")
    if not card_id:
        return {"found": False, "message": "NFC tag not linked to a card", "redirect_url": None, "nfc_id": nfc_id}

    card = await db.cards.find_one({"id": card_id}, {"_id": 0})
    if not card:
        return {"found": False, "message": "Linked card no longer exists", "redirect_url": None, "nfc_id": nfc_id}

    # Fire-and-forget push to the owner ("your card came to life")
    if nfc_card.get("user_id"):
        asyncio.create_task(_fire_nfc_scan_push(nfc_card["user_id"], card, nfc_id))

    frontend_url = os.environ.get('FRONTEND_URL')
    return {
        "found": True,
        "card_id": card_id,
        "card_title": card.get("title", ""),
        "redirect_url": f"{frontend_url}/c/{card_id}",
        "nfc_id": nfc_id,
    }


@router.get("/go/{nfc_id}")
async def nfc_direct_redirect(nfc_id: str):
    """HTTP 302 redirect — instant resolution without SPA load."""
    nfc_card = await db.nfc_cards.find_one({"nfc_id": nfc_id}, {"_id": 0})
    frontend_url = os.environ.get('FRONTEND_URL', '')

    if not nfc_card or not nfc_card.get("card_id"):
        return RedirectResponse(url=f"{frontend_url}/n/{nfc_id}", status_code=302)

    card = await db.cards.find_one({"id": nfc_card["card_id"]}, {"_id": 0})
    if not card:
        return RedirectResponse(url=f"{frontend_url}/n/{nfc_id}", status_code=302)

    # Fire-and-forget push to the owner — runs in background, never blocks redirect
    if nfc_card.get("user_id"):
        asyncio.create_task(_fire_nfc_scan_push(nfc_card["user_id"], card, nfc_id))

    return RedirectResponse(url=f"{frontend_url}/c/{nfc_card['card_id']}", status_code=302)


@router.get("/my-cards")
async def get_my_nfc_cards(current_user: User = Depends(get_current_user)):
    nfc_cards = await db.nfc_cards.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
    frontend_url = os.environ.get('FRONTEND_URL', '')

    # Batch fetch card titles to avoid N+1
    card_ids = list({nfc.get("card_id", "") for nfc in nfc_cards if nfc.get("card_id")})
    cards_map = {}
    if card_ids:
        cards_cursor = db.cards.find({"id": {"$in": card_ids}}, {"_id": 0, "id": 1, "title": 1})
        async for c in cards_cursor:
            cards_map[c["id"]] = c.get("title", "")

    for nfc in nfc_cards:
        if isinstance(nfc.get('created_at'), str):
            nfc['created_at'] = datetime.fromisoformat(nfc['created_at'])
        if nfc.get('activated_at') and isinstance(nfc['activated_at'], str):
            nfc['activated_at'] = datetime.fromisoformat(nfc['activated_at'])
        nfc['redirect_url'] = f"{frontend_url}/api/nfc/go/{nfc['nfc_id']}"
        nfc['card_title'] = cards_map.get(nfc.get("card_id", ""), "")

    return nfc_cards


@router.post("/update-card")
async def update_nfc_card_link(nfc_id: str, card_id: str, current_user: User = Depends(get_current_user)):
    nfc_card = await db.nfc_cards.find_one({"nfc_id": nfc_id, "user_id": current_user.id})
    if not nfc_card:
        raise HTTPException(status_code=404, detail="NFC tag not found")

    card = await db.cards.find_one({"id": card_id, "user_id": current_user.id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    await db.nfc_cards.update_one(
        {"nfc_id": nfc_id},
        {"$set": {"card_id": card_id, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    frontend_url = os.environ.get('FRONTEND_URL', '')
    return {
        "message": "NFC card updated",
        "nfc_id": nfc_id,
        "card_id": card_id,
        "redirect_url": f"{frontend_url}/api/nfc/go/{nfc_id}",
    }


@router.post("/configure-product")
async def configure_nfc_product(config_input: NFCProductConfig, current_user: User = Depends(get_current_user)):
    """Configure an NFC tag with product-specific settings. Exclusive to BRUNO app."""
    nfc_card = await db.nfc_cards.find_one({"nfc_id": config_input.nfc_id, "user_id": current_user.id})
    if not nfc_card:
        raise HTTPException(status_code=404, detail="NFC tag not found or not owned by you")

    update_data = {
        "product_id": config_input.product_id,
        "product_type": config_input.product_id.split("-")[1] if "-" in config_input.product_id else "generic",
        "config": config_input.config,
        "is_active": True,
        "is_locked": True,
        "configured_at": datetime.now(timezone.utc).isoformat(),
        "configured_via": "bruno_app",
    }

    await db.nfc_cards.update_one({"nfc_id": config_input.nfc_id}, {"$set": update_data})
    return {"message": "NFC product configured successfully", "nfc_id": config_input.nfc_id, "product_id": config_input.product_id}


@router.post("/lock")
async def update_nfc_lock(lock_input: NFCLockUpdate, current_user: User = Depends(get_current_user)):
    """Lock/unlock an NFC tag. Only the owner can modify through BRUNO app."""
    nfc_card = await db.nfc_cards.find_one({"nfc_id": lock_input.nfc_id, "user_id": current_user.id})
    if not nfc_card:
        raise HTTPException(status_code=404, detail="NFC tag not found or not owned by you")

    update_data = {
        "is_locked": lock_input.is_locked,
        "lock_updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if lock_input.lock_pin:
        update_data["lock_pin"] = lock_input.lock_pin

    await db.nfc_cards.update_one({"nfc_id": lock_input.nfc_id}, {"$set": update_data})
    return {"message": f"NFC tag {'locked' if lock_input.is_locked else 'unlocked'}", "nfc_id": lock_input.nfc_id}


@router.get("/resolve-product/{nfc_id}")
async def resolve_nfc_product(nfc_id: str):
    """Resolve NFC product by ID — returns product config if unlocked."""
    nfc_card = await db.nfc_cards.find_one({"nfc_id": nfc_id}, {"_id": 0})
    if not nfc_card:
        return {"found": False, "message": "NFC tag not registered", "nfc_id": nfc_id}

    if nfc_card.get("is_locked") and not nfc_card.get("card_id"):
        return {
            "found": True,
            "locked": True,
            "message": "This tag is locked by BRUNO. Only the owner can modify it.",
            "nfc_id": nfc_id,
        }

    config = nfc_card.get("config", {})
    product_id = nfc_card.get("product_id", "")
    safe_config = {k: v for k, v in config.items() if k != "password"} if config else {}

    result = {
        "found": True,
        "locked": nfc_card.get("is_locked", True),
        "product_id": product_id,
        "product_type": nfc_card.get("product_type", "generic"),
        "config": safe_config,
        "nfc_id": nfc_id,
        "configured_via": nfc_card.get("configured_via", ""),
        "owner_id": nfc_card.get("user_id", ""),
    }

    if nfc_card.get("card_id"):
        card = await db.cards.find_one({"id": nfc_card["card_id"]}, {"_id": 0})
        if card:
            frontend_url = os.environ.get('FRONTEND_URL')
            result["redirect_url"] = f"{frontend_url}/c/{nfc_card['card_id']}"
            result["card_title"] = card.get("title", "")

    return result


@router.get("/product-schemas")
async def get_nfc_product_schemas():
    """Return configuration schemas for each NFC product type."""
    schemas = {
        "nfc-wifi-home": {
            "name": "WiFi Compartido",
            "fields": [
                {"key": "ssid", "label": "Nombre de Red (SSID)", "type": "text", "required": True},
                {"key": "password", "label": "Contrasena WiFi", "type": "password", "required": True},
                {"key": "encryption", "label": "Tipo de Encriptacion", "type": "select", "options": ["WPA2", "WPA3", "WEP", "Abierta"], "required": True},
                {"key": "hidden_network", "label": "Red Oculta", "type": "boolean", "required": False},
            ],
        },
        "nfc-wifi-comercio": {
            "name": "WiFi Comercial",
            "fields": [
                {"key": "ssid", "label": "Nombre de Red (SSID)", "type": "text", "required": True},
                {"key": "password", "label": "Contrasena WiFi", "type": "password", "required": True},
                {"key": "encryption", "label": "Tipo de Encriptacion", "type": "select", "options": ["WPA2", "WPA3", "WEP", "Portal Cautivo"], "required": True},
                {"key": "business_name", "label": "Nombre del Negocio", "type": "text", "required": False},
                {"key": "welcome_message", "label": "Mensaje de Bienvenida", "type": "textarea", "required": False},
            ],
        },
        "nfc-emergencia": {
            "name": "Tag de Emergencia",
            "fields": [
                {"key": "full_name", "label": "Nombre Completo", "type": "text", "required": True},
                {"key": "blood_type", "label": "Tipo de Sangre", "type": "select", "options": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], "required": True},
                {"key": "allergies", "label": "Alergias", "type": "textarea", "required": False},
                {"key": "medical_conditions", "label": "Condiciones Medicas", "type": "textarea", "required": False},
                {"key": "medications", "label": "Medicamentos Actuales", "type": "textarea", "required": False},
                {"key": "emergency_contact_1", "label": "Contacto de Emergencia 1", "type": "text", "required": True},
                {"key": "emergency_phone_1", "label": "Telefono Emergencia 1", "type": "tel", "required": True},
                {"key": "emergency_contact_2", "label": "Contacto de Emergencia 2", "type": "text", "required": False},
                {"key": "emergency_phone_2", "label": "Telefono Emergencia 2", "type": "tel", "required": False},
                {"key": "doctor_name", "label": "Medico de Cabecera", "type": "text", "required": False},
                {"key": "doctor_phone", "label": "Telefono del Medico", "type": "tel", "required": False},
                {"key": "insurance", "label": "Seguro Medico", "type": "text", "required": False},
            ],
        },
        "nfc-despensa": {
            "name": "Lista de Despensa",
            "fields": [
                {"key": "list_name", "label": "Nombre de la Lista", "type": "text", "required": True},
                {"key": "items", "label": "Articulos (uno por linea)", "type": "textarea", "required": False},
                {"key": "shared_with", "label": "Compartir con (emails)", "type": "text", "required": False},
            ],
        },
        "nfc-alarma": {
            "name": "Tag de Alarma",
            "fields": [
                {"key": "alarm_system", "label": "Sistema de Alarma", "type": "text", "required": True},
                {"key": "zone", "label": "Zona", "type": "text", "required": False},
                {"key": "action", "label": "Accion al Escanear", "type": "select", "options": ["Activar", "Desactivar", "Toggle"], "required": True},
            ],
        },
        "nfc-redes-sociales": {
            "name": "Redes Sociales",
            "fields": [
                {"key": "instagram", "label": "Instagram", "type": "text", "required": False},
                {"key": "tiktok", "label": "TikTok", "type": "text", "required": False},
                {"key": "facebook", "label": "Facebook", "type": "text", "required": False},
                {"key": "twitter", "label": "X (Twitter)", "type": "text", "required": False},
                {"key": "youtube", "label": "YouTube", "type": "text", "required": False},
                {"key": "linkedin", "label": "LinkedIn", "type": "text", "required": False},
                {"key": "whatsapp", "label": "WhatsApp", "type": "tel", "required": False},
                {"key": "telegram", "label": "Telegram", "type": "text", "required": False},
            ],
        },
        "nfc-pet-basico": {
            "name": "Tag Mascota",
            "fields": [
                {"key": "pet_name", "label": "Nombre de la Mascota", "type": "text", "required": True},
                {"key": "species", "label": "Especie", "type": "select", "options": ["Perro", "Gato", "Ave", "Conejo", "Otro"], "required": True},
                {"key": "breed", "label": "Raza", "type": "text", "required": False},
                {"key": "color", "label": "Color", "type": "text", "required": False},
                {"key": "age", "label": "Edad", "type": "text", "required": False},
                {"key": "owner_name", "label": "Nombre del Dueno", "type": "text", "required": True},
                {"key": "owner_phone", "label": "Telefono del Dueno", "type": "tel", "required": True},
                {"key": "owner_email", "label": "Email del Dueno", "type": "email", "required": False},
                {"key": "vet_name", "label": "Veterinario", "type": "text", "required": False},
                {"key": "vet_phone", "label": "Telefono Veterinario", "type": "tel", "required": False},
                {"key": "vaccinations", "label": "Vacunas al dia", "type": "boolean", "required": False},
                {"key": "microchip_id", "label": "ID Microchip", "type": "text", "required": False},
            ],
        },
        "nfc-pet-gps": {
            "name": "Tag Mascota GPS",
            "fields": [
                {"key": "pet_name", "label": "Nombre de la Mascota", "type": "text", "required": True},
                {"key": "species", "label": "Especie", "type": "select", "options": ["Perro", "Gato", "Ave", "Conejo", "Otro"], "required": True},
                {"key": "breed", "label": "Raza", "type": "text", "required": False},
                {"key": "owner_name", "label": "Nombre del Dueno", "type": "text", "required": True},
                {"key": "owner_phone", "label": "Telefono del Dueno", "type": "tel", "required": True},
                {"key": "safe_zone_radius", "label": "Radio Zona Segura (metros)", "type": "number", "required": False},
                {"key": "alert_email", "label": "Email para Alertas", "type": "email", "required": False},
            ],
        },
        "nfc-collar-completo": {
            "name": "Collar Inteligente",
            "fields": [
                {"key": "pet_name", "label": "Nombre de la Mascota", "type": "text", "required": True},
                {"key": "species", "label": "Especie", "type": "select", "options": ["Perro", "Gato"], "required": True},
                {"key": "breed", "label": "Raza", "type": "text", "required": False},
                {"key": "weight", "label": "Peso (kg)", "type": "number", "required": False},
                {"key": "owner_name", "label": "Nombre del Dueno", "type": "text", "required": True},
                {"key": "owner_phone", "label": "Telefono del Dueno", "type": "tel", "required": True},
                {"key": "activity_goal", "label": "Meta de Actividad Diaria (min)", "type": "number", "required": False},
                {"key": "safe_zone_radius", "label": "Radio Zona Segura (metros)", "type": "number", "required": False},
            ],
        },
        "nfc-citas": {
            "name": "Agenda de Citas",
            "fields": [
                {"key": "business_name", "label": "Nombre del Negocio", "type": "text", "required": True},
                {"key": "service_type", "label": "Tipo de Servicio", "type": "text", "required": True},
                {"key": "calendar_url", "label": "URL del Calendario", "type": "url", "required": False},
                {"key": "phone", "label": "Telefono para Citas", "type": "tel", "required": True},
                {"key": "whatsapp", "label": "WhatsApp para Citas", "type": "tel", "required": False},
                {"key": "address", "label": "Direccion", "type": "text", "required": False},
            ],
        },
        "nfc-pagos": {
            "name": "Metodos de Pago",
            "fields": [
                {"key": "business_name", "label": "Nombre / Negocio", "type": "text", "required": True},
                {"key": "paypal_link", "label": "Link PayPal", "type": "url", "required": False},
                {"key": "stripe_link", "label": "Link Stripe", "type": "url", "required": False},
                {"key": "bank_name", "label": "Banco", "type": "text", "required": False},
                {"key": "account_number", "label": "Numero de Cuenta", "type": "text", "required": False},
                {"key": "zelle_email", "label": "Zelle Email/Telefono", "type": "text", "required": False},
                {"key": "crypto_wallet", "label": "Wallet Crypto", "type": "text", "required": False},
            ],
        },
        "nfc-apps": {
            "name": "Descarga de Apps",
            "fields": [
                {"key": "app_name", "label": "Nombre de la App", "type": "text", "required": True},
                {"key": "app_store_url", "label": "URL App Store (iOS)", "type": "url", "required": False},
                {"key": "play_store_url", "label": "URL Play Store (Android)", "type": "url", "required": False},
                {"key": "web_app_url", "label": "URL Web App", "type": "url", "required": False},
            ],
        },
        "nfc-menu-qr": {
            "name": "Menu Virtual",
            "fields": [
                {"key": "restaurant_name", "label": "Nombre del Restaurante", "type": "text", "required": True},
                {"key": "menu_url", "label": "URL del Menu", "type": "url", "required": True},
                {"key": "phone", "label": "Telefono", "type": "tel", "required": False},
                {"key": "delivery_url", "label": "URL de Delivery", "type": "url", "required": False},
                {"key": "special_message", "label": "Mensaje Especial", "type": "textarea", "required": False},
            ],
        },
        "nfc-inventario": {
            "name": "Control de Inventario",
            "fields": [
                {"key": "item_name", "label": "Nombre del Articulo", "type": "text", "required": True},
                {"key": "category", "label": "Categoria", "type": "text", "required": False},
                {"key": "location", "label": "Ubicacion", "type": "text", "required": False},
                {"key": "quantity", "label": "Cantidad", "type": "number", "required": False},
                {"key": "notes", "label": "Notas", "type": "textarea", "required": False},
            ],
        },
        "nfc-acceso": {
            "name": "Control de Acceso",
            "fields": [
                {"key": "zone_name", "label": "Nombre de la Zona", "type": "text", "required": True},
                {"key": "access_level", "label": "Nivel de Acceso", "type": "select", "options": ["Basico", "Empleado", "Gerente", "Admin", "VIP"], "required": True},
                {"key": "valid_hours", "label": "Horario Valido", "type": "text", "required": False},
                {"key": "notes", "label": "Notas", "type": "textarea", "required": False},
            ],
        },
        "nfc-llavero-gps": {
            "name": "Llavero GPS",
            "fields": [
                {"key": "item_name", "label": "Nombre del Item", "type": "text", "required": True},
                {"key": "owner_name", "label": "Nombre del Dueno", "type": "text", "required": True},
                {"key": "owner_phone", "label": "Telefono", "type": "tel", "required": True},
                {"key": "reward_message", "label": "Mensaje de Recompensa", "type": "textarea", "required": False},
            ],
        },
        "nfc-ar-productos": {
            "name": "AR para Productos",
            "fields": [
                {"key": "product_name", "label": "Nombre del Producto", "type": "text", "required": True},
                {"key": "model_url", "label": "URL Modelo 3D", "type": "url", "required": False},
                {"key": "product_url", "label": "URL del Producto (e-commerce)", "type": "url", "required": False},
                {"key": "description", "label": "Descripcion", "type": "textarea", "required": False},
            ],
        },
    }

    for pid in ["nfc-card-black", "nfc-card-white", "nfc-card-orange", "nfc-card-gold", "nfc-card-holographic", "nfc-carnet"]:
        schemas[pid] = {
            "name": "Tarjeta NFC Personal/Empresarial",
            "fields": [
                {"key": "linked_card_id", "label": "Tarjeta Digital Vinculada", "type": "card_selector", "required": True},
                {"key": "custom_url", "label": "URL Personalizada (opcional)", "type": "url", "required": False},
            ],
        }

    return schemas
