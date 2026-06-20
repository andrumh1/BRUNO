"""Video call routes (extracted from server.py).

Uses Jitsi Meet (https://meet.jit.si) — public free WebRTC service with
built-in STUN+TURN servers. No API keys or extra config required.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
import logging

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from utils.ws_manager import ws_manager
from models.user import User

router = APIRouter(prefix="/calls", tags=["calls"])
logger = logging.getLogger(__name__)


class VideoCallRequest(BaseModel):
    chat_id: str
    call_type: str = "video"  # video or audio


class VideoCallResponse(BaseModel):
    room_url: str
    room_name: str
    call_id: str


@router.post("/start", response_model=VideoCallResponse)
async def start_video_call(
    request: VideoCallRequest,
    current_user: User = Depends(get_current_user),
):
    """Start a video/audio call in a chat (Jitsi Meet room)."""
    chat = await db.chats.find_one({
        "id": request.chat_id,
        "participants": current_user.id,
    })
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    room_name = f"bruno-{request.chat_id}-{str(uuid.uuid4())[:8]}"
    start_video_muted = "true" if request.call_type == "audio" else "false"
    room_url = (
        f"https://meet.jit.si/{room_name}"
        f"#config.prejoinPageEnabled=false&config.startWithVideoMuted={start_video_muted}"
    )
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
        "ended_at": None,
    }
    await db.video_calls.insert_one(call_doc)

    other_participants = [p for p in chat["participants"] if p != current_user.id]
    call_notification = {
        "type": "incoming_call",
        "call_id": call_id,
        "chat_id": request.chat_id,
        "room_url": room_url,
        "call_type": request.call_type,
        "caller_id": current_user.id,
        "caller_name": current_user.name,
    }
    try:
        await ws_manager.broadcast_to_users(call_notification, other_participants)
    except Exception as e:
        logger.warning(f"WS broadcast failed for call {call_id}: {e}")

    # Fire-and-forget push notification to offline participants
    try:
        from routers.push_notifications import send_push_notification, NotificationPayload
        call_type_text = "voz" if request.call_type == "audio" else "video"
        for participant_id in other_participants:
            try:
                await send_push_notification(participant_id, NotificationPayload(
                    title=f"Llamada de {current_user.name}",
                    body=f"Tienes una llamada de {call_type_text} entrante",
                    url="/chat",
                    tag="incoming_call",
                    data={
                        "type": "incoming_call",
                        "call_id": call_id,
                        "chat_id": request.chat_id,
                        "caller_name": current_user.name,
                        "call_type": request.call_type,
                    },
                ))
            except Exception as e:
                logger.warning(f"Push notification failed for user {participant_id}: {e}")
    except Exception as e:
        logger.warning(f"Push notification module unavailable: {e}")

    return VideoCallResponse(room_url=room_url, room_name=room_name, call_id=call_id)


@router.post("/{call_id}/answer")
async def answer_call(
    call_id: str,
    current_user: User = Depends(get_current_user),
):
    """Answer an incoming call."""
    call = await db.video_calls.find_one({
        "id": call_id,
        "participants": current_user.id,
        "status": "ringing",
    })
    if not call:
        raise HTTPException(status_code=404, detail="Call not found or already answered")

    await db.video_calls.update_one(
        {"id": call_id},
        {"$set": {"status": "active", "answered_at": datetime.now(timezone.utc).isoformat()}},
    )
    try:
        await ws_manager.send_personal_message(
            {"type": "call_answered", "call_id": call_id},
            call["started_by"],
        )
    except Exception as e:
        logger.warning(f"WS answer broadcast failed: {e}")

    return {"status": "answered", "room_url": call["room_url"]}


@router.post("/{call_id}/decline")
async def decline_call(
    call_id: str,
    current_user: User = Depends(get_current_user),
):
    """Decline an incoming call."""
    call = await db.video_calls.find_one({
        "id": call_id,
        "participants": current_user.id,
        "status": "ringing",
    })
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    await db.video_calls.update_one(
        {"id": call_id},
        {"$set": {"status": "declined", "ended_at": datetime.now(timezone.utc).isoformat()}},
    )
    try:
        await ws_manager.send_personal_message(
            {"type": "call_declined", "call_id": call_id},
            call["started_by"],
        )
    except Exception as e:
        logger.warning(f"WS decline broadcast failed: {e}")

    return {"status": "declined"}


@router.post("/{call_id}/end")
async def end_call(
    call_id: str,
    current_user: User = Depends(get_current_user),
):
    """End an active call."""
    call = await db.video_calls.find_one({
        "id": call_id,
        "participants": current_user.id,
    })
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    await db.video_calls.update_one(
        {"id": call_id},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}},
    )
    try:
        await ws_manager.broadcast_to_users(
            {"type": "call_ended", "call_id": call_id},
            call["participants"],
        )
    except Exception as e:
        logger.warning(f"WS end broadcast failed: {e}")

    return {"status": "ended"}
