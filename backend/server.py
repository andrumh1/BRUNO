from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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
import io
import base64
import requests
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production-123456789')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

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

# Card Models
class CardType(str):
    PERSONAL = "personal"
    EMPRESARIAL = "empresarial"
    NEGOCIO = "negocio"
    LUGARES = "lugares"

class SocialLink(BaseModel):
    type: str  # instagram, facebook, linkedin, twitter, tiktok, youtube, whatsapp, email, phone, website, custom
    label: str
    url: str
    icon: Optional[str] = None

class SocialLinks(BaseModel):
    links: List[SocialLink] = []

class Card(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    card_type: str
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    background_color: str = "#FF6B35"
    text_color: str = "#FFFFFF"
    social_links: Optional[SocialLinks] = None
    custom_fields: Optional[dict] = None
    is_public: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    views: int = 0

class CardCreate(BaseModel):
    card_type: str
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    background_color: str = "#FF6B35"
    text_color: str = "#FFFFFF"
    social_links: Optional[SocialLinks] = None
    custom_fields: Optional[dict] = None
    is_public: bool = True

class CardUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    background_color: Optional[str] = None
    text_color: Optional[str] = None
    social_links: Optional[SocialLinks] = None
    custom_fields: Optional[dict] = None
    is_public: Optional[bool] = None

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

@api_router.post("/auth/google")
async def google_auth(request: dict):
    """Handle Google OAuth callback - exchange session_id for user data"""
    session_id = request.get('session_id')
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth API to get user data
    import requests
    try:
        response = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        response.raise_for_status()
        user_data = response.json()
    except Exception as e:
        logger.error(f"Failed to get session data: {e}")
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data['email']}, {"_id": 0})
    
    if existing_user:
        # Update user data if needed
        user_obj = User(**existing_user)
        if isinstance(existing_user.get('created_at'), str):
            user_obj.created_at = datetime.fromisoformat(existing_user['created_at'])
    else:
        # Create new user
        user_obj = User(
            email=user_data['email'],
            name=user_data['name'],
            role=UserRole.PERSONAL
        )
        user_doc = user_obj.model_dump()
        user_doc['created_at'] = user_doc['created_at'].isoformat()
        user_doc['google_picture'] = user_data.get('picture')
        await db.users.insert_one(user_doc)
    
    # Store session token
    session_token = user_data['session_token']
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "user_id": user_obj.id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert session
    await db.user_sessions.update_one(
        {"user_id": user_obj.id},
        {"$set": session_doc},
        upsert=True
    )
    
    return {
        "session_token": session_token,
        "user": user_obj
    }

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
    cards = await db.cards.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
    
    for card in cards:
        if isinstance(card.get('created_at'), str):
            card['created_at'] = datetime.fromisoformat(card['created_at'])
        if isinstance(card.get('updated_at'), str):
            card['updated_at'] = datetime.fromisoformat(card['updated_at'])
    
    return cards

@api_router.get("/cards/{card_id}", response_model=Card)
async def get_card(card_id: str, current_user: Optional[User] = None):
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
    
    # Generate QR code URL
    frontend_url = os.environ.get('FRONTEND_URL', 'https://andru-gift-finder.preview.emergentagent.com')
    card_url = f"{frontend_url}/c/{card_id}"
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(card_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="#FF6B35", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        "qr_code": f"data:image/png;base64,{img_base64}",
        "card_url": card_url
    }

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
