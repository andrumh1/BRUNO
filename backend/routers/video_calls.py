"""Video call routes (extracted from server.py).

Uses Jitsi Meet (https://meet.jit.si) — public free WebRTC service with
built-in STUN+TURN servers. No API keys or extra config required.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import uuid
import logging
import os
import time
import asyncio
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
    busy: bool = False


RING_TIMEOUT_SEC = 45


async def _ring_timeout(call_id: str):
    """Nobody answered within RING_TIMEOUT_SEC → missed call for everyone."""
    await asyncio.sleep(RING_TIMEOUT_SEC)
    call = await db.video_calls.find_one({"id": call_id, "status": "ringing"}, {"_id": 0})
    if not call:
        return
    await db.video_calls.update_one({"id": call_id}, {"$set": {"status": "missed", "ended_at": datetime.now(timezone.utc).isoformat()}})
    await _log_call_message(call, "missed", call["started_by"])
    try:
        await ws_manager.broadcast_to_users({"type": "call_ended", "call_id": call_id, "reason": "missed"}, call.get("participants", []))
    except Exception as e:
        logger.warning(f"WS ring-timeout broadcast failed: {e}")


@router.get("/history")
async def call_history(filter: str = "all", q: str = "", limit: int = 100, current_user: User = Depends(get_current_user)):
    """Every call of the user (incoming/outgoing/missed) with duration, peer/group and redial info."""
    query = {"participants": current_user.id, "status": {"$in": ["ended", "missed", "declined", "busy"]}}
    if filter == "missed":
        query["started_by"] = {"$ne": current_user.id}
        query["status"] = {"$in": ["missed", "declined"]}
    calls = await db.video_calls.find(query, {"_id": 0}).sort("started_at", -1).to_list(400)
    chat_ids = list({c["chat_id"] for c in calls})
    chats = {c["id"]: c async for c in db.chats.find({"id": {"$in": chat_ids}}, {"_id": 0, "id": 1, "name": 1, "avatar_url": 1, "is_group": 1, "participants": 1})}
    uids = list({p for c in calls for p in c.get("participants", [])})
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": uids}}, {"_id": 0, "id": 1, "name": 1, "email": 1})}
    profiles = {p["user_id"]: p async for p in db.user_profiles.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "display_name": 1, "avatar_url": 1})}

    def person(uid):
        u, p = users.get(uid, {}), profiles.get(uid, {})
        return {"id": uid, "name": p.get("display_name") or u.get("name") or (u.get("email") or "Usuario").split("@")[0], "avatar_url": p.get("avatar_url")}

    out = []
    ql = q.strip().lower()
    for c in calls:
        chat = chats.get(c["chat_id"], {})
        is_group = bool(c.get("is_group") or chat.get("is_group"))
        others = [p for p in c.get("participants", []) if p != current_user.id]
        peer = {"id": c["chat_id"], "name": chat.get("name") or "Grupo", "avatar_url": chat.get("avatar_url"), "members": len(c.get("participants", []))} if is_group else person(others[0] if others else c["started_by"])
        if ql and ql not in (peer.get("name") or "").lower():
            continue
        duration = 0
        if c.get("answered_at") and c.get("ended_at"):
            try:
                duration = int((datetime.fromisoformat(c["ended_at"]) - datetime.fromisoformat(c["answered_at"])).total_seconds())
            except Exception:
                duration = 0
        outgoing = c["started_by"] == current_user.id
        out.append({"id": c["id"], "chat_id": c["chat_id"], "call_type": c.get("call_type", "video"), "status": c["status"],
                    "direction": "outgoing" if outgoing else "incoming", "missed": (not outgoing) and c["status"] in ("missed", "declined"),
                    "duration_sec": duration, "duration": _fmt_duration(duration) if duration else None, "dnd": bool(c.get("dnd")),
                    "started_at": c.get("started_at"), "ended_at": c.get("ended_at"), "is_group": is_group, "peer": peer, "caller": person(c["started_by"])})
        if len(out) >= limit:
            break
    return {"total": len(out), "calls": out}


@router.delete("/history")
async def clear_call_history(call_id: str | None = None, current_user: User = Depends(get_current_user)):
    """Hide calls from my history (removes me from the participants list of the log)."""
    query = {"participants": current_user.id, "status": {"$in": ["ended", "missed", "declined", "busy"]}}
    if call_id:
        query["id"] = call_id
    res = await db.video_calls.update_many(query, {"$pull": {"participants": current_user.id}})
    return {"deleted": res.modified_count}


@router.get("/missed/today")
async def missed_calls_today(current_user: User = Depends(get_current_user)):
    """Missed/declined incoming calls of the last 24h for the Alerts page."""
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    calls = await db.video_calls.find(
        {"participants": current_user.id, "started_by": {"$ne": current_user.id}, "status": {"$in": ["missed", "declined"]}, "started_at": {"$gte": since}},
        {"_id": 0}).sort("started_at", -1).to_list(50)
    callers = {u["id"]: u async for u in db.users.find({"id": {"$in": list({c["started_by"] for c in calls})}}, {"_id": 0, "id": 1, "name": 1, "username": 1})}
    profiles = {p["user_id"]: p async for p in db.user_profiles.find({"user_id": {"$in": list(callers)}}, {"_id": 0, "user_id": 1, "avatar_url": 1, "display_name": 1})}
    out = []
    for c in calls:
        u, p = callers.get(c["started_by"], {}), profiles.get(c["started_by"], {})
        out.append({"id": c["id"], "chat_id": c["chat_id"], "call_type": c.get("call_type", "video"), "status": c["status"], "created_at": c.get("started_at"),
                    "caller": {"id": c["started_by"], "name": p.get("display_name") or u.get("name") or u.get("username") or "Usuario", "avatar_url": p.get("avatar_url")}})
    return {"total": len(out), "calls": out}


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
            "exp": exp, "eject_at_room_exp": True, "max_participants": 50 if chat.get("is_group") else 8, "start_video_off": request.call_type == "audio",
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
        "is_group": bool(chat.get("is_group")),
        "status": "ringing",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
    }
    await db.video_calls.insert_one(call_doc)

    other_participants = [p for p in chat["participants"] if p != current_user.id]

    # Busy: a direct peer already in another ringing/active call
    if not chat.get("is_group") and other_participants:
        busy = await db.video_calls.find_one({"participants": other_participants[0], "status": {"$in": ["ringing", "active"]}, "id": {"$ne": call_id}}, {"_id": 0, "id": 1})
        if busy:
            await db.video_calls.update_one({"id": call_id}, {"$set": {"status": "busy", "ended_at": datetime.now(timezone.utc).isoformat()}})
            return VideoCallResponse(room_url="", room_name=room_name, call_id=call_id, busy=True)

    # Do-Not-Disturb or chat muted: receiver is silenced → register as missed, no ring/push
    from utils.dnd import is_dnd_active
    from utils.chat_mute import muted_user_ids
    muted_by = muted_user_ids(chat)
    receivers = [u async for u in db.users.find({"id": {"$in": other_participants}}, {"_id": 0, "id": 1, "dnd": 1})]
    if receivers and all(is_dnd_active(u) or u["id"] in muted_by for u in receivers):
        await db.video_calls.update_one({"id": call_id}, {"$set": {"status": "missed", "ended_at": datetime.now(timezone.utc).isoformat(), "dnd": True}})
        await _log_call_message({**call_doc, "id": call_id}, "dnd", current_user.id)
        return VideoCallResponse(room_url="", room_name=room_name, call_id=call_id, dnd=True)

    caller_profile = await db.user_profiles.find_one({"user_id": current_user.id}, {"_id": 0, "avatar_url": 1})
    call_notification = {
        "type": "incoming_call",
        "call_id": call_id,
        "chat_id": request.chat_id,
        "call_type": request.call_type,
        "caller_id": current_user.id,
        "caller_name": current_user.name,
        "caller_avatar": (caller_profile or {}).get("avatar_url") or getattr(current_user, "avatar_url", None),
        "is_group": bool(chat.get("is_group")),
        "chat_name": chat.get("name"),
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

    asyncio.create_task(_ring_timeout(call_id))
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
            {"type": "call_ended", "call_id": call_id, "reason": "cancelled" if final == "missed" and current_user.id == call.get("started_by") else final},
            call["participants"],
        )
    except Exception as e:
        logger.warning(f"WS end broadcast failed: {e}")

    return {"status": final}
