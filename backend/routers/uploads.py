"""Cloudinary upload endpoints.
Extracted from server.py to reduce monolith size.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import Optional
import logging
import uuid
import os

import io
import cloudinary
import cloudinary.uploader
import cloudinary.utils
from starlette.concurrency import run_in_threadpool

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

# Estándar BRUNO: todo video cabe en un marco vertical 9:16 de 1080×1920 (sin recortar: los 16:9 quedan
# horizontales dentro del marco y el reproductor ofrece pantalla completa/giro).
VIDEO_MAX_W, VIDEO_MAX_H = 1080, 1920
VIDEO_EAGER = [
    {"format": "mp4", "video_codec": "h264", "audio_codec": "aac",
     "bit_rate": "2500k", "width": VIDEO_MAX_W, "height": VIDEO_MAX_H, "crop": "limit"},
    {"format": "jpg", "width": VIDEO_MAX_W, "height": VIDEO_MAX_H, "crop": "limit", "start_offset": "auto"},
]
# Estándar BRUNO de imágenes: 1:1 → 1080×1080 · 4:5 → 1080×1350 · 9:16 → 1080×1920 · libre → cabe en 1080×1350
IMAGE_PRESETS = {
    "1:1": {"width": 1080, "height": 1080, "crop": "fill", "gravity": "auto"},
    "4:5": {"width": 1080, "height": 1350, "crop": "fill", "gravity": "auto"},
    "9:16": {"width": 1080, "height": 1920, "crop": "fill", "gravity": "auto"},
    "story": {"width": 1080, "height": 1920, "crop": "limit"},
    "free": {"width": 1080, "height": 1350, "crop": "limit"},
}


MAX_VIDEO_BYTES = 100 * 1024 * 1024  # Cloudinary per-file video limit (free plan); real value read from the account below
_LIMITS_CACHE: dict = {"at": 0.0, "data": None}
CHUNK_BYTES = 20 * 1024 * 1024
HLS_MIN_SECONDS = 180  # long videos get an HLS adaptive rendition (eager, async)


def _fetch_limits() -> dict:
    """Real per-file limits of the connected Cloudinary account (plan dependent)."""
    import cloudinary.api
    u = cloudinary.api.usage()
    ml = u.get("media_limits") or {}
    return {"plan": u.get("plan"), "video_max_bytes": int(ml.get("video_max_size_bytes") or MAX_VIDEO_BYTES), "image_max_bytes": int(ml.get("image_max_size_bytes") or 10 * 1024 * 1024)}


async def video_limits() -> dict:
    import time
    if not _LIMITS_CACHE["data"] or time.time() - _LIMITS_CACHE["at"] > 3600:
        try:
            _LIMITS_CACHE["data"] = await run_in_threadpool(_fetch_limits)
        except Exception as e:
            logger.warning(f"Cloudinary usage unavailable: {e}")
            _LIMITS_CACHE["data"] = _LIMITS_CACHE["data"] or {"plan": None, "video_max_bytes": MAX_VIDEO_BYTES, "image_max_bytes": 10 * 1024 * 1024}
        _LIMITS_CACHE["at"] = time.time()
    d = dict(_LIMITS_CACHE["data"])
    mb = d["video_max_bytes"] // (1024 * 1024)
    d.update({"video_max_mb": mb, "chunk_bytes": CHUNK_BYTES, "resumable": True, "max_duration_seconds": None,
              "note": f"El límite real lo fija el plan de almacenamiento ({d.get('plan') or 'Cloudinary'}): {mb} MB por video, sin límite de duración. Videos de 3 h necesitan un plan con archivos de varios GB."})
    return d


def _too_large_msg(limit_mb: int) -> str:
    return f"El video supera los {limit_mb} MB que permite el plan actual de almacenamiento. La duración no es el límite: reduce la calidad/bitrate o súbelo en partes."


@router.get("/limits")
async def upload_limits(current_user: User = Depends(get_current_user)):
    return await video_limits()


@router.post("/video/sign")
async def sign_video_upload(folder: str = "bruno", size: int = 0, current_user: User = Depends(get_current_user)):
    """Signature for a direct, chunked, resumable browser → Cloudinary upload (the file never passes through BRUNO)."""
    import time
    lim = await video_limits()
    if size and size > lim["video_max_bytes"]:
        raise HTTPException(status_code=413, detail=_too_large_msg(lim["video_max_mb"]))
    cfg = cloudinary.config()
    if not (cfg.cloud_name and cfg.api_key and cfg.api_secret):
        raise HTTPException(status_code=503, detail="Almacenamiento de video no configurado")
    params = {"timestamp": int(time.time()), "folder": f"{folder}/{current_user.id}", "eager": "f_mp4,vc_h264,ac_aac,br_2500k,w_1080,h_1920,c_limit|w_1080,h_1920,c_limit,so_auto/jpg",
              "eager_async": "true", "context": f"owner={current_user.id}"}
    signature = cloudinary.utils.api_sign_request(params, cfg.api_secret)
    return {"upload_url": f"https://api.cloudinary.com/v1_1/{cfg.cloud_name}/video/upload", "params": {**params, "api_key": cfg.api_key, "signature": signature},
            "chunk_bytes": CHUNK_BYTES, "upload_id": uuid.uuid4().hex, "video_max_bytes": lim["video_max_bytes"]}


@router.post("/video/complete")
async def complete_video_upload(body: dict, trim_start: Optional[float] = None, trim_end: Optional[float] = None, cover_at: Optional[float] = None, current_user: User = Depends(get_current_user)):
    """Verify the asset with Cloudinary (never trust the browser) and return BRUNO's media descriptor; long videos get HLS."""
    import cloudinary.api
    public_id = (body or {}).get("public_id")
    if not public_id:
        raise HTTPException(status_code=400, detail="public_id requerido")
    try:
        res = await run_in_threadpool(lambda: cloudinary.api.resource(public_id, resource_type="video", context=True, media_metadata=True))
    except Exception:
        raise HTTPException(status_code=404, detail="El video no existe en el almacenamiento")
    owner = ((res.get("context") or {}).get("custom") or {}).get("owner")
    if owner and owner != current_user.id:
        raise HTTPException(status_code=403, detail="Ese video no es tuyo")
    base_url = res.get("secure_url") or ""
    duration = float(res.get("duration") or 0)
    trim = ""
    if trim_start is not None and trim_start > 0:
        trim += f"so_{trim_start:.2f},"
    if trim_end is not None and trim_end > 0 and (trim_start is None or trim_end > trim_start):
        trim += f"eo_{trim_end:.2f},"
    cover = f"so_{max(0.0, cover_at):.2f}" if cover_at is not None else "so_auto"
    # Textos incrustados de verdad en el archivo exportado (capas Cloudinary), no solo en la vista previa.
    from urllib.parse import quote
    text_layers = ""
    for ov in ((body or {}).get("overlays") or [])[:8]:
        txt = str(ov.get("text") or "").strip()[:80]
        if not txt:
            continue
        safe = quote(txt.replace(",", "%2C").replace("/", "%2F"), safe="%")
        color = str(ov.get("color") or "#ffffff").lstrip("#")[:6] or "ffffff"
        x = min(max(float(ov.get("x") or 50), 0), 100) / 100
        y = min(max(float(ov.get("y") or 50), 0), 100) / 100
        size = int(ov.get("size") or 56)
        text_layers += f"l_text:Arial_{size}_bold:{safe},co_rgb:{color},g_center,fl_relative,x_{x - 0.5:.3f},y_{y - 0.5:.3f},fl_layer_apply/"
    mp4_url = base_url.replace("/upload/", f"/upload/{trim}f_mp4,vc_h264,ac_aac,br_2500k,w_{VIDEO_MAX_W},h_{VIDEO_MAX_H},c_limit/{text_layers}").rsplit(".", 1)[0] + ".mp4"
    poster_url = base_url.replace("/upload/", f"/upload/{cover},w_{VIDEO_MAX_W},h_{VIDEO_MAX_H},c_limit/{text_layers}").rsplit(".", 1)[0] + ".jpg"
    hls_url = None
    if duration >= HLS_MIN_SECONDS:
        hls_url = base_url.replace("/upload/", f"/upload/{trim}{text_layers}sp_auto/").rsplit(".", 1)[0] + ".m3u8"
        try:
            await run_in_threadpool(lambda: cloudinary.uploader.explicit(public_id, type="upload", resource_type="video", eager=[{"streaming_profile": "auto", "format": "m3u8"}], eager_async=True))
        except Exception as e:
            logger.warning(f"HLS eager failed for {public_id}: {e}")
    return {"url": mp4_url, "original_url": base_url, "mp4_url": mp4_url, "f_auto_url": base_url.replace("/upload/", "/upload/f_auto,q_auto/"), "poster_url": poster_url, "hls_url": hls_url,
            "public_id": public_id, "width": res.get("width"), "height": res.get("height"), "format": res.get("format"), "resource_type": "video", "duration": duration, "bytes": res.get("bytes"), "is_long": duration >= HLS_MIN_SECONDS, "burned_texts": bool(text_layers)}


