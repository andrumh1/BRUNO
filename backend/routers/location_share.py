"""Location sharing — share fixed point or real-time location between users.

Schema (collection: location_shares):
  {
    id: str,
    from_user_id: str,            # sharer
    to_user_id: str | None,       # specific recipient, or None for "everyone allowed"
    chat_id: str | None,          # optional context
    type: "fixed" | "live",
    expires_at: ISO str | None,   # None for fixed point shares
    interval_seconds: int,         # tracking frequency (live only)
    last_lat: float,
    last_lng: float,
    last_accuracy: float | None,
    last_speed: float | None,     # m/s (for icon selection)
    last_heading: float | None,   # 0-360°
    last_update: ISO str,
    started_at: ISO str,
    stopped: bool,
    label: str | None,
  }
"""
import sys
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

sys.path.insert(0, "/app/backend")
from utils.database import db
from utils.security import get_current_user
from utils.ws_manager import ws_manager
from models.user import User


router = APIRouter(prefix="/location", tags=["location"])


class LocationStartInput(BaseModel):
    to_user_id: Optional[str] = None
    chat_id: Optional[str] = None
    type: str = Field("live", pattern="^(fixed|live)$")
    duration_minutes: int = Field(15, ge=1, le=720)  # 1 min .. 12 hours
    interval_seconds: int = Field(10, ge=3, le=60)
    label: Optional[str] = None
    lat: float
    lng: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None


