"""Video call routes (extracted from server.py).

Uses Jitsi Meet (https://meet.jit.si) — public free WebRTC service with
built-in STUN+TURN servers. No API keys or extra config required.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
import logging
import os
import time
import httpx

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from utils.ws_manager import ws_manager
from models.user import User

router = APIRouter(prefix="/calls", tags=["calls"])
logger = logging.getLogger(__name__)

DAILY_API = "https://api.daily.co/v1"


def _daily_key():
    return os.environ.get("DAILY_API_KEY")


async def _daily_post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(f"{DAILY_API}{path}", headers={"Authorization": f"Bearer {_daily_key()}", "Content-Type": "application/json"}, json=body)
    if r.is_error:
        logger.error(f"Daily error {r.status_code}: {r.text[:200]}")
        raise HTTPException(status_code=502, detail="No se pudo crear la sala de llamada")
    return r.json()


async def _daily_token(room_name: str, user: User, is_owner: bool, exp: int) -> str:
    res = await _daily_post("/meeting-tokens", {"properties": {
        "room_name": room_name, "user_id": user.id, "user_name": user.name or "Usuario",
        "is_owner": is_owner, "exp": min(exp, int(time.time()) + 2 * 3600), "eject_at_token_exp": True,
    }})
    return res["token"]


def _with_token(room_url: str, token: str | None, call_type: str) -> str:
    if not token:
        return room_url
    return f"{room_url}?t={token}"


def _fmt_duration(sec: int) -> str:
    m, s = divmod(max(0, int(sec)), 60)
    return f"{m}:{s:02d}"


async def _log_call_message(call: dict, status: str, actor_id: str):
    """Insert a system 'call' message into the chat (missed / declined / ended with duration)."""
    kind = "Videollamada" if call.get("call_type") == "video" else "Llamada de voz"
    duration = 0
    if status == "ended" and call.get("answered_at"):
        try:
            duration = int((datetime.now(timezone.utc) - datetime.fromisoformat(call["answered_at"])).total_seconds())
        except Exception:
            duration = 0
    label = {"missed": f"{kind} perdida", "declined": f"{kind} rechazada", "ended": f"{kind} · {_fmt_duration(duration)}", "dnd": f"{kind} perdida (No molestar)"}.get(status, kind)
    msg = {
        "id": str(uuid.uuid4()), "chat_id": call["chat_id"], "sender_id": call["started_by"], "content": label,
        "message_type": "call", "attachments": [{"type": "call", "call_type": call.get("call_type", "video"), "status": status, "duration_sec": duration, "call_id": call["id"], "actor_id": actor_id}],
        "is_read": False, "is_deleted": False, "read_by": [call["started_by"]], "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.messages.insert_one(msg)
    await db.chats.update_one({"id": call["chat_id"]}, {"$set": {"last_message": label, "last_message_at": msg["created_at"], "updated_at": msg["created_at"]}})
    try:
        await ws_manager.broadcast_to_users({"type": "new_message", "chat_id": call["chat_id"], "message": {k: v for k, v in msg.items() if k != "_id"}}, call.get("participants", []))
    except Exception as e:
        logger.warning(f"WS call-log broadcast failed: {e}")


class VideoCallRequest(BaseModel):
    chat_id: str
    call_type: str = "video"  # video or audio


class VideoCallResponse(BaseModel):
    room_url: str
    room_name: str
    call_id: str
    dnd: bool = False


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

    room_name = f"bruno-{request.chat_id[:8]}-{uuid.uuid4().hex[:10]}"
    start_video_muted = "true" if request.call_type == "audio" else "false"
    provider = "jitsi"
    caller_url = None
    if _daily_key():
        # Daily.co: private room that expires in 2h; each participant gets its own token
        exp = int(time.time()) + 2 * 3600
        room = await _daily_post("/rooms", {"name": room_name, "privacy": "private", "properties": {
            "exp": exp, "eject_at_room_exp": True, "max_participants": 8, "start_video_off": request.call_type == "audio",
            "enable_prejoin_ui": False, "enable_chat": False,
        }})
        room_name, room_url, provider = room["name"], room["url"], "daily"
        caller_url = _with_token(room_url, await _daily_token(room_name, current_user, True, exp), request.call_type)
    else:
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
        "provider": provider,
        "call_type": request.call_type,
        "started_by": current_user.id,
        "participants": chat["participants"],
        "status": "ringing",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
    }
    await db.video_calls.insert_one(call_doc)

    other_participants = [p for p in chat["participants"] if p != current_user.id]

    # Do-Not-Disturb: receiver is silenced → register as missed, no ring/push
    from utils.dnd import is_dnd_active
    receivers = [u async for u in db.users.find({"id": {"$in": other_participants}}, {"_id": 0, "id": 1, "dnd": 1})]
    if receivers and all(is_dnd_active(u) for u in receivers):
        await db.video_calls.update_one({"id": call_id}, {"$set": {"status": "missed", "ended_at": datetime.now(timezone.utc).isoformat(), "dnd": True}})
        await _log_call_message({**call_doc, "id": call_id}, "dnd", current_user.id)
        return VideoCallResponse(room_url="", room_name=room_name, call_id=call_id, dnd=True)

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

    return VideoCallResponse(room_url=caller_url or room_url, room_name=room_name, call_id=call_id)


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

    room_url = call["room_url"]
    if call.get("provider") == "daily" and _daily_key():
        room_url = _with_token(room_url, await _daily_token(call["room_name"], current_user, False, int(time.time()) + 2 * 3600), call.get("call_type", "video"))
    return {"status": "answered", "room_url": room_url}


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
    await _log_call_message(call, "declined", current_user.id)
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
    if call.get("status") in ("ended", "declined", "missed"):
        return {"status": call["status"]}

    final = "ended" if call.get("status") == "active" else "missed"
    await db.video_calls.update_one(
        {"id": call_id},
        {"$set": {"status": final, "ended_at": datetime.now(timezone.utc).isoformat()}},
    )
    await _log_call_message(call, final, current_user.id)
    try:
        await ws_manager.broadcast_to_users(
            {"type": "call_ended", "call_id": call_id},
            call["participants"],
        )
    except Exception as e:
        logger.warning(f"WS end broadcast failed: {e}")

    return {"status": final}
