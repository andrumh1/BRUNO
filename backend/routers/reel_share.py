"""Descarga de reels con sello BRUNO (overlay Cloudinary cuando el video vive en nuestro cloud)."""
import os
import re
import logging
from typing import Optional
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


def _public_id(url: str, cloud: str):
    """https://res.cloudinary.com/<cloud>/image/upload/v123/bruno/abc.png -> bruno:abc (formato overlay)."""
    marker = f"res.cloudinary.com/{cloud}/image/upload/"
    if marker not in url:
        return None
    tail = url.split(marker, 1)[1].split("?")[0]
    parts = [p for p in tail.split("/") if p]
    if parts and re.fullmatch(r"v\d+", parts[0]):
        parts = parts[1:]
    if not parts:
        return None
    parts[-1] = parts[-1].rsplit(".", 1)[0]
    return ":".join(parts)


@router.get("/{post_id}/download")
async def reel_download_url(post_id: str, seal: Optional[str] = None):
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
        seal_id = _public_id(seal, cloud) if seal else None
        if seal_id:
            overlay += f"l_{seal_id},w_0.14,fl_relative,o_85,g_south_west,x_36,y_36/"
        url = url.replace(marker, marker + overlay, 1)
        watermarked = True
    return {"url": url, "watermarked": watermarked, "filename": f"bruno-reel-{post_id[:8]}.mp4"}
