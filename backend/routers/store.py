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

PIUP_PRODUCTS = [
    # NFC Cards
    {"id": "nfc-card-black", "name": "Tarjeta NFC BRUNO Negro", "description": "Tarjeta NFC premium color negro mate con chip de alta frecuencia.", "category": "nfc_card", "price": 29.99, "colors": ["black"], "features": ["NFC de alta frecuencia", "Diseño premium", "Compatible con iOS/Android", "Grabado láser incluido"], "for_card_type": "personal", "image_url": "/products/nfc-black.png"},
    {"id": "nfc-card-white", "name": "Tarjeta NFC BRUNO Blanco", "description": "Tarjeta NFC elegante color blanco con acabado brillante.", "category": "nfc_card", "price": 29.99, "colors": ["white"], "features": ["NFC de alta frecuencia", "Acabado brillante", "Compatible con iOS/Android", "Grabado láser incluido"], "for_card_type": "personal", "image_url": "/products/nfc-white.png"},
    {"id": "nfc-card-orange", "name": "Tarjeta NFC BRUNO Naranja", "description": "Tarjeta NFC signature color naranja BRUNO.", "category": "nfc_card", "price": 34.99, "colors": ["orange"], "features": ["Color signature BRUNO", "NFC premium", "Compatible universal", "Diseño exclusivo"], "for_card_type": "personal", "image_url": "/products/nfc-orange.png"},
    {"id": "nfc-card-gold", "name": "Tarjeta NFC BRUNO Dorado", "description": "Tarjeta NFC de lujo con acabado dorado.", "category": "nfc_card", "price": 49.99, "colors": ["gold"], "features": ["Acabado dorado premium", "NFC de alta frecuencia", "Presentación de lujo", "Grabado personalizado"], "for_card_type": "negocio", "image_url": "/products/nfc-gold.png"},
    {"id": "nfc-card-holographic", "name": "Tarjeta NFC BRUNO Holográfica", "description": "Tarjeta NFC con efecto holográfico único.", "category": "nfc_card", "price": 44.99, "colors": ["holographic"], "features": ["Efecto holográfico", "NFC premium", "Diseño futurista", "Edición limitada"], "for_card_type": "personal", "image_url": "/products/nfc-holo.png"},
    {"id": "nfc-carnet", "name": "Carnet Empresarial NFC", "description": "Carnets corporativos con NFC integrado para empresas.", "category": "nfc_card", "price": 24.99, "colors": ["white", "black"], "features": ["Personalización corporativa", "NFC integrado", "Impresión full color", "Mínimo 10 unidades"], "for_card_type": "empresarial", "image_url": "/products/carnet.png"},
    
    # Home
    {"id": "nfc-wifi-home", "name": "NFC WiFi Compartido", "description": "Tag NFC para compartir tu WiFi con visitantes.", "category": "nfc_card", "price": 14.99, "colors": ["white", "black"], "features": ["Conexión instantánea", "Sin revelar contraseña", "Diseño discreto"], "for_card_type": None, "image_url": "/products/wifi-tag.png"},
    {"id": "nfc-despensa", "name": "Lista de Despensa NFC", "description": "Tag para lista de compras inteligente.", "category": "nfc_card", "price": 12.99, "colors": ["white"], "features": ["Lista compartida", "Actualización en tiempo real", "Integración con apps"], "for_card_type": None, "image_url": "/products/despensa.png"},
    {"id": "nfc-alarma", "name": "Tag de Alarma", "description": "Activación/desactivación de alarma por NFC.", "category": "nfc_card", "price": 19.99, "colors": ["black", "white"], "features": ["Control de alarma", "Registro de accesos", "Compatible sistemas"], "for_card_type": None, "image_url": "/products/alarma.png"},
    {"id": "nfc-emergencia", "name": "Tag de Emergencia", "description": "Información de emergencia para el hogar.", "category": "nfc_card", "price": 14.99, "colors": ["red"], "features": ["Info de emergencia", "Contactos prioritarios", "Información médica"], "for_card_type": "guardian", "image_url": "/products/emergencia.png"},
    {"id": "nfc-llavero-gps", "name": "Llavero GPS Tracker", "description": "Llavero con GPS para localizar tus llaves.", "category": "nfc_pet_tag", "price": 39.99, "colors": ["black", "white"], "features": ["GPS integrado", "App de localización", "Batería 6 meses", "Resistente al agua"], "for_card_type": None, "image_url": "/products/llavero-gps.png"},
    
    # Commerce
    {"id": "nfc-menu-qr", "name": "Menú Virtual QR/NFC", "description": "Solución completa para menú digital de restaurantes.", "category": "service", "price": 99.99, "colors": [], "features": ["Menú interactivo", "Actualización en tiempo real", "QR + NFC", "Soporte incluido"], "for_card_type": "lugares", "image_url": "/products/menu.png"},
    {"id": "nfc-wifi-comercio", "name": "WiFi para Clientes", "description": "Sistema de WiFi para comercios.", "category": "nfc_card", "price": 24.99, "colors": ["white", "black"], "features": ["Portal cautivo", "Analytics de uso", "Diseño personalizable"], "for_card_type": None, "image_url": "/products/wifi-comercio.png"},
    {"id": "nfc-redes-sociales", "name": "Síguenos en Redes", "description": "Tag para promocionar redes sociales del negocio.", "category": "nfc_card", "price": 19.99, "colors": ["white", "black", "orange"], "features": ["Links a todas las redes", "QR backup", "Diseño atractivo"], "for_card_type": "negocio", "image_url": "/products/redes.png"},
    {"id": "nfc-ar-productos", "name": "AR para Productos", "description": "Experiencia de realidad aumentada para productos.", "category": "service", "price": 149.99, "colors": [], "features": ["Modelo 3D del producto", "Información interactiva", "Integración e-commerce"], "for_card_type": None, "image_url": "/products/ar.png"},
    
    # Offices
    {"id": "nfc-citas", "name": "Agenda de Citas NFC", "description": "Sistema de agendamiento por NFC.", "category": "nfc_card", "price": 29.99, "colors": ["black", "white"], "features": ["Calendario integrado", "Confirmación automática", "Recordatorios"], "for_card_type": "servicios", "image_url": "/products/citas.png"},
    {"id": "nfc-apps", "name": "Descarga de Apps", "description": "Tag para descarga directa de aplicaciones.", "category": "nfc_card", "price": 14.99, "colors": ["black", "white"], "features": ["Link a App Store", "Link a Play Store", "Analytics de descargas"], "for_card_type": None, "image_url": "/products/apps.png"},
    {"id": "nfc-pagos", "name": "Métodos de Pago", "description": "Tag con todas las opciones de pago.", "category": "nfc_card", "price": 19.99, "colors": ["black", "white"], "features": ["Links de pago", "Múltiples métodos", "Confirmación instantánea"], "for_card_type": "negocio", "image_url": "/products/pagos.png"},
    {"id": "nfc-inventario", "name": "Control de Inventario", "description": "Tags NFC para gestión de inventario.", "category": "nfc_card", "price": 9.99, "colors": ["white"], "features": ["Tracking de items", "App de gestión", "Reportes automáticos"], "for_card_type": None, "image_url": "/products/inventario.png"},
    {"id": "nfc-acceso", "name": "Control de Acceso", "description": "Sistema de acceso por tarjeta NFC.", "category": "nfc_card", "price": 34.99, "colors": ["black", "white"], "features": ["Registro de accesos", "Múltiples usuarios", "Integración cerraduras"], "for_card_type": None, "image_url": "/products/acceso.png"},
    
    # Pets
    {"id": "nfc-pet-basico", "name": "Tag Mascota Básico", "description": "Identificación básica para mascotas.", "category": "nfc_pet_tag", "price": 19.99, "colors": ["blue", "pink", "green"], "features": ["Datos del dueño", "Info de la mascota", "QR backup", "Resistente al agua"], "for_card_type": "mascotas", "image_url": "/products/pet-basic.png"},
    {"id": "nfc-pet-gps", "name": "Tag Mascota con GPS", "description": "Tag con GPS para localizar tu mascota.", "category": "nfc_pet_tag", "price": 49.99, "colors": ["blue", "pink", "green"], "features": ["GPS en tiempo real", "Historial de ubicación", "Alertas de zona segura", "Batería 3 meses"], "for_card_type": "mascotas", "image_url": "/products/pet-gps.png"},
    {"id": "nfc-collar-completo", "name": "Collar Inteligente", "description": "Collar completo con NFC, GPS y monitoreo.", "category": "nfc_pet_tag", "price": 79.99, "colors": ["black", "red", "blue"], "features": ["NFC + GPS", "Monitor de actividad", "Batería recargable", "App completa"], "for_card_type": "mascotas", "image_url": "/products/collar.png"},
    
    # Guardian
    {"id": "nfc-guardian-adulto", "name": "Pulsera Guardian Adulto", "description": "Pulsera de identificación para adultos mayores.", "category": "nfc_bracelet", "price": 34.99, "colors": ["black", "brown", "silver"], "features": ["Info médica", "Contactos de emergencia", "QR + NFC", "Diseño elegante"], "for_card_type": "guardian", "image_url": "/products/guardian-adult.png"},
    {"id": "nfc-guardian-infantil", "name": "Pulsera Guardian Infantil", "description": "Pulsera de seguridad para niños.", "category": "nfc_bracelet", "price": 29.99, "colors": ["blue", "pink", "green", "orange"], "features": ["Datos del niño", "Contactos de padres", "Diseño divertido", "Resistente"], "for_card_type": "guardian", "image_url": "/products/guardian-kid.png"},
    
    # Habladores / Signage
    {"id": "hablador-mesa", "name": "Hablador de Mesa", "description": "Display de mesa con NFC para restaurantes.", "category": "service", "price": 24.99, "colors": ["black", "white"], "features": ["Diseño elegante", "NFC integrado", "QR visible", "Base estable"], "for_card_type": None, "image_url": "/products/hablador-mesa.png"},
    {"id": "hablador-pared", "name": "Hablador de Pared", "description": "Display de pared con NFC.", "category": "service", "price": 29.99, "colors": ["black", "white"], "features": ["Montaje fácil", "NFC integrado", "Diseño profesional"], "for_card_type": None, "image_url": "/products/hablador-pared.png"},
    {"id": "hablador-mostrador", "name": "Hablador de Mostrador", "description": "Display para punto de venta.", "category": "service", "price": 34.99, "colors": ["black", "white"], "features": ["Visible desde ambos lados", "NFC + QR", "Base pesada"], "for_card_type": None, "image_url": "/products/hablador-mostrador.png"},
    {"id": "hablador-aframe", "name": "A-Frame con NFC", "description": "Caballete tipo A con NFC integrado.", "category": "service", "price": 79.99, "colors": ["black", "white"], "features": ["Doble cara", "Resistente exterior", "NFC en ambos lados", "Gráficas intercambiables"], "for_card_type": None, "image_url": "/products/aframe.png"},
    
    # Services
    {"id": "service-design", "name": "Diseño Personalizado", "description": "Servicio de diseño gráfico para tu tarjeta.", "category": "service", "price": 49.99, "colors": [], "features": ["Diseño único", "3 revisiones", "Archivos originales", "Soporte incluido"], "for_card_type": None, "image_url": "/products/design.png"},
    {"id": "service-enterprise", "name": "Configuración Empresarial", "description": "Setup completo para empresas.", "category": "service", "price": 299.99, "colors": [], "features": ["Hasta 50 tarjetas", "Portal empresarial", "Capacitación", "Soporte premium 1 año"], "for_card_type": "empresarial", "image_url": "/products/enterprise.png"},
    
    # MEOW APP Partner Products
    {"id": "meow-redes", "name": "MEOW Gestión de Redes", "description": "Servicio de gestión de redes sociales por MEOW APP.", "category": "service", "price": 199.99, "colors": [], "features": ["Gestión mensual", "Contenido original", "Analytics", "Por MEOW APP"], "for_card_type": None, "image_url": "/products/meow-redes.png"},
    {"id": "meow-branding", "name": "MEOW Branding Completo", "description": "Servicio de branding empresarial por MEOW APP.", "category": "service", "price": 499.99, "colors": [], "features": ["Logo", "Manual de marca", "Templates", "Por MEOW APP"], "for_card_type": None, "image_url": "/products/meow-branding.png"},
    {"id": "meow-ads", "name": "MEOW Publicidad Digital", "description": "Campañas publicitarias por MEOW APP.", "category": "service", "price": 299.99, "colors": [], "features": ["Facebook Ads", "Google Ads", "Optimización", "Reportes semanales", "Por MEOW APP"], "for_card_type": None, "image_url": "/products/meow-ads.png"},
]


# ============================================================================
# ROUTES
# ============================================================================

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
    if tier not in ["pro", "business"]:
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
