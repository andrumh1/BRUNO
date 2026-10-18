from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Request, Response, WebSocket, WebSocketDisconnect, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal, Dict
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timezone, timedelta
import os
import logging
import uuid
import qrcode
from PIL import Image, ImageDraw
import io
import base64
import requests
import cloudinary
import cloudinary.uploader
from pathlib import Path
import json
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Cloudinary configuration
cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key=os.environ.get('CLOUDINARY_API_KEY'),
    api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
    secure=True
)
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse


# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production-123456789')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days

# Payments / Stripe
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============================================================================
# WEBSOCKET CONNECTION MANAGER
# ============================================================================

# WebSocket connection manager (extracted to utils to break circular imports)
from utils.ws_manager import ConnectionManager, ws_manager  # noqa: F401

# ============================================================================
# MODELS
# ============================================================================

# User Models
class UserRole(str):
    PERSONAL = "personal"
    ADMIN_EMPRESA = "admin_empresa"
    SUPER_ADMIN = "super_admin"

class SubscriptionTier(str):
    FREE = "free"
    PRO = "pro"
    BUSINESS = "business"

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str = UserRole.PERSONAL
    company_id: Optional[str] = None
    subscription_tier: str = SubscriptionTier.FREE
    subscription_expires_at: Optional[datetime] = None
    is_verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = UserRole.PERSONAL

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    platform: Optional[str] = "web"  # "web" | "mobile" | "native"
    remember: Optional[bool] = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

# Social Link Models (needed for both UserProfile and Card)
class SocialLink(BaseModel):
    type: str  # instagram, facebook, linkedin, twitter, tiktok, youtube, whatsapp, email, phone, website, custom
    label: str
    url: str
    icon: Optional[str] = None

