from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal
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
# MODELS
# ============================================================================

# User Models
class UserRole(str):
    PERSONAL = "personal"
    ADMIN_EMPRESA = "admin_empresa"
    SUPER_ADMIN = "super_admin"

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str = UserRole.PERSONAL
    company_id: Optional[str] = None
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

    location: Optional[dict] = None
    template_id: Optional[str] = None
    custom_fields: Optional[dict] = None
    is_public: Optional[bool] = None
    show_in_feed: Optional[bool] = None
    is_animated: Optional[bool] = None

# NFC Models

# NFC Models
class NFCCard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nfc_id: str
    user_id: str
    card_id: Optional[str] = None
    is_active: bool = False
    activated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NFCActivate(BaseModel):
    nfc_id: str
    card_id: str

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
    updated = await db.payment_transactions.update_one(
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
    frontend_url = os.environ.get('FRONTEND_URL', 'https://digibizcard-15.preview.emergentagent.com')
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
        # Try to open logo from public folder - preferir el logo cuadrado para QR
        logo_path = ROOT_DIR.parent / 'frontend' / 'public' / 'bruno-qr-logo.png'
        if not logo_path.exists():
            logo_path = ROOT_DIR.parent / 'frontend' / 'public' / 'bruno-mascot.png'
        
        logger.info(f"QR: Looking for logo at {logo_path}, exists: {logo_path.exists()}")
        if logo_path.exists():
            logo = Image.open(logo_path)
            logger.info(f"QR: Logo loaded, mode: {logo.mode}, size: {logo.size}")
            
            # Calculate logo size (20% del QR para mejor visibilidad)
            qr_width, qr_height = img.size
            max_logo_size = int(qr_width * 0.20)
            
            # Mantener proporción del logo
            logo_w, logo_h = logo.size
            ratio = min(max_logo_size / logo_w, max_logo_size / logo_h)
            new_w = int(logo_w * ratio)
            new_h = int(logo_h * ratio)
            
            # Resize logo con alta calidad
            logo = logo.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            # Crear fondo blanco cuadrado para el logo
            padding = 12
            bg_size = max(new_w, new_h) + padding * 2
            logo_bg = Image.new('RGBA', (bg_size, bg_size), (255, 255, 255, 255))
            
            # Centrar logo en el fondo
            logo_x = (bg_size - new_w) // 2
            logo_y = (bg_size - new_h) // 2
            
            if logo.mode == 'RGBA':
                logo_bg.paste(logo, (logo_x, logo_y), logo)
            else:
                logo_bg.paste(logo, (logo_x, logo_y))
            
            # Calculate position to center logo in QR
            logo_pos = ((qr_width - bg_size) // 2, (qr_height - bg_size) // 2)
            logger.info(f"QR: Pasting logo at {logo_pos}, bg_size: {bg_size}, logo size: {new_w}x{new_h}")
            
            # Convert logo_bg to RGB for final paste
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
        logger.error(f"Error uploading image: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading image: {str(e)}")

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
        if not public_id.startswith(f"bruno") or current_user.id not in public_id:
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

@api_router.get("/nfc/my-cards")
async def get_my_nfc_cards(current_user: User = Depends(get_current_user)):
    nfc_cards = await db.nfc_cards.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
    
    for nfc in nfc_cards:
        if isinstance(nfc.get('created_at'), str):
            nfc['created_at'] = datetime.fromisoformat(nfc['created_at'])
        if nfc.get('activated_at') and isinstance(nfc['activated_at'], str):
            nfc['activated_at'] = datetime.fromisoformat(nfc['activated_at'])
    
    return nfc_cards

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
# PUBLIC ROUTES
# ============================================================================

@api_router.get("/")
async def root():
    return {"message": "BRUNO API - Tarjetas Digitales del Futuro"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "BRUNO API"}

# Include router in app
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
