from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Request, WebSocket, WebSocketDisconnect
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
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

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

class ConnectionManager:
    def __init__(self):
        # Map user_id -> list of WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
    
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.append(connection)
            # Clean up disconnected
            for conn in disconnected:
                self.disconnect(conn, user_id)
    
    async def broadcast_to_users(self, message: dict, user_ids: List[str]):
        for user_id in user_ids:
            await self.send_personal_message(message, user_id)

ws_manager = ConnectionManager()

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

class UserProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    user_id: str
    social_links: List[SocialLink] = []
    contact_info: Optional[ContactInfo] = None
    bio: Optional[str] = None
    website: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserProfileUpdate(BaseModel):
    social_links: Optional[List[SocialLink]] = None
    contact_info: Optional[ContactInfo] = None
    bio: Optional[str] = None
    website: Optional[str] = None
    contact_info: Optional[ContactInfo] = None
    bio: Optional[str] = None
    website: Optional[str] = None

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

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))) -> Optional[User]:
    """Get current user from JWT token or session_token cookie (optional - returns None if not authenticated)"""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


async def get_current_user_from_token(token: str) -> Optional[User]:
    """Get current user from a token string directly (for WebSocket endpoints)"""
    if not token:
        return None
    
    try:
        # Try JWT token first
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email:
            user_dict = await db.users.find_one({"email": email}, {"_id": 0})
            if user_dict:
                if isinstance(user_dict.get('created_at'), str):
                    user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
                return User(**user_dict)
    except JWTError:
        pass
    
    # Try as session_token
    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session_doc:
        expires_at = session_doc["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        now = datetime.now(timezone.utc)
        if now > expires_at:
            return None
        
        user_dict = await db.users.find_one({"id": session_doc["user_id"]}, {"_id": 0})
        if user_dict:
            if isinstance(user_dict.get('created_at'), str):
                user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
            return User(**user_dict)
    
    return None

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> User:
    """Get current user from JWT token or session_token cookie"""
    from fastapi import Request
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = None
    
    # Try to get token from Authorization header first
    if credentials:
        token = credentials.credentials
        # Try JWT token (email/password auth)
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email: str = payload.get("sub")
            if email is None:
                raise credentials_exception
            
            user_dict = await db.users.find_one({"email": email}, {"_id": 0})
            if user_dict is None:
                raise credentials_exception
            
            if isinstance(user_dict.get('created_at'), str):
                user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
            
            return User(**user_dict)
        except JWTError:
            # If JWT fails, try as session_token
            pass
    
    # If we have a token, try it as session_token
    if token:
        session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if session_doc:
            # Check expiry
            expires_at = session_doc["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if expires_at < datetime.now(timezone.utc):
                raise HTTPException(status_code=401, detail="Session expired")
            
            # Get user
            user_dict = await db.users.find_one({"id": session_doc["user_id"]}, {"_id": 0})
            if user_dict is None:
                raise credentials_exception
            
            if isinstance(user_dict.get('created_at'), str):
                user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
            
            return User(**user_dict)
    
    raise credentials_exception

# ============================================================================
# AUTH ROUTES
# ============================================================================

@api_router.post("/auth/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_input: UserCreate):
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
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.post("/auth/login", response_model=Token)
async def login(user_input: UserLogin):
    # Find user
    user_dict = await db.users.find_one({"email": user_input.email}, {"_id": 0})
    if not user_dict:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify password
    if not verify_password(user_input.password, user_dict['hashed_password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Convert datetime
    if isinstance(user_dict.get('created_at'), str):
        user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
    
    user_obj = User(**user_dict)
    
    # Create token
    access_token = create_access_token(data={"sub": user_obj.email})
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

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
async def logout(current_user: User = Depends(get_current_user)):
    """Logout user - for audit logging purposes"""
    # Log the logout event
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "action": "logout",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Logged out successfully"}

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
# CARD ROUTES
# ============================================================================

@api_router.post("/cards", response_model=Card, status_code=status.HTTP_201_CREATED)
async def create_card(card_input: CardCreate, current_user: User = Depends(get_current_user)):
    card_dict = card_input.model_dump()
    card_dict['user_id'] = current_user.id
    card_obj = Card(**card_dict)
    
    card_doc = card_obj.model_dump()
    card_doc['created_at'] = card_doc['created_at'].isoformat()
    card_doc['updated_at'] = card_doc['updated_at'].isoformat()
    
    await db.cards.insert_one(card_doc)
    return card_obj

@api_router.get("/cards", response_model=List[Card])
async def get_my_cards(current_user: User = Depends(get_current_user)):
    """Obtener las tarjetas del usuario autenticado (panel y gestión)."""
    cards = await db.cards.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
    
    for card in cards:
        if isinstance(card.get('created_at'), str):
            card['created_at'] = datetime.fromisoformat(card['created_at'])
        if isinstance(card.get('updated_at'), str):
            card['updated_at'] = datetime.fromisoformat(card['updated_at'])
    
    return cards

@api_router.get("/public/cards", response_model=List[Card])
async def get_public_cards():
    """Obtener tarjetas pblicas para el Feed (sin autenticacin).

    Solo devuelve tarjetas marcadas como pblicas y visibles en el Feed.
    Las tarjetas antiguas sin el campo show_in_feed tambin se consideran visibles.
    """
    query = {
        "is_public": True,
        "$or": [
            {"show_in_feed": True},
            {"show_in_feed": {"$exists": False}},
        ],
    }
    cards = await db.cards.find(query, {"_id": 0}).to_list(1000)

    for card in cards:
        if isinstance(card.get("created_at"), str):
            card["created_at"] = datetime.fromisoformat(card["created_at"])
        if isinstance(card.get("updated_at"), str):
            card["updated_at"] = datetime.fromisoformat(card["updated_at"])

    return [Card(**card) for card in cards]

@api_router.get("/cards/explore")
async def explore_cards(limit: int = 20, offset: int = 0):
    """Get public cards for explore/discovery section."""
    query = {
        "is_public": True,
        "$or": [
            {"show_in_feed": True},
            {"show_in_feed": {"$exists": False}},
        ],
    }
    cards = await db.cards.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    for card in cards:
        if isinstance(card.get("created_at"), str):
            card["created_at"] = datetime.fromisoformat(card["created_at"])
        if isinstance(card.get("updated_at"), str):
            card["updated_at"] = datetime.fromisoformat(card["updated_at"])
    return [Card(**card) for card in cards]

@api_router.get("/cards/{card_id}", response_model=Card)
async def get_card(card_id: str, current_user: Optional[User] = Depends(get_current_user_optional)):
    card_dict = await db.cards.find_one({"id": card_id}, {"_id": 0})
    
    if not card_dict:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Check if card is public or user owns it
    if not card_dict.get('is_public', False):
        if not current_user or card_dict['user_id'] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Increment views
    await db.cards.update_one(
        {"id": card_id},
        {"$inc": {"views": 1}}
    )
    card_dict['views'] = card_dict.get('views', 0) + 1
    
    if isinstance(card_dict.get('created_at'), str):
        card_dict['created_at'] = datetime.fromisoformat(card_dict['created_at'])
    if isinstance(card_dict.get('updated_at'), str):
        card_dict['updated_at'] = datetime.fromisoformat(card_dict['updated_at'])
    
    return Card(**card_dict)

@api_router.put("/cards/{card_id}", response_model=Card)
async def update_card(card_id: str, card_input: CardUpdate, current_user: User = Depends(get_current_user)):
    # Check if card exists and belongs to user
    existing_card = await db.cards.find_one({"id": card_id, "user_id": current_user.id})
    if not existing_card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Update card
    update_data = {k: v for k, v in card_input.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.cards.update_one(
        {"id": card_id},
        {"$set": update_data}
    )
    
    updated_card = await db.cards.find_one({"id": card_id}, {"_id": 0})
    
    if isinstance(updated_card.get('created_at'), str):
        updated_card['created_at'] = datetime.fromisoformat(updated_card['created_at'])
    if isinstance(updated_card.get('updated_at'), str):
        updated_card['updated_at'] = datetime.fromisoformat(updated_card['updated_at'])
    
    return Card(**updated_card)

@api_router.delete("/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(card_id: str, current_user: User = Depends(get_current_user)):
    result = await db.cards.delete_one({"id": card_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    return None

@api_router.get("/cards/{card_id}/qr")
async def get_card_qr(card_id: str):
    card_dict = await db.cards.find_one({"id": card_id}, {"_id": 0})
    if not card_dict:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Generate QR code URL (permanent - never changes)
    frontend_url = os.environ.get('FRONTEND_URL')
    card_url = f"{frontend_url}/c/{card_id}"
    
    # Get card color (default to orange) y ajustarlo para buen contraste
    base_color = card_dict.get('background_color', '#FF5A00')
    fill_color = base_color

    # Generate QR code optimizado para miniatura
    # Versión más alta = más datos pero más resistente a errores
    # box_size mayor = módulos más grandes = mejor lectura en miniatura
    qr = qrcode.QRCode(
        version=2,  # Versión 2 para mejor resolución
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # 30% de corrección de errores
        box_size=12,  # Módulos más grandes para mejor lectura
        border=3,  # Borde más amplio para mejor escaneo
    )
    qr.add_data(card_url)
    qr.make(fit=True)
    
    # Create QR image with custom color
    img = qr.make_image(fill_color=fill_color, back_color="white")
    
    # Convert PIL image to RGB mode for manipulation
    img = img.convert('RGB')
    
    # Add BRUNO logo in center (optimizado para miniatura)
    try:
        # Try to open logo from public folder
        logo_path = ROOT_DIR.parent / 'frontend' / 'public' / 'bruno-qr-logo.png'
        if not logo_path.exists():
            logo_path = ROOT_DIR.parent / 'frontend' / 'public' / 'bruno-mascot.png'
        
        logger.info(f"QR: Looking for logo at {logo_path}, exists: {logo_path.exists()}")
        if logo_path.exists():
            logo = Image.open(logo_path)
            logger.info(f"QR: Logo loaded, mode: {logo.mode}, size: {logo.size}")
            
            # Calculate logo size - usar 30% del QR para que sea visible
            qr_width, qr_height = img.size
            max_logo_width = int(qr_width * 0.30)
            max_logo_height = int(qr_height * 0.15)  # Limitar altura para logos horizontales
            
            # Mantener proporción del logo
            logo_w, logo_h = logo.size
            ratio = min(max_logo_width / logo_w, max_logo_height / logo_h)
            new_w = int(logo_w * ratio)
            new_h = int(logo_h * ratio)
            
            # Resize logo con alta calidad
            logo = logo.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            # Convertir a RGBA si no lo es
            if logo.mode != 'RGBA':
                logo = logo.convert('RGBA')
            
            # Crear fondo blanco rectangular para el logo
            padding = 10
            bg_width = new_w + padding * 2
            bg_height = new_h + padding * 2
            logo_bg = Image.new('RGBA', (bg_width, bg_height), (255, 255, 255, 255))
            
            # Pegar logo centrado en el fondo
            logo_bg.paste(logo, (padding, padding), logo)
            
            # Calculate position to center logo in QR
            logo_pos = ((qr_width - bg_width) // 2, (qr_height - bg_height) // 2)
            logger.info(f"QR: Pasting logo at {logo_pos}, bg_size: {bg_width}x{bg_height}, logo size: {new_w}x{new_h}")
            
            # Convert logo_bg to RGB for final paste (QR es RGB)
            final_logo = Image.new('RGB', logo_bg.size, (255, 255, 255))
            final_logo.paste(logo_bg, mask=logo_bg.split()[3])
            
            # Paste logo on QR code
            img.paste(final_logo, logo_pos)
            logger.info("QR: Logo added successfully")
        else:
            logger.warning(f"QR: Logo file not found at {logo_path}")
    except Exception as e:
        logger.error(f"Could not add logo to QR code: {e}", exc_info=True)
        # Continue without logo if there's an error
    
    # Convert to base64 con alta calidad
    buffer = io.BytesIO()
    img.save(buffer, format='PNG', optimize=True)
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        "qr_code": f"data:image/png;base64,{img_base64}",
        "card_url": card_url,
        "color": fill_color,
        "note": "QR optimizado para miniatura - funciona incluso impreso pequeño"
    }

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
# IMAGE UPLOAD ROUTES
# ============================================================================

@api_router.post("/upload/image")
async def upload_image(
    file: UploadFile = File(...),
    folder: str = "bruno",
    current_user: User = Depends(get_current_user)
):
    """Upload an image to Cloudinary"""
    try:
        # Read file content
        contents = await file.read()
        
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            contents,
            folder=f"{folder}/{current_user.id}",
            resource_type="auto",
            transformation=[
                {'width': 1200, 'height': 1200, 'crop': 'limit'},
                {'quality': 'auto:good'}
            ]
        )
        
        return {
            "url": result['secure_url'],
            "public_id": result['public_id'],
            "width": result['width'],
            "height": result['height'],
            "format": result['format']
        }
    except Exception as e:
        logging.error(f"Error uploading image: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading image: {str(e)}")

@api_router.post("/upload/audio")
async def upload_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload an audio file to Cloudinary"""
    try:
        contents = await file.read()
        
        result = cloudinary.uploader.upload(
            contents,
            folder=f"bruno/audio/{current_user.id}",
            resource_type="video",  # Cloudinary uses 'video' for audio too
        )
        
        return {
            "url": result['secure_url'],
            "public_id": result['public_id'],
            "duration": result.get('duration'),
            "format": result.get('format')
        }
    except Exception as e:
        logging.error(f"Error uploading audio: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading audio: {str(e)}")

@api_router.post("/upload/file")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload a generic file to Cloudinary"""
    try:
        contents = await file.read()
        
        result = cloudinary.uploader.upload(
            contents,
            folder=f"bruno/files/{current_user.id}",
            resource_type="raw",
            public_id=f"{uuid.uuid4()}_{file.filename}"
        )
        
        return {
            "url": result['secure_url'],
            "public_id": result['public_id'],
            "filename": file.filename,
            "size": len(contents),
            "format": file.filename.split('.')[-1] if '.' in file.filename else 'unknown'
        }
    except Exception as e:
        logging.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

@api_router.post("/upload/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload an avatar image (square, optimized)"""
    try:
        contents = await file.read()
        
        result = cloudinary.uploader.upload(
            contents,
            folder=f"bruno/avatars/{current_user.id}",
            transformation=[
                {'width': 400, 'height': 400, 'crop': 'fill', 'gravity': 'face'},
                {'quality': 'auto:best'},
                {'fetch_format': 'auto'}
            ]
        )
        
        return {
            "url": result['secure_url'],
            "public_id": result['public_id']
        }
    except Exception as e:
        logger.error(f"Error uploading avatar: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading avatar: {str(e)}")

@api_router.post("/upload/banner")
async def upload_banner(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload a banner image (wide format)"""
    try:
        contents = await file.read()
        
        result = cloudinary.uploader.upload(
            contents,
            folder=f"bruno/banners/{current_user.id}",
            transformation=[
                {'width': 1200, 'height': 400, 'crop': 'fill'},
                {'quality': 'auto:good'},
                {'fetch_format': 'auto'}
            ]
        )
        
        return {
            "url": result['secure_url'],
            "public_id": result['public_id']
        }
    except Exception as e:
        logger.error(f"Error uploading banner: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading banner: {str(e)}")

@api_router.delete("/upload/{public_id:path}")
async def delete_image(
    public_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete an image from Cloudinary"""
    try:
        # Verify the image belongs to the user
        if not public_id.startswith("bruno") or current_user.id not in public_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this image")
        
        result = cloudinary.uploader.destroy(public_id)
        return {"result": result}
    except Exception as e:
        logger.error(f"Error deleting image: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting image: {str(e)}")


# ============================================================================
# NFC ROUTES
# ============================================================================

@api_router.post("/nfc/activate")
async def activate_nfc(nfc_input: NFCActivate, current_user: User = Depends(get_current_user)):
    # Check if card exists and belongs to user
    card = await db.cards.find_one({"id": nfc_input.card_id, "user_id": current_user.id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Check if NFC card exists
    nfc_card = await db.nfc_cards.find_one({"nfc_id": nfc_input.nfc_id})
    
    if nfc_card:
        # Update existing NFC card
        await db.nfc_cards.update_one(
            {"nfc_id": nfc_input.nfc_id},
            {"$set": {
                "card_id": nfc_input.card_id,
                "user_id": current_user.id,
                "is_active": True,
                "activated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # Create new NFC card
        nfc_card_obj = NFCCard(
            nfc_id=nfc_input.nfc_id,
            user_id=current_user.id,
            card_id=nfc_input.card_id,
            is_active=True,
            activated_at=datetime.now(timezone.utc)
        )
        
        nfc_doc = nfc_card_obj.model_dump()
        nfc_doc['created_at'] = nfc_doc['created_at'].isoformat()
        if nfc_doc['activated_at']:
            nfc_doc['activated_at'] = nfc_doc['activated_at'].isoformat()
        
        await db.nfc_cards.insert_one(nfc_doc)
    
    return {"message": "NFC card activated successfully", "nfc_id": nfc_input.nfc_id, "card_id": nfc_input.card_id}

@api_router.get("/nfc/resolve/{nfc_id}")
async def resolve_nfc_card(nfc_id: str):
    """Resolve NFC ID to card URL - used when scanning NFC tags"""
    nfc_card = await db.nfc_cards.find_one({"nfc_id": nfc_id}, {"_id": 0})
    
    if not nfc_card:
        # NFC not registered - return info to register
        return {
            "found": False,
            "message": "NFC tag not registered",
            "redirect_url": None,
            "nfc_id": nfc_id
        }
    
    card_id = nfc_card.get("card_id")
    if not card_id:
        return {
            "found": False,
            "message": "NFC tag not linked to a card",
            "redirect_url": None,
            "nfc_id": nfc_id
        }
    
    # Verify the card still exists
    card = await db.cards.find_one({"id": card_id}, {"_id": 0})
    if not card:
        return {
            "found": False,
            "message": "Linked card no longer exists",
            "redirect_url": None,
            "nfc_id": nfc_id
        }
    
    # Return card URL
    frontend_url = os.environ.get('FRONTEND_URL')
    
    return {
        "found": True,
        "card_id": card_id,
        "card_title": card.get("title", ""),
        "redirect_url": f"{frontend_url}/c/{card_id}",
        "nfc_id": nfc_id
    }

@api_router.get("/nfc/my-cards")
async def get_my_nfc_cards(current_user: User = Depends(get_current_user)):
    nfc_cards = await db.nfc_cards.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
    
    for nfc in nfc_cards:
        if isinstance(nfc.get('created_at'), str):
            nfc['created_at'] = datetime.fromisoformat(nfc['created_at'])
        if nfc.get('activated_at') and isinstance(nfc['activated_at'], str):
            nfc['activated_at'] = datetime.fromisoformat(nfc['activated_at'])
    
    return nfc_cards

@api_router.post("/nfc/configure-product")
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
        "configured_via": "bruno_app"
    }
    
    await db.nfc_cards.update_one(
        {"nfc_id": config_input.nfc_id},
        {"$set": update_data}
    )
    
    return {"message": "NFC product configured successfully", "nfc_id": config_input.nfc_id, "product_id": config_input.product_id}

@api_router.post("/nfc/lock")
async def update_nfc_lock(lock_input: NFCLockUpdate, current_user: User = Depends(get_current_user)):
    """Lock/unlock an NFC tag. Only the owner can modify through BRUNO app."""
    nfc_card = await db.nfc_cards.find_one({"nfc_id": lock_input.nfc_id, "user_id": current_user.id})
    if not nfc_card:
        raise HTTPException(status_code=404, detail="NFC tag not found or not owned by you")
    
    update_data = {
        "is_locked": lock_input.is_locked,
        "lock_updated_at": datetime.now(timezone.utc).isoformat()
    }
    if lock_input.lock_pin:
        update_data["lock_pin"] = lock_input.lock_pin
    
    await db.nfc_cards.update_one(
        {"nfc_id": lock_input.nfc_id},
        {"$set": update_data}
    )
    
    return {"message": f"NFC tag {'locked' if lock_input.is_locked else 'unlocked'}", "nfc_id": lock_input.nfc_id}

@api_router.get("/nfc/resolve-product/{nfc_id}")
async def resolve_nfc_product(nfc_id: str):
    """Resolve NFC product by ID - returns product config if unlocked."""
    nfc_card = await db.nfc_cards.find_one({"nfc_id": nfc_id}, {"_id": 0})
    if not nfc_card:
        return {"found": False, "message": "NFC tag not registered", "nfc_id": nfc_id}
    
    if nfc_card.get("is_locked") and not nfc_card.get("card_id"):
        return {"found": True, "locked": True, "message": "This tag is locked by BRUNO. Only the owner can modify it.", "nfc_id": nfc_id}
    
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
        "owner_id": nfc_card.get("user_id", "")
    }
    
    if nfc_card.get("card_id"):
        card = await db.cards.find_one({"id": nfc_card["card_id"]}, {"_id": 0})
        if card:
            frontend_url = os.environ.get('FRONTEND_URL')
            result["redirect_url"] = f"{frontend_url}/c/{nfc_card['card_id']}"
            result["card_title"] = card.get("title", "")
    
    return result

@api_router.get("/nfc/product-schemas")
async def get_nfc_product_schemas():
    """Return configuration schemas for each NFC product type."""
    schemas = {
        "nfc-wifi-home": {
            "name": "WiFi Compartido",
            "fields": [
                {"key": "ssid", "label": "Nombre de Red (SSID)", "type": "text", "required": True},
                {"key": "password", "label": "Contrasena WiFi", "type": "password", "required": True},
                {"key": "encryption", "label": "Tipo de Encriptacion", "type": "select", "options": ["WPA2", "WPA3", "WEP", "Abierta"], "required": True},
                {"key": "hidden_network", "label": "Red Oculta", "type": "boolean", "required": False}
            ]
        },
        "nfc-wifi-comercio": {
            "name": "WiFi Comercial",
            "fields": [
                {"key": "ssid", "label": "Nombre de Red (SSID)", "type": "text", "required": True},
                {"key": "password", "label": "Contrasena WiFi", "type": "password", "required": True},
                {"key": "encryption", "label": "Tipo de Encriptacion", "type": "select", "options": ["WPA2", "WPA3", "WEP", "Portal Cautivo"], "required": True},
                {"key": "business_name", "label": "Nombre del Negocio", "type": "text", "required": False},
                {"key": "welcome_message", "label": "Mensaje de Bienvenida", "type": "textarea", "required": False}
            ]
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
                {"key": "insurance", "label": "Seguro Medico", "type": "text", "required": False}
            ]
        },
        "nfc-despensa": {
            "name": "Lista de Despensa",
            "fields": [
                {"key": "list_name", "label": "Nombre de la Lista", "type": "text", "required": True},
                {"key": "items", "label": "Articulos (uno por linea)", "type": "textarea", "required": False},
                {"key": "shared_with", "label": "Compartir con (emails)", "type": "text", "required": False}
            ]
        },
        "nfc-alarma": {
            "name": "Tag de Alarma",
            "fields": [
                {"key": "alarm_system", "label": "Sistema de Alarma", "type": "text", "required": True},
                {"key": "zone", "label": "Zona", "type": "text", "required": False},
                {"key": "action", "label": "Accion al Escanear", "type": "select", "options": ["Activar", "Desactivar", "Toggle"], "required": True}
            ]
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
                {"key": "telegram", "label": "Telegram", "type": "text", "required": False}
            ]
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
                {"key": "microchip_id", "label": "ID Microchip", "type": "text", "required": False}
            ]
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
                {"key": "alert_email", "label": "Email para Alertas", "type": "email", "required": False}
            ]
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
                {"key": "safe_zone_radius", "label": "Radio Zona Segura (metros)", "type": "number", "required": False}
            ]
        },
        "nfc-citas": {
            "name": "Agenda de Citas",
            "fields": [
                {"key": "business_name", "label": "Nombre del Negocio", "type": "text", "required": True},
                {"key": "service_type", "label": "Tipo de Servicio", "type": "text", "required": True},
                {"key": "calendar_url", "label": "URL del Calendario", "type": "url", "required": False},
                {"key": "phone", "label": "Telefono para Citas", "type": "tel", "required": True},
                {"key": "whatsapp", "label": "WhatsApp para Citas", "type": "tel", "required": False},
                {"key": "address", "label": "Direccion", "type": "text", "required": False}
            ]
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
                {"key": "crypto_wallet", "label": "Wallet Crypto", "type": "text", "required": False}
            ]
        },
        "nfc-apps": {
            "name": "Descarga de Apps",
            "fields": [
                {"key": "app_name", "label": "Nombre de la App", "type": "text", "required": True},
                {"key": "app_store_url", "label": "URL App Store (iOS)", "type": "url", "required": False},
                {"key": "play_store_url", "label": "URL Play Store (Android)", "type": "url", "required": False},
                {"key": "web_app_url", "label": "URL Web App", "type": "url", "required": False}
            ]
        },
        "nfc-menu-qr": {
            "name": "Menu Virtual",
            "fields": [
                {"key": "restaurant_name", "label": "Nombre del Restaurante", "type": "text", "required": True},
                {"key": "menu_url", "label": "URL del Menu", "type": "url", "required": True},
                {"key": "phone", "label": "Telefono", "type": "tel", "required": False},
                {"key": "delivery_url", "label": "URL de Delivery", "type": "url", "required": False},
                {"key": "special_message", "label": "Mensaje Especial", "type": "textarea", "required": False}
            ]
        },
        "nfc-inventario": {
            "name": "Control de Inventario",
            "fields": [
                {"key": "item_name", "label": "Nombre del Articulo", "type": "text", "required": True},
                {"key": "category", "label": "Categoria", "type": "text", "required": False},
                {"key": "location", "label": "Ubicacion", "type": "text", "required": False},
                {"key": "quantity", "label": "Cantidad", "type": "number", "required": False},
                {"key": "notes", "label": "Notas", "type": "textarea", "required": False}
            ]
        },
        "nfc-acceso": {
            "name": "Control de Acceso",
            "fields": [
                {"key": "zone_name", "label": "Nombre de la Zona", "type": "text", "required": True},
                {"key": "access_level", "label": "Nivel de Acceso", "type": "select", "options": ["Basico", "Empleado", "Gerente", "Admin", "VIP"], "required": True},
                {"key": "valid_hours", "label": "Horario Valido", "type": "text", "required": False},
                {"key": "notes", "label": "Notas", "type": "textarea", "required": False}
            ]
        },
        "nfc-llavero-gps": {
            "name": "Llavero GPS",
            "fields": [
                {"key": "item_name", "label": "Nombre del Item", "type": "text", "required": True},
                {"key": "owner_name", "label": "Nombre del Dueno", "type": "text", "required": True},
                {"key": "owner_phone", "label": "Telefono", "type": "tel", "required": True},
                {"key": "reward_message", "label": "Mensaje de Recompensa", "type": "textarea", "required": False}
            ]
        },
        "nfc-ar-productos": {
            "name": "AR para Productos",
            "fields": [
                {"key": "product_name", "label": "Nombre del Producto", "type": "text", "required": True},
                {"key": "model_url", "label": "URL Modelo 3D", "type": "url", "required": False},
                {"key": "product_url", "label": "URL del Producto (e-commerce)", "type": "url", "required": False},
                {"key": "description", "label": "Descripcion", "type": "textarea", "required": False}
            ]
        }
    }
    
    for pid in ["nfc-card-black", "nfc-card-white", "nfc-card-orange", "nfc-card-gold", "nfc-card-holographic", "nfc-carnet"]:
        schemas[pid] = {
            "name": "Tarjeta NFC Personal/Empresarial",
            "fields": [
                {"key": "linked_card_id", "label": "Tarjeta Digital Vinculada", "type": "card_selector", "required": True},
                {"key": "custom_url", "label": "URL Personalizada (opcional)", "type": "url", "required": False}
            ]
        }
    
    return schemas

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
async def get_store_products(category: Optional[str] = None):
    query = {"is_active": True}
    if category:
        query["category"] = category
    
    products = await db.store_products.find(query, {"_id": 0}).to_list(1000)
    
    # If no products, seed with defaults
    if not products:
        await seed_store_products()
        products = await db.store_products.find(query, {"_id": 0}).to_list(1000)
    
    return products

# Get single product
@api_router.get("/store/products/{product_id}")
async def get_store_product(product_id: str):
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
    # Validate items and calculate totals
    order_items = []
    subtotal = 0
    
    for item in items:
        product = await db.store_products.find_one({"id": item["product_id"], "is_active": True}, {"_id": 0})
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

# Get user's saved data
@api_router.get("/user/saved-data")
async def get_user_saved_data(current_user: User = Depends(get_current_user)):
    data = await db.user_saved_data.find_one({"user_id": current_user.id}, {"_id": 0})
    if not data:
        # Create default empty data
        data = UserSavedData(user_id=current_user.id).model_dump()
        data['created_at'] = data['created_at'].isoformat()
        data['updated_at'] = data['updated_at'].isoformat()
        await db.user_saved_data.insert_one(data)
    return data

# Update user's saved data
@api_router.put("/user/saved-data")
async def update_user_saved_data(
    updates: dict,
    current_user: User = Depends(get_current_user)
):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.user_saved_data.update_one(
        {"user_id": current_user.id},
        {"$set": updates},
        upsert=True
    )
    
    return {"message": "Data saved successfully"}

# Add shipping address
@api_router.post("/user/addresses")
async def add_user_address(
    address: dict,
    current_user: User = Depends(get_current_user)
):
    address_obj = ShippingAddress(**address)
    address_dict = address_obj.model_dump()
    
    # If this is the first address, make it default
    user_data = await db.user_saved_data.find_one({"user_id": current_user.id}, {"_id": 0})
    if not user_data or not user_data.get("addresses"):
        address_dict["is_default"] = True
    
    await db.user_saved_data.update_one(
        {"user_id": current_user.id},
        {
            "$push": {"addresses": address_dict},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    return {"message": "Address added", "address": address_dict}

# Delete shipping address
@api_router.delete("/user/addresses/{address_id}")
async def delete_user_address(
    address_id: str,
    current_user: User = Depends(get_current_user)
):
    await db.user_saved_data.update_one(
        {"user_id": current_user.id},
        {
            "$pull": {"addresses": {"id": address_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    return {"message": "Address deleted"}

# Add social link to saved data
@api_router.post("/user/social-links")
async def add_saved_social_link(
    link: dict,
    current_user: User = Depends(get_current_user)
):
    social_link = SocialLink(**link)
    
    await db.user_saved_data.update_one(
        {"user_id": current_user.id},
        {
            "$push": {"social_links": social_link.model_dump()},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    return {"message": "Social link saved"}

# ============================================================================
# SUBSCRIPTION PLANS ROUTES
# ============================================================================

# Get all subscription plans
@api_router.get("/plans")
async def get_subscription_plans():
    plans = await db.subscription_plans.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    # If no plans, seed with defaults
    if not plans:
        await seed_subscription_plans()
        plans = await db.subscription_plans.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    return plans

# Get user's current subscription
@api_router.get("/user/subscription")
async def get_user_subscription(current_user: User = Depends(get_current_user)):
    sub = await db.user_subscriptions.find_one({"user_id": current_user.id}, {"_id": 0})
    if not sub:
        # Return free plan by default
        return {
            "plan_id": "free",
            "status": "active",
            "billing_cycle": None,
            "features": ["1 tarjeta digital", "QR básico", "Plantilla estándar"]
        }
    return sub

# Create subscription checkout
@api_router.post("/subscribe/{plan_id}")
async def create_subscription_checkout(
    plan_id: str,
    billing_cycle: str = "monthly",
    current_user: User = Depends(get_current_user)
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
                "product_data": {
                    "name": f"BRUNO {plan['name']} - {billing_cycle.capitalize()}",
                },
                "unit_amount": int(price * 100),
                "recurring": {"interval": "month" if billing_cycle == "monthly" else "year"}
            },
            "quantity": 1,
        }],
        mode="subscription",
        metadata={"plan_id": plan_id, "user_id": current_user.id, "billing_cycle": billing_cycle}
    )
    
    checkout_response = stripe_checkout.create_checkout_session(checkout_request)
    
    return {"checkout_url": checkout_response.url, "session_id": checkout_response.session_id}

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

async def seed_subscription_plans():
    """Seed default subscription plans"""
    plans = [
        {
            "id": "free",
            "name": "Gratis",
            "price_monthly": 0,
            "price_yearly": 0,
            "currency": "USD",
            "features": [
                "1 tarjeta digital",
                "Código QR básico",
                "1 plantilla estándar",
                "Perfil público",
                "Compartir por link",
                "Soporte por email"
            ],
            "limits": {
                "max_cards": 1,
                "max_photos": 3,
                "max_social_links": 5,
                "analytics": False,
                "custom_domain": False,
                "remove_branding": False,
                "nfc_support": False
            },
            "is_active": True
        },
        {
            "id": "pro",
            "name": "Pro",
            "price_monthly": 9.99,
            "price_yearly": 99.00,
            "currency": "USD",
            "features": [
                "5 tarjetas digitales",
                "Código QR personalizado con logo",
                "Todas las plantillas",
                "Estadísticas de visitas",
                "Perfil verificado ✓",
                "Soporte NFC básico",
                "Sin marca BRUNO en tarjeta",
                "Exportar contactos VCF",
                "Integración calendario",
                "Soporte prioritario"
            ],
            "limits": {
                "max_cards": 5,
                "max_photos": 20,
                "max_social_links": 20,
                "analytics": True,
                "custom_domain": False,
                "remove_branding": True,
                "nfc_support": True
            },
            "is_active": True
        },
        {
            "id": "business",
            "name": "Business",
            "price_monthly": 29.99,
            "price_yearly": 299.00,
            "currency": "USD",
            "features": [
                "Tarjetas ilimitadas",
                "Todo de Pro incluido",
                "Panel de administración de equipo",
                "Dominio personalizado",
                "API access",
                "Estadísticas avanzadas",
                "Múltiples administradores",
                "Integración CRM",
                "Soporte 24/7",
                "Onboarding personalizado",
                "Facturación empresarial"
            ],
            "limits": {
                "max_cards": -1,
                "max_photos": -1,
                "max_social_links": -1,
                "analytics": True,
                "custom_domain": True,
                "remove_branding": True,
                "nfc_support": True,
                "team_management": True,
                "api_access": True
            },
            "is_active": True
        }
    ]
    
    for plan in plans:
        await db.subscription_plans.update_one(
            {"id": plan["id"]},
            {"$set": plan},
            upsert=True
        )

# ============================================================================
# SOCIAL NETWORK ROUTES
# ============================================================================

# -------------------- POSTS --------------------

import re as re_module

def _extract_hashtags(text: str) -> List[str]:
    """Extract hashtags from post content"""
    if not text:
        return []
    return list(set(re_module.findall(r'#(\w+)', text)))

@api_router.post("/posts")
async def create_post(
    post_data: PostCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new post"""
    post = Post(
        user_id=current_user.id,
        content=post_data.content,
        media=[PostMedia(**m) for m in post_data.media] if post_data.media else [],
        card_id=post_data.card_id,
        post_type=post_data.post_type,
        visibility=post_data.visibility,
        hashtags=post_data.hashtags or _extract_hashtags(post_data.content)
    )
    
    post_doc = post.model_dump()
    post_doc['created_at'] = post_doc['created_at'].isoformat()
    post_doc['updated_at'] = post_doc['updated_at'].isoformat()
    
    await db.posts.insert_one(post_doc)
    
    # Update user's posts count
    await db.user_profiles.update_one(
        {"user_id": current_user.id},
        {"$inc": {"posts_count": 1}},
        upsert=True
    )
    
    # Remove _id before returning (MongoDB adds it)
    post_doc.pop("_id", None)
    
    # Process @mentions
    await _notify_mentions(post_data.content, current_user.id, current_user.name or "Alguien", post_doc["id"], "post")
    
    return post_doc

@api_router.get("/posts")
async def get_posts(
    skip: int = 0,
    limit: int = 20,
    user_id: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get posts feed"""
    query = {"visibility": "public"}
    
    if user_id:
        query["user_id"] = user_id
        # If viewing own posts, show all visibility levels
        if current_user and current_user.id == user_id:
            del query["visibility"]
    
    posts = await db.posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich posts with user info and like status
    for post in posts:
        user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
        
        # Determine display name - User model has 'name' not 'username'
        username = "Unknown"
        display_name = None
        if user:
            username = user.get("name") or user.get("email", "Unknown").split("@")[0]
        if profile:
            display_name = profile.get("display_name")
        
        post["user"] = {
            "id": user["id"] if user else None,
            "username": username,
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": display_name or username,
            "is_verified": user.get("is_verified", False) if user else False,
            "subscription_tier": user.get("subscription_tier", "free") if user else "free"
        }
        
        # Check if current user liked this post
        if current_user:
            like = await db.likes.find_one({
                "user_id": current_user.id,
                "target_id": post["id"],
                "target_type": "post"
            })
            post["is_liked"] = like is not None
            bm = await db.bookmarks.find_one({"user_id": current_user.id, "post_id": post["id"]})
            post["is_bookmarked"] = bm is not None
        else:
            post["is_liked"] = False
            post["is_bookmarked"] = False
    
    return posts

@api_router.get("/posts/{post_id}")
async def get_post(post_id: str, current_user: Optional[User] = Depends(get_current_user_optional)):
    """Get a single post"""
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Get user info
    user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "hashed_password": 0})
    profile = await db.user_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
    post["user"] = {
        "id": user["id"] if user else None,
        "username": user.get("username") if user else "Unknown",
        "avatar_url": profile.get("avatar_url") if profile else None,
        "display_name": profile.get("display_name") if profile else None,
        "is_verified": user.get("is_verified", False) if user else False,
        "subscription_tier": user.get("subscription_tier", "free") if user else "free"
    }
    
    if current_user:
        like = await db.likes.find_one({
            "user_id": current_user.id,
            "target_id": post["id"],
            "target_type": "post"
        })
        post["is_liked"] = like is not None
    else:
        post["is_liked"] = False
    
    return post

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: User = Depends(get_current_user)):
    """Delete a post"""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user.id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found or not authorized")
    
    await db.posts.delete_one({"id": post_id})
    await db.likes.delete_many({"target_id": post_id, "target_type": "post"})
    await db.comments.delete_many({"post_id": post_id})
    
    # Update posts count
    await db.user_profiles.update_one(
        {"user_id": current_user.id},
        {"$inc": {"posts_count": -1}}
    )
    
    return {"message": "Post deleted"}

# -------------------- LIKES --------------------

@api_router.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, current_user: User = Depends(get_current_user)):
    """Toggle like on a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing_like = await db.likes.find_one({
        "user_id": current_user.id,
        "target_id": post_id,
        "target_type": "post"
    })
    
    if existing_like:
        # Unlike
        await db.likes.delete_one({"id": existing_like["id"]})
        await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": -1}})
        return {"liked": False, "likes_count": post["likes_count"] - 1}
    else:
        # Like
        like = Like(
            user_id=current_user.id,
            target_id=post_id,
            target_type="post"
        )
        like_doc = like.model_dump()
        like_doc['created_at'] = like_doc['created_at'].isoformat()
        await db.likes.insert_one(like_doc)
        await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": 1}})
        
        # Create notification (if not own post)
        if post["user_id"] != current_user.id:
            notification = Notification(
                user_id=post["user_id"],
                actor_id=current_user.id,
                type="like",
                target_id=post_id,
                target_type="post"
            )
            notif_doc = notification.model_dump()
            notif_doc['created_at'] = notif_doc['created_at'].isoformat()
            await db.notifications.insert_one(notif_doc)
            
            # Send push notification
            from routers.push_notifications import notify_new_like
            await notify_new_like(post["user_id"], current_user.name or "Alguien", "publicación")
        
        return {"liked": True, "likes_count": post["likes_count"] + 1}

# -------------------- COMMENTS --------------------

@api_router.post("/posts/{post_id}/comments")
async def create_comment(
    post_id: str,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a comment on a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = Comment(
        user_id=current_user.id,
        post_id=post_id,
        parent_id=comment_data.parent_id,
        content=comment_data.content
    )
    
    comment_doc = comment.model_dump()
    comment_doc['created_at'] = comment_doc['created_at'].isoformat()
    comment_doc['updated_at'] = comment_doc['updated_at'].isoformat()
    
    await db.comments.insert_one(comment_doc)
    
    # Update post's comment count
    await db.posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    
    # If it's a reply, update parent's replies count
    if comment_data.parent_id:
        await db.comments.update_one({"id": comment_data.parent_id}, {"$inc": {"replies_count": 1}})
    
    # Create notification
    if post["user_id"] != current_user.id:
        notification = Notification(
            user_id=post["user_id"],
            actor_id=current_user.id,
            type="comment",
            target_id=post_id,
            target_type="post",
            content=comment_data.content[:100]
        )
        notif_doc = notification.model_dump()
        notif_doc['created_at'] = notif_doc['created_at'].isoformat()
        await db.notifications.insert_one(notif_doc)
        
        # Send push notification
        from routers.push_notifications import notify_new_comment
        await notify_new_comment(post["user_id"], current_user.name or "Alguien", comment_data.content[:50])
    
    # Get user info for response
    profile = await db.user_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    
    # Remove _id before returning (MongoDB adds it)
    comment_doc.pop("_id", None)
    
    # Determine display name - User model has 'name' not 'username'
    username = current_user.name or current_user.email.split("@")[0]
    display_name = profile.get("display_name") if profile else None
    
    comment_doc["user"] = {
        "id": current_user.id,
        "username": username,
        "avatar_url": profile.get("avatar_url") if profile else None,
        "display_name": display_name or username
    }
    
    # Process @mentions in comment
    await _notify_mentions(comment_data.content, current_user.id, current_user.name or "Alguien", post_id, "comment")
    
    return comment_doc

@api_router.get("/posts/{post_id}/comments")
async def get_comments(post_id: str, skip: int = 0, limit: int = 50):
    """Get comments for a post"""
    comments = await db.comments.find(
        {"post_id": post_id, "parent_id": None},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user info
    for comment in comments:
        user = await db.users.find_one({"id": comment["user_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": comment["user_id"]}, {"_id": 0})
        
        # Determine display name - User model has 'name' not 'username'
        username = "Unknown"
        display_name = None
        if user:
            username = user.get("name") or user.get("email", "Unknown").split("@")[0]
        if profile:
            display_name = profile.get("display_name")
            
        comment["user"] = {
            "id": user["id"] if user else None,
            "username": username,
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": display_name or username
        }
        
        # Get replies
        if comment["replies_count"] > 0:
            replies = await db.comments.find(
                {"parent_id": comment["id"]},
                {"_id": 0}
            ).sort("created_at", 1).limit(3).to_list(3)
            
            for reply in replies:
                reply_user = await db.users.find_one({"id": reply["user_id"]}, {"_id": 0, "hashed_password": 0})
                reply_profile = await db.user_profiles.find_one({"user_id": reply["user_id"]}, {"_id": 0})
                reply["user"] = {
                    "id": reply_user["id"] if reply_user else None,
                    "username": reply_user.get("username") if reply_user else "Unknown",
                    "avatar_url": reply_profile.get("avatar_url") if reply_profile else None
                }
            
            comment["replies"] = replies
    
    return comments

# -------------------- USER PROFILE --------------------

@api_router.get("/profile/{user_id}")
async def get_user_profile(user_id: str, current_user: Optional[User] = Depends(get_current_user_optional)):
    """Get a user's profile"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    profile = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    if not profile:
        # Create default profile
        profile = UserProfile(user_id=user_id).model_dump()
        profile['created_at'] = profile['created_at'].isoformat()
        profile['updated_at'] = profile['updated_at'].isoformat()
        await db.user_profiles.insert_one(profile)
    
    # Combine user and profile data
    result = {
        "id": user["id"],
        "username": user.get("username"),
        "email": user.get("email") if current_user and current_user.id == user_id else None,
        **profile
    }
    
    # Check if current user follows this profile
    if current_user and current_user.id != user_id:
        follow = await db.follows.find_one({
            "follower_id": current_user.id,
            "following_id": user_id
        })
        result["is_following"] = follow is not None
    else:
        result["is_following"] = False
    
    # Get user's cards
    cards = await db.cards.find(
        {"user_id": user_id, "is_public": True},
        {"_id": 0}
    ).limit(10).to_list(10)
    result["cards"] = cards
    
    return result

@api_router.put("/profile")
async def update_user_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update current user's profile"""
    update_data = profile_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if profile_update.social_links is not None:
        update_data["social_links"] = profile_update.social_links
    
    await db.user_profiles.update_one(
        {"user_id": current_user.id},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Profile updated successfully"}

@api_router.get("/profile")
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Get current user's profile"""
    return await get_user_profile(current_user.id, current_user)

# -------------------- FOLLOW --------------------

@api_router.post("/profile/{user_id}/follow")
async def toggle_follow(user_id: str, current_user: User = Depends(get_current_user)):
    """Follow or unfollow a user"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing_follow = await db.follows.find_one({
        "follower_id": current_user.id,
        "following_id": user_id
    })
    
    if existing_follow:
        # Unfollow
        await db.follows.delete_one({"id": existing_follow["id"]})
        await db.user_profiles.update_one({"user_id": current_user.id}, {"$inc": {"following_count": -1}})
        await db.user_profiles.update_one({"user_id": user_id}, {"$inc": {"followers_count": -1}})
        return {"following": False}
    else:
        # Follow
        follow = Follow(
            follower_id=current_user.id,
            following_id=user_id
        )
        follow_doc = follow.model_dump()
        follow_doc['created_at'] = follow_doc['created_at'].isoformat()
        await db.follows.insert_one(follow_doc)
        await db.user_profiles.update_one({"user_id": current_user.id}, {"$inc": {"following_count": 1}}, upsert=True)
        await db.user_profiles.update_one({"user_id": user_id}, {"$inc": {"followers_count": 1}}, upsert=True)
        
        # Create notification
        notification = Notification(
            user_id=user_id,
            actor_id=current_user.id,
            type="follow"
        )
        notif_doc = notification.model_dump()
        notif_doc['created_at'] = notif_doc['created_at'].isoformat()
        await db.notifications.insert_one(notif_doc)
        
        # Send push notification
        from routers.push_notifications import notify_new_follower
        await notify_new_follower(user_id, current_user.name or "Alguien")
        
        return {"following": True}

# -------------------- @MENTION SEARCH --------------------

@api_router.get("/users/mention-search")
async def mention_search(
    q: str,
    limit: int = 8,
    current_user: User = Depends(get_current_user)
):
    """Quick search for @mention autocomplete (min 1 char)"""
    if len(q) < 1:
        return []
    
    users = await db.users.find({
        "$and": [
            {"id": {"$ne": current_user.id}},
            {"name": {"$regex": f"^{q}", "$options": "i"}}
        ]
    }, {"_id": 0, "hashed_password": 0}).limit(limit).to_list(limit)
    
    result = []
    for u in users:
        profile = await db.user_profiles.find_one({"user_id": u["id"]}, {"_id": 0})
        username = u.get("name") or u.get("email", "Unknown").split("@")[0]
        result.append({
            "id": u["id"],
            "username": username,
            "display_name": profile.get("display_name") if profile else username,
            "avatar_url": profile.get("avatar_url") if profile else None,
        })
    
    return result

# -------------------- @MENTION NOTIFICATION --------------------

async def _notify_mentions(content: str, actor_id: str, actor_name: str, target_id: str, target_type: str):
    """Parse @mentions from content and send notifications"""
    if not content:
        return
    mentions = re_module.findall(r'@(\w+)', content)
    if not mentions:
        return
    
    for mention_name in set(mentions):
        mentioned_user = await db.users.find_one(
            {"name": {"$regex": f"^{mention_name}$", "$options": "i"}},
            {"_id": 0}
        )
        if mentioned_user and mentioned_user["id"] != actor_id:
            notif = {
                "id": str(uuid.uuid4()),
                "user_id": mentioned_user["id"],
                "actor_id": actor_id,
                "type": "mention",
                "target_id": target_id,
                "target_type": target_type,
                "message": f"{actor_name} te mencionó en una publicación",
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notif)
            
            from routers.push_notifications import send_push_notification, NotificationPayload
            await send_push_notification(mentioned_user["id"], NotificationPayload(
                title="Te mencionaron",
                body=f"{actor_name} te mencionó",
                url="/feed",
                tag="mention"
            ))

# -------------------- USER SEARCH --------------------

@api_router.get("/users/search")
async def search_users(
    q: str,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Search users by name or email"""
    if len(q) < 2:
        return []
    
    # Search in users collection
    users = await db.users.find({
        "$and": [
            {"id": {"$ne": current_user.id}},  # Exclude current user
            {"$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"email": {"$regex": q, "$options": "i"}}
            ]}
        ]
    }, {"_id": 0, "hashed_password": 0}).limit(limit).to_list(limit)
    
    # Enrich with profile info
    result = []
    for user in users:
        profile = await db.user_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
        username = user.get("name") or user.get("email", "Unknown").split("@")[0]
        result.append({
            "id": user["id"],
            "username": username,
            "email": user.get("email"),
            "display_name": profile.get("display_name") if profile else username,
            "avatar_url": profile.get("avatar_url") if profile else None,
            "is_verified": profile.get("is_verified", False) if profile else False
        })
    
    return result

# -------------------- USER PROFILE --------------------

@api_router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: str, request: Request = None, current_user: Optional[User] = Depends(get_current_user_optional)):
    """Get public profile of a user"""
    # Get user
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get profile
    profile = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    # Get followers/following counts
    followers_count = await db.follows.count_documents({"following_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})
    
    # Get posts count
    posts_count = await db.posts.count_documents({"user_id": user_id, "is_deleted": False})
    
    username = user.get("name") or user.get("email", "Unknown").split("@")[0]
    
    # Check relationship with current user
    is_following = False
    is_blocked_by_me = False
    is_blocked_by_them = False
    if current_user and current_user.id != user_id:
        follow = await db.follows.find_one({"follower_id": current_user.id, "following_id": user_id})
        is_following = follow is not None
        block = await db.blocks.find_one({"blocker_id": current_user.id, "blocked_id": user_id})
        is_blocked_by_me = block is not None
        block2 = await db.blocks.find_one({"blocker_id": user_id, "blocked_id": current_user.id})
        is_blocked_by_them = block2 is not None
    
    return {
        "id": user_id,
        "name": user.get("name"),
        "email": user.get("email"),
        "username": username,
        "display_name": profile.get("display_name") if profile else username,
        "avatar_url": profile.get("avatar_url") if profile else None,
        "banner_url": profile.get("banner_url") if profile else None,
        "bio": profile.get("bio") if profile else None,
        "location": profile.get("location") if profile else None,
        "website": profile.get("website") if profile else None,
        "is_verified": profile.get("is_verified", False) if profile else False,
        "created_at": user.get("created_at"),
        "followers_count": followers_count,
        "following_count": following_count,
        "posts_count": posts_count,
        "is_following": is_following,
        "is_blocked_by_me": is_blocked_by_me,
        "is_blocked_by_them": is_blocked_by_them
    }

@api_router.get("/users/{user_id}/posts")
async def get_user_posts(
    user_id: str,
    skip: int = 0,
    limit: int = 20,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get posts from a specific user"""
    posts = await db.posts.find(
        {"user_id": user_id, "is_deleted": False},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get user info
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    profile = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    username = user.get("name") if user else "Unknown"
    
    # Enrich posts
    result = []
    for post in posts:
        # Check if current user liked the post
        is_liked = False
        if current_user:
            like = await db.likes.find_one({
                "user_id": current_user.id,
                "target_id": post["id"],
                "target_type": "post"
            })
            is_liked = like is not None
        
        result.append({
            **post,
            "user": {
                "id": user_id,
                "username": username,
                "display_name": profile.get("display_name") if profile else username,
                "avatar_url": profile.get("avatar_url") if profile else None,
                "is_verified": profile.get("is_verified", False) if profile else False
            },
            "is_liked": is_liked
        })
    
    return result

@api_router.post("/users/{user_id}/follow")
async def toggle_follow(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Follow or unfollow a user"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    # Check if already following
    existing = await db.follows.find_one({
        "follower_id": current_user.id,
        "following_id": user_id
    })
    
    if existing:
        # Unfollow
        await db.follows.delete_one({"_id": existing["_id"]})
        return {"following": False}
    else:
        # Follow
        follow_doc = {
            "id": str(uuid.uuid4()),
            "follower_id": current_user.id,
            "following_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.follows.insert_one(follow_doc)
        
        # Create notification
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "follow",
            "message": f"{current_user.name} comenzó a seguirte",
            "from_user_id": current_user.id,
            "target_id": current_user.id,
            "target_type": "user",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        
        return {"following": True}


# -------------------- BLOCK / UNBLOCK --------------------

@api_router.post("/users/{user_id}/block")
async def toggle_block(user_id: str, current_user: User = Depends(get_current_user)):
    """Block or unblock a user"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    existing = await db.blocks.find_one({"blocker_id": current_user.id, "blocked_id": user_id})
    
    if existing:
        await db.blocks.delete_one({"_id": existing["_id"]})
        return {"blocked": False}
    else:
        block_doc = {
            "id": str(uuid.uuid4()),
            "blocker_id": current_user.id,
            "blocked_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.blocks.insert_one(block_doc)
        # Also unfollow in both directions
        await db.follows.delete_many({"follower_id": current_user.id, "following_id": user_id})
        await db.follows.delete_many({"follower_id": user_id, "following_id": current_user.id})
        return {"blocked": True}

# -------------------- FOLLOWERS / FOLLOWING LISTS --------------------

@api_router.get("/users/{user_id}/followers")
async def get_followers(user_id: str, skip: int = 0, limit: int = 50):
    """Get list of followers for a user"""
    follows = await db.follows.find(
        {"following_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for f in follows:
        u = await db.users.find_one({"id": f["follower_id"]}, {"_id": 0, "hashed_password": 0})
        p = await db.user_profiles.find_one({"user_id": f["follower_id"]}, {"_id": 0})
        if u:
            result.append({
                "id": u["id"],
                "name": u.get("name"),
                "avatar_url": p.get("avatar_url") if p else None,
                "bio": p.get("bio") if p else None,
                "followed_at": f.get("created_at")
            })
    return result

@api_router.get("/users/{user_id}/following")
async def get_following(user_id: str, skip: int = 0, limit: int = 50):
    """Get list of users that a user follows"""
    follows = await db.follows.find(
        {"follower_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for f in follows:
        u = await db.users.find_one({"id": f["following_id"]}, {"_id": 0, "hashed_password": 0})
        p = await db.user_profiles.find_one({"user_id": f["following_id"]}, {"_id": 0})
        if u:
            result.append({
                "id": u["id"],
                "name": u.get("name"),
                "avatar_url": p.get("avatar_url") if p else None,
                "bio": p.get("bio") if p else None,
                "followed_at": f.get("created_at")
            })
    return result

@api_router.get("/users/me/blocked")
async def get_blocked_users(current_user: User = Depends(get_current_user)):
    """Get list of blocked users"""
    blocks = await db.blocks.find(
        {"blocker_id": current_user.id}, {"_id": 0}
    ).to_list(100)
    
    result = []
    for b in blocks:
        u = await db.users.find_one({"id": b["blocked_id"]}, {"_id": 0, "hashed_password": 0})
        p = await db.user_profiles.find_one({"user_id": b["blocked_id"]}, {"_id": 0})
        if u:
            result.append({
                "id": u["id"],
                "name": u.get("name"),
                "avatar_url": p.get("avatar_url") if p else None,
                "blocked_at": b.get("created_at")
            })
    return result


# ==================== MODERN SOCIAL FEATURES ====================

# ---- Bookmarks ----

@api_router.post("/posts/{post_id}/bookmark")
async def toggle_bookmark(post_id: str, current_user: User = Depends(get_current_user)):
    """Toggle bookmark/save a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing = await db.bookmarks.find_one({"user_id": current_user.id, "post_id": post_id})
    if existing:
        await db.bookmarks.delete_one({"_id": existing["_id"]})
        return {"bookmarked": False}
    else:
        bookmark = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "post_id": post_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.bookmarks.insert_one(bookmark)
        return {"bookmarked": True}

@api_router.get("/posts/saved/list")
async def get_saved_posts(skip: int = 0, limit: int = 20, current_user: User = Depends(get_current_user)):
    """Get user's saved/bookmarked posts"""
    bookmarks = await db.bookmarks.find(
        {"user_id": current_user.id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    posts = []
    for bm in bookmarks:
        post = await db.posts.find_one({"id": bm["post_id"]}, {"_id": 0})
        if not post:
            continue
        user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = {
            "id": user["id"] if user else None,
            "username": user.get("name", "Unknown") if user else "Unknown",
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": profile.get("display_name") if profile else None,
        }
        post["is_liked"] = bool(await db.likes.find_one({"user_id": current_user.id, "target_id": post["id"], "target_type": "post"}))
        post["is_bookmarked"] = True
        posts.append(post)
    
    return posts

# ---- Reactions (Multi-emoji) ----

@api_router.post("/posts/{post_id}/react")
async def toggle_reaction(post_id: str, reaction_type: str = "like", current_user: User = Depends(get_current_user)):
    """Add/remove reaction to a post (like, love, fire, laugh, wow, sad)"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    valid_types = ["like", "love", "fire", "laugh", "wow", "sad"]
    if reaction_type not in valid_types:
        reaction_type = "like"
    
    existing = await db.reactions.find_one({
        "user_id": current_user.id,
        "target_id": post_id,
        "target_type": "post"
    })
    
    if existing:
        if existing.get("reaction_type") == reaction_type:
            # Remove reaction
            await db.reactions.delete_one({"_id": existing["_id"]})
            await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": -1}})
            return {"reacted": False, "reaction_type": None}
        else:
            # Change reaction type
            await db.reactions.update_one(
                {"_id": existing["_id"]},
                {"$set": {"reaction_type": reaction_type}}
            )
            return {"reacted": True, "reaction_type": reaction_type}
    else:
        reaction = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "target_id": post_id,
            "target_type": "post",
            "reaction_type": reaction_type,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.reactions.insert_one(reaction)
        await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": 1}})
        return {"reacted": True, "reaction_type": reaction_type}

@api_router.get("/posts/{post_id}/reactions")
async def get_reactions(post_id: str):
    """Get reaction summary for a post"""
    pipeline = [
        {"$match": {"target_id": post_id, "target_type": "post"}},
        {"$group": {"_id": "$reaction_type", "count": {"$sum": 1}}},
    ]
    result = {"total": 0, "types": {}}
    async for doc in db.reactions.aggregate(pipeline):
        result["types"][doc["_id"]] = doc["count"]
        result["total"] += doc["count"]
    return result

# ---- Repost / Share ----

@api_router.post("/posts/{post_id}/repost")
async def repost(post_id: str, quote: str = "", current_user: User = Depends(get_current_user)):
    """Repost/share a post with optional quote"""
    original = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Post not found")
    
    repost_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "content": quote,
        "post_type": "repost",
        "original_post_id": post_id,
        "original_user_id": original["user_id"],
        "media": original.get("media", []),
        "visibility": "public",
        "likes_count": 0,
        "comments_count": 0,
        "shares_count": 0,
        "hashtags": [],
        "mentions": [],
        "is_pinned": False,
        "is_edited": False,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.posts.insert_one(repost_doc)
    await db.posts.update_one({"id": post_id}, {"$inc": {"shares_count": 1}})
    
    # Notify original author
    if original["user_id"] != current_user.id:
        notif = {
            "id": str(uuid.uuid4()),
            "user_id": original["user_id"],
            "actor_id": current_user.id,
            "type": "repost",
            "target_id": post_id,
            "target_type": "post",
            "message": f"{current_user.name or 'Alguien'} compartio tu publicacion",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notif)
    
    repost_doc.pop("_id", None)
    return repost_doc

# ---- Suggested Users (Authenticated) ----

@api_router.get("/social/suggested")
async def get_suggested_users_auth(limit: int = 8, current_user: User = Depends(get_current_user)):
    """Get personalized suggested users for current user"""
    # Get who current user already follows
    my_follows = await db.follows.find(
        {"follower_id": current_user.id}, {"_id": 0, "following_id": 1}
    ).to_list(500)
    followed_ids = {f["following_id"] for f in my_follows}
    followed_ids.add(current_user.id)  # Exclude self
    
    # Strategy 1: Mutual follows (friends of friends)
    mutual_candidates = set()
    for fid in list(followed_ids)[:20]:
        their_follows = await db.follows.find(
            {"follower_id": fid}, {"_id": 0, "following_id": 1}
        ).limit(20).to_list(20)
        for tf in their_follows:
            if tf["following_id"] not in followed_ids:
                mutual_candidates.add(tf["following_id"])
    
    # Strategy 2: Popular users
    popular = []
    pipeline = [
        {"$group": {"_id": "$following_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit * 3}
    ]
    async for doc in db.follows.aggregate(pipeline):
        if doc["_id"] and doc["_id"] not in followed_ids:
            popular.append(doc["_id"])
    
    # Strategy 3: Recent active users
    recent = await db.users.find(
        {"id": {"$nin": list(followed_ids)}, "is_active": True},
        {"_id": 0, "id": 1}
    ).sort("created_at", -1).limit(limit * 2).to_list(limit * 2)
    recent_ids = [u["id"] for u in recent]
    
    # Combine and deduplicate
    combined = list(mutual_candidates)[:limit//2] + popular[:limit//2] + recent_ids
    seen = set()
    unique = []
    for uid in combined:
        if uid not in seen and uid not in followed_ids:
            seen.add(uid)
            unique.append(uid)
    
    # Build profiles
    result = []
    for uid in unique[:limit]:
        user = await db.users.find_one({"id": uid}, {"_id": 0, "hashed_password": 0})
        if not user:
            continue
        profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
        fc = await db.follows.count_documents({"following_id": uid})
        # Check mutual count
        mc = 0
        for fid in list(followed_ids)[:20]:
            if await db.follows.find_one({"follower_id": fid, "following_id": uid}):
                mc += 1
        
        result.append({
            "id": uid,
            "name": user.get("name"),
            "username": user.get("name", user.get("email", "").split("@")[0]),
            "avatar_url": profile.get("avatar_url") if profile else None,
            "bio": profile.get("bio", "") if profile else "",
            "is_verified": profile.get("is_verified", False) if profile else False,
            "followers_count": fc,
            "mutual_count": mc,
        })
    
    return result

# ---- Trending & Hashtags ----

@api_router.get("/social/trending")
async def get_trending_tags(limit: int = 10):
    """Get trending hashtags"""
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}, "hashtags": {"$exists": True, "$ne": []}}},
        {"$unwind": "$hashtags"},
        {"$group": {"_id": {"$toLower": "$hashtags"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ]
    
    trending = []
    async for doc in db.posts.aggregate(pipeline):
        trending.append({"hashtag": doc["_id"], "count": doc["count"]})
    
    if not trending:
        trending = [
            {"hashtag": "bruno", "count": 0},
            {"hashtag": "networking", "count": 0},
            {"hashtag": "business", "count": 0},
            {"hashtag": "emprendimiento", "count": 0},
            {"hashtag": "tecnologia", "count": 0},
        ]
    return trending

@api_router.get("/social/hashtag/{tag}")
async def get_posts_by_tag(tag: str, skip: int = 0, limit: int = 20, current_user: Optional[User] = Depends(get_current_user_optional)):
    """Get posts by hashtag"""
    posts = await db.posts.find(
        {"hashtags": {"$regex": f"^{tag}$", "$options": "i"}, "is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for post in posts:
        user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = {
            "id": user["id"] if user else None,
            "username": user.get("name", "Unknown") if user else "Unknown",
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": profile.get("display_name") if profile else None,
        }
        if current_user:
            like = await db.likes.find_one({"user_id": current_user.id, "target_id": post["id"], "target_type": "post"})
            post["is_liked"] = like is not None
            bm = await db.bookmarks.find_one({"user_id": current_user.id, "post_id": post["id"]})
            post["is_bookmarked"] = bm is not None
        else:
            post["is_liked"] = False
            post["is_bookmarked"] = False
    
    return posts

# ---- Explore / Discover ----

@api_router.get("/social/explore")
async def explore_feed(
    skip: int = 0, limit: int = 20, category: str = "trending",
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Explore/discover content - trending, media, cards"""
    query = {"is_deleted": {"$ne": True}, "visibility": "public"}
    sort_field = "likes_count"
    
    if category == "recent":
        sort_field = "created_at"
    elif category == "media":
        query["media"] = {"$exists": True, "$ne": []}
    elif category == "cards":
        query["post_type"] = "card_share"
    
    posts = await db.posts.find(query, {"_id": 0}).sort(sort_field, -1).skip(skip).limit(limit).to_list(limit)
    
    for post in posts:
        user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = {
            "id": user["id"] if user else None,
            "username": user.get("name", "Unknown") if user else "Unknown",
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": profile.get("display_name") if profile else None,
        }
        if current_user:
            like = await db.likes.find_one({"user_id": current_user.id, "target_id": post["id"], "target_type": "post"})
            post["is_liked"] = like is not None
            bm = await db.bookmarks.find_one({"user_id": current_user.id, "post_id": post["id"]})
            post["is_bookmarked"] = bm is not None
        else:
            post["is_liked"] = False
            post["is_bookmarked"] = False
    
    return posts

# ---- Polls (for Stories) ----

@api_router.post("/social/polls")
async def create_poll(poll_data: PollCreate, current_user: User = Depends(get_current_user)):
    """Create a poll"""
    poll = {
        "id": str(uuid.uuid4()),
        "creator_id": current_user.id,
        "question": poll_data.question,
        "options": [{"text": opt, "votes": 0} for opt in poll_data.options],
        "total_votes": 0,
        "voters": [],
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=poll_data.duration_hours)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.polls.insert_one(poll)
    poll.pop("_id", None)
    return poll

@api_router.post("/social/polls/{poll_id}/vote")
async def vote_poll(poll_id: str, vote: PollVote, current_user: User = Depends(get_current_user)):
    """Vote on a poll"""
    poll = await db.polls.find_one({"id": poll_id})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    if current_user.id in poll.get("voters", []):
        raise HTTPException(status_code=400, detail="Already voted")
    if vote.option_index < 0 or vote.option_index >= len(poll["options"]):
        raise HTTPException(status_code=400, detail="Invalid option")
    
    await db.polls.update_one(
        {"id": poll_id},
        {
            "$inc": {f"options.{vote.option_index}.votes": 1, "total_votes": 1},
            "$push": {"voters": current_user.id}
        }
    )
    
    updated = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    return updated

@api_router.get("/social/polls/{poll_id}")
async def get_poll(poll_id: str):
    """Get poll details"""
    poll = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    return poll



# ==================== FOR YOU PERSONALIZED FEED ====================

@api_router.get("/feed/for-you")
async def get_for_you_feed(
    skip: int = 0, limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Personalized 'For You' feed based on user interactions, follows, and preferences"""
    
    # 1. Collect user's interest signals
    # - Hashtags from posts user has liked/bookmarked/reacted to
    liked_ids = await db.reactions.find(
        {"user_id": current_user.id, "target_type": "post"},
        {"_id": 0, "target_id": 1}
    ).to_list(200)
    liked_post_ids = [l["target_id"] for l in liked_ids]
    
    bookmarked = await db.bookmarks.find(
        {"user_id": current_user.id},
        {"_id": 0, "post_id": 1}
    ).to_list(200)
    bookmarked_ids = [b["post_id"] for b in bookmarked]
    
    interacted_ids = set(liked_post_ids + bookmarked_ids)
    
    # 2. Extract preferred hashtags from interacted posts
    preferred_hashtags = []
    if interacted_ids:
        interacted_posts = await db.posts.find(
            {"id": {"$in": list(interacted_ids)}, "hashtags": {"$exists": True, "$ne": []}},
            {"_id": 0, "hashtags": 1}
        ).to_list(200)
        for p in interacted_posts:
            preferred_hashtags.extend(p.get("hashtags", []))
    
    # Count hashtag frequency for weighting
    hashtag_freq = {}
    for h in preferred_hashtags:
        hl = h.lower()
        hashtag_freq[hl] = hashtag_freq.get(hl, 0) + 1
    top_hashtags = sorted(hashtag_freq, key=hashtag_freq.get, reverse=True)[:15]
    
    # 3. Get who user follows
    follows = await db.follows.find(
        {"follower_id": current_user.id}, {"_id": 0, "following_id": 1}
    ).to_list(500)
    followed_ids = {f["following_id"] for f in follows}
    
    # 4. Build candidate posts from multiple sources with scoring
    seen_ids = set()
    scored_posts = []
    
    # Source A: Posts from followed users (high relevance)
    if followed_ids:
        following_posts = await db.posts.find(
            {"user_id": {"$in": list(followed_ids)}, "is_deleted": {"$ne": True}, "visibility": "public"},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit * 2).to_list(limit * 2)
        for p in following_posts:
            if p["id"] not in seen_ids:
                seen_ids.add(p["id"])
                score = 80 + (p.get("likes_count", 0) * 0.5)
                scored_posts.append((score, p))
    
    # Source B: Posts matching preferred hashtags (medium-high relevance)
    if top_hashtags:
        hashtag_posts = await db.posts.find(
            {"hashtags": {"$in": top_hashtags}, "is_deleted": {"$ne": True}, "visibility": "public", "user_id": {"$ne": current_user.id}},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit * 2).to_list(limit * 2)
        for p in hashtag_posts:
            if p["id"] not in seen_ids:
                seen_ids.add(p["id"])
                matching = sum(1 for h in p.get("hashtags", []) if h.lower() in top_hashtags)
                score = 50 + (matching * 15) + (p.get("likes_count", 0) * 0.3)
                scored_posts.append((score, p))
    
    # Source C: Trending/popular posts (medium relevance)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    popular_posts = await db.posts.find(
        {"created_at": {"$gte": week_ago}, "is_deleted": {"$ne": True}, "visibility": "public", "user_id": {"$ne": current_user.id}},
        {"_id": 0}
    ).sort("likes_count", -1).limit(limit * 2).to_list(limit * 2)
    for p in popular_posts:
        if p["id"] not in seen_ids:
            seen_ids.add(p["id"])
            score = 30 + (p.get("likes_count", 0) * 1.5) + (p.get("comments_count", 0) * 2)
            scored_posts.append((score, p))
    
    # Source D: Recent posts from new users (discovery)
    new_posts = await db.posts.find(
        {"is_deleted": {"$ne": True}, "visibility": "public", "user_id": {"$ne": current_user.id}},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    for p in new_posts:
        if p["id"] not in seen_ids:
            seen_ids.add(p["id"])
            score = 10 + (p.get("likes_count", 0) * 0.5)
            scored_posts.append((score, p))
    
    # 5. Sort by score, apply pagination
    scored_posts.sort(key=lambda x: x[0], reverse=True)
    paginated = [p for _, p in scored_posts[skip:skip + limit]]
    
    # 6. Enrich with user info
    for post in paginated:
        user_doc = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
        username = "Unknown"
        display_name = None
        if user_doc:
            username = user_doc.get("name") or user_doc.get("email", "Unknown").split("@")[0]
        if profile:
            display_name = profile.get("display_name")
        post["user"] = {
            "id": user_doc["id"] if user_doc else None,
            "username": username,
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": display_name or username,
            "is_verified": user_doc.get("is_verified", False) if user_doc else False,
            "subscription_tier": user_doc.get("subscription_tier", "free") if user_doc else "free"
        }
        like = await db.reactions.find_one({"user_id": current_user.id, "target_id": post["id"], "target_type": "post"})
        post["is_liked"] = like is not None
        bm = await db.bookmarks.find_one({"user_id": current_user.id, "post_id": post["id"]})
        post["is_bookmarked"] = bm is not None
        post["_for_you_reason"] = (
            "following" if post["user_id"] in followed_ids else
            "hashtag_match" if any(h.lower() in top_hashtags for h in post.get("hashtags", [])) else
            "trending" if post.get("likes_count", 0) > 2 else
            "discover"
        )
    
    return paginated

# ---- Interaction Tracking ----

@api_router.post("/feed/interaction")
async def track_interaction(
    post_id: str,
    interaction_type: str = "view",
    current_user: User = Depends(get_current_user)
):
    """Track user interaction with content for recommendation improvement"""
    valid_types = ["view", "click", "expand", "share", "dwell"]
    if interaction_type not in valid_types:
        interaction_type = "view"
    
    interaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "post_id": post_id,
        "interaction_type": interaction_type,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.interactions.insert_one(interaction)
    return {"tracked": True}

# ---- User Preferences / Settings ----

@api_router.get("/settings/preferences")
async def get_preferences(current_user: User = Depends(get_current_user)):
    """Get user preferences"""
    prefs = await db.user_preferences.find_one(
        {"user_id": current_user.id}, {"_id": 0}
    )
    if not prefs:
        prefs = {
            "user_id": current_user.id,
            "feed_mode": "for_you",
            "language": "es",
            "theme": "system",
            "notifications": {
                "likes": True,
                "comments": True,
                "follows": True,
                "messages": True,
                "mentions": True
            },
            "privacy": {
                "show_online_status": True,
                "allow_messages_from": "everyone",
                "show_read_receipts": True,
                "profile_visibility": "public"
            },
            "content": {
                "autoplay_videos": True,
                "show_sensitive_content": False,
                "default_post_visibility": "public"
            }
        }
        await db.user_preferences.insert_one({**prefs})
    
    prefs.pop("_id", None)
    return prefs

@api_router.put("/settings/preferences")
async def update_preferences(prefs_data: dict, current_user: User = Depends(get_current_user)):
    """Update user preferences"""
    allowed_keys = {"feed_mode", "language", "theme", "notifications", "privacy", "content"}
    update = {k: v for k, v in prefs_data.items() if k in allowed_keys}
    
    await db.user_preferences.update_one(
        {"user_id": current_user.id},
        {"$set": update},
        upsert=True
    )
    
    return await get_preferences(current_user)



# -------------------- CHAT / MESSAGING --------------------

@api_router.get("/chats")
async def get_chats(current_user: User = Depends(get_current_user)):
    """Get all chat rooms for current user"""
    chats = await db.chats.find(
        {"participants": current_user.id},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(100)
    
    # Enrich with other participant info and last message
    for chat in chats:
        # Get other participant(s)
        other_ids = [p for p in chat["participants"] if p != current_user.id]
        participants = []
        for uid in other_ids:
            user = await db.users.find_one({"id": uid}, {"_id": 0, "hashed_password": 0})
            profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
            if user:
                username = user.get("name") or user.get("email", "Unknown").split("@")[0]
                display_name = profile.get("display_name") if profile else None
                avatar_url = profile.get("avatar_url") if profile else user.get("avatar_url")
                participants.append({
                    "id": uid,
                    "username": username,
                    "avatar_url": avatar_url,
                    "display_name": display_name or username
                })
        chat["other_participants"] = participants
        
        # Get last message
        if chat.get("last_message_id"):
            last_msg = await db.messages.find_one({"id": chat["last_message_id"]}, {"_id": 0})
            chat["last_message"] = last_msg
        
        # Count unread messages
        unread_count = await db.messages.count_documents({
            "chat_id": chat["id"],
            "sender_id": {"$ne": current_user.id},
            "read_by": {"$nin": [current_user.id]}
        })
        chat["unread_count"] = unread_count
    
    return chats

@api_router.post("/chats")
async def create_or_get_chat(
    participant_id: str,
    current_user: User = Depends(get_current_user)
):
    """Create a new direct chat or get existing one"""
    if participant_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot chat with yourself")
    
    # Check if direct chat already exists
    existing_chat = await db.chats.find_one({
        "type": "direct",
        "participants": {"$all": [current_user.id, participant_id], "$size": 2}
    }, {"_id": 0})
    
    if existing_chat:
        return existing_chat
    
    # Create new chat
    chat = ChatRoom(
        type="direct",
        participants=[current_user.id, participant_id],
        created_by=current_user.id
    )
    
    chat_doc = chat.model_dump()
    chat_doc['created_at'] = chat_doc['created_at'].isoformat()
    chat_doc['updated_at'] = chat_doc['updated_at'].isoformat()
    
    await db.chats.insert_one(chat_doc)
    
    # Remove _id before returning
    chat_doc.pop("_id", None)
    return chat_doc

@api_router.get("/chats/{chat_id}/messages")
async def get_messages(
    chat_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get messages from a chat"""
    # Verify user is participant
    chat = await db.chats.find_one({
        "id": chat_id,
        "participants": current_user.id
    })
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    messages = await db.messages.find(
        {"chat_id": chat_id, "is_deleted": False},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Mark messages as read
    await db.messages.update_many(
        {
            "chat_id": chat_id,
            "sender_id": {"$ne": current_user.id},
            "read_by": {"$nin": [current_user.id]}
        },
        {"$addToSet": {"read_by": current_user.id}, "$set": {"is_read": True}}
    )
    
    # Enrich with sender info
    for msg in messages:
        user = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": msg["sender_id"]}, {"_id": 0})
        username = "Unknown"
        if user:
            username = user.get("name") or user.get("email", "Unknown").split("@")[0]
        msg["sender"] = {
            "id": msg["sender_id"],
            "username": username,
            "avatar_url": profile.get("avatar_url") if profile else None
        }
    
    return messages[::-1]  # Return in chronological order

@api_router.post("/chats/{chat_id}/messages")
async def send_message(
    chat_id: str,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user)
):
    """Send a message in a chat"""
    # Verify user is participant
    chat = await db.chats.find_one({
        "id": chat_id,
        "participants": current_user.id
    })
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        content=message_data.content,
        message_type=message_data.message_type,
        attachments=[MessageAttachment(**a) for a in message_data.attachments] if message_data.attachments else [],
        reply_to_id=message_data.reply_to_id,
        read_by=[current_user.id]
    )
    
    message_doc = message.model_dump()
    message_doc['created_at'] = message_doc['created_at'].isoformat()
    message_doc['updated_at'] = message_doc['updated_at'].isoformat()
    
    await db.messages.insert_one(message_doc)
    
    # Update chat's last message
    await db.chats.update_one(
        {"id": chat_id},
        {
            "$set": {
                "last_message_id": message.id,
                "last_message_at": message_doc['created_at'],
                "updated_at": message_doc['updated_at']
            }
        }
    )
    
    # Create notification for other participants
    from routers.push_notifications import notify_new_message
    for participant_id in chat["participants"]:
        if participant_id != current_user.id:
            notification = Notification(
                user_id=participant_id,
                actor_id=current_user.id,
                type="message",
                target_id=chat_id,
                target_type="chat",
                content=message_data.content[:100] if message_data.content else "Sent an attachment"
            )
            notif_doc = notification.model_dump()
            notif_doc['created_at'] = notif_doc['created_at'].isoformat()
            await db.notifications.insert_one(notif_doc)
            
            # Send push notification
            msg_preview = message_data.content[:50] if message_data.content else "Envió un archivo"
            await notify_new_message(participant_id, current_user.name or "Alguien", msg_preview)
    
    # Add sender info to response
    profile = await db.user_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    username = current_user.name or current_user.email.split("@")[0]
    message_doc.pop("_id", None)
    message_doc["sender"] = {
        "id": current_user.id,
        "username": username,
        "avatar_url": profile.get("avatar_url") if profile else None
    }
    
    return message_doc

# -------------------- NOTIFICATIONS --------------------

@api_router.get("/notifications")
async def get_notifications(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get notifications for current user"""
    notifications = await db.notifications.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with actor info
    for notif in notifications:
        actor_id = notif.get("actor_id")
        if actor_id:
            actor = await db.users.find_one({"id": actor_id}, {"_id": 0, "hashed_password": 0})
            profile = await db.user_profiles.find_one({"user_id": actor_id}, {"_id": 0})
            username = "Unknown"
            if actor:
                username = actor.get("name") or actor.get("email", "Unknown").split("@")[0]
            notif["actor"] = {
                "id": actor_id,
                "username": username,
                "avatar_url": profile.get("avatar_url") if profile else None
            }
        else:
            notif["actor"] = {
                "id": None,
                "username": "Sistema",
                "avatar_url": None
            }
    
    return notifications

@api_router.put("/notifications/read")
async def mark_notifications_read(current_user: User = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user.id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: User = Depends(get_current_user)):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "user_id": current_user.id,
        "is_read": False
    })
    return {"count": count}

# ============================================================================
# BRUNO AI ASSISTANT
# ============================================================================

from emergentintegrations.llm.chat import LlmChat, UserMessage

# Store active AI chat sessions
ai_chat_sessions = {}

BRUNO_SYSTEM_MESSAGE = """Eres BRUNO IA, asistente de BRUNO APP - red social de tarjetas digitales profesionales.

## Estilo de Comunicación
- **Directo al punto**: Respuestas cortas y útiles, sin rodeos
- **Amistoso pero eficiente**: No seas frío, pero evita palabrería innecesaria
- **Accionable**: Sugiere pasos concretos, no teorías
- **Español por defecto**: Responde en el idioma del usuario

## Formato de Respuestas
- Máximo 2-3 líneas para preguntas simples
- Usa bullets solo cuando sean necesarios
- NO uses emojis excesivos (máximo 1 por respuesta si es apropiado)
- Evita: "¡Hola!", "¡Claro que sí!", "¡Por supuesto!", "Con mucho gusto"
- Prefiere: Ir directo a la respuesta útil

## Capacidades ACTIVAS
1. **Búsqueda de tarjetas**: Si buscan servicio/producto → busca y recomienda tarjetas
2. **Crear tarjetas**: Guía paso a paso (tipo → campos → diseño)
3. **Navegación rápida**: Di exactamente dónde ir en la app
4. **Resolver problemas**: Soluciones directas, no explicaciones largas

## Tipos de Tarjetas (respuesta rápida)
Personal | Empresarial | Negocio | Servicios | Lugares | Guardian | Curriculum | Mascotas | Oferta de Trabajo | Búsqueda de Personal | Solicitud de Servicio

## Funciones de la App (menciona solo lo relevante)
Feed, Stories, Reels, Chat, Mapa, Tienda PIUP, Marketplace, Lives, Llamadas, Puntos

## Ejemplos de Respuestas Correctas

❌ MAL: "¡Hola! Me encanta que me preguntes eso. Para crear una tarjeta personal, te cuento que BRUNO tiene varios tipos de tarjetas muy interesantes que puedes usar..."

✅ BIEN: "Para crear tu tarjeta: Ve a + en la barra inferior → Selecciona 'Personal' → Completa tus datos. ¿Necesitas ayuda con el diseño?"

❌ MAL: "¡Por supuesto que puedo ayudarte! Las tarjetas NFC son increíbles productos que te permiten compartir tu información profesional de manera muy fácil..."

✅ BIEN: "Tarjetas NFC disponibles en Tienda PIUP: Negro ($15), Blanco ($15), Dorado ($25), Holográfica ($30). Todas incluyen grabado y envío."

## Cuando no sepas algo
Di: "No tengo esa info. Contacta soporte@bruno.app" (No inventes)

## Acciones Especiales
- Si piden buscar profesional → "Busco en el directorio..." + resultados
- Si hay error → "¿Qué pantalla ves? Te guío paso a paso"
- Si piden precio → Da el número exacto, no rangos vagos"""

class AIMessageInput(BaseModel):
    message: str
    session_id: Optional[str] = None

class AIMessageResponse(BaseModel):
    response: str
    session_id: str

@api_router.post("/ai/chat", response_model=AIMessageResponse)
async def chat_with_bruno_ai(
    input_data: AIMessageInput,
    current_user: User = Depends(get_current_user)
):
    """Chat with BRUNO AI assistant"""
    try:
        # Get or create session ID
        session_id = input_data.session_id or f"bruno_ai_{current_user.id}_{str(uuid.uuid4())[:8]}"
        
        # Get or create chat instance
        if session_id not in ai_chat_sessions:
            api_key = os.environ.get("EMERGENT_LLM_KEY")
            if not api_key:
                raise HTTPException(status_code=500, detail="AI service not configured")
            
            chat = LlmChat(
                api_key=api_key,
                session_id=session_id,
                system_message=BRUNO_SYSTEM_MESSAGE
            ).with_model("openai", "gpt-5.2")
            
            ai_chat_sessions[session_id] = chat
        
        chat = ai_chat_sessions[session_id]
        
        # Create user message
        user_message = UserMessage(text=input_data.message)
        
        # Get response
        response = await chat.send_message(user_message)
        
        # Store conversation in database for persistence
        conversation_doc = {
            "session_id": session_id,
            "user_id": current_user.id,
            "user_message": input_data.message,
            "ai_response": response,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.ai_conversations.insert_one(conversation_doc)
        
        return AIMessageResponse(response=response, session_id=session_id)
        
    except Exception as e:
        logging.error(f"AI Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing AI request: {str(e)}")

@api_router.get("/ai/history")
async def get_ai_chat_history(
    session_id: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get AI conversation history"""
    query = {"user_id": current_user.id}
    if session_id:
        query["session_id"] = session_id
    
    conversations = await db.ai_conversations.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return conversations

@api_router.delete("/ai/history")
async def clear_ai_chat_history(
    session_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Clear AI conversation history"""
    query = {"user_id": current_user.id}
    if session_id:
        query["session_id"] = session_id
        # Also remove from active sessions
        if session_id in ai_chat_sessions:
            del ai_chat_sessions[session_id]
    
    result = await db.ai_conversations.delete_many(query)
    return {"deleted_count": result.deleted_count}


# ==================== AI CARD CREATION ====================

class AICardGenerateInput(BaseModel):
    description: str  # e.g., "soy plomero en CDMX", "tengo una cafetería", "busco trabajo como diseñador"

class AICardGenerateResponse(BaseModel):
    card_type: str
    suggested_fields: dict
    message: str

@api_router.post("/ai/generate-card", response_model=AICardGenerateResponse)
async def ai_generate_card(
    input_data: AICardGenerateInput,
    current_user: User = Depends(get_current_user)
):
    """Generate card data based on natural language description"""
    description = input_data.description.lower()
    
    # Determine card type based on keywords
    card_type = "personal"
    if any(word in description for word in ["empleo", "trabajo", "oferta", "vacante", "contratar"]):
        if any(word in description for word in ["busco", "necesito", "quiero"]):
            card_type = "busqueda_personal" if "personal" in description or "empleado" in description else "solicitud_servicio"
        else:
            card_type = "oferta_trabajo"
    elif any(word in description for word in ["empresa", "corporativo", "compañía"]):
        card_type = "empresarial"
    elif any(word in description for word in ["tienda", "negocio", "vendo", "venta", "local"]):
        card_type = "negocio"
    elif any(word in description for word in ["servicio", "freelance", "profesional", "ofrezco"]):
        card_type = "servicios"
    elif any(word in description for word in ["restaurante", "café", "bar", "lugar", "ubicación"]):
        card_type = "lugares"
    elif any(word in description for word in ["mascota", "perro", "gato", "pet"]):
        card_type = "mascotas"
    elif any(word in description for word in ["curriculum", "cv", "experiencia", "habilidades"]):
        card_type = "curriculum"
    
    # Generate suggested fields using AI
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import json
        
        generation_prompt = f"""Genera los datos para una tarjeta digital tipo "{card_type}" basándote en esta descripción: "{input_data.description}"

Responde SOLO en JSON válido con estos campos según el tipo:

Para servicios/personal/empresarial/negocio:
{{"title": "nombre", "subtitle": "profesión/eslogan", "description": "descripción corta", "services": ["servicio1", "servicio2"], "suggested_color": "#hexcolor"}}

Para oferta_trabajo/busqueda_personal:
{{"title": "título del puesto", "subtitle": "empresa/sector", "description": "descripción", "salary_min": 0, "salary_max": 0, "contract_type": "full-time/part-time/freelance", "remote_option": "remote/hybrid/on-site", "requirements": ["req1", "req2"], "suggested_color": "#hexcolor"}}

Para solicitud_servicio:
{{"title": "servicio que busca", "subtitle": "urgencia", "description": "detalles", "budget_min": 0, "budget_max": 0, "requirements": ["req1"], "suggested_color": "#hexcolor"}}

Usa colores profesionales. Si hay ubicación mencionada, inclúyela. Responde SOLO JSON."""

        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"card_gen_{current_user.id}_{uuid.uuid4()}",
            system_message="Eres un generador de datos para tarjetas digitales. Respondes SOLO en JSON válido."
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=generation_prompt)
        ai_response = await chat.send_message(user_message)
        
        # Parse AI response
        response_text = ai_response.strip()
        # Clean markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        response_text = response_text.strip()
        
        suggested_fields = json.loads(response_text)
        
        # Add default fields
        suggested_fields["card_type"] = card_type
        suggested_fields["is_public"] = True
        suggested_fields["show_in_feed"] = True
        
        return AICardGenerateResponse(
            card_type=card_type,
            suggested_fields=suggested_fields,
            message=f"Tarjeta tipo '{card_type}' generada. Revisa y ajusta los campos antes de crear."
        )
        
    except Exception as e:
        logging.error(f"AI Card Generation error: {str(e)}")
        # Fallback to basic fields
        return AICardGenerateResponse(
            card_type=card_type,
            suggested_fields={
                "title": input_data.description[:50],
                "subtitle": "",
                "description": input_data.description,
                "card_type": card_type,
                "suggested_color": "#FF5A00"
            },
            message=f"Tarjeta tipo '{card_type}' creada con datos básicos. Completa los campos."
        )


class AIRecommendationInput(BaseModel):
    query: str
    type: str = "all"  # cards, posts, reels, all


@api_router.post("/ai/recommend")
async def get_ai_recommendations(
    input_data: AIRecommendationInput,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get AI-powered recommendations for cards, posts, or reels based on search query"""
    results = {
        "cards": [],
        "posts": [],
        "query": input_data.query,
        "message": ""
    }
    
    search_terms = input_data.query.lower().split()
    
    # Search cards
    if input_data.type in ["cards", "all"]:
        card_query = {
            "is_public": True,
            "$or": [
                {"title": {"$regex": input_data.query, "$options": "i"}},
                {"subtitle": {"$regex": input_data.query, "$options": "i"}},
                {"description": {"$regex": input_data.query, "$options": "i"}},
                {"card_type": {"$regex": input_data.query, "$options": "i"}}
            ]
        }
        
        cards = await db.cards.find(
            card_query, 
            {"_id": 0}
        ).sort("views", -1).limit(10).to_list(10)
        
        # Enrich with user info
        for card in cards:
            user = await db.users.find_one(
                {"id": card["user_id"]}, 
                {"_id": 0, "hashed_password": 0}
            )
            if user:
                card["user"] = {
                    "id": user["id"],
                    "name": user.get("name", ""),
                    "avatar_url": user.get("avatar_url")
                }
        
        results["cards"] = cards
    
    # Search posts
    if input_data.type in ["posts", "all"]:
        post_query = {
            "visibility": "public",
            "$or": [
                {"content": {"$regex": input_data.query, "$options": "i"}},
                {"hashtags": {"$in": search_terms}}
            ]
        }
        
        posts = await db.posts.find(
            post_query, 
            {"_id": 0}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        # Enrich with user info
        for post in posts:
            user = await db.users.find_one(
                {"id": post["user_id"]},
                {"_id": 0, "hashed_password": 0}
            )
            profile = await db.user_profiles.find_one(
                {"user_id": post["user_id"]},
                {"_id": 0}
            )
            if user:
                post["user"] = {
                    "id": user["id"],
                    "name": user.get("name", ""),
                    "display_name": profile.get("display_name") if profile else user.get("name", ""),
                    "avatar_url": profile.get("avatar_url") if profile else user.get("avatar_url")
                }
        
        results["posts"] = posts
    
    # Generate helpful message
    total_results = len(results["cards"]) + len(results["posts"])
    if total_results > 0:
        if results["cards"]:
            results["message"] = f"Encontré {len(results['cards'])} tarjetas relacionadas con '{input_data.query}'. ¿Te interesa alguna en particular?"
        else:
            results["message"] = f"Encontré {len(results['posts'])} publicaciones relacionadas con '{input_data.query}'."
    else:
        results["message"] = f"No encontré resultados para '{input_data.query}'. Prueba con términos diferentes o publica una solicitud en el feed."
    
    return results


@api_router.get("/ai/share-card/{card_id}")
async def share_card_recommendation(
    card_id: str,
    target_user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Share a recommended card with a user via chat"""
    # Get the card
    card = await db.cards.find_one({"id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Find or create chat with target user
    chat = await db.chats.find_one({
        "type": "direct",
        "participants": {"$all": [current_user.id, target_user_id]}
    })
    
    if not chat:
        # Create new chat
        chat_id = str(uuid.uuid4())
        chat_doc = {
            "id": chat_id,
            "type": "direct",
            "participants": [current_user.id, target_user_id],
            "created_by": current_user.id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.chats.insert_one(chat_doc)
    else:
        chat_id = chat["id"]
    
    # Create message with card attachment
    message_doc = {
        "id": str(uuid.uuid4()),
        "chat_id": chat_id,
        "sender_id": current_user.id,
        "content": "Te comparto esta tarjeta que puede interesarte:",
        "message_type": "card",
        "attachments": [{
            "type": "card",
            "card_id": card["id"],
            "card_title": card.get("title", ""),
            "card_subtitle": card.get("subtitle", ""),
            "card_type": card.get("card_type", ""),
            "primary_color": card.get("background_color", "#FF6B35"),
            "secondary_color": card.get("text_color", "#FFFFFF")
        }],
        "is_read": False,
        "read_by": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message_doc)
    
    # Update chat last message
    await db.chats.update_one(
        {"id": chat_id},
        {
            "$set": {
                "last_message_id": message_doc["id"],
                "last_message_at": message_doc["created_at"],
                "updated_at": message_doc["created_at"]
            }
        }
    )
    
    # Send WebSocket notification
    await ws_manager.send_personal_message({
        "type": "new_message",
        "message": {**message_doc},
        "chat_id": chat_id
    }, target_user_id)
    
    return {"status": "sent", "chat_id": chat_id, "message_id": message_doc["id"]}


# ============================================================================
# VIDEO CALL ENDPOINTS
# ============================================================================

class VideoCallRequest(BaseModel):
    chat_id: str
    call_type: str = "video"  # video or audio

class VideoCallResponse(BaseModel):
    room_url: str
    room_name: str
    call_id: str

# Note: For production, you would use Daily.co API to create rooms
# This is a simplified implementation using local room management
DAILY_DEMO_DOMAIN = "https://bruno-demo.daily.co"  # Replace with your Daily.co domain

@api_router.post("/calls/start", response_model=VideoCallResponse)
async def start_video_call(
    request: VideoCallRequest,
    current_user: User = Depends(get_current_user)
):
    """Start a video call in a chat"""
    # Verify user is participant in the chat
    chat = await db.chats.find_one({
        "id": request.chat_id,
        "participants": current_user.id
    })
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Generate unique room name
    room_name = f"bruno-call-{request.chat_id}-{str(uuid.uuid4())[:8]}"
    room_url = f"{DAILY_DEMO_DOMAIN}/{room_name}"
    call_id = str(uuid.uuid4())
    
    # Store call record
    call_doc = {
        "id": call_id,
        "chat_id": request.chat_id,
        "room_name": room_name,
        "room_url": room_url,
        "call_type": request.call_type,
        "started_by": current_user.id,
        "participants": chat["participants"],
        "status": "ringing",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None
    }
    await db.video_calls.insert_one(call_doc)
    
    # Notify other participants via WebSocket
    other_participants = [p for p in chat["participants"] if p != current_user.id]
    call_notification = {
        "type": "incoming_call",
        "call_id": call_id,
        "chat_id": request.chat_id,
        "room_url": room_url,
        "call_type": request.call_type,
        "caller_id": current_user.id,
        "caller_name": current_user.name
    }
    await ws_manager.broadcast_to_users(call_notification, other_participants)
    
    # Send push notifications to offline participants
    from routers.push_notifications import send_push_notification, NotificationPayload
    call_type_text = "voz" if request.call_type == "audio" else "video"
    for participant_id in other_participants:
        await send_push_notification(participant_id, NotificationPayload(
            title=f"Llamada de {current_user.name}",
            body=f"Tienes una llamada de {call_type_text} entrante",
            url="/chat",
            tag="incoming_call",
            data={
                "type": "incoming_call",
                "call_id": call_id,
                "chat_id": request.chat_id,
                "caller_name": current_user.name,
                "call_type": request.call_type
            }
        ))
    
    return VideoCallResponse(
        room_url=room_url,
        room_name=room_name,
        call_id=call_id
    )

@api_router.post("/calls/{call_id}/answer")
async def answer_call(
    call_id: str,
    current_user: User = Depends(get_current_user)
):
    """Answer an incoming call"""
    call = await db.video_calls.find_one({
        "id": call_id,
        "participants": current_user.id,
        "status": "ringing"
    })
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found or already answered")
    
    await db.video_calls.update_one(
        {"id": call_id},
        {"$set": {"status": "active", "answered_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify caller that call was answered
    await ws_manager.send_personal_message({
        "type": "call_answered",
        "call_id": call_id
    }, call["started_by"])
    
    return {"status": "answered", "room_url": call["room_url"]}

@api_router.post("/calls/{call_id}/decline")
async def decline_call(
    call_id: str,
    current_user: User = Depends(get_current_user)
):
    """Decline an incoming call"""
    call = await db.video_calls.find_one({
        "id": call_id,
        "participants": current_user.id,
        "status": "ringing"
    })
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    await db.video_calls.update_one(
        {"id": call_id},
        {"$set": {"status": "declined", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify caller that call was declined
    await ws_manager.send_personal_message({
        "type": "call_declined",
        "call_id": call_id
    }, call["started_by"])
    
    return {"status": "declined"}

@api_router.post("/calls/{call_id}/end")
async def end_call(
    call_id: str,
    current_user: User = Depends(get_current_user)
):
    """End an active call"""
    call = await db.video_calls.find_one({
        "id": call_id,
        "participants": current_user.id
    })
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    await db.video_calls.update_one(
        {"id": call_id},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Notify all participants that call ended
    await ws_manager.broadcast_to_users({
        "type": "call_ended",
        "call_id": call_id
    }, call["participants"])
    
    return {"status": "ended"}

# ============================================================================
# WEBSOCKET ENDPOINTS
# ============================================================================

async def get_user_from_token(token: str) -> Optional[User]:
    """Validate token and return user for WebSocket connections"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")  # JWT token stores email in "sub", not user_id
        if email is None:
            return None
        
        user_data = await db.users.find_one({"email": email}, {"_id": 0, "hashed_password": 0})
        if user_data is None:
            return None
        
        if isinstance(user_data.get('created_at'), str):
            user_data['created_at'] = datetime.fromisoformat(user_data['created_at'])
        
        return User(**user_data)
    except JWTError:
        return None

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
                        "is_read": False,
                        "created_at": created_at,
                        "sender": sender_info
                    }
                }
                
                # Send to all participants
                await ws_manager.broadcast_to_users(message_response, chat["participants"])
            
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
                
                # Mark messages as read
                await db.messages.update_many(
                    {
                        "chat_id": chat_id,
                        "sender_id": {"$ne": user.id},
                        "is_read": False
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
                except:
                    pass

map_manager = MapConnectionManager()

# Import math functions for distance calculation
from math import sin, cos, sqrt, atan2

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
            except:
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
api_router.include_router(notifications_router)
api_router.include_router(points_router)
api_router.include_router(marketplace_router)
api_router.include_router(stories_router)
api_router.include_router(store_router)
api_router.include_router(analytics_router)

# Set database for compliance router
compliance_set_db(db)
app.include_router(compliance_router)

# Set database for lives router
lives_set_db(db)
app.include_router(lives_router)

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

# Then include api_router in app
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