# User Profile Models
class ContactInfo(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None

# NOTE: UserProfile / UserProfileUpdate are defined further below (line ~583).
# The earlier minimal versions were dead code (redefined immediately).

# Album Models
class Photo(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    url: str
    thumbnail_url: Optional[str] = None
    caption: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Album(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    description: Optional[str] = None
    is_public: bool = False
    photos: List[Photo] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AlbumCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False

class AlbumUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None

# Card Models
class CardType(str):
    PERSONAL = "personal"
    EMPRESARIAL = "empresarial"
    NEGOCIO = "negocio"
    LUGARES = "lugares"
    GUARDIAN = "guardian"
    CURRICULUM = "curriculum"

class Card(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    card_type: str
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    gallery_photos: List[str] = []  # URLs of photos
    background_color: str = "#FF6B35"
    text_color: str = "#FFFFFF"
    social_links: Optional[List[SocialLink]] = []
    contact_info: Optional[ContactInfo] = None
    location: Optional[dict] = None  # { "lat": float, "lng": float, "address": str, "place_name": str }
    locations: List[dict] = []  # Multiple locations: [{ "lat": float, "lng": float, "address": str, "label": str }]
    template_id: str = "default"  # Para las 12 plantillas diferentes
    custom_fields: Optional[dict] = None
    is_public: bool = True
    show_in_feed: bool = True
    is_animated: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    views: int = 0

class CardCreate(BaseModel):
    card_type: str
    title: str
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
    card_type: Optional[str] = None

# Payment Transaction Models
class PaymentType(str):
    SUBSCRIPTION = "subscription"
    ONE_TIME = "one_time"


class PaymentStatus(str):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    EXPIRED = "expired"


class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    session_id: str
    payment_type: str  # subscription / one_time
    amount: float
    currency: str
    metadata: dict = {}
    status: str = PaymentStatus.PENDING
    payment_status: str = PaymentStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# NFC Models
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

# Card Order Models
class CardOrderStatus(str):
    PENDING = "pending"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class CardOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    card_id: str
    quantity: int = 1
    status: str = CardOrderStatus.PENDING
    shipping_address: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CardOrderCreate(BaseModel):
    card_id: str
    quantity: int = 1
    shipping_address: Optional[dict] = None

# ============================================================================
# STORE / SHOP MODELS (PIUP - Personal Intelligent Unlock Point)
# ============================================================================

# Product Categories
class ProductCategory(str):
    NFC_CARD = "nfc_card"
    NFC_BRACELET = "nfc_bracelet"  # Guardian
    NFC_PET_TAG = "nfc_pet_tag"    # Mascotas con GPS
    MEMBERSHIP = "membership"
    SERVICE = "service"

# Store Product
class StoreProduct(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    category: str  # nfc_card, nfc_bracelet, nfc_pet_tag, membership, service
    price: float
    currency: str = "USD"
    image_url: Optional[str] = None
    colors: List[str] = []  # Available colors for NFC products
    features: List[str] = []  # Product features
    for_card_type: Optional[str] = None  # personal, guardian, mascotas, etc.
    is_active: bool = True
    stock: int = -1  # -1 = unlimited
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Shipping Address
class ShippingAddress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str = "Home"  # Home, Work, Other
    full_name: str
    phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: Optional[str] = None
    postal_code: str
    country: str
    is_default: bool = False

# Payment Method (stored for user)
class SavedPaymentMethod(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = "card"  # card, paypal, etc.
    last_four: str
    brand: str  # visa, mastercard, etc.
    exp_month: int
    exp_year: int
    is_default: bool = False
    stripe_payment_method_id: Optional[str] = None

# User Saved Data (for reuse across cards)
class UserSavedData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    user_id: str
    # Personal Info
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    bio: Optional[str] = None
    profession: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    
    # Saved Social Links
    social_links: List[SocialLink] = []
    
    # Saved Addresses
    addresses: List[ShippingAddress] = []
    
    # Saved Payment Methods
    payment_methods: List[SavedPaymentMethod] = []
    
    # Saved Photos (gallery)
    photos: List[str] = []  # URLs
    
    # Work References (for curriculum)
    work_references: List[dict] = []
    
    # Frequently used custom fields
    custom_fields: dict = {}
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Store Order
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

# Subscription Plans
class SubscriptionPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str
    name: str  # Free, Pro, Business
    price_monthly: float
    price_yearly: float
    currency: str = "USD"
    features: List[str] = []
    limits: dict = {}  # max_cards, max_photos, etc.
    stripe_price_id_monthly: Optional[str] = None
    stripe_price_id_yearly: Optional[str] = None
    is_active: bool = True

# User Subscription
class UserSubscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    user_id: str
    plan_id: str
    status: str = "active"  # active, cancelled, past_due, trialing
    billing_cycle: str = "monthly"  # monthly, yearly
    current_period_start: datetime
    current_period_end: datetime
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============================================================================
# SOCIAL NETWORK MODELS
# ============================================================================

# Post / Publication
class PostMedia(BaseModel):
    type: str = "image"  # image, video, document
    url: str
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = None  # for videos, in seconds

class Post(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    content: str = ""
    media: List[PostMedia] = []
    card_id: Optional[str] = None  # If sharing a card
    post_type: str = "text"  # text, image, video, card_share
    visibility: str = "public"  # public, followers, private
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    is_pinned: bool = False
    is_edited: bool = False
    hashtags: List[str] = []
    mentions: List[str] = []  # user_ids mentioned
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PostCreate(BaseModel):
    content: str = ""
    media: List[dict] = []
    card_id: Optional[str] = None
    post_type: str = "text"
    visibility: str = "public"
    hashtags: List[str] = []

class PollCreate(BaseModel):
    question: str
    options: List[str]
    duration_hours: int = 24

class PollVote(BaseModel):
    option_index: int

# Like
class Like(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    target_id: str  # post_id or comment_id
    target_type: str = "post"  # post, comment
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Comment
class Comment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    post_id: str
    parent_id: Optional[str] = None  # For nested replies
    content: str
    likes_count: int = 0
    replies_count: int = 0
    is_edited: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[str] = None

# Follow relationship
class Follow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    follower_id: str  # Who is following
    following_id: str  # Who is being followed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# User Profile (extended)
class UserProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    user_id: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    profession: Optional[str] = None
    company: Optional[str] = None
    is_verified: bool = False
    is_private: bool = False  # Private profile
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    social_links: List[SocialLink] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    profession: Optional[str] = None
    company: Optional[str] = None
    is_private: Optional[bool] = None
    social_links: Optional[List[dict]] = None

# Chat / Messaging
class ChatRoom(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = "direct"  # direct, group
    name: Optional[str] = None  # For group chats
    participants: List[str] = []  # user_ids
    last_message_id: Optional[str] = None
    last_message_at: Optional[datetime] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageAttachment(BaseModel):
    type: str = "image"  # image, video, audio, file, sticker, card
    url: Optional[str] = None  # Optional for stickers/cards
    filename: Optional[str] = None
    size: Optional[int] = None  # in bytes
    duration: Optional[int] = None  # for audio/video in seconds
    # Sticker-specific fields
    sticker_id: Optional[str] = None
    emoji: Optional[str] = None
    is_emoji: Optional[bool] = False
    # Card-specific fields (for sharing cards in chat)
    card_id: Optional[str] = None
    card_title: Optional[str] = None
    card_subtitle: Optional[str] = None
    card_type: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    chat_id: str
    sender_id: str
    content: str = ""
    message_type: str = "text"  # text, image, video, audio, file, voice_note
    attachments: List[MessageAttachment] = []
    reply_to_id: Optional[str] = None
    is_read: bool = False
    read_by: List[str] = []  # user_ids who have read
    is_edited: bool = False
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    content: str = ""
    message_type: str = "text"
    attachments: List[dict] = []
    reply_to_id: Optional[str] = None

# Notification
class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Who receives the notification
    actor_id: str  # Who triggered the notification
    type: str  # like, comment, follow, mention, message
    target_id: Optional[str] = None  # post_id, comment_id, etc.
    target_type: Optional[str] = None  # post, comment, etc.
    content: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============================================================================
# SECURITY FUNCTIONS
# ============================================================================

from utils import security as _sec
from utils.security import (  # noqa: E402 — single source of truth for auth
    verify_password, get_password_hash, create_access_token, resolve_user_from_token,
    get_current_user, get_current_user_optional, revoke_token, revoke_all_user_tokens,
    client_ip, check_login_allowed, record_login_failure, clear_login_failures,
)


async def get_current_user_from_token(token: str) -> Optional[User]:
    """Get current user from a token string directly (for WebSocket endpoints)"""
    return await resolve_user_from_token(token)

# ============================================================================
# AUTH ROUTES
# ============================================================================

@api_router.post("/auth/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_input: UserCreate, response: Response):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_input.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user_dict = user_input.model_dump(exclude={'password'})
    user_obj = User(**user_dict)
    
    # Hash password and store
    hashed_password = get_password_hash(user_input.password)
    user_doc = user_obj.model_dump()
    user_doc['hashed_password'] = hashed_password
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    
    await db.users.insert_one(user_doc)
    
    # Create token
    access_token = create_access_token(data={"sub": user_obj.email})
    _sec.set_session_cookie(response, access_token)
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.post("/auth/login", response_model=Token)
async def login(user_input: UserLogin, request: Request, response: Response):
    ip = client_ip(request)
    email = user_input.email.strip().lower()
    await check_login_allowed(email, ip)
    user_dict = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_dict:
        user_dict = await db.users.find_one({"email": user_input.email.strip()}, {"_id": 0})
    # Same message whether the account exists or not; never issue a token on failure.
    if not user_dict or not verify_password(user_input.password, user_dict.get('hashed_password') or ""):
        await record_login_failure(email, ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Correo o contraseña incorrectos")
    if user_dict.get("is_active") is False:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta desactivada")
    await clear_login_failures(email, ip)

    if isinstance(user_dict.get('created_at'), str):
        user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
    user_obj = User(**user_dict)

    # Create token — mobile gets 1-year expiry for persistent notifications
    expire_delta = timedelta(days=365) if user_input.platform in ("mobile", "native") else None
    access_token = create_access_token(data={"sub": user_obj.email, "plt": user_input.platform or "web"}, expires_delta=expire_delta)
    await db.users.update_one({"id": user_obj.id}, {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}})
    await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "user_id": user_obj.id, "action": "login", "ip": ip, "platform": user_input.platform or "web", "created_at": datetime.now(timezone.utc).isoformat()})
    if user_input.platform != "native":
        _sec.set_session_cookie(response, access_token, persistent=user_input.remember is not False)
    # Seguridad: aviso de nuevo inicio de sesión (in-app + push categoría account_security, 1 por dispositivo/día vía dedupe)
    try:
        sec_notif = {"id": str(uuid.uuid4()), "user_id": user_obj.id, "type": "security", "message": f"Nuevo inicio de sesión en BRUNO ({user_input.platform or 'web'}). Si no fuiste tú, cambia tu contraseña.",
                     "target_id": user_obj.id, "target_type": "security", "url": "/settings", "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()}
        await db.notifications.insert_one(dict(sec_notif))
        from routers.push_notifications import send_push_notification, NotificationPayload
        asyncio.create_task(send_push_notification(user_obj.id, NotificationPayload(title="Nuevo inicio de sesión", body=sec_notif["message"], url="/settings", tag=f"security_login_{(user_input.platform or 'web')}_{datetime.now(timezone.utc).date()}", data={"category": "account_security"})))
    except Exception:
        pass
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/auth/me/dnd")
async def get_dnd(current_user: User = Depends(get_current_user)):
    from utils.dnd import is_dnd_active
    doc = await db.users.find_one({"id": current_user.id}, {"_id": 0, "dnd": 1})
    dnd = (doc or {}).get("dnd") or {"enabled": False, "start": "22:00", "end": "07:00", "tz_offset_min": 0}
    return {**dnd, "active": is_dnd_active(doc)}

@api_router.put("/auth/me/dnd")
async def update_dnd(payload: dict, current_user: User = Depends(get_current_user)):
    from utils.dnd import is_dnd_active
    dnd = {
        "enabled": bool(payload.get("enabled")),
        "start": str(payload.get("start") or "22:00")[:5],
        "end": str(payload.get("end") or "07:00")[:5],
        "tz_offset_min": int(payload.get("tz_offset_min") or 0),
    }
    await db.users.update_one({"id": current_user.id}, {"$set": {"dnd": dnd}})
    return {**dnd, "active": is_dnd_active({"dnd": dnd})}

@api_router.get("/auth/me")
async def get_me(request: Request, response: Response, current_user: User = Depends(get_current_user), credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))):
    user_dict = current_user.dict()
    # Auto-refresh token if it will expire within 7 days
    raw = _sec.token_from_request(request, credentials)
    if raw:
        try:
            payload = jwt.decode(raw, SECRET_KEY, algorithms=[ALGORITHM])
            exp = payload.get("exp")
            if exp:
                remaining = datetime.fromtimestamp(exp, tz=timezone.utc) - datetime.now(timezone.utc)
                if remaining.days < 7:
                    new_token = create_access_token(data={"sub": payload.get("sub"), "plt": payload.get("plt", "web")})
                    user_dict["refreshed_token"] = new_token
                    if request.cookies.get(_sec.SESSION_COOKIE) == raw:
                        _sec.set_session_cookie(response, new_token)
                    await revoke_token(raw, current_user.id)
        except Exception:
            pass
    return user_dict

@api_router.post("/auth/refresh")
async def refresh_token(current_user: User = Depends(get_current_user)):
    """Issue a fresh long-lived token for the authenticated user"""
    new_token = create_access_token(data={"sub": current_user.email})
    return {"access_token": new_token, "token_type": "bearer"}

@api_router.put("/auth/me")
async def update_me(
    updates: dict,
    current_user: User = Depends(get_current_user)
):
    """Update current user profile"""
    allowed_fields = ["name", "plan"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": update_data}
    )
    
    # Return updated user
    user_dict = await db.users.find_one({"id": current_user.id}, {"_id": 0, "hashed_password": 0})
    if isinstance(user_dict.get('created_at'), str):
        user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
    
    return User(**user_dict)

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response, current_user: User = Depends(get_current_user), credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)), all_devices: bool = False):
    """Invalidate this session (or every session of the user with ?all_devices=true)."""
    raw = _sec.token_from_request(request, credentials)
    if all_devices:
        await revoke_all_user_tokens(current_user.id)
    elif raw:
        await revoke_token(raw, current_user.id)
    _sec.clear_session_cookie(response)
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "action": "logout_all" if all_devices else "logout",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Logged out successfully"}


@api_router.post("/auth/session/restore")
async def auth_session_restore(request: Request, response: Response):
    """Web only: the httpOnly cookie proves the session; the token is returned for in-memory use (never persisted by the browser app)."""
    raw = request.cookies.get(_sec.SESSION_COOKIE)
    user = await resolve_user_from_token(raw) if raw else None
    if not user:
        _sec.clear_session_cookie(response)
        raise HTTPException(status_code=401, detail="Sin sesión")
    return {"access_token": raw, "token_type": "bearer", "user": user.model_dump()}


@api_router.get("/auth/session")
async def auth_session(request: Request, current_user: User = Depends(get_current_user), credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))):
    """Lightweight session check: who am I and when does this token expire."""
    exp = None
    try:
        payload = jwt.decode(_sec.token_from_request(request, credentials), SECRET_KEY, algorithms=[ALGORITHM])
        exp = payload.get("exp")
    except Exception:
        pass
    return {"user_id": current_user.id, "email": current_user.email, "name": current_user.name, "expires_at": datetime.fromtimestamp(exp, tz=timezone.utc).isoformat() if exp else None}

class GoogleAuthRequest(BaseModel):
    session_id: str

@api_router.post("/auth/google")
async def google_auth(request: GoogleAuthRequest):
    """Handle Google OAuth callback - exchange session_id for user data from Emergent Auth"""
    import httpx
    
    try:
        # Exchange session_id with Emergent Auth service
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id},
                timeout=10.0
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            
            auth_data = response.json()
            
        # Extract user data from Emergent Auth response
        email = auth_data.get("email")
        name = auth_data.get("name", email.split("@")[0] if email else "User")
        picture = auth_data.get("picture", "")
        session_token = auth_data.get("session_token")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            # Update existing user
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "name": name,
                    "avatar_url": picture,
                    "last_login": datetime.now(timezone.utc).isoformat()
                }}
            )
            user_id = existing_user["id"]
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            new_user = {
                "id": user_id,
                "email": email,
                "name": name,
                "avatar_url": picture,
                "hashed_password": "",  # Google users don't have password
                "role": "personal",
                "company_id": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "is_active": True,
                "plan": "free",
                "subscription_status": "inactive",
                "country": ""
            }
            await db.users.insert_one(new_user)
        
        # Get full user data
        user_doc = await db.users.find_one({"email": email}, {"_id": 0})
        
        # Create JWT token for this user (for API calls)
        jwt_token = create_access_token(data={"sub": email})
        
        return {
            "user": User(**user_doc),
            "session_token": session_token or jwt_token,
            "access_token": jwt_token
        }
        
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Error connecting to auth service: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")

