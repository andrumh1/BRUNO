"""Cloudinary upload endpoints.
Extracted from server.py to reduce monolith size.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
import logging
import uuid
import os

import cloudinary
import cloudinary.uploader

import sys
sys.path.insert(0, '/app/backend')

from utils.security import get_current_user
from models.user import User

# Configure Cloudinary once (idempotent — server.py also configures it)
cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key=os.environ.get('CLOUDINARY_API_KEY'),
    api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
    secure=True,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["uploads"])


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    folder: str = "bruno",
    current_user: User = Depends(get_current_user),
):
    """Upload an image to Cloudinary."""
    try:
        contents = await file.read()
        result = cloudinary.uploader.upload(
            contents,
            folder=f"{folder}/{current_user.id}",
            resource_type="auto",
            transformation=[
                {'width': 1200, 'height': 1200, 'crop': 'limit'},
                {'quality': 'auto:good'},
            ],
        )
        return {
            "url": result['secure_url'],
            "public_id": result['public_id'],
            "width": result['width'],
            "height": result['height'],
            "format": result['format'],
        }
    except Exception as e:
        logger.error(f"Error uploading image: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading image: {str(e)}")


@router.post("/audio")
async def upload_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an audio file to Cloudinary."""
    try:
        contents = await file.read()
        result = cloudinary.uploader.upload(
            contents,
            folder=f"bruno/audio/{current_user.id}",
            resource_type="video",  # Cloudinary uses 'video' for audio
        )
        return {
            "url": result['secure_url'],
            "public_id": result['public_id'],
            "duration": result.get('duration'),
            "format": result.get('format'),
        }
    except Exception as e:
        logger.error(f"Error uploading audio: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading audio: {str(e)}")


@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a generic file to Cloudinary."""
    try:
        contents = await file.read()
        result = cloudinary.uploader.upload(
            contents,
            folder=f"bruno/files/{current_user.id}",
            resource_type="raw",
            public_id=f"{uuid.uuid4()}_{file.filename}",
        )
        return {
            "url": result['secure_url'],
            "public_id": result['public_id'],
            "filename": file.filename,
            "size": len(contents),
            "format": file.filename.split('.')[-1] if file.filename and '.' in file.filename else 'unknown',
        }
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@router.post("/chat-file")
async def upload_chat_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a chat attachment (image, video, or file) to Cloudinary."""
    try:
        contents = await file.read()
        content_type = file.content_type or ""

        if content_type.startswith("image"):
            result = cloudinary.uploader.upload(
                contents,
                folder=f"bruno/chat/{current_user.id}",
                resource_type="image",
                transformation=[
                    {'width': 1200, 'height': 1200, 'crop': 'limit'},
                    {'quality': 'auto:good'},
                ],
            )
        elif content_type.startswith("video") or content_type.startswith("audio"):
            result = cloudinary.uploader.upload(
                contents,
                folder=f"bruno/chat/{current_user.id}",
                resource_type="video",
            )
        else:
            result = cloudinary.uploader.upload(
                contents,
                folder=f"bruno/chat/{current_user.id}",
                resource_type="raw",
                public_id=f"{uuid.uuid4()}_{file.filename}",
            )

        return {
            "url": result['secure_url'],
            "public_id": result['public_id'],
            "filename": file.filename,
            "type": content_type,
            "size": len(contents),
        }
    except Exception as e:
        logger.error(f"Error uploading chat file: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading chat file: {str(e)}")


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an avatar image (square, face-cropped, optimized)."""
    try:
        contents = await file.read()
        result = cloudinary.uploader.upload(
            contents,
            folder=f"bruno/avatars/{current_user.id}",
            transformation=[
                {'width': 400, 'height': 400, 'crop': 'fill', 'gravity': 'face'},
                {'quality': 'auto:best'},
                {'fetch_format': 'auto'},
            ],
        )
        return {"url": result['secure_url'], "public_id": result['public_id']}
    except Exception as e:
        logger.error(f"Error uploading avatar: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading avatar: {str(e)}")


@router.post("/banner")
async def upload_banner(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a banner image (wide format)."""
    try:
        contents = await file.read()
        result = cloudinary.uploader.upload(
            contents,
            folder=f"bruno/banners/{current_user.id}",
            transformation=[
                {'width': 1200, 'height': 400, 'crop': 'fill'},
                {'quality': 'auto:good'},
                {'fetch_format': 'auto'},
            ],
        )
        return {"url": result['secure_url'], "public_id": result['public_id']}
    except Exception as e:
        logger.error(f"Error uploading banner: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading banner: {str(e)}")


@router.delete("/{public_id:path}")
async def delete_image(
    public_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete an image from Cloudinary (owner-only)."""
    try:
        if not public_id.startswith("bruno") or current_user.id not in public_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this image")
        result = cloudinary.uploader.destroy(public_id)
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting image: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting image: {str(e)}")
