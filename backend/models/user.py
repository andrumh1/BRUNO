"""User models."""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from datetime import datetime, timezone
from typing import Optional
import uuid


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
    email_verified: Optional[bool] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = UserRole.PERSONAL
    platform: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    platform: Optional[str] = None
    remember: Optional[bool] = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: User
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