# =========================================================================
# PAYMENTS / STRIPE ROUTES
# =========================================================================


async def get_stripe_checkout(request) -> StripeCheckout:
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe API key not configured")

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


PACKAGES = {
    "nfc_basic": {"amount": 9.99, "currency": "usd", "type": PaymentType.ONE_TIME},
    "nfc_pro": {"amount": 24.99, "currency": "usd", "type": PaymentType.ONE_TIME},
}


SUBSCRIPTION_PLANS = {
    "bruno_personal": {"amount": 4.99, "currency": "usd"},
    "bruno_business": {"amount": 14.99, "currency": "usd"},
    "bruno_corporate": {"amount": 39.99, "currency": "usd"},
}


class CheckoutSessionCreate(BaseModel):
    package_id: Optional[str] = None
    plan_id: Optional[str] = None
    origin: str


@api_router.post("/payments/checkout", response_model=CheckoutSessionResponse)
async def create_checkout_session(payload: CheckoutSessionCreate, request: Request, current_user: User = Depends(get_current_user)):
    """Crear sesión de pago (suscripción o pago único)."""
    stripe_checkout = await get_stripe_checkout(request)

    if not payload.package_id and not payload.plan_id:
        raise HTTPException(status_code=400, detail="Debe especificar package_id o plan_id")

    # Determinar tipo de pago y configuración
    if payload.package_id:
        pkg = PACKAGES.get(payload.package_id)
        if not pkg:
            raise HTTPException(status_code=400, detail="Paquete inválido")
        amount = pkg["amount"]
        currency = pkg["currency"]
        payment_type = pkg["type"]
    else:
        plan = SUBSCRIPTION_PLANS.get(payload.plan_id)
        if not plan:
            raise HTTPException(status_code=400, detail="Plan inválido")
        amount = plan["amount"]
        currency = plan["currency"]
        payment_type = PaymentType.SUBSCRIPTION

    # ─── Multi-currency: convert to the user's preferred currency ───────────
    # Stripe natively supports 135+ currencies. We pick the user's currency
    # (profile preference → IP fallback) and convert from USD base via the FX
    # cache from routers/i18n.
    try:
        from routers.i18n import _ensure_fx_rates, _request_country, SUPPORTED_COUNTRIES
        target_currency = currency.upper()
        profile = await db.user_profiles.find_one({"user_id": current_user.id}, {"_id": 0}) or {}
        target_currency = (profile.get("preferred_currency") or "").upper() or target_currency
        if target_currency == currency.upper() and not profile.get("preferred_currency"):
            # Fall back to IP-detected country's currency
            cc = _request_country(request) or ""
            target_currency = SUPPORTED_COUNTRIES.get(cc.upper(), {}).get("currency", target_currency)
        if target_currency != currency.upper():
            fx = await _ensure_fx_rates(currency.upper())
            rate = (fx.get("rates") or {}).get(target_currency)
            if rate and rate > 0:
                amount = round(amount * rate, 2 if target_currency not in ("COP", "CLP", "HUF", "JPY") else 0)
                currency = target_currency.lower()
    except Exception as _conv_err:
        # Conversion failure → keep original USD price, never block checkout
        pass

    origin = payload.origin.rstrip("/")
    success_url = f"{origin}/pricing?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pricing"

    metadata = {
        "user_id": current_user.id,
        "payment_type": payment_type,
        "package_id": payload.package_id or "",
        "plan_id": payload.plan_id or "",
    }

    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )

    session = await stripe_checkout.create_checkout_session(checkout_request)

    # Registrar transacción
    transaction = PaymentTransaction(
        user_id=current_user.id,
        session_id=session.session_id,
        payment_type=payment_type,
        amount=amount,
        currency=currency,
        metadata=metadata,
    )

    tx_doc = transaction.model_dump()
    tx_doc["created_at"] = tx_doc["created_at"].isoformat()
    tx_doc["updated_at"] = tx_doc["updated_at"].isoformat()
    await db.payment_transactions.insert_one(tx_doc)

    return session


