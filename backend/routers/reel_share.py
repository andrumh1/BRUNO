"""Descarga de reels con sello BRUNO (overlay Cloudinary cuando el video vive en nuestro cloud)."""
import os
import logging
from fastapi import APIRouter, HTTPException
import cloudinary
import cloudinary.uploader
import cloudinary.api

from utils.database import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reels", tags=["reels-share"])

WATERMARK_ID = "bruno_watermark"
WATERMARK_SRC = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "brand", "icon-white.png")
_watermark_ready = False


async def _ensure_watermark():
    global _watermark_ready
    if _watermark_ready:
        return True
    try:
        cloudinary.api.resource(WATERMARK_ID)
        _watermark_ready = True
    except Exception:
        try:
            cloudinary.uploader.upload(WATERMARK_SRC, public_id=WATERMARK_ID, overwrite=True, resource_type="image")
            _watermark_ready = True
        except Exception as e:
            logger.warning("No se pudo subir la marca de agua: %s", e)
    return _watermark_ready


def _video_url(post: dict):
    if post.get("video_url"):
        return post["video_url"]
    for m in post.get("media") or []:
        if m.get("type") == "video" and m.get("url"):
            return m["url"]
    return None


@router.get("/{post_id}/download")
async def reel_download_url(post_id: str):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0, "id": 1, "video_url": 1, "media": 1, "content": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Reel no encontrado")
    url = _video_url(post)
    if not url:
        raise HTTPException(status_code=400, detail="Este reel no tiene video")
    cloud = os.environ.get("CLOUDINARY_CLOUD_NAME") or ""
    marker = f"res.cloudinary.com/{cloud}/video/upload/"
    watermarked = False
    if cloud and marker in url and await _ensure_watermark():
        overlay = f"l_{WATERMARK_ID},w_0.16,fl_relative,o_75,g_south_east,x_36,y_36/"
        url = url.replace(marker, marker + overlay, 1)
        watermarked = True
    return {"url": url, "watermarked": watermarked, "filename": f"bruno-reel-{post_id[:8]}.mp4"}