class LocationUpdateInput(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None


def _serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


@router.post("/share")
async def start_location_share(
    payload: LocationStartInput,
    current_user: User = Depends(get_current_user),
):
    """Start a new location share. For fixed, only one snapshot is stored."""
    share_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = None
    if payload.type == "live":
        expires_at = (now + timedelta(minutes=payload.duration_minutes)).isoformat()

    doc = {
        "id": share_id,
        "from_user_id": current_user.id,
        "from_user_name": current_user.name,
        "to_user_id": payload.to_user_id,
        "chat_id": payload.chat_id,
        "type": payload.type,
        "expires_at": expires_at,
        "interval_seconds": payload.interval_seconds,
        "last_lat": payload.lat,
        "last_lng": payload.lng,
        "last_accuracy": payload.accuracy,
        "last_speed": payload.speed,
        "last_heading": payload.heading,
        "last_update": now.isoformat(),
        "started_at": now.isoformat(),
        "stopped": False,
        "label": payload.label,
    }
    await db.location_shares.insert_one(doc)

    # If there's a chat, drop a system message so it shows up in the thread
    if payload.chat_id:
        msg_id = str(uuid.uuid4())
        msg = {
            "id": msg_id,
            "chat_id": payload.chat_id,
            "sender_id": current_user.id,
            "content": f"📍 Ubicación {'en vivo' if payload.type == 'live' else 'compartida'}",
            "message_type": "location_share",
            "attachments": [{
                "type": "location_share",
                "share_id": share_id,
                "share_type": payload.type,
                "expires_at": expires_at,
                "lat": payload.lat,
                "lng": payload.lng,
                "label": payload.label,
            }],
            "is_read": False,
            "read_by": [],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        await db.messages.insert_one(msg)
        await db.chats.update_one(
            {"id": payload.chat_id},
            {"$set": {"last_message_id": msg_id, "last_message_at": msg["created_at"],
                      "updated_at": msg["created_at"]}},
        )

    # WS broadcast to interested users
    targets = []
    if payload.to_user_id:
        targets.append(payload.to_user_id)
    elif payload.chat_id:
        chat = await db.chats.find_one({"id": payload.chat_id}, {"_id": 0, "participants": 1})
        if chat:
            targets = [p for p in chat.get("participants", []) if p != current_user.id]
    if targets:
        try:
            await ws_manager.broadcast_to_users(
                {"type": "location_share_started", "share": _serialize(dict(doc))},
                targets,
            )
        except Exception:
            pass

    return _serialize(dict(doc))


@router.post("/share/{share_id}/update")
async def update_location_share(
    share_id: str,
    payload: LocationUpdateInput,
    current_user: User = Depends(get_current_user),
):
    """Append a real-time update to an existing live share."""
    share = await db.location_shares.find_one({"id": share_id}, {"_id": 0})
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    if share["from_user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the sharer can update")
    if share.get("stopped"):
        raise HTTPException(status_code=400, detail="Share already stopped")
    if share.get("expires_at") and share["expires_at"] < datetime.now(timezone.utc).isoformat():
        await db.location_shares.update_one({"id": share_id}, {"$set": {"stopped": True}})
        raise HTTPException(status_code=400, detail="Share expired")

    now_iso = datetime.now(timezone.utc).isoformat()
    upd = {
        "last_lat": payload.lat,
        "last_lng": payload.lng,
        "last_accuracy": payload.accuracy,
        "last_speed": payload.speed,
        "last_heading": payload.heading,
        "last_update": now_iso,
    }
    await db.location_shares.update_one({"id": share_id}, {"$set": upd})

    # Broadcast to recipients
    targets = []
    if share.get("to_user_id"):
        targets.append(share["to_user_id"])
    elif share.get("chat_id"):
        chat = await db.chats.find_one({"id": share["chat_id"]}, {"_id": 0, "participants": 1})
        if chat:
            targets = [p for p in chat.get("participants", []) if p != current_user.id]
    if targets:
        try:
            await ws_manager.broadcast_to_users(
                {"type": "location_share_update", "share_id": share_id, **upd},
                targets,
            )
        except Exception:
            pass
    return {"status": "updated", **upd}


@router.post("/share/{share_id}/stop")
async def stop_location_share(
    share_id: str,
    current_user: User = Depends(get_current_user),
):
    share = await db.location_shares.find_one({"id": share_id}, {"_id": 0})
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    if share["from_user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the sharer can stop")
    await db.location_shares.update_one({"id": share_id}, {"$set": {"stopped": True}})

    targets = []
    if share.get("to_user_id"):
        targets.append(share["to_user_id"])
    elif share.get("chat_id"):
        chat = await db.chats.find_one({"id": share["chat_id"]}, {"_id": 0, "participants": 1})
        if chat:
            targets = [p for p in chat.get("participants", []) if p != current_user.id]
    if targets:
        try:
            await ws_manager.broadcast_to_users(
                {"type": "location_share_stopped", "share_id": share_id},
                targets,
            )
        except Exception:
            pass

    return {"status": "stopped"}


@router.get("/shares/active")
async def list_active_shares(
    current_user: User = Depends(get_current_user),
):
    """Return all active shares relevant to the current user — either they
    are the recipient OR they share a chat with the sharer.

    Used by the map to render real-time location pins.
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    # Chats the user is in
    my_chats = []
    async for c in db.chats.find({"participants": current_user.id}, {"_id": 0, "id": 1}):
        my_chats.append(c["id"])

    # Query: see shares I sent, shares sent to me, or shares posted in any chat I'm in.
    query = {
        "stopped": False,
        "$or": [
            {"to_user_id": current_user.id},
            {"from_user_id": current_user.id},
        ],
    }
    if my_chats:
        query["$or"].append({"chat_id": {"$in": my_chats}})

    shares = []
    async for s in db.location_shares.find(query, {"_id": 0}):
        # Skip expired live shares
        if s.get("type") == "live" and s.get("expires_at") and s["expires_at"] < now_iso:
            continue
        # Hydrate avatar
        if s.get("from_user_id"):
            u = await db.users.find_one({"id": s["from_user_id"]}, {"_id": 0, "id": 1, "avatar_url": 1, "name": 1})
            if u:
                s["from_avatar_url"] = u.get("avatar_url")
                s["from_user_name"] = s.get("from_user_name") or u.get("name")
        shares.append(s)

    return {"shares": shares, "count": len(shares)}


@router.get("/share/{share_id}")
async def get_location_share(
    share_id: str,
    current_user: User = Depends(get_current_user),
):
    s = await db.location_shares.find_one({"id": share_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Share not found")
    # Permission: sharer, direct recipient, or chat participant
    allowed = (
        s["from_user_id"] == current_user.id
        or s.get("to_user_id") == current_user.id
    )
    if not allowed and s.get("chat_id"):
        chat = await db.chats.find_one({"id": s["chat_id"], "participants": current_user.id})
        allowed = bool(chat)
    if not allowed:
        raise HTTPException(status_code=403, detail="Not allowed")
    return s