@api_router.get("/payments/checkout/status/{session_id}", response_model=CheckoutStatusResponse)
async def get_checkout_status(session_id: str, request: Request):
    """Consultar estado de sesión de pago y actualizar transacción."""
    stripe_checkout = await get_stripe_checkout(request)
    status = await stripe_checkout.get_checkout_status(session_id)

    # Actualizar estado en BD
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "status": status.status,
                "payment_status": status.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    return status


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Webhook de Stripe (registro adicional de eventos)."""
    stripe_checkout = await get_stripe_checkout(request)
    body = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    event = await stripe_checkout.handle_webhook(body, sig_header)

    # Podemos registrar el evento o actualizar según sea necesario
    session_id = event.session_id
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"payment_status": event.payment_status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    return {"received": True}

# ============================================================================
# CARD ROUTES — extracted to routers/cards.py
# ============================================================================

# ============================================================================
# USER PROFILE ROUTES
# ============================================================================

@api_router.get("/profile", response_model=UserProfile)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    profile = await db.user_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    
    if not profile:
        # Create default profile
        profile = UserProfile(user_id=current_user.id)
        profile_doc = profile.model_dump()
        profile_doc['updated_at'] = profile_doc['updated_at'].isoformat()
        await db.user_profiles.insert_one(profile_doc)
        return profile
    
    if isinstance(profile.get('updated_at'), str):
        profile['updated_at'] = datetime.fromisoformat(profile['updated_at'])
    
    return UserProfile(**profile)

@api_router.put("/profile", response_model=UserProfile)
async def update_my_profile(profile_input: UserProfileUpdate, current_user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in profile_input.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.user_profiles.update_one(
        {"user_id": current_user.id},
        {"$set": update_data},
        upsert=True
    )
    
    profile = await db.user_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    
    if isinstance(profile.get('updated_at'), str):
        profile['updated_at'] = datetime.fromisoformat(profile['updated_at'])
    
    return UserProfile(**profile)


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


@api_router.post("/auth/change-password")
async def change_password(payload: ChangePasswordInput, current_user: User = Depends(get_current_user)):
    user_doc = await db.users.find_one({"id": current_user.id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not verify_password(payload.current_password, user_doc.get("hashed_password", "")):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    new_hash = get_password_hash(payload.new_password)
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"hashed_password": new_hash, "password_changed_at": datetime.now(timezone.utc).isoformat()}}
    )
    await revoke_all_user_tokens(current_user.id)
    await asyncio.sleep(1.1)  # tokens_valid_after has second precision: the new token must be issued after it
    new_token = create_access_token(data={"sub": current_user.email})
    return {"status": "ok", "message": "Contraseña actualizada", "access_token": new_token}

# ============================================================================
# ALBUM ROUTES
# ============================================================================

@api_router.post("/albums", response_model=Album, status_code=status.HTTP_201_CREATED)
async def create_album(album_input: AlbumCreate, current_user: User = Depends(get_current_user)):
    album_dict = album_input.model_dump()
    album_dict['user_id'] = current_user.id
    album_obj = Album(**album_dict)
    
    album_doc = album_obj.model_dump()
    album_doc['created_at'] = album_doc['created_at'].isoformat()
    album_doc['updated_at'] = album_doc['updated_at'].isoformat()
    
    await db.albums.insert_one(album_doc)
    return album_obj

@api_router.get("/albums", response_model=List[Album])
async def get_my_albums(current_user: User = Depends(get_current_user)):
    albums = await db.albums.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
    
    for album in albums:
        if isinstance(album.get('created_at'), str):
            album['created_at'] = datetime.fromisoformat(album['created_at'])
        if isinstance(album.get('updated_at'), str):
            album['updated_at'] = datetime.fromisoformat(album['updated_at'])
    
    return albums

@api_router.get("/albums/{album_id}", response_model=Album)
async def get_album(album_id: str, current_user: User = Depends(get_current_user)):
    album = await db.albums.find_one({"id": album_id, "user_id": current_user.id}, {"_id": 0})
    
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    if isinstance(album.get('created_at'), str):
        album['created_at'] = datetime.fromisoformat(album['created_at'])
    if isinstance(album.get('updated_at'), str):
        album['updated_at'] = datetime.fromisoformat(album['updated_at'])
    
    return Album(**album)

@api_router.put("/albums/{album_id}", response_model=Album)
async def update_album(album_id: str, album_input: AlbumUpdate, current_user: User = Depends(get_current_user)):
    existing_album = await db.albums.find_one({"id": album_id, "user_id": current_user.id})
    if not existing_album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    update_data = {k: v for k, v in album_input.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.albums.update_one(
        {"id": album_id},
        {"$set": update_data}
    )
    
    updated_album = await db.albums.find_one({"id": album_id}, {"_id": 0})
    
    if isinstance(updated_album.get('created_at'), str):
        updated_album['created_at'] = datetime.fromisoformat(updated_album['created_at'])
    if isinstance(updated_album.get('updated_at'), str):
        updated_album['updated_at'] = datetime.fromisoformat(updated_album['updated_at'])
    
    return Album(**updated_album)

@api_router.delete("/albums/{album_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_album(album_id: str, current_user: User = Depends(get_current_user)):
    result = await db.albums.delete_one({"id": album_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Album not found")
    return None

@api_router.post("/albums/{album_id}/photos")
async def add_photo_to_album(album_id: str, photo: Photo, current_user: User = Depends(get_current_user)):
    album = await db.albums.find_one({"id": album_id, "user_id": current_user.id})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    photo_doc = photo.model_dump()
    photo_doc['uploaded_at'] = photo_doc['uploaded_at'].isoformat()
    
    await db.albums.update_one(
        {"id": album_id},
        {
            "$push": {"photos": photo_doc},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Photo added successfully", "photo_id": photo.id}

@api_router.delete("/albums/{album_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo_from_album(album_id: str, photo_id: str, current_user: User = Depends(get_current_user)):
    album = await db.albums.find_one({"id": album_id, "user_id": current_user.id})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    await db.albums.update_one(
        {"id": album_id},
        {
            "$pull": {"photos": {"id": photo_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return None





# ============================================================================
# CARD ORDER ROUTES
# ============================================================================

@api_router.post("/orders", response_model=CardOrder, status_code=status.HTTP_201_CREATED)
async def create_order(order_input: CardOrderCreate, current_user: User = Depends(get_current_user)):
    # Check if card exists and belongs to user
    card = await db.cards.find_one({"id": order_input.card_id, "user_id": current_user.id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    order_dict = order_input.model_dump()
    order_dict['user_id'] = current_user.id
    order_obj = CardOrder(**order_dict)
    
    order_doc = order_obj.model_dump()
    order_doc['created_at'] = order_doc['created_at'].isoformat()
    order_doc['updated_at'] = order_doc['updated_at'].isoformat()
    
    await db.orders.insert_one(order_doc)
    return order_obj

@api_router.get("/orders", response_model=List[CardOrder])
async def get_my_orders(current_user: User = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
    
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
        if isinstance(order.get('updated_at'), str):
            order['updated_at'] = datetime.fromisoformat(order['updated_at'])
    
    return orders

# ============================================================================
# STORE / SHOP ROUTES (PIUP)
# ============================================================================

# Get all products
@api_router.get("/store/products")
async def get_store_products(category: Optional[str] = None, group: Optional[str] = None):
    """Catálogo oficial BRUNO PIUP (routers/store.py) con medidas C/U/R."""
    from routers.store import PIUP_PRODUCTS
    products = [dict(p) for p in PIUP_PRODUCTS]
    if category:
        products = [p for p in products if p["category"] == category]
    if group:
        products = [p for p in products if p.get("group") == group]
    return products

# Get single product
@api_router.get("/store/products/{product_id}")
async def get_store_product(product_id: str):
    from routers.store import PIUP_PRODUCTS
    for p in PIUP_PRODUCTS:
        if p["id"] == product_id:
            return p
    product = await db.store_products.find_one({"id": product_id, "is_active": True}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

# Create store order with Stripe checkout
@api_router.post("/store/orders")
async def create_store_order(
    items: List[dict],
    shipping_address_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    # Validate items and calculate totals — batch fetch products
    product_ids = [item["product_id"] for item in items]
    from routers.store import PIUP_PRODUCTS
    for _p in PIUP_PRODUCTS:
        if _p["id"] in product_ids:
            await db.store_products.update_one({"id": _p["id"]}, {"$set": {**_p, "is_active": True}}, upsert=True)
    products_cursor = db.store_products.find({"id": {"$in": product_ids}, "is_active": True}, {"_id": 0})
    products_map = {}
    async for p in products_cursor:
        products_map[p["id"]] = p
    
    order_items = []
    subtotal = 0
    
    for item in items:
        product = products_map.get(item["product_id"])
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item['product_id']} not found")
        
        quantity = item.get("quantity", 1)
        line_total = product["price"] * quantity
        subtotal += line_total
        
        order_items.append(StoreOrderItem(
            product_id=product["id"],
            product_name=product["name"],
            quantity=quantity,
            price=product["price"],
            color=item.get("color"),
            options=item.get("options", {})
        ))
    
    # Get shipping address if provided
    shipping_address = None
    if shipping_address_id:
        user_data = await db.user_saved_data.find_one({"user_id": current_user.id}, {"_id": 0})
        if user_data and user_data.get("addresses"):
            for addr in user_data["addresses"]:
                if addr.get("id") == shipping_address_id:
                    shipping_address = ShippingAddress(**addr)
                    break
    
    # Calculate shipping and tax
    shipping_cost = 5.99 if subtotal < 50 else 0  # Free shipping over $50
    tax = subtotal * 0.08  # 8% tax example
    total = subtotal + shipping_cost + tax
    
    # Create order
    order = StoreOrder(
        user_id=current_user.id,
        items=[item.model_dump() for item in order_items],
        subtotal=round(subtotal, 2),
        shipping_cost=round(shipping_cost, 2),
        tax=round(tax, 2),
        total=round(total, 2),
        shipping_address=shipping_address.model_dump() if shipping_address else None
    )
    
    order_doc = order.model_dump()
    order_doc['created_at'] = order_doc['created_at'].isoformat()
    order_doc['updated_at'] = order_doc['updated_at'].isoformat()
    
    await db.store_orders.insert_one(order_doc)
    
    return {
        "order_id": order.id,
        "subtotal": order.subtotal,
        "shipping_cost": order.shipping_cost,
        "tax": order.tax,
        "total": order.total,
        "status": order.status
    }

# Create Stripe checkout for store order
@api_router.post("/store/checkout/{order_id}")
async def create_store_checkout(
    order_id: str,
    current_user: User = Depends(get_current_user)
):
    order = await db.store_orders.find_one({"id": order_id, "user_id": current_user.id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != "pending_payment":
        raise HTTPException(status_code=400, detail="Order already processed")
    
    # Create Stripe checkout session
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
    
    line_items = []
    for item in order["items"]:
        line_items.append({
            "price_data": {
                "currency": order["currency"].lower(),
                "product_data": {
                    "name": item["product_name"],
                },
                "unit_amount": int(item["price"] * 100),
            },
            "quantity": item["quantity"],
        })
    
    # Add shipping if applicable
    if order["shipping_cost"] > 0:
        line_items.append({
            "price_data": {
                "currency": order["currency"].lower(),
                "product_data": {"name": "Shipping"},
                "unit_amount": int(order["shipping_cost"] * 100),
            },
            "quantity": 1,
        })
    
    frontend_url = os.environ.get('FRONTEND_URL')
    
    checkout_request = CheckoutSessionRequest(
        success_url=f"{frontend_url}/store/success?order_id={order_id}",
        cancel_url=f"{frontend_url}/store/cancel?order_id={order_id}",
        line_items=line_items,
        mode="payment",
        metadata={"order_id": order_id, "user_id": current_user.id}
    )
    
    checkout_response = stripe_checkout.create_checkout_session(checkout_request)
    
    # Update order with session ID
    await db.store_orders.update_one(
        {"id": order_id},
        {"$set": {
            "stripe_session_id": checkout_response.session_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"checkout_url": checkout_response.url, "session_id": checkout_response.session_id}

# Get user's store orders
@api_router.get("/store/orders")
async def get_user_store_orders(current_user: User = Depends(get_current_user)):
    orders = await db.store_orders.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders

# ============================================================================
# USER SAVED DATA ROUTES
# ============================================================================

# ============================================================================
# USER SAVED-DATA + SUBSCRIPTIONS — extracted to routers/user_data.py
# ============================================================================


# ============================================================================
# SEED DATA FUNCTIONS
# ============================================================================

async def seed_store_products():
    """Seed default store products - Complete PIUP catalog"""
    products = [
        # ==================== NFC CARDS ====================
        {
            "id": "nfc-card-black",
            "name": "PIUP Card - Negro Elegante",
            "description": "Tarjeta NFC premium en negro mate. Compatible con todos los smartphones.",
            "category": "nfc_card",
            "subcategory": "tarjetas_presentacion",
            "price": 15.00,
            "currency": "USD",
            "image_url": "/images/products/card-black.png",
            "colors": ["black"],
            "features": ["NFC de alta frecuencia", "Diseño premium", "Resistente al agua", "Personalizable"],
            "for_card_type": "personal",
            "is_active": True,
            "stock": -1
        },
        {
            "id": "nfc-card-white",
            "name": "PIUP Card - Blanco Minimalista",
            "description": "Tarjeta NFC elegante en blanco puro. Perfecta para profesionales.",
            "category": "nfc_card",
            "subcategory": "tarjetas_presentacion",
            "price": 15.00,
            "currency": "USD",
            "image_url": "/images/products/card-white.png",
            "colors": ["white"],
            "features": ["NFC de alta frecuencia", "Diseño minimalista", "Resistente al agua", "Personalizable"],
            "for_card_type": "personal",
            "is_active": True,
            "stock": -1
        },
        {
            "id": "nfc-card-orange",
            "name": "PIUP Card - Naranja BRUNO",
            "description": "Tarjeta NFC en el color signature de BRUNO. Destaca del resto.",
            "category": "nfc_card",
            "subcategory": "tarjetas_presentacion",
            "price": 18.00,
            "currency": "USD",
            "image_url": "/images/products/card-orange.png",
            "colors": ["orange"],
            "features": ["NFC de alta frecuencia", "Color exclusivo BRUNO", "Resistente al agua", "Personalizable"],
            "for_card_type": "personal",
            "is_active": True,
            "stock": -1
        },
        {
            "id": "nfc-card-gold",
            "name": "PIUP Card - Dorado Premium",
            "description": "Tarjeta NFC premium con acabado dorado. Para quienes buscan lo mejor.",
            "category": "nfc_card",
            "subcategory": "tarjetas_presentacion",
            "price": 25.00,
            "currency": "USD",
            "image_url": "/images/products/card-gold.png",
            "colors": ["gold"],
            "features": ["NFC de alta frecuencia", "Acabado metálico", "Resistente al agua", "Edición limitada"],
            "for_card_type": "empresarial",
            "is_active": True,
            "stock": -1
        },
        {
            "id": "nfc-card-holographic",
            "name": "PIUP Card - Holográfica",
            "description": "Tarjeta NFC con efecto holográfico único. Impresiona en cada encuentro.",
            "category": "nfc_card",
            "subcategory": "tarjetas_presentacion",
            "price": 30.00,
            "currency": "USD",
            "image_url": "/images/products/card-holo.png",
            "colors": ["holographic"],
            "features": ["NFC de alta frecuencia", "Efecto holográfico", "Ultra premium", "Edición limitada"],
            "for_card_type": "empresarial",
            "is_active": True,
            "stock": -1
        },
        # Carnets empresariales
        {
            "id": "nfc-carnet-empresarial",
            "name": "PIUP Carnet Empresarial",
            "description": "Carnet de identificación con NFC integrado. Ideal para empresas.",
            "category": "nfc_card",
            "subcategory": "carnets",
            "price": 20.00,
            "currency": "USD",
            "image_url": "/images/products/carnet-empresarial.png",
            "colors": ["white", "black"],
            "features": ["NFC integrado", "Porta credencial incluido", "Impresión full color", "Personalizable"],
            "for_card_type": "empresarial",
            "is_active": True,
            "stock": -1
        },
        # ==================== HOGAR ====================
        {
            "id": "piup-wifi-home",
            "name": "PIUP WiFi - Hogar",
            "description": "Comparte tu clave WiFi con un solo tap. Ideal para invitados.",
            "category": "hogar",
            "subcategory": "wifi",
            "price": 12.00,
            "currency": "USD",
            "image_url": "/images/products/wifi-home.png",
            "colors": ["white", "black", "wood"],
            "features": ["NFC integrado", "Adhesivo 3M", "Diseño decorativo", "Sin app necesaria para invitados"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "piup-despensa",
            "name": "PIUP Lista de Despensa",
            "description": "NFC en tu refrigerador para acceder a tu lista de compras compartida.",
            "category": "hogar",
            "subcategory": "organizacion",
            "price": 10.00,
            "currency": "USD",
            "image_url": "/images/products/despensa.png",
            "colors": ["white", "black"],
            "features": ["NFC integrado", "Imán incluido", "Lista compartible", "Sincronización familiar"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "piup-alarma",
            "name": "PIUP Activación Alarma",
            "description": "Activa/desactiva tu alarma del hogar con un tap.",
            "category": "hogar",
            "subcategory": "seguridad",
            "price": 15.00,
            "currency": "USD",
            "image_url": "/images/products/alarma.png",
            "colors": ["white", "black"],
            "features": ["NFC integrado", "Compatible con principales alarmas", "Instalación sencilla", "Múltiples usuarios"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "piup-mensaje-emergencia",
            "name": "PIUP Mensaje de Emergencia",
            "description": "Envía mensaje instantáneo a contactos de emergencia con un tap.",
            "category": "hogar",
            "subcategory": "seguridad",
            "price": 12.00,
            "currency": "USD",
            "image_url": "/images/products/emergencia.png",
            "colors": ["red", "white"],
            "features": ["NFC integrado", "Ubicación automática", "Múltiples contactos", "Sin necesidad de desbloquear"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "piup-llavero-gps",
            "name": "PIUP Llavero GPS",
            "description": "Llavero con NFC y rastreo GPS. Nunca pierdas tus llaves.",
            "category": "hogar",
            "subcategory": "gps",
            "price": 35.00,
            "currency": "USD",
            "image_url": "/images/products/llavero-gps.png",
            "colors": ["black", "white", "blue"],
            "features": ["NFC + GPS", "Batería 6 meses", "Rastreo en tiempo real", "Notificaciones de zona"],
            "is_active": True,
            "stock": -1
        },
        # ==================== RESTAURANTES Y COMERCIOS ====================
        {
            "id": "piup-menu-qr",
            "name": "PIUP Menú Virtual",
            "description": "Descarga de menú digital con NFC. Adiós a los menús físicos.",
            "category": "comercios",
            "subcategory": "restaurantes",
            "price": 15.00,
            "currency": "USD",
            "image_url": "/images/products/menu-qr.png",
            "colors": ["black", "white", "wood"],
            "features": ["NFC + QR", "Actualización en tiempo real", "Menú multilenguaje", "Sin app para clientes"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "piup-wifi-comercio",
            "name": "PIUP WiFi Comercio",
            "description": "Comparte WiFi de tu negocio fácilmente con clientes.",
            "category": "comercios",
            "subcategory": "wifi",
            "price": 18.00,
            "currency": "USD",
            "image_url": "/images/products/wifi-comercio.png",
            "colors": ["black", "white", "acrylic"],
            "features": ["NFC integrado", "Diseño de mesa", "QR backup", "Portal cautivo opcional"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "piup-redes-comercio",
            "name": "PIUP Redes Sociales Comercio",
            "description": "Todos tus enlaces de redes sociales en una sola tarjeta.",
            "category": "comercios",
            "subcategory": "redes",
            "price": 20.00,
            "currency": "USD",
            "image_url": "/images/products/redes-comercio.png",
            "colors": ["black", "white", "custom"],
            "features": ["NFC + QR", "Todas las redes", "Estadísticas de taps", "Logo personalizado"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "piup-ar-productos",
            "name": "PIUP AR para Productos",
            "description": "Realidad aumentada para mostrar productos en 3D.",
            "category": "comercios",
            "subcategory": "ar",
            "price": 45.00,
            "currency": "USD",
            "image_url": "/images/products/ar-productos.png",
            "colors": ["transparent"],
            "features": ["NFC + AR", "Modelo 3D incluido", "Sin app necesaria", "Analytics de interacción"],
            "is_active": True,
            "stock": -1
        },
        # ==================== OFICINAS ====================
        {
            "id": "piup-citas",
            "name": "PIUP Agenda Citas",
            "description": "Permite a clientes agendar citas directamente desde el NFC.",
            "category": "oficinas",
            "subcategory": "citas",
            "price": 20.00,
            "currency": "USD",
            "image_url": "/images/products/citas.png",
            "colors": ["black", "white"],
            "features": ["NFC integrado", "Integración calendarios", "Recordatorios automáticos", "Confirmación SMS"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "piup-descarga-app",
            "name": "PIUP Descarga de App",
            "description": "Lleva a usuarios directamente a tu app en stores.",
            "category": "oficinas",
            "subcategory": "apps",
            "price": 15.00,
            "currency": "USD",
            "image_url": "/images/products/descarga-app.png",
            "colors": ["black", "white"],
            "features": ["NFC integrado", "Smart redirect iOS/Android", "QR backup", "Estadísticas"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "piup-metodos-pago",
            "name": "PIUP Métodos de Pago",
            "description": "Muestra todos tus métodos de pago aceptados con un tap.",
            "category": "oficinas",
            "subcategory": "pagos",
            "price": 18.00,
            "currency": "USD",
            "image_url": "/images/products/metodos-pago.png",
            "colors": ["black", "white"],
            "features": ["NFC integrado", "Links de pago directo", "Múltiples métodos", "QR de pago"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "piup-web-redirect",
            "name": "PIUP Página Web",
            "description": "Redirige instantáneamente a tu página web.",
            "category": "oficinas",
            "subcategory": "web",
            "price": 12.00,
            "currency": "USD",
            "image_url": "/images/products/web-redirect.png",
            "colors": ["black", "white", "custom"],
            "features": ["NFC integrado", "URL personalizable", "Estadísticas de visitas", "QR backup"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "piup-inventario",
            "name": "PIUP Control Inventario",
            "description": "Tags NFC para control de inventario y activos.",
            "category": "oficinas",
            "subcategory": "inventario",
            "price": 8.00,
            "currency": "USD",
            "image_url": "/images/products/inventario.png",
            "colors": ["white"],
            "features": ["NFC adhesivo", "Resistente", "Escaneo rápido", "Base de datos incluida"],
            "is_active": True,
            "stock": -1,
            "min_quantity": 10
        },
        {
            "id": "piup-acceso",
            "name": "PIUP Claves de Acceso",
            "description": "Control de acceso a oficinas con NFC.",
            "category": "oficinas",
            "subcategory": "acceso",
            "price": 25.00,
            "currency": "USD",
            "image_url": "/images/products/acceso.png",
            "colors": ["black", "white"],
            "features": ["NFC seguro", "Registro de accesos", "Múltiples usuarios", "Permisos por horario"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "piup-archivos",
            "name": "PIUP Presentación de Archivos",
            "description": "Comparte documentos, presentaciones y archivos con un tap.",
            "category": "oficinas",
            "subcategory": "archivos",
            "price": 15.00,
            "currency": "USD",
            "image_url": "/images/products/archivos.png",
            "colors": ["black", "white"],
            "features": ["NFC integrado", "Nube incluida 1GB", "Múltiples archivos", "Protección por contraseña"],
            "is_active": True,
            "stock": -1
        },
        # ==================== MASCOTAS ====================
        {
            "id": "nfc-pet-tag-basic",
            "name": "PIUP Pet Tag - Básico",
            "description": "Colgante NFC para collar de mascota. Si se pierde, quien lo encuentre puede contactarte.",
            "category": "mascotas",
            "subcategory": "collares",
            "price": 15.00,
            "currency": "USD",
            "image_url": "/images/products/pet-tag-basic.png",
            "colors": ["silver", "gold", "black", "blue", "pink"],
            "features": ["NFC de alta frecuencia", "Acero inoxidable", "Resistente al agua", "Grabado personalizado"],
            "for_card_type": "mascotas",
            "is_active": True,
            "stock": -1
        },
        {
            "id": "nfc-pet-tag-gps",
            "name": "PIUP Pet Tag GPS - Premium",
            "description": "Colgante con NFC + GPS integrado. Localiza a tu mascota en tiempo real.",
            "category": "mascotas",
            "subcategory": "gps",
            "price": 45.00,
            "currency": "USD",
            "image_url": "/images/products/pet-tag-gps.png",
            "colors": ["black", "white", "orange"],
            "features": ["NFC + GPS integrado", "Batería 30 días", "App de rastreo", "Resistente al agua IP67"],
            "for_card_type": "mascotas",
            "is_active": True,
            "stock": -1
        },
        {
            "id": "nfc-collar-gps",
            "name": "PIUP Collar GPS Completo",
            "description": "Collar con placa NFC y GPS integrados. Todo en uno.",
            "category": "mascotas",
            "subcategory": "collares",
            "price": 65.00,
            "currency": "USD",
            "image_url": "/images/products/collar-gps.png",
            "colors": ["black", "brown", "red", "blue"],
            "features": ["NFC + GPS + QR", "Collar ajustable", "Batería 45 días", "Notificaciones de zona"],
            "for_card_type": "mascotas",
            "is_active": True,
            "stock": -1
        },
        # ==================== GUARDIAN (Pulseras) ====================
        {
            "id": "nfc-bracelet-blue",
            "name": "PIUP Guardian - Pulsera Adulto",
            "description": "Pulsera de silicona con NFC integrado. Ideal para adultos mayores.",
            "category": "guardian",
            "subcategory": "pulseras",
            "price": 12.00,
            "currency": "USD",
            "image_url": "/images/products/bracelet-blue.png",
            "colors": ["blue", "red", "green", "purple", "black"],
            "features": ["NFC integrado", "Silicona hipoalergénica", "Resistente al agua", "Talla ajustable"],
            "for_card_type": "guardian",
            "is_active": True,
            "stock": -1
        },
        {
            "id": "nfc-bracelet-kids",
            "name": "PIUP Guardian Kids - Pulsera Infantil",
            "description": "Pulsera colorida con NFC para los más pequeños. Seguridad y diversión.",
            "category": "guardian",
            "subcategory": "pulseras",
            "price": 10.00,
            "currency": "USD",
            "image_url": "/images/products/bracelet-kids.png",
            "colors": ["rainbow", "pink", "blue", "green"],
            "features": ["NFC integrado", "Diseños infantiles", "Silicona segura", "Tamaño niños"],
            "for_card_type": "guardian",
            "is_active": True,
            "stock": -1
        },
        # ==================== HABLADORES ====================
        {
            "id": "hablador-mesa-acrilico",
            "name": "Hablador de Mesa - Acrílico",
            "description": "Hablador de acrílico transparente con NFC para mesas.",
            "category": "habladores",
            "subcategory": "mesa",
            "price": 25.00,
            "currency": "USD",
            "image_url": "/images/products/hablador-mesa.png",
            "colors": ["transparent", "black", "white"],
            "features": ["NFC integrado", "Acrílico premium", "Base estable", "Diseño personalizable"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "hablador-pared",
            "name": "Hablador de Pared",
            "description": "Señalética de pared con NFC integrado.",
            "category": "habladores",
            "subcategory": "pared",
            "price": 35.00,
            "currency": "USD",
            "image_url": "/images/products/hablador-pared.png",
            "colors": ["white", "black", "custom"],
            "features": ["NFC integrado", "Montaje incluido", "Diseño corporativo", "Resistente"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "hablador-mostrador",
            "name": "Hablador de Mostrador",
            "description": "Display de mostrador con NFC para puntos de venta.",
            "category": "habladores",
            "subcategory": "mostrador",
            "price": 30.00,
            "currency": "USD",
            "image_url": "/images/products/hablador-mostrador.png",
            "colors": ["black", "white", "wood"],
            "features": ["NFC integrado", "Diseño elegante", "Base antideslizante", "Personalizable"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "hablador-a-frame",
            "name": "Hablador A-Frame / Caballete",
            "description": "Caballete publicitario con NFC para exteriores.",
            "category": "habladores",
            "subcategory": "exterior",
            "price": 55.00,
            "currency": "USD",
            "image_url": "/images/products/hablador-aframe.png",
            "colors": ["black", "white"],
            "features": ["NFC integrado", "Doble cara", "Resistente exterior", "Fácil cambio de gráfica"],
            "is_active": True,
            "stock": -1
        },
        # ==================== SERVICIOS ====================
        {
            "id": "service-design-custom",
            "name": "Diseño Personalizado",
            "description": "Diseño exclusivo para tu tarjeta digital. Nuestros diseñadores crean algo único para ti.",
            "category": "servicios",
            "subcategory": "diseno",
            "price": 25.00,
            "currency": "USD",
            "image_url": "/images/products/service-design.png",
            "colors": [],
            "features": ["Diseño exclusivo", "3 revisiones incluidas", "Entrega en 48h", "Archivos fuente"],
            "is_active": True,
            "stock": -1
        },
        {
            "id": "service-setup-business",
            "name": "Configuración Empresarial",
            "description": "Configuramos todo tu equipo con tarjetas BRUNO. Incluye capacitación.",
            "category": "servicios",
            "subcategory": "empresarial",
            "price": 99.00,
            "currency": "USD",
            "image_url": "/images/products/service-business.png",
            "colors": [],
            "features": ["Setup completo", "Hasta 10 usuarios", "Capacitación incluida", "Soporte prioritario 30 días"],
            "is_active": True,
            "stock": -1
        },
        # ==================== MEOW APP INTEGRATION ====================
        {
            "id": "meow-social-management",
            "name": "MEOW - Gestión Redes Sociales",
            "description": "Servicio de gestión de redes sociales por MEOW APP. Partner de BRUNO.",
            "category": "meow_services",
            "subcategory": "redes",
            "price": 199.00,
            "currency": "USD",
            "image_url": "/images/products/meow-social.png",
            "colors": [],
            "features": ["Gestión mensual", "5 redes sociales", "Contenido incluido", "Reportes semanales"],
            "is_active": True,
            "stock": -1,
            "external_link": "https://meowapp.com"
        },
        {
            "id": "meow-branding",
            "name": "MEOW - Branding Completo",
            "description": "Diseño de marca completo: logo, colores, tipografía. Por MEOW APP.",
            "category": "meow_services",
            "subcategory": "branding",
            "price": 299.00,
            "currency": "USD",
            "image_url": "/images/products/meow-branding.png",
            "colors": [],
            "features": ["Logo profesional", "Manual de marca", "Papelería básica", "Archivos editables"],
            "is_active": True,
            "stock": -1,
            "external_link": "https://meowapp.com"
        },
        {
            "id": "meow-publicidad",
            "name": "MEOW - Campañas Publicitarias",
            "description": "Diseño y ejecución de campañas publicitarias digitales. Por MEOW APP.",
            "category": "meow_services",
            "subcategory": "publicidad",
            "price": 499.00,
            "currency": "USD",
            "image_url": "/images/products/meow-ads.png",
            "colors": [],
            "features": ["Estrategia completa", "Diseño de anuncios", "Facebook & Google Ads", "Optimización continua"],
            "is_active": True,
            "stock": -1,
            "external_link": "https://meowapp.com"
        },
    ]
    
    for product in products:
        product["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.store_products.update_one(
            {"id": product["id"]},
            {"$set": product},
            upsert=True
        )

# (seed_subscription_plans moved to routers/user_data.py)
# ============================================================================
# SOCIAL NETWORK ROUTES
# ============================================================================


# ============================================================================
# POSTS, FEED, CHAT, USERS, NOTIFICATIONS, SETTINGS
# Extracted to routers/posts_feed.py
# ============================================================================





# ============================================================================
# VIDEO CALL ENDPOINTS — extracted to routers/video_calls.py
# ============================================================================

# ============================================================================
# WEBSOCKET ENDPOINTS
# ============================================================================

async def get_user_from_token(token: str) -> Optional[User]:
    """Validate token and return user for WebSocket connections (same rules as HTTP)."""
    return await resolve_user_from_token(token)


@app.websocket("/api/ws/chat/{token}")
@app.websocket("/ws/chat/{token}")
async def websocket_chat(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time chat"""
    # Validate token
    user = await get_user_from_token(token)
    if not user:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    await ws_manager.connect(websocket, user.id)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            action = data.get("action")
            
            if action == "send_message":
                chat_id = data.get("chat_id")
                content = data.get("content", "")
                message_type = data.get("message_type", "text")
                attachments = data.get("attachments", [])
                mentions = [m for m in (data.get("mentions") or []) if isinstance(m, str)]
                reply_to = data.get("reply_to")
                
                # Verify user is participant of the chat
                chat = await db.chats.find_one({
                    "id": chat_id,
                    "participants": user.id
                })
                
                if not chat:
                    await websocket.send_json({"error": "Chat not found"})
                    continue
                
                # Create message
                message_id = str(uuid.uuid4())
                created_at = datetime.now(timezone.utc).isoformat()
                
                message_doc = {
                    "id": message_id,
                    "chat_id": chat_id,
                    "sender_id": user.id,
                    "content": content,
                    "message_type": message_type,
                    "attachments": attachments,
                    "mentions": [m for m in mentions if m in chat["participants"]],
                    "reply_to": reply_to if isinstance(reply_to, dict) else None,
                    "forwarded": bool(data.get("forwarded")),
                    "forwarded_from": (data.get("forwarded_from") or "")[:80] if data.get("forwarded") else None,
                    "is_read": False,
                    "read_by": [user.id],
                    "is_deleted": False,
                    "created_at": created_at
                }
                
                await db.messages.insert_one(message_doc)
                
                # Update chat's last message
                await db.chats.update_one(
                    {"id": chat_id},
                    {"$set": {
                        "last_message_id": message_id,
                        "last_message_at": created_at,
                        "updated_at": created_at
                    }}
                )
                
                # Get sender info for response
                profile = await db.user_profiles.find_one({"user_id": user.id}, {"_id": 0})
                sender_info = {
                    "id": user.id,
                    "username": user.name,
                    "avatar_url": profile.get("avatar_url") if profile else None
                }
                
                # Prepare message for broadcast
                message_response = {
                    "type": "new_message",
                    "message": {
                        "id": message_id,
                        "chat_id": chat_id,
                        "sender_id": user.id,
                        "content": content,
                        "message_type": message_type,
                        "attachments": attachments,
                        "mentions": message_doc["mentions"],
                        "reply_to": message_doc["reply_to"],
                        "forwarded": message_doc["forwarded"],
                        "forwarded_from": message_doc["forwarded_from"],
                        "is_read": False,
                        "created_at": created_at,
                        "sender": sender_info
                    }
                }
                
                # Send to all participants
                await ws_manager.broadcast_to_users(message_response, chat["participants"])
                if message_type == "audio" and attachments:
                    from routers.chat_extras import transcribe_message_audio
                    asyncio.create_task(transcribe_message_audio(message_id))
                try:
                    from utils.chat_notify import notify_chat_message
                    await notify_chat_message(chat, user.id, user.name or "Alguien", content, message_doc["mentions"], bool(attachments))
                except Exception as e:
                    logger.warning(f"WS chat notification failed: {e}")
            
            elif action == "typing":
                chat_id = data.get("chat_id")
                
                # Get chat participants
                chat = await db.chats.find_one({"id": chat_id, "participants": user.id})
                if chat:
                    # Notify other participants
                    other_participants = [p for p in chat["participants"] if p != user.id]
                    await ws_manager.broadcast_to_users({
                        "type": "typing",
                        "chat_id": chat_id,
                        "user_id": user.id,
                        "username": user.name
                    }, other_participants)
            
            elif action == "mark_read":
                chat_id = data.get("chat_id")
                if not await db.chats.find_one({"id": chat_id, "participants": user.id}, {"_id": 0, "id": 1}):
                    continue
                
                # Mark messages as read
                await db.messages.update_many(
                    {
                        "chat_id": chat_id,
                        "sender_id": {"$ne": user.id},
                        "read_by": {"$nin": [user.id]}
                    },
                    {
                        "$set": {"is_read": True},
                        "$addToSet": {"read_by": user.id}
                    }
                )
                
                # Notify sender their messages were read
                chat = await db.chats.find_one({"id": chat_id})
                if chat:
                    other_participants = [p for p in chat["participants"] if p != user.id]
                    await ws_manager.broadcast_to_users({
                        "type": "messages_read",
                        "chat_id": chat_id,
                        "read_by": user.id
                    }, other_participants)
            
            elif action == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user.id)
    except Exception as e:
        logging.error(f"WebSocket error: {str(e)}")
        ws_manager.disconnect(websocket, user.id)