def _upload_video(contents: bytes, folder: str, filename: str | None):
    """Blocking Cloudinary video upload. upload_large needs a file-like object, not raw bytes."""
    limit = (_LIMITS_CACHE["data"] or {}).get("video_max_bytes") or MAX_VIDEO_BYTES
    if len(contents) > limit:
        raise HTTPException(status_code=413, detail=_too_large_msg(limit // (1024 * 1024)))
    opts = {"folder": folder, "resource_type": "video", "eager": VIDEO_EAGER, "eager_async": True}
    if len(contents) > 10_000_000:
        return cloudinary.uploader.upload_large(
            io.BytesIO(contents), filename=filename or "video", chunk_size=6_000_000, **opts
        )
    return cloudinary.uploader.upload(contents, **opts)


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    folder: str = "bruno",
    aspect: str = "free",
    trim_start: Optional[float] = None,
    trim_end: Optional[float] = None,
    cover_at: Optional[float] = None,
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
        # Detect video by content-type OR by extension (mobile browsers sometimes
        # mis-tag uploads as `application/octet-stream`).
        ext = (file.filename or "").lower().rsplit(".", 1)[-1] if "." in (file.filename or "") else ""
        VIDEO_EXTS = {"mp4", "mov", "webm", "m4v", "mkv", "avi", "ogv", "3gp", "qt", "hevc"}
        is_video = content_type.startswith("video") or ext in VIDEO_EXTS

        if is_video:
            # Eager async: return immediately so the request doesn't hang
            # while Cloudinary transcodes (can take 30s-2min for big videos).
            # The MP4 + poster derivatives are generated in the background;
            # in the meantime the frontend can use `f_auto_url` which routes
            # through Cloudinary's adaptive codec picker.
            result = await run_in_threadpool(
                _upload_video, contents, f"{folder}/{current_user.id}", file.filename
            )
            # eager_async=True means derivatives aren't ready immediately —
            # we synthesize predictable URLs via Cloudinary's URL-transform API.
            base_url = result.get("secure_url") or ""
            mp4_url = None
            poster_url = None
            # Recorte (so_/eo_) y portada (so_) elegidos en la vista previa: se aplican por URL de transformación,
            # así el video publicado coincide exactamente con lo que el usuario vio.
            trim = ""
            if trim_start is not None and trim_start > 0:
                trim += f"so_{trim_start:.2f},"
            if trim_end is not None and trim_end > 0 and (trim_start is None or trim_end > trim_start):
                trim += f"eo_{trim_end:.2f},"
            cover = f"so_{max(0.0, cover_at):.2f}" if cover_at is not None else "so_auto"
            if not trim and cover == "so_auto":
                for d in result.get("eager", []) or []:
                    if d.get("format") == "mp4" and not mp4_url:
                        mp4_url = d.get("secure_url")
                    elif d.get("format") == "jpg" and not poster_url:
                        poster_url = d.get("secure_url")
            # Synth fallbacks while derivatives bake
            if "/upload/" in base_url:
                if not mp4_url:
                    mp4_url = base_url.replace("/upload/", f"/upload/{trim}f_mp4,vc_h264,ac_aac,br_2500k,w_{VIDEO_MAX_W},h_{VIDEO_MAX_H},c_limit/").rsplit(".", 1)[0] + ".mp4"
                if not poster_url:
                    poster_url = base_url.replace("/upload/", f"/upload/{cover},w_{VIDEO_MAX_W},h_{VIDEO_MAX_H},c_limit/").rsplit(".", 1)[0] + ".jpg"
                f_auto_url = base_url.replace("/upload/", "/upload/f_auto,q_auto/")
            else:
                f_auto_url = base_url
        else:
            result = cloudinary.uploader.upload(
                contents,
                folder=f"{folder}/{current_user.id}",
                resource_type="image",
                transformation=[
                    IMAGE_PRESETS.get(aspect, IMAGE_PRESETS["free"]),
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
    except HTTPException:
        raise
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
        ext = (file.filename or "").lower().rsplit(".", 1)[-1] if "." in (file.filename or "") else ""
        VIDEO_EXTS = {"mp4", "mov", "webm", "m4v", "mkv", "avi", "ogv", "3gp", "qt", "hevc"}
        is_video = content_type.startswith("video") or ext in VIDEO_EXTS

        mp4_url = None
        poster_url = None
        f_auto_url = None

        IMAGE_EXTS = {"jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "avif"}
        if content_type.startswith("image") or (not is_video and ext in IMAGE_EXTS):
            result = cloudinary.uploader.upload(
                contents,
                folder=f"bruno/chat/{current_user.id}",
                resource_type="image",
                transformation=[
                    IMAGE_PRESETS["free"],
                    {'quality': 'auto:good'},
                ],
            )
        elif is_video:
            result = await run_in_threadpool(
                _upload_video, contents, f"bruno/chat/{current_user.id}", file.filename
            )
            base_url = result.get("secure_url") or ""
            if "/upload/" in base_url:
                mp4_url = base_url.replace("/upload/", "/upload/f_mp4,vc_h264,ac_aac,br_2500k,w_1080,h_1920,c_limit/").rsplit(".", 1)[0] + ".mp4"
                poster_url = base_url.replace("/upload/", "/upload/so_auto,w_1080,h_1920,c_limit/").rsplit(".", 1)[0] + ".jpg"
                f_auto_url = base_url.replace("/upload/", "/upload/f_auto,q_auto/")
        elif content_type.startswith("audio"):
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

        # Effective URL the frontend should use: MP4 derivative for videos,
        # original otherwise. Always fall back to original if mp4 unknown.
        effective_url = (mp4_url if is_video and mp4_url else result['secure_url'])
        return {
            "url": effective_url,
            "original_url": result['secure_url'],
            "mp4_url": mp4_url,
            "f_auto_url": f_auto_url,
            "poster_url": poster_url,
            "public_id": result['public_id'],
            "filename": file.filename,
            "type": "video/mp4" if is_video else content_type,
            "size": len(contents),
            "duration": result.get('duration'),
        }
    except HTTPException:
        raise
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
