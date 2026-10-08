"""Borradores de videos/publicaciones (media ya subido + texto) para retomarlos después."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from utils.database import db
from utils.security import get_current_user
from models.user import User

router = APIRouter(prefix="/post-drafts", tags=["drafts"])


class DraftIn(BaseModel):
    media_url: str
    media_type: str = "video"
    media_meta: Optional[dict] = None
    caption: str = ""
    trim_start: Optional[float] = None
    trim_end: Optional[float] = None
    cover_at: Optional[float] = None
    poster_url: Optional[str] = None


@router.get("")
async def list_drafts(current_user: User = Depends(get_current_user)):
    return await db.post_drafts.find({"user_id": current_user.id}, {"_id": 0}).sort("updated_at", -1).to_list(50)


@router.post("")
async def save_draft(body: DraftIn, current_user: User = Depends(get_current_user)):
    doc = {**body.model_dump(), "id": str(uuid.uuid4()), "user_id": current_user.id, "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.post_drafts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/{draft_id}")
async def delete_draft(draft_id: str, current_user: User = Depends(get_current_user)):
    r = await db.post_drafts.delete_one({"id": draft_id, "user_id": current_user.id})
    if not r.deleted_count:
        raise HTTPException(status_code=404, detail="Borrador no encontrado")
    return {"deleted": True}