# ============================================================================
# MAP WEBSOCKET - Real-time user locations
# ============================================================================

class MapConnectionManager:
    def __init__(self):
        self.active_connections: dict = {}  # user_id -> {websocket, location}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = {
            "websocket": websocket,
            "location": None
        }
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    def update_location(self, user_id: str, location: dict):
        if user_id in self.active_connections:
            self.active_connections[user_id]["location"] = location
    
    def get_nearby_users(self, user_id: str, max_distance_km: float = 50):
        """Get users within max_distance_km"""
        current = self.active_connections.get(user_id)
        if not current or not current["location"]:
            return []
        
        current_loc = current["location"]
        nearby = []
        
        for uid, data in self.active_connections.items():
            if uid == user_id or not data["location"]:
                continue
            
            # Calculate distance
            lat1, lng1 = current_loc["lat"], current_loc["lng"]
            lat2, lng2 = data["location"]["lat"], data["location"]["lng"]
            
            R = 6371  # Earth's radius in km
            dLat = (lat2 - lat1) * 3.14159 / 180
            dLng = (lng2 - lng1) * 3.14159 / 180
            a = (pow(sin(dLat/2), 2) + 
                 cos(lat1 * 3.14159 / 180) * cos(lat2 * 3.14159 / 180) * 
                 pow(sin(dLng/2), 2))
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            distance = R * c
            
            if distance <= max_distance_km:
                nearby.append({
                    "id": uid,
                    "location": data["location"],
                    "distance_km": round(distance, 2)
                })
        
        return nearby
    
    async def broadcast_location_update(self, user_id: str, user_info: dict):
        """Broadcast user location to nearby users"""
        for uid, data in self.active_connections.items():
            if uid != user_id:
                try:
                    await data["websocket"].send_json({
                        "type": "user_location_update",
                        "user": user_info
                    })
                except Exception:
                    pass

