"""
Albums Router - Sistema de álbumes internos para usuarios
Permite guardar y organizar fotos/videos privados
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from jose import JWTError, jwt
import uuid
import os
import cloudinary
import cloudinary.uploader

router = APIRouter(prefix="/api/albums", tags=["albums"])
security = HTTPBearer()

# Database reference (set by main app)
_db = None
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production-123456789')
ALGORITHM = "HS256"

def set_db(db):
    global _db
    _db = db

# Models
class AlbumCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    is_private: bool = True
    cover_url: Optional[str] = None

class AlbumUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_private: Optional[bool] = None
    cover_url: Optional[str] = None

class AlbumMediaAdd(BaseModel):
    media_url: str
    media_type: str = "image"  # image, video
    caption: Optional[str] = None
    thumbnail_url: Optional[str] = None

class AlbumResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str]
    is_private: bool
    cover_url: Optional[str]
    media_count: int
    created_at: datetime
    updated_at: datetime

class AlbumMediaResponse(BaseModel):
    id: str
    album_id: str
    media_url: str
    media_type: str
    caption: Optional[str]
    thumbnail_url: Optional[str]
    created_at: datetime

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify token and get current user"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_identifier = payload.get("sub")
        if not user_identifier:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Try to find by email first (main auth system uses email as sub), then by id
        user = await _db.users.find_one({"email": user_identifier}, {"_id": 0, "password": 0})
        if not user:
            user = await _db.users.find_one({"id": user_identifier}, {"_id": 0, "password": 0})
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        class UserObj:
            def __init__(self, data):
                for key, value in data.items():
                    setattr(self, key, value)
        
        return UserObj(user)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("", response_model=AlbumResponse)
async def create_album(
    album_data: AlbumCreate,
    current_user = Depends(get_current_user)
):
    """Create a new album"""
    album_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    album = {
        "id": album_id,
        "user_id": current_user.id,
        "name": album_data.name,
        "description": album_data.description,
        "is_private": album_data.is_private,
        "cover_url": album_data.cover_url,
        "media_count": 0,
        "created_at": now,
        "updated_at": now
    }
    
    await _db.albums.insert_one(album)
    
    return AlbumResponse(**album)

@router.get("", response_model=List[AlbumResponse])
async def get_my_albums(
    current_user = Depends(get_current_user)
):
    """Get all albums for the current user"""
    albums = await _db.albums.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    return [AlbumResponse(**album) for album in albums]

@router.get("/{album_id}", response_model=AlbumResponse)
async def get_album(
    album_id: str,
    current_user = Depends(get_current_user)
):
    """Get a specific album"""
    album = await _db.albums.find_one(
        {"id": album_id, "user_id": current_user.id},
        {"_id": 0}
    )
    
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    return AlbumResponse(**album)

@router.put("/{album_id}", response_model=AlbumResponse)
async def update_album(
    album_id: str,
    album_data: AlbumUpdate,
    current_user = Depends(get_current_user)
):
    """Update an album"""
    # Check ownership
    album = await _db.albums.find_one({"id": album_id, "user_id": current_user.id})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    # Update fields
    update_data = {"updated_at": datetime.now(timezone.utc)}
    if album_data.name is not None:
        update_data["name"] = album_data.name
    if album_data.description is not None:
        update_data["description"] = album_data.description
    if album_data.is_private is not None:
        update_data["is_private"] = album_data.is_private
    if album_data.cover_url is not None:
        update_data["cover_url"] = album_data.cover_url
    
    await _db.albums.update_one(
        {"id": album_id},
        {"$set": update_data}
    )
    
    updated_album = await _db.albums.find_one({"id": album_id}, {"_id": 0})
    return AlbumResponse(**updated_album)

@router.delete("/{album_id}")
async def delete_album(
    album_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an album and all its media"""
    # Check ownership
    album = await _db.albums.find_one({"id": album_id, "user_id": current_user.id})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    # Delete all media in album
    await _db.album_media.delete_many({"album_id": album_id})
    
    # Delete album
    await _db.albums.delete_one({"id": album_id})
    
    return {"message": "Album deleted"}

# Media endpoints
@router.post("/{album_id}/media", response_model=AlbumMediaResponse)
async def add_media_to_album(
    album_id: str,
    media_data: AlbumMediaAdd,
    current_user = Depends(get_current_user)
):
    """Add media to an album"""
    # Check album ownership
    album = await _db.albums.find_one({"id": album_id, "user_id": current_user.id})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    media_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    media = {
        "id": media_id,
        "album_id": album_id,
        "user_id": current_user.id,
        "media_url": media_data.media_url,
        "media_type": media_data.media_type,
        "caption": media_data.caption,
        "thumbnail_url": media_data.thumbnail_url,
        "created_at": now
    }
    
    await _db.album_media.insert_one(media)
    
    # Update album media count and cover if not set
    update_data = {
        "$inc": {"media_count": 1},
        "$set": {"updated_at": now}
    }
    if not album.get("cover_url"):
        update_data["$set"]["cover_url"] = media_data.thumbnail_url or media_data.media_url
    
    await _db.albums.update_one({"id": album_id}, update_data)
    
    return AlbumMediaResponse(**{k: v for k, v in media.items() if k != "user_id"})

@router.get("/{album_id}/media", response_model=List[AlbumMediaResponse])
async def get_album_media(
    album_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user = Depends(get_current_user)
):
    """Get all media in an album"""
    # Check album access
    album = await _db.albums.find_one({"id": album_id, "user_id": current_user.id})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    media_list = await _db.album_media.find(
        {"album_id": album_id},
        {"_id": 0, "user_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return [AlbumMediaResponse(**m) for m in media_list]

@router.delete("/{album_id}/media/{media_id}")
async def delete_media_from_album(
    album_id: str,
    media_id: str,
    current_user = Depends(get_current_user)
):
    """Delete media from an album"""
    # Check media ownership
    media = await _db.album_media.find_one({
        "id": media_id,
        "album_id": album_id,
        "user_id": current_user.id
    })
    
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    # Delete media
    await _db.album_media.delete_one({"id": media_id})
    
    # Update album count
    await _db.albums.update_one(
        {"id": album_id},
        {
            "$inc": {"media_count": -1},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {"message": "Media deleted"}

@router.post("/upload")
async def upload_album_media(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    """Upload a file for album media"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de archivo no soportado")
    
    # Determine resource type
    resource_type = "video" if file.content_type.startswith("video") else "image"
    
    try:
        # Read file content
        content = await file.read()
        
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            content,
            resource_type=resource_type,
            folder=f"bruno/albums/{current_user.id}",
            transformation={"quality": "auto:good"} if resource_type == "image" else None
        )
        
        response = {
            "url": result["secure_url"],
            "media_type": resource_type,
            "public_id": result["public_id"]
        }
        
        # Add thumbnail for videos
        if resource_type == "video":
            response["thumbnail_url"] = result.get("secure_url", "").replace("/upload/", "/upload/so_0/")
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir: {str(e)}")
