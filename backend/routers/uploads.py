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
    """Upload an image or video to Cloudinary.

    Detects content type and applies image transforms only when needed —
    videos pass through as resource_type='video' without image transforms,
    which would otherwise fail.
    """
    try:
        contents = await file.read()
        content_type = (file.content_type or "").lower()
        is_video = content_type.startswith("video")

        if is_video:
            # eager_transcoding: ALWAYS deliver a cross-platform-safe MP4
            # (H.264 video + AAC audio) at moderate bitrate — iOS Safari
            # rejects webm/opus, Windows defaults reject HEVC, etc.
            result = cloudinary.uploader.upload(
                contents,
                folder=f"{folder}/{current_user.id}",
                resource_type="video",
                # Cloudinary will store the original AND produce these derivatives
                eager=[
                    {"format": "mp4", "video_codec": "h264", "audio_codec": "aac",
                     "bit_rate": "1500k", "width": 720, "crop": "limit"},
                    {"format": "jpg", "width": 720, "crop": "limit",
                     "start_offset": "auto"},  # auto-poster
                ],
                eager_async=False,
            )
            # Find the eager MP4 + poster
            mp4_url = None
            poster_url = None
            for d in result.get("eager", []) or []:
                if d.get("format") == "mp4" and not mp4_url:
                    mp4_url = d.get("secure_url")
                elif d.get("format") == "jpg" and not poster_url:
                    poster_url = d.get("secure_url")
            # Always expose a fallback `f_auto` URL that lets Cloudinary pick
            # the best codec per device on the fly.
            base_url = result.get("secure_url") or ""
            f_auto_url = base_url.replace("/upload/", "/upload/f_auto,q_auto/") if "/upload/" in base_url else base_url
        else:
            result = cloudinary.uploader.upload(
                contents,
                folder=f"{folder}/{current_user.id}",
                resource_type="image",
                transformation=[
                    {'width': 1200, 'height': 1200, 'crop': 'limit'},
                    {'quality': 'auto:good'},
                ],
            )
        return {
            "url": (mp4_url if is_video else result['secure_url']) or result['secure_url'],
            "original_url": result['secure_url'],
            "mp4_url": mp4_url if is_video else None,
            "f_auto_url": f_auto_url if is_video else None,
            "poster_url": poster_url if is_video else None,
            "public_id": result['public_id'],
            "width": result.get('width'),
            "height": result.get('height'),
            "format": result.get('format'),
            "resource_type": result.get('resource_type', 'image'),
            "duration": result.get('duration'),
        }
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@router.post("/audio")
async def upload_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an audio file to Cloudinary.

    Cloudinary performs server-side transcoding to MP3 via `eager` so the
    front-end can serve a wide-compat MP3 source AND the original (webm/opus)
    via `<source>` tags. Combined this fixes audio playback across:
      - Chrome / Edge   (webm + mp3)
      - Safari / iOS    (mp3)
      - Firefox         (ogg/webm + mp3)
    """
    try:
        contents = await file.read()
        result = cloudinary.uploader.upload(
            contents,
            folder=f"bruno/audio/{current_user.id}",
            resource_type="video",  # Cloudinary uses 'video' for audio
            eager=[{"format": "mp3", "audio_codec": "mp3"}],
            eager_async=False,
        )
        eager = (result.get("eager") or [])
        mp3_url = eager[0].get("secure_url") if eager else None
        return {
            "url": result['secure_url'],
            "mp3_url": mp3_url,
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