map_manager = MapConnectionManager()

# Import math functions for distance calculation
from math import sin, cos, sqrt, atan2

@app.websocket("/api/ws/map/{token}")
@app.websocket("/ws/map/{token}")
async def map_websocket(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time map locations"""
    user = await get_current_user_from_token(token)
    if not user:
        await websocket.close(code=1008)
        return
    
    await map_manager.connect(websocket, user.id)
    
    # Get user profile for display
    profile = await db.user_profiles.find_one({"user_id": user.id}, {"_id": 0})
    user_doc = await db.users.find_one({"id": user.id}, {"_id": 0, "hashed_password": 0})
    
    user_info = {
        "id": user.id,
        "name": user_doc.get("name", ""),
        "avatar_url": profile.get("avatar_url") if profile else None,
        "subscription_tier": user_doc.get("subscription_tier", "free"),
        "location": None
    }
    
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "location_update":
                location = data.get("location")
                if location and "lat" in location and "lng" in location:
                    map_manager.update_location(user.id, location)
                    user_info["location"] = location
                    
                    # Get nearby users and send back
                    nearby = map_manager.get_nearby_users(user.id)
                    
                    # Enrich nearby users with profile info
                    enriched_nearby = []
                    for nearby_user in nearby:
                        nearby_profile = await db.user_profiles.find_one(
                            {"user_id": nearby_user["id"]}, {"_id": 0}
                        )
                        nearby_user_doc = await db.users.find_one(
                            {"id": nearby_user["id"]}, 
                            {"_id": 0, "hashed_password": 0}
                        )
                        if nearby_user_doc:
                            enriched_nearby.append({
                                "id": nearby_user["id"],
                                "name": nearby_user_doc.get("name", ""),
                                "avatar_url": nearby_profile.get("avatar_url") if nearby_profile else None,
                                "subscription_tier": nearby_user_doc.get("subscription_tier", "free"),
                                "location": nearby_user["location"],
                                "distance_km": nearby_user["distance_km"]
                            })
                    
                    await websocket.send_json({
                        "type": "users_nearby",
                        "users": enriched_nearby
                    })
                    
                    # Broadcast to other users
                    await map_manager.broadcast_location_update(user.id, user_info)
                    
    except WebSocketDisconnect:
        map_manager.disconnect(user.id)
        # Notify others user disconnected
        for uid, data in map_manager.active_connections.items():
            try:
                await data["websocket"].send_json({
                    "type": "user_disconnected",
                    "user_id": user.id
                })
            except Exception:
                pass
    except Exception as e:
        logging.error(f"Map WebSocket error: {str(e)}")
        map_manager.disconnect(user.id)

# ============================================================================
# PUBLIC ROUTES
# ============================================================================

@api_router.get("/")
async def root():
    return {"message": "BRUNO API - Tarjetas Digitales del Futuro"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "BRUNO API"}

# Include router in app
# First, import and include separate routers in api_router
from routers.notifications import router as notifications_router
from routers.points import router as points_router
from routers.marketplace import router as marketplace_router
from routers.stories import router as stories_router
from routers.store import router as store_router
from routers.analytics import router as analytics_router
from routers.compliance import router as compliance_router, set_db as compliance_set_db
from routers.lives import router as lives_router, set_db as lives_set_db
from routers.monetization import router as monetization_router, set_db as monetization_set_db
from routers.moderation import router as moderation_router, set_db as moderation_set_db
from routers.albums import router as albums_router, set_db as albums_set_db
from routers.deal_integration import router as deal_router
api_router.include_router(notifications_router)
api_router.include_router(points_router)
api_router.include_router(marketplace_router)
api_router.include_router(stories_router)
api_router.include_router(store_router)
api_router.include_router(analytics_router)
api_router.include_router(deal_router)
from routers.posts_feed import router as posts_feed_router
api_router.include_router(posts_feed_router)
from routers.mobile_native import router as mobile_native_router
api_router.include_router(mobile_native_router)
from routers.uploads import router as uploads_router
api_router.include_router(uploads_router)
from routers.nfc import router as nfc_router
api_router.include_router(nfc_router)
from routers.piup import router as piup_router
api_router.include_router(piup_router)
from routers.password_reset import router as password_reset_router  # noqa: E402
api_router.include_router(password_reset_router)
from routers.piup_admin import router as piup_admin_router  # noqa: E402
api_router.include_router(piup_admin_router)
from routers.marketplace_orders import router as marketplace_orders_router  # noqa: E402
api_router.include_router(marketplace_orders_router)
from routers.ai import router as ai_router
api_router.include_router(ai_router)
from routers.location_share import router as location_share_router
api_router.include_router(location_share_router)
from routers.i18n import router as i18n_router
api_router.include_router(i18n_router)
from routers.admin_maintenance import router as admin_maintenance_router
api_router.include_router(admin_maintenance_router)

# Share / OG meta-cards
from routers.share_og import router as share_og_router
api_router.include_router(share_og_router)
from routers.map_pins import router as map_pins_router
api_router.include_router(map_pins_router)
from routers.video_calls import router as video_calls_router
api_router.include_router(video_calls_router)
from routers.chat_groups import router as chat_groups_router
api_router.include_router(chat_groups_router)
from routers.chat_extras import router as chat_extras_router
api_router.include_router(chat_extras_router)
from routers.chat_ai import router as chat_ai_router
api_router.include_router(chat_ai_router)
from routers.polls import router as polls_router
api_router.include_router(polls_router)
from routers.reel_share import router as reel_share_router
api_router.include_router(reel_share_router)
from routers.share_stats import router as share_stats_router
api_router.include_router(share_stats_router)
from routers.card_transfer import router as card_transfer_router
api_router.include_router(card_transfer_router)
from routers.cards import router as cards_router, public_router as cards_public_router
api_router.include_router(cards_router)
api_router.include_router(cards_public_router)
from routers.search import router as search_router
api_router.include_router(search_router)
from routers.series import router as series_router
api_router.include_router(series_router)
from routers.card_examples import router as card_examples_router
api_router.include_router(card_examples_router)
from routers.user_data import router as user_data_router
api_router.include_router(user_data_router)

# Set database for compliance router
compliance_set_db(db)
app.include_router(compliance_router)

# Set database for lives router
lives_set_db(db)
app.include_router(lives_router)
from routers.post_drafts import router as post_drafts_router  # noqa: E402
api_router.include_router(post_drafts_router)

# Set database for monetization router
monetization_set_db(db)
app.include_router(monetization_router)

# Set database for moderation router
moderation_set_db(db)
app.include_router(moderation_router)

# Set database for albums router
albums_set_db(db)
app.include_router(albums_router)

# Set database for push notifications router
from routers.push_notifications import router as push_router, set_db as push_set_db
push_set_db(db)
app.include_router(push_router)

# Set database for card analytics router
from routers.card_analytics import router as card_analytics_router, set_db as card_analytics_set_db
card_analytics_set_db(db)
app.include_router(card_analytics_router)

# Set database for stripe payments router
from routers.stripe_payments import router as stripe_payments_router, set_db as stripe_set_db
stripe_set_db(db)
app.include_router(stripe_payments_router)

# Set database for social router
from routers.social import router as social_router, set_db as social_set_db
social_set_db(db)
app.include_router(social_router)

# Then include api_router in app
from routers.money import router as money_router, webhook_router as stripe_webhook_router  # noqa: E402
app.include_router(money_router)
from routers.credits import router as credits_router  # noqa: E402
app.include_router(credits_router)
app.include_router(stripe_webhook_router)
from routers.telemetry import router as telemetry_router  # noqa: E402
api_router.include_router(telemetry_router)
from routers.places import router as places_router  # noqa: E402
api_router.include_router(places_router)
app.include_router(api_router)

# Rendimiento: timing por ruta + Cache-Control, y gzip (el último add_middleware queda más externo)
from utils.perf import PerfMiddleware, SelectiveGZipMiddleware, ensure_indexes  # noqa: E402
app.add_middleware(PerfMiddleware)
app.add_middleware(SelectiveGZipMiddleware, minimum_size=1000)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Server-Timing"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logging.getLogger("passlib").setLevel(logging.ERROR)  # aviso benigno bcrypt 4.x / passlib 1.7

@app.on_event("startup")
async def auth_hardening_startup():
    """One-time platform-wide session reset (first boot with revocable tokens) + indexes for auth tables."""
    try:
        existing = await db.auth_settings.find_one({"key": "auth"}, {"_id": 0})
        if not existing or not existing.get("min_token_iat"):
            now = int(datetime.now(timezone.utc).timestamp())
            await db.auth_settings.update_one({"key": "auth"}, {"$set": {"key": "auth", "min_token_iat": now, "reset_at": datetime.now(timezone.utc).isoformat(), "reason": "auth hardening: all pre-existing sessions invalidated"}}, upsert=True)
            await db.audit_logs.insert_one({"id": str(uuid.uuid4()), "user_id": None, "action": "global_session_reset", "created_at": datetime.now(timezone.utc).isoformat()})
            logger.warning("AUTH: all sessions issued before now were invalidated (global reset)")
        await db.revoked_tokens.create_index("jti", unique=True)
        await db.revoked_tokens.create_index("expires_at", expireAfterSeconds=0)
        await db.login_attempts.create_index("key", unique=True)
        await db.login_attempts.create_index("last_failure_at", expireAfterSeconds=60 * 60 * 24)
        await db.chats.create_index("participants")
        await db.messages.create_index([("chat_id", 1), ("created_at", -1)])
        await ensure_indexes()
    except Exception as e:
        logger.error(f"auth startup hardening failed: {e}")
    try:
        from routers.card_examples import seed_examples
        logger.info(f"card examples: {await seed_examples()}")
    except Exception as e:
        logger.error(f"card examples seed failed: {e}")
    try:
        from utils.search_sync import sync_loop
        asyncio.get_event_loop().create_task(sync_loop())
    except Exception as e:
        logger.error(f"search sync startup failed: {e}")



@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
