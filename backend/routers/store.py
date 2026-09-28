"""Store / PIUP Shop routes."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
from typing import List, Optional
import uuid
import os

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from models.user import User

router = APIRouter(prefix="/store", tags=["store"])

# Try to import Stripe
try:
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

# ============================================================================
# MODELS
# ============================================================================

class ProductCategory(str):
    NFC_CARD = "nfc_card"
    NFC_BRACELET = "nfc_bracelet"
    NFC_PET_TAG = "nfc_pet_tag"
    MEMBERSHIP = "membership"
    SERVICE = "service"


class StoreProduct(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    category: str
    price: float
    currency: str = "USD"
    image_url: Optional[str] = None
    colors: List[str] = []
    features: List[str] = []
    for_card_type: Optional[str] = None
    is_active: bool = True
    stock: int = -1
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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


class StoreOrderStatus(str):
    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class StoreOrderItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    price: float
    color: Optional[str] = None
    options: dict = {}


class StoreOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[StoreOrderItem] = []
    subtotal: float
    shipping_cost: float = 0
    tax: float = 0
    total: float
    currency: str = "USD"
    status: str = StoreOrderStatus.PENDING_PAYMENT
    shipping_address: Optional[ShippingAddress] = None
    billing_address: Optional[ShippingAddress] = None
    payment_method_id: Optional[str] = None
    stripe_session_id: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    tracking_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreateOrderRequest(BaseModel):
    items: List[dict]  # [{product_id, quantity, color?, options?}]
    shipping_address: ShippingAddress
    notes: Optional[str] = None


# ============================================================================
# PIUP PRODUCTS DATA
# ============================================================================

# Medidas PIUP: C=Círculo, U=Cuadrado, R=Rectángulo · 1=1x1 2=3x3 3=5x5 4=7x7 (C/U) · 5=3x5 6=4x7 7=ID (R)
PIUP_SIZES = {
    "C1": {"shape": "Círculo", "dims": "1x1 cm"}, "C2": {"shape": "Círculo", "dims": "3x3 cm"}, "C3": {"shape": "Círculo", "dims": "5x5 cm"}, "C4": {"shape": "Círculo", "dims": "7x7 cm"},
    "U1": {"shape": "Cuadrado", "dims": "1x1 cm"}, "U2": {"shape": "Cuadrado", "dims": "3x3 cm"}, "U3": {"shape": "Cuadrado", "dims": "5x5 cm"}, "U4": {"shape": "Cuadrado", "dims": "7x7 cm"},
    "R5": {"shape": "Rectángulo", "dims": "3x5 cm"}, "R6": {"shape": "Rectángulo", "dims": "4x7 cm"}, "R7": {"shape": "Rectángulo", "dims": "Tarjeta ID (8.6x5.4 cm)"},
}
SIZE_PRICE = {"1": 9.99, "2": 12.99, "3": 15.99, "4": 19.99, "5": 14.99, "6": 17.99, "7": 24.99}

PIUP_GROUPS = [
    {"id": "hogar", "name": "Hogar", "icon": "🏠"},
    {"id": "comercios", "name": "Restaurantes y Comercios", "icon": "🍽️"},
    {"id": "oficinas", "name": "Oficinas", "icon": "🏢"},
    {"id": "mascotas", "name": "Mascotas", "icon": "🐾"},
]

def _piup(pid, name, group, desc, sizes, category="nfc_card", for_card_type=None, price=None, colors=None, image=None, features=None):
    sizes = sizes.split()
    base = price or min(SIZE_PRICE[c[1]] for c in sizes)
    return {"id": pid, "name": name, "group": group, "description": desc, "category": category, "price": base,
            "sizes": sizes, "size_options": [{"code": c, **PIUP_SIZES[c], "price": price or SIZE_PRICE[c[1]]} for c in sizes],
            "options_count": len(sizes), "colors": colors or ["black", "white", "orange"], "features": features or ["Chip NFC NTAG", "QR de respaldo", "Compatible iOS/Android", "Configurable desde BRUNO PIUP"],
            "for_card_type": for_card_type, "image_url": image or f"/products/{pid}.png"}

PIUP_PRODUCTS = [
    # ── HOGAR ──
    _piup("piup-wifi", "PIUP Clave de WiFi", "hogar", "Ubica la red WiFi y conecta el celular al instante: solo hay que dar Aceptar para confirmar.", "C1 C2 U1 U2 R7"),
    _piup("piup-despensa", "PIUP Lista de Despensa", "hogar", "Al acercar el celular abre notas con selector de productos y despensa, dentro de PIUP.", "C2 C3 U2 U3 R7"),
    _piup("piup-alarmas", "PIUP Activación de Alarmas", "hogar", "Direcciona a las alarmas del celular y programa la alarma que desees.", "C1 C2 U1 U2 R7"),
    _piup("piup-mensajes", "PIUP Envío Instantáneo de Mensajes", "hogar", "Configura acciones: abrir WhatsApp y enviar texto, ubicación o imagen a una persona específica.", "C1 C2 U1 U2 R7"),
    _piup("piup-llavero-gps", "PIUP Llavero GPS", "hogar", "Mapa con ubicación en tiempo real, rutas realizadas e historial del dispositivo.", "C1 U1", category="nfc_pet_tag", price=39.99, colors=["black", "white"], features=["GPS en tiempo real", "Historial de rutas", "Batería 6 meses", "Resistente al agua"]),
    # ── RESTAURANTES Y COMERCIOS ──
    _piup("piup-menu", "PIUP Descarga de Menú Virtual", "comercios", "Hipervínculo que descarga un formato, app o página web con el menú.", "C2 C3 C4 U2 U3 U4 R5 R6", for_card_type="lugares"),
    _piup("piup-redes-qr", "PIUP Redes Sociales con QR", "comercios", "Direcciona a las redes sociales o abre una BRUNO Card con todas las redes agregadas.", "C2 C3 C4 U2 U3 U4 R5 R6 R7", for_card_type="negocio"),
    _piup("piup-ar", "PIUP QR para AR", "comercios", "Abre un documento 3D en realidad aumentada con la cámara (tamaño adaptable al documento).", "C1 U1", category="service", price=149.99, features=["Modelo 3D", "Simulador AR con cámara", "Adaptable al documento"]),
    # ── OFICINAS ──
    _piup("piup-citas", "PIUP Sacar Citas", "oficinas", "Calendario con el correo, calendario propio o links a sistemas externos.", "C2 C3 U2 U3 R5 R6 R7", for_card_type="servicios"),
    _piup("piup-apps", "PIUP Descarga de Aplicaciones", "oficinas", "Links direccionadores a App Store y Play Store.", "C2 C3 C4 U2 U3 U4 R5 R6 R7"),
    _piup("piup-calendario", "PIUP Calendario de Citas", "oficinas", "Calendario con el correo, calendario propio o links a sistemas externos.", "C2 C3 U2 U3 R5 R6 R7", for_card_type="servicios"),
    _piup("piup-pagos", "PIUP Métodos de Pago", "oficinas", "Rutas y datos bancarios para transferencia, pagos directos por Stripe.", "C2 C3 C4 U2 U3 U4 R5 R6 R7", for_card_type="negocio"),
    _piup("piup-web", "PIUP Páginas Web", "oficinas", "Links direccionadores a tu sitio web.", "C2 C3 C4 U2 U3 U4 R5 R6 R7"),
    _piup("piup-inventario", "PIUP Control de Inventario", "oficinas", "Sistema profesional de inventario propio de PIUP o links a sistemas externos.", "C1 C2 U1 U2 R7"),
    _piup("piup-acceso", "PIUP Claves de Acceso", "oficinas", "Códigos de acceso (puertas, llaves) y acciones de sistemas de seguridad de casa u oficina.", "C1 C2 U1 U2 R7"),
    _piup("piup-archivos", "PIUP Presentación de Archivos", "oficinas", "Descarga de un archivo específico guardado directamente en PIUP.", "C1 C2 U1 U2 R7"),
    _piup("piup-tarjetas", "PIUP Tarjetas de Presentación", "oficinas", "Direcciona a BRUNO Card con tus Digital Business Cards.", "R7", for_card_type="personal", colors=["black", "white", "orange", "gold", "holographic"]),
    _piup("piup-carnets", "PIUP Carnets", "oficinas", "Carnets corporativos que funcionan junto con PIUP Claves de Acceso.", "R7", for_card_type="empresarial", colors=["white", "black"]),
    # ── MASCOTAS ──
    _piup("piup-collar-mascota", "PIUP Collar Mascota NFC + GPS", "mascotas", "Collares con placa NFC, GPS incluido y QR de respaldo.", "C1 U1", category="nfc_pet_tag", price=49.99, for_card_type="mascotas", colors=["blue", "pink", "green", "black"], features=["Placa NFC + QR", "GPS en tiempo real", "Zona segura", "Resistente al agua"]),
]

SUBSCRIPTION_PLANS = [
    {"brand": "MEOW", "brand_id": "meow", "icon": "🔵", "color": "#2563EB", "tagline": "Marketing y automatización para tu marca", "plans": [
        {"id": "meow-starter", "name": "Starter", "monthly": 15, "yearly": 150, "summary": "Marketing básico"},
        {"id": "meow-growth", "name": "Growth", "monthly": 29, "yearly": 290, "summary": "Automatizaciones", "popular": True},
        {"id": "meow-pro", "name": "Pro", "monthly": 49, "yearly": 490, "summary": "Marketing avanzado + IA"},
        {"id": "meow-business", "name": "Business", "monthly": 79, "yearly": 790, "summary": "Empresas/equipos"},
    ]},
    {"brand": "DEAL", "brand_id": "deal", "icon": "🟢", "color": "#16A34A", "tagline": "CRM y ventas con IA NOAH", "plans": [
        {"id": "deal-starter", "name": "Starter", "monthly": 39, "yearly": 390, "summary": "CRM para pequeños negocios"},
        {"id": "deal-professional", "name": "Professional", "monthly": 79, "yearly": 790, "summary": "Ventas + clientes + IA NOAH", "popular": True},
        {"id": "deal-business", "name": "Business", "monthly": 149, "yearly": 1490, "summary": "Equipos comerciales"},
        {"id": "deal-enterprise", "name": "Enterprise", "monthly": 249, "yearly": 2490, "summary": "Operación comercial avanzada"},
    ]},
]
PLAN_IDS = {p["id"] for b in SUBSCRIPTION_PLANS for p in b["plans"]} | {"pro", "business"}


# ============================================================================
# ROUTES
# ============================================================================

@router.get("/sizes")
async def get_piup_sizes():
    return {"sizes": PIUP_SIZES, "groups": PIUP_GROUPS}


@router.get("/plans")
async def get_subscription_plans():
    return SUBSCRIPTION_PLANS


@router.get("/products")
async def get_store_products(
    category: Optional[str] = None,
    for_card_type: Optional[str] = None
):
    """Get all store products with optional filters"""
    products = PIUP_PRODUCTS.copy()
    
    if category:
        products = [p for p in products if p["category"] == category]
    
    if for_card_type:
        products = [p for p in products if p.get("for_card_type") == for_card_type or p.get("for_card_type") is None]
    
    return products


@router.get("/products/{product_id}")
async def get_store_product(product_id: str):
    """Get a single store product"""
    for product in PIUP_PRODUCTS:
        if product["id"] == product_id:
            return product
    raise HTTPException(status_code=404, detail="Product not found")


@router.post("/orders")
async def create_store_order(
    order_data: CreateOrderRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new store order"""
    # Calculate totals
    items = []
    subtotal = 0
    
    for item in order_data.items:
        product = None
        for p in PIUP_PRODUCTS:
            if p["id"] == item["product_id"]:
                product = p
                break
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item['product_id']} not found")
        
        order_item = StoreOrderItem(
            product_id=product["id"],
            product_name=product["name"],
            quantity=item.get("quantity", 1),
            price=product["price"],
            color=item.get("color"),
            options=item.get("options", {})
        )
        items.append(order_item)
        subtotal += product["price"] * order_item.quantity
    
    # Calculate shipping (simplified)
    shipping_cost = 9.99 if subtotal < 50 else 0
    tax = subtotal * 0.16  # 16% tax
    total = subtotal + shipping_cost + tax
    
    # Create order
    order = StoreOrder(
        user_id=current_user.id,
        items=items,
        subtotal=round(subtotal, 2),
        shipping_cost=round(shipping_cost, 2),
        tax=round(tax, 2),
        total=round(total, 2),
        shipping_address=order_data.shipping_address,
        notes=order_data.notes
    )
    
    order_doc = order.model_dump()
    order_doc['created_at'] = order_doc['created_at'].isoformat()
    order_doc['updated_at'] = order_doc['updated_at'].isoformat()
    order_doc['items'] = [item.model_dump() for item in items]
    order_doc['shipping_address'] = order_data.shipping_address.model_dump() if order_data.shipping_address else None
    
    await db.store_orders.insert_one(order_doc)
    
    # Return without _id
    order_doc.pop("_id", None)
    return order_doc


