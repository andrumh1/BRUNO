"""Admin maintenance routes — owner/superadmin only.

Currently exposes a single helper:

    POST /api/admin/migrate-videos
        Iterates ALL videos under the configured Cloudinary cloud and applies
        an `explicit()` call with the same eager derivatives that new uploads
        get (MP4 H.264+AAC 720p + poster JPG). This brings the historical
        catalogue up to par for cross-platform playback.
"""
import sys
import logging
import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
import cloudinary
import cloudinary.api
import cloudinary.uploader

sys.path.insert(0, "/app/backend")
from utils.database import db
from utils.security import get_current_user
from models.user import User


router = APIRouter(prefix="/admin", tags=["admin"])


def _is_admin(user: User) -> bool:
    return getattr(user, "role", None) in ("admin", "superadmin") or getattr(user, "is_admin", False)


EAGER = [
    {"format": "mp4", "video_codec": "h264", "audio_codec": "aac",
     "bit_rate": "1500k", "width": 720, "crop": "limit"},
    {"format": "jpg", "width": 720, "crop": "limit", "start_offset": "auto"},
]


def _migrate_one(public_id: str) -> dict:
    """Run cloudinary.uploader.explicit on a single video public_id."""
    try:
        res = cloudinary.uploader.explicit(
            public_id,
            type="upload",
            resource_type="video",
            eager=EAGER,
            eager_async=True,
        )
        mp4_url = None
        poster = None
        for d in res.get("eager", []) or []:
            if d.get("format") == "mp4" and not mp4_url:
                mp4_url = d.get("secure_url")
            elif d.get("format") == "jpg" and not poster:
                poster = d.get("secure_url")
        return {"public_id": public_id, "ok": True, "mp4_url": mp4_url, "poster_url": poster}
    except Exception as e:
        return {"public_id": public_id, "ok": False, "error": str(e)[:200]}


async def _run_migration(prefix: Optional[str], limit: int):
    """Background task — iterates all videos and triggers explicit() on each.
    Records progress on `db.admin_jobs`."""
    job_id = f"video_migration_{asyncio.get_event_loop().time():.0f}"
    await db.admin_jobs.insert_one({"id": job_id, "type": "video_migration", "status": "running",
                                    "processed": 0, "errors": 0, "limit": limit})
    processed = 0
    errors = 0
    next_cursor = None
    try:
        while processed < limit:
            params = {
                "resource_type": "video",
                "max_results": min(100, limit - processed),
            }
            if prefix:
                params["prefix"] = prefix
            if next_cursor:
                params["next_cursor"] = next_cursor
            page = cloudinary.api.resources(**params)
            for r in page.get("resources", []):
                if processed >= limit:
                    break
                result = _migrate_one(r["public_id"])
                if not result["ok"]:
                    errors += 1
                processed += 1
                # Update DB record (best-effort)
                if r.get("public_id"):
                    try:
                        await db.posts.update_many(
                            {"media.public_id": r["public_id"]},
                            {"$set": {"media.$.mp4_url": result.get("mp4_url"),
                                      "media.$.poster_url": result.get("poster_url")}},
                        )
                    except Exception:
                        pass
            next_cursor = page.get("next_cursor")
            if not next_cursor:
                break
        await db.admin_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "completed", "processed": processed, "errors": errors}},
        )
    except Exception as e:
        logging.error(f"Video migration job failed: {e}")
        await db.admin_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "failed", "error": str(e)[:300],
                      "processed": processed, "errors": errors}},
        )


@router.post("/migrate-videos")
async def migrate_videos(
    background: BackgroundTasks,
    prefix: Optional[str] = None,
    limit: int = 500,
    current_user: User = Depends(get_current_user),
):
    """Trigger the Cloudinary video migration in the background.

    Query params:
      • prefix — restrict to a folder (e.g. ``bruno/videos/``)
      • limit  — max number of videos to process (default 500, max 5000)

    Returns immediately with a job id. Poll /api/admin/jobs to see status.
    """
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    limit = max(1, min(limit, 5000))
    background.add_task(_run_migration, prefix, limit)
    return {"status": "started", "limit": limit, "prefix": prefix}


@router.get("/jobs")
async def list_admin_jobs(current_user: User = Depends(get_current_user)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    jobs = []
    async for j in db.admin_jobs.find({}, {"_id": 0}).sort("id", -1).limit(20):
        jobs.append(j)
    return {"jobs": jobs}
