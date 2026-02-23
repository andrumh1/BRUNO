"""Video call routes."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
import os

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from models.user import User

router = APIRouter(prefix="/calls", tags=["calls"])

# Daily.co domain - in production, this should be your own domain
DAILY_DEMO_DOMAIN = os.environ.get("DAILY_DOMAIN", "https://bruno-demo.daily.co")


class VideoCallRequest(BaseModel):
    chat_id: str
    call_type: str = "video"  # video or audio


class VideoCallResponse(BaseModel):
    room_url: str
    room_name: str
    call_id: str


# Import ws_manager from main server (will be set during app initialization)
ws_manager = None


def set_ws_manager(manager):
    global ws_manager
    ws_manager = manager


@router.post("/start", response_model=VideoCallResponse)
async def start_video_call(
    request: VideoCallRequest,
    current_user: User = Depends(get_current_user)
):
    """Start a video call in a chat"""
    chat = await db.chats.find_one({
        "id": request.chat_id,
        "participants": current_user.id
    })
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    room_name = f"bruno-call-{request.chat_id}-{str(uuid.uuid4())[:8]}"
    room_url = f"{DAILY_DEMO_DOMAIN}/{room_name}"
    call_id = str(uuid.uuid4())
    
    call_doc = {
        "id": call_id,
        "chat_id": request.chat_id,
        "room_name": room_name,
        "room_url": room_url,
        "call_type": request.call_type,
        "started_by": current_user.id,
        "participants": chat["participants"],
        "status": "ringing",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None
    }
    await db.video_calls.insert_one(call_doc)
    
    # Notify other participants via WebSocket
    if ws_manager:
        other_participants = [p for p in chat["participants"] if p != current_user.id]
        call_notification = {
            "type": "incoming_call",
            "call_id": call_id,
            "chat_id": request.chat_id,
            "room_url": room_url,
            "call_type": request.call_type,
            "caller_id": current_user.id,
            "caller_name": current_user.name
        }
        await ws_manager.broadcast_to_users(call_notification, other_participants)
    
    return VideoCallResponse(
        room_url=room_url,
        room_name=room_name,
        call_id=call_id
    )


@router.post("/{call_id}/answer")
async def answer_call(
    call_id: str,
    current_user: User = Depends(get_current_user)
):
    """Answer an incoming call"""
    call = await db.video_calls.find_one({
        "id": call_id,
        "participants": current_user.id,
        "status": "ringing"
    })
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found or already answered")
    
    await db.video_calls.update_one(
        {"id": call_id},
        {"$set": {"status": "active", "answered_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if ws_manager:
        await ws_manager.send_personal_message({
            "type": "call_answered",
            "call_id": call_id
        }, call["started_by"])
    
    return {"status": "answered", "room_url": call["room_url"]}


@router.post("/{call_id}/decline")
async def decline_call(
    call_id: str,
    current_user: User = Depends(get_current_user)
):
    """Decline an incoming call"""
    call = await db.video_calls.find_one({
        "id": call_id,
        "participants": current_user.id,
        "status": "ringing"
    })
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    await db.video_calls.update_one(
        {"id": call_id},
        {"$set": {"status": "declined", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if ws_manager:
        await ws_manager.send_personal_message({
            "type": "call_declined",
            "call_id": call_id
        }, call["started_by"])
    
    return {"status": "declined"}


@router.post("/{call_id}/end")
async def end_call(
    call_id: str,
    current_user: User = Depends(get_current_user)
):
    """End an active call"""
    call = await db.video_calls.find_one({
        "id": call_id,
        "participants": current_user.id
    })
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    await db.video_calls.update_one(
        {"id": call_id},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if ws_manager:
        await ws_manager.broadcast_to_users({
            "type": "call_ended",
            "call_id": call_id
        }, call["participants"])
    
    return {"status": "ended"}