@router.post("/checkout/{order_id}")
async def create_checkout_session(
    order_id: str,
    current_user: User = Depends(get_current_user)
):
    """Create a Stripe checkout session for an order"""
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    order = await db.store_orders.find_one({
        "id": order_id,
        "user_id": current_user.id
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != StoreOrderStatus.PENDING_PAYMENT:
        raise HTTPException(status_code=400, detail="Order already processed")
    
    frontend_url = os.environ.get('FRONTEND_URL', 'https://bruno.app')
    
    # Build line items
    line_items = []
    for item in order["items"]:
        line_items.append({
            "price_data": {
                "currency": order.get("currency", "usd").lower(),
                "product_data": {"name": item["product_name"]},
                "unit_amount": int(item["price"] * 100)
            },
            "quantity": item["quantity"]
        })
    
    # Add shipping if applicable
    if order.get("shipping_cost", 0) > 0:
        line_items.append({
            "price_data": {
                "currency": order.get("currency", "usd").lower(),
                "product_data": {"name": "Shipping"},
                "unit_amount": int(order["shipping_cost"] * 100)
            },
            "quantity": 1
        })
    
    # Add tax
    if order.get("tax", 0) > 0:
        line_items.append({
            "price_data": {
                "currency": order.get("currency", "usd").lower(),
                "product_data": {"name": "Tax"},
                "unit_amount": int(order["tax"] * 100)
            },
            "quantity": 1
        })
    
    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
        request = CheckoutSessionRequest(
            line_items=line_items,
            success_url=f"{frontend_url}/store/success?order_id={order_id}",
            cancel_url=f"{frontend_url}/store/cancel?order_id={order_id}",
            mode="payment"
        )
        response = await stripe_checkout.create_session(request)
        
        # Update order with session ID
        await db.store_orders.update_one(
            {"id": order_id},
            {"$set": {
                "stripe_session_id": response.session_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"checkout_url": response.url, "session_id": response.session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")


@router.get("/orders")
async def get_user_orders(
    current_user: User = Depends(get_current_user)
):
    """Get user's orders"""
    orders = await db.store_orders.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return orders


@router.get("/orders/{order_id}")
async def get_order(
    order_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a single order"""
    order = await db.store_orders.find_one(
        {"id": order_id, "user_id": current_user.id},
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return order


# Subscription management
@router.post("/subscribe/{tier}")
async def subscribe_to_tier(
    tier: str,
    current_user: User = Depends(get_current_user)
):
    """Subscribe to a tier (Pro or Business)"""
    if tier not in PLAN_IDS:
        raise HTTPException(status_code=400, detail="Invalid tier")
    
    # In production, this would create a Stripe subscription
    # For now, we'll just update the user
    
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "subscription_tier": tier,
            "subscription_expires_at": expires_at.isoformat(),
            "is_verified": True
        }}
    )
    
    return {
        "status": "subscribed",
        "tier": tier,
        "expires_at": expires_at.isoformat()
    }


@router.get("/subscription")
async def get_subscription_status(
    current_user: User = Depends(get_current_user)
):
    """Get user's subscription status"""
    user = await db.users.find_one({"id": current_user.id}, {"_id": 0, "hashed_password": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "tier": user.get("subscription_tier", "free"),
        "is_verified": user.get("is_verified", False),
        "expires_at": user.get("subscription_expires_at")
    }


# Import timedelta for subscription
from datetime import timedelta
