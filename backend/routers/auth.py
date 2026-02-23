"""Authentication routes."""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
import httpx

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import (
    verify_password, get_password_hash, create_access_token, get_current_user
)
from models.user import User, UserCreate, UserLogin, Token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_input: UserCreate):
    existing_user = await db.users.find_one({"email": user_input.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user_dict = user_input.model_dump(exclude={'password'})
    user_obj = User(**user_dict)
    
    hashed_password = get_password_hash(user_input.password)
    user_doc = user_obj.model_dump()
    user_doc['hashed_password'] = hashed_password
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token(data={"sub": user_obj.email})
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)


@router.post("/login", response_model=Token)
async def login(user_input: UserLogin):
    user_dict = await db.users.find_one({"email": user_input.email}, {"_id": 0})
    if not user_dict:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not verify_password(user_input.password, user_dict['hashed_password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if isinstance(user_dict.get('created_at'), str):
        user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
    
    user_obj = User(**user_dict)
    access_token = create_access_token(data={"sub": user_obj.email})
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)


@router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me")
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
    
    user_dict = await db.users.find_one({"id": current_user.id}, {"_id": 0, "hashed_password": 0})
    if isinstance(user_dict.get('created_at'), str):
        user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
    
    return User(**user_dict)


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout user - for audit logging purposes"""
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "action": "logout",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": "Logged out successfully"}


class GoogleAuthRequest(BaseModel):
    session_id: str


@router.post("/google")
async def google_auth(request: GoogleAuthRequest):
    """Handle Google OAuth callback - exchange session_id for user data from Emergent Auth"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id},
                timeout=10.0
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            
            auth_data = response.json()
            
        email = auth_data.get("email")
        name = auth_data.get("name", email.split("@")[0] if email else "User")
        picture = auth_data.get("picture", "")
        session_token = auth_data.get("session_token")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")
        
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
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
            user_id = str(uuid.uuid4())
            new_user = {
                "id": user_id,
                "email": email,
                "name": name,
                "avatar_url": picture,
                "hashed_password": "",
                "role": "personal",
                "company_id": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "is_active": True,
                "plan": "free",
                "subscription_status": "inactive",
                "country": ""
            }
            await db.users.insert_one(new_user)
        
        user_doc = await db.users.find_one({"email": email}, {"_id": 0})
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
