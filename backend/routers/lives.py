"""
Lives Router - TikTok-style live streaming.

Video transport: WebRTC (host → each viewer) with signaling relayed over the
`/api/lives/{live_id}/ws` WebSocket. Private lives require a 6-char access
code that only the host can see/share.
"""

from fastapi import APIRouter, HTTPException, Depends, Header, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os
import re
import time
import uuid
import secrets
import string
import httpx

router = APIRouter(tags=["lives"])

db = None


def set_db(database):
    global db
    db = database


active_lives = {}       # {live_id: {host_id, viewers: [], started_at}}
live_connections = {}   # {live_id: {user_id: websocket}}

ICE_SERVERS = [
    {"urls": "stun:stun.l.google.com:19302"},
    {"urls": "stun:stun1.l.google.com:19302"},
    {"urls": "stun:stun2.l.google.com:19302"},
]


class CreateLiveRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    category: Optional[str] = "general"
    is_private: bool = False
    ticket_price: Optional[float] = None  # entrada de pago (privados); None/0 = gratis
    ticket_currency: Optional[str] = "usd"
    allow_comments: bool = True
    allow_gifts: bool = True
    anti_capture: bool = True


class LiveComment(BaseModel):
    text: str


class LiveGift(BaseModel):
    gift_type: str
    amount: int = 1


class JoinLiveRequest(BaseModel):
    access_code: Optional[str] = None


class ModerationAction(BaseModel):
    action: str  # pin | unpin | mute | unmute | kick | add_mod | remove_mod | settings
    user_id: Optional[str] = None
    comment_id: Optional[str] = None
    blocked_words: Optional[list[str]] = None
    allow_comments: Optional[bool] = None


DAILY_API = "https://api.daily.co/v1"
LIVE_MAX_PARTICIPANTS = 200


def _daily_ready() -> bool:
    return bool(os.environ.get("DAILY_API_KEY"))


async def _daily(method: str, path: str, body: Optional[dict] = None) -> dict:
    key = os.environ.get("DAILY_API_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Transmisiones no disponibles: falta configurar DAILY_API_KEY en el servidor")
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.request(method, DAILY_API + path, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, json=body)
    if r.status_code >= 400 and not (method == "DELETE" and r.status_code == 404):
        raise HTTPException(status_code=502, detail=f"Daily.co: {r.text[:200]}")
    return r.json() if r.content else {}


async def _daily_token(room_name: str, user: dict, is_host: bool, exp: int) -> str:
    res = await _daily("POST", "/meeting-tokens", {"properties": {
        "room_name": room_name, "exp": min(exp, int(time.time()) + 4 * 3600), "is_owner": is_host,
        "user_name": user.get("name", "Usuario"), "user_id": user["id"], "eject_at_token_exp": True,
        "start_video_off": not is_host, "start_audio_off": not is_host,
        "permissions": {"hasPresence": True, "canSend": is_host, "canAdmin": is_host},
    }})
    return res["token"]


def _can_moderate(live: dict, user_id: str) -> bool:
    return user_id == live["host_id"] or user_id in (live.get("moderators") or [])


def _blocked(text: str, words: list) -> bool:
    low = (text or "").lower()
    return any(w and re.search(rf"\b{re.escape(w.lower())}\b", low) for w in words or [])


def _viewer_count(live_id: str, host_id: str) -> int:
    conns = live_connections.get(live_id, {})
    return max(0, len(conns) - (1 if host_id in conns else 0))


def _gen_code(n: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


def _public(live: dict, viewer_id: Optional[str]) -> dict:
    """Strip private fields unless the requester is the host."""
    out = {k: v for k, v in live.items() if k != "_id"}
    if viewer_id != out.get("host_id"):
        out.pop("access_code", None)
    return out


async def _user_from_token(token: Optional[str]):
    from utils.security import resolve_user_dict_from_token
    return await resolve_user_dict_from_token(token) if token else None


async def get_current_user_from_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await _user_from_token(authorization.replace("Bearer ", ""))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


async def get_optional_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return await _user_from_token(authorization.replace("Bearer ", ""))


GIFT_VALUES = {"rose": 1, "heart": 5, "star": 10, "diamond": 50, "rocket": 100, "crown": 500}

LIVE_CATEGORIES = [
    {"id": "general", "name": "General", "icon": "radio"},
    {"id": "music", "name": "Música", "icon": "music"},
    {"id": "gaming", "name": "Gaming", "icon": "gamepad-2"},
    {"id": "talk", "name": "Charla", "icon": "message-circle"},
    {"id": "cooking", "name": "Cocina", "icon": "chef-hat"},
    {"id": "fitness", "name": "Fitness", "icon": "dumbbell"},
    {"id": "art", "name": "Arte", "icon": "palette"},
    {"id": "education", "name": "Educación", "icon": "graduation-cap"},
    {"id": "business", "name": "Negocios", "icon": "briefcase"},
    {"id": "technology", "name": "Tecnología", "icon": "cpu"},
]


async def _broadcast(live_id: str, message: dict, exclude: Optional[str] = None):
    for uid, ws in list(live_connections.get(live_id, {}).items()):
        if uid == exclude:
            continue
        try:
            await ws.send_json(message)
        except Exception:
            live_connections.get(live_id, {}).pop(uid, None)


# ============================================
# LIVE STREAM MANAGEMENT
# ============================================

@router.post("/api/lives")
async def create_live(request: CreateLiveRequest, current_user: dict = Depends(get_current_user_from_token)):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")

    existing = await db.lives.find_one({"host_id": current_user["id"], "status": "live"})
    if existing:
        raise HTTPException(status_code=400, detail="Ya tienes un live activo")

    if not _daily_ready():
        raise HTTPException(status_code=503, detail="Transmisiones no disponibles: falta configurar DAILY_API_KEY en el servidor")
    live_id = str(uuid.uuid4())
    room_name = f"bruno-live-{live_id[:13]}"
    exp = int(time.time()) + 6 * 3600
    room = await _daily("POST", "/rooms", {"name": room_name, "privacy": "private", "properties": {
        "exp": exp, "max_participants": LIVE_MAX_PARTICIPANTS, "eject_at_room_exp": True, "enable_chat": False,
        "enable_knocking": False, "enable_screenshare": False, "start_video_off": False, "start_audio_off": False, "enable_recording": "cloud"}})
    host_token = await _daily_token(room_name, current_user, True, exp)
    live_doc = {
        "id": live_id,
        "room_name": room_name,
        "room_url": room.get("url"),
        "room_exp": exp,
        "moderators": [],
        "muted_user_ids": [],
        "banned_user_ids": [],
        "blocked_words": [],
        "pinned_comment": None,
        "host_id": current_user["id"],
        "host_name": current_user.get("name", "Usuario"),
        "host_avatar": current_user.get("avatar_url"),
        "host_tier": current_user.get("subscription_tier", "free"),
        "title": request.title,
        "description": request.description,
        "category": request.category,
        "is_private": request.is_private,
        "ticket_price_minor": (int(round(request.ticket_price * 100)) if (request.is_private and request.ticket_price and request.ticket_price > 0) else None),
        "ticket_currency": (request.ticket_currency or "usd").lower(),
        "access_code": _gen_code() if request.is_private else None,
        "anti_capture": request.anti_capture if request.is_private else False,
        "allow_comments": request.allow_comments,
        "allow_gifts": request.allow_gifts,
        "status": "live",
        "viewer_count": 0,
        "peak_viewers": 0,
        "total_viewers": 0,
        "total_gifts": 0,
        "total_gift_value": 0,
        "hearts_count": 0,
        "comments_count": 0,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
        "duration_seconds": 0,
        "thumbnail_url": None,
    }
    await db.lives.insert_one(dict(live_doc))

    active_lives[live_id] = {"host_id": current_user["id"], "viewers": [], "started_at": datetime.now(timezone.utc)}
    live_connections[live_id] = {}

    if not request.is_private:
        try:
            from utils.notification_realtime import emit_notification_ws
            now = datetime.now(timezone.utc).isoformat()
            async for f in db.follows.find({"following_id": current_user["id"]}, {"_id": 0, "follower_id": 1}).limit(2000):
                doc = {"id": str(uuid.uuid4()), "user_id": f["follower_id"], "actor_id": current_user["id"], "type": "live_started",
                       "target_id": live_id, "target_type": "live", "message": f"{current_user.get('name', 'Alguien')} está en vivo: {request.title}",
                       "is_read": False, "created_at": now}
                await db.notifications.insert_one(dict(doc))
                await emit_notification_ws(doc)
        except Exception:
            pass

    return {**live_doc, "is_host": True, "rtc": {"url": live_doc["room_url"], "token": host_token}}


@router.get("/api/lives")
async def get_active_lives(category: Optional[str] = None, limit: int = 20, offset: int = 0):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    query = {"status": "live", "is_private": False}
    if category:
        query["category"] = category
    lives = await db.lives.find(query, {"_id": 0, "access_code": 0}).sort("viewer_count", -1).skip(offset).limit(limit).to_list(limit)
    return lives


@router.get("/api/lives/categories")
async def get_live_categories():
    return LIVE_CATEGORIES


@router.get("/api/lives/following")
async def get_following_lives(current_user: dict = Depends(get_current_user_from_token)):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    following = await db.follows.find({"follower_id": current_user["id"]}, {"following_id": 1}).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    lives = await db.lives.find(
        {"host_id": {"$in": following_ids}, "status": "live"}, {"_id": 0, "access_code": 0}
    ).sort("started_at", -1).to_list(50)
    return lives


@router.get("/api/lives/mine/active")
async def get_my_active_live(current_user: dict = Depends(get_current_user_from_token)):
    live = await db.lives.find_one({"host_id": current_user["id"], "status": "live"}, {"_id": 0})
    if not live:
        return {}
    out = {**live, "is_host": True}
    if live.get("room_name") and _daily_ready():
        out["rtc"] = {"url": live.get("room_url"), "token": await _daily_token(live["room_name"], current_user, True, live.get("room_exp") or int(time.time()) + 3600)}
    return out


@router.get("/api/lives/by-code/{code}")
async def resolve_live_by_code(code: str):
    live = await db.lives.find_one({"access_code": code.strip().upper(), "status": "live"}, {"_id": 0, "id": 1, "title": 1, "host_name": 1})
    if not live:
        raise HTTPException(status_code=404, detail="Código inválido o live finalizado")
    return live


@router.get("/api/lives/upcoming")
async def list_scheduled(current_user: Optional[dict] = Depends(get_optional_user)):
    q = {"status": "scheduled", "scheduled_at": {"$gt": datetime.fromtimestamp(time.time() - 3600, tz=timezone.utc).isoformat()}}
    q["$or"] = [{"is_private": {"$ne": True}}] + ([{"host_id": current_user["id"]}] if current_user else [])
    items = await db.lives.find(q, {"_id": 0, "access_code": 0, "muted_user_ids": 0, "banned_user_ids": 0, "blocked_words": 0}).sort("scheduled_at", 1).to_list(50)
    if current_user:
        mine = {r["live_id"] async for r in db.live_reminders.find({"user_id": current_user["id"]}, {"_id": 0, "live_id": 1})}
        for it in items:
            it["reminded"] = it["id"] in mine
            it["is_host"] = it["host_id"] == current_user["id"]
    return items


@router.get("/api/lives/{live_id}")
async def get_live_details(live_id: str, current_user: Optional[dict] = Depends(get_optional_user)):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    live = await db.lives.find_one({"id": live_id}, {"_id": 0})
    if not live:
        raise HTTPException(status_code=404, detail="Live not found")
    out = _public(live, current_user["id"] if current_user else None)
    out["requires_code"] = bool(live.get("is_private")) and (not current_user or current_user["id"] != live["host_id"])
    out["is_host"] = bool(current_user) and current_user["id"] == live["host_id"]
    out["is_moderator"] = bool(current_user) and _can_moderate(live, current_user["id"])
    out["viewer_count"] = _viewer_count(live_id, live["host_id"]) if live.get("status") == "live" else live.get("viewer_count", 0)
    if not out["is_moderator"]:
        for k in ("muted_user_ids", "banned_user_ids", "blocked_words", "room_name", "room_url"):
            out.pop(k, None)
    return out


@router.post("/api/lives/{live_id}/rotate-code")
async def rotate_access_code(live_id: str, current_user: dict = Depends(get_current_user_from_token)):
    live = await db.lives.find_one({"id": live_id, "status": "live"})
    if not live:
        raise HTTPException(status_code=404, detail="Live not found")
    if live["host_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Solo el anfitrión puede cambiar el código")
    if not live.get("is_private"):
        raise HTTPException(status_code=400, detail="Este live no es privado")
    code = _gen_code()
    await db.lives.update_one({"id": live_id}, {"$set": {"access_code": code}})
    return {"access_code": code}


@router.post("/api/lives/{live_id}/end")
async def end_live(live_id: str, current_user: dict = Depends(get_current_user_from_token)):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    live = await db.lives.find_one({"id": live_id})
    if not live:
        raise HTTPException(status_code=404, detail="Live not found")
    if live["host_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if live["status"] != "live":
        raise HTTPException(status_code=400, detail="Live already ended")

    ended_at = datetime.now(timezone.utc)
    started_at = datetime.fromisoformat(live["started_at"].replace("Z", "+00:00"))
    duration = int((ended_at - started_at).total_seconds())
    await db.lives.update_one(
        {"id": live_id},
        {"$set": {"status": "ended", "ended_at": ended_at.isoformat(), "duration_seconds": duration}},
    )

    active_lives.pop(live_id, None)
    rec = live.get("recording") or {}
    if rec.get("status") == "recording" and live.get("room_name"):
        try:
            await _daily("POST", f"/rooms/{live['room_name']}/recordings/stop")
        except HTTPException:
            pass
        await db.lives.update_one({"id": live_id}, {"$set": {"recording.status": "processing", "recording.stopped_at": ended_at.isoformat()}})
    elif rec.get("status") == "stopped":
        await db.lives.update_one({"id": live_id}, {"$set": {"recording.status": "processing"}})
    await _broadcast(live_id, {"type": "live_ended", "live_id": live_id})
    live_connections.pop(live_id, None)
    if live.get("room_name") and _daily_ready():
        try:
            await _daily("DELETE", f"/rooms/{live['room_name']}")
        except HTTPException:
            pass

    if duration >= 60:
        points = min(duration // 60, 100)
        await db.users.update_one({"id": current_user["id"]}, {"$inc": {"points": points}})
    return {"success": True, "duration_seconds": duration}


@router.post("/api/lives/{live_id}/join")
async def join_live(live_id: str, body: JoinLiveRequest = None, current_user: dict = Depends(get_current_user_from_token)):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    live = await db.lives.find_one({"id": live_id, "status": "live"}, {"_id": 0})
    if not live:
        raise HTTPException(status_code=404, detail="Live not found or ended")

    is_host = live["host_id"] == current_user["id"]
    if live.get("ticket_price_minor") and not is_host:
        # Paid private live: access only with a confirmed ticket (server-side; sharing the link/code is not enough)
        ticket = await db.live_tickets.find_one({"live_id": live_id, "user_id": current_user["id"]}, {"_id": 0, "id": 1})
        if not ticket:
            raise HTTPException(status_code=402, detail={"code": "ticket_required", "message": "Este live requiere entrada de pago", "price_minor": live["ticket_price_minor"], "currency": live.get("ticket_currency", "usd")})
    elif live.get("is_private") and not is_host:
        code = ((body.access_code if body else None) or "").strip().upper()
        if not code or code != live.get("access_code"):
            raise HTTPException(status_code=403, detail="Código de acceso incorrecto")

    if current_user["id"] in (live.get("banned_user_ids") or []):
        raise HTTPException(status_code=403, detail="Fuiste expulsado de este live")

    if not is_host:
        state = active_lives.setdefault(live_id, {"host_id": live["host_id"], "viewers": [], "started_at": datetime.now(timezone.utc)})
        if current_user["id"] not in state["viewers"]:
            state["viewers"].append(current_user["id"])  # unique viewers for the whole session (no inflation on reconnect)
            await db.lives.update_one({"id": live_id}, {"$set": {"total_viewers": len(state["viewers"])}, "$addToSet": {"participant_ids": current_user["id"]}})

    rtc = None
    if live.get("room_name") and _daily_ready():
        rtc = {"url": live.get("room_url"), "token": await _daily_token(live["room_name"], current_user, is_host, live.get("room_exp") or int(time.time()) + 3600)}
    out = _public(live, current_user["id"])
    for k in ("muted_user_ids", "banned_user_ids", "blocked_words", "room_name", "room_url"):
        if not _can_moderate(live, current_user["id"]):
            out.pop(k, None)
    return {"success": True, "live": out, "is_host": is_host, "is_moderator": _can_moderate(live, current_user["id"]), "rtc": rtc}


@router.post("/api/lives/{live_id}/leave")
async def leave_live(live_id: str, current_user: dict = Depends(get_current_user_from_token)):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    return {"success": True}


@router.post("/api/lives/{live_id}/comment")
async def post_comment(live_id: str, comment: LiveComment, current_user: dict = Depends(get_current_user_from_token)):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    live = await db.lives.find_one({"id": live_id, "status": "live"})
    if not live:
        raise HTTPException(status_code=404, detail="Live not found or ended")
    if not live["allow_comments"] and not _can_moderate(live, current_user["id"]):
        raise HTTPException(status_code=403, detail="El anfitrión desactivó los comentarios")
    if current_user["id"] in (live.get("banned_user_ids") or []):
        raise HTTPException(status_code=403, detail="Fuiste expulsado de este live")
    if current_user["id"] in (live.get("muted_user_ids") or []):
        raise HTTPException(status_code=403, detail="El anfitrión te silenció en este live")
    if _blocked(comment.text, live.get("blocked_words")):
        raise HTTPException(status_code=422, detail="Tu mensaje contiene palabras bloqueadas por el anfitrión")
    since = datetime.fromtimestamp(time.time() - 5, tz=timezone.utc).isoformat()
    recent = await db.live_comments.count_documents({"live_id": live_id, "user_id": current_user["id"], "created_at": {"$gt": since}})
    if recent >= 3:
        raise HTTPException(status_code=429, detail="Estás enviando mensajes muy rápido")

    comment_doc = {
        "role": "host" if current_user["id"] == live["host_id"] else "moderator" if _can_moderate(live, current_user["id"]) else "viewer",
        "id": str(uuid.uuid4()),
        "live_id": live_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("name", "Usuario"),
        "user_avatar": current_user.get("avatar_url"),
        "user_tier": current_user.get("subscription_tier", "free"),
        "text": comment.text[:200],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.live_comments.insert_one(dict(comment_doc))
    await db.lives.update_one({"id": live_id}, {"$inc": {"comments_count": 1}})
    await _broadcast(live_id, {"type": "new_comment", "comment": comment_doc})
    return comment_doc


@router.post("/api/lives/{live_id}/moderation")
async def moderate_live(live_id: str, body: ModerationAction, current_user: dict = Depends(get_current_user_from_token)):
    live = await db.lives.find_one({"id": live_id, "status": "live"}, {"_id": 0})
    if not live:
        raise HTTPException(status_code=404, detail="Live not found or ended")
    uid = current_user["id"]
    host_only = body.action in ("add_mod", "remove_mod", "settings")
    if host_only and uid != live["host_id"]:
        raise HTTPException(status_code=403, detail="Solo el anfitrión puede hacer esto")
    if not _can_moderate(live, uid):
        raise HTTPException(status_code=403, detail="No tienes permisos de moderación")
    if body.user_id == live["host_id"] and body.action in ("mute", "kick", "add_mod", "remove_mod"):
        raise HTTPException(status_code=400, detail="No puedes aplicar esto al anfitrión")
    update, event = {}, None
    if body.action == "pin":
        c = await db.live_comments.find_one({"id": body.comment_id, "live_id": live_id}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Comentario no encontrado")
        update = {"$set": {"pinned_comment": c}}; event = {"type": "pinned", "comment": c}
    elif body.action == "unpin":
        update = {"$set": {"pinned_comment": None}}; event = {"type": "pinned", "comment": None}
    elif body.action in ("mute", "unmute"):
        op = "$addToSet" if body.action == "mute" else "$pull"
        update = {op: {"muted_user_ids": body.user_id}}; event = {"type": "user_muted" if body.action == "mute" else "user_unmuted", "user_id": body.user_id}
    elif body.action == "kick":
        update = {"$addToSet": {"banned_user_ids": body.user_id}}; event = {"type": "user_kicked", "user_id": body.user_id}
        if live.get("room_name") and _daily_ready():
            try:
                await _daily("POST", f"/rooms/{live['room_name']}/eject", {"user_ids": [body.user_id], "ban": True})
            except HTTPException:
                pass
        ws = live_connections.get(live_id, {}).get(body.user_id)
        if ws:
            try:
                await ws.send_json({"type": "kicked"}); await ws.close(code=4005, reason="Kicked")
            except Exception:
                pass
    elif body.action in ("add_mod", "remove_mod"):
        op = "$addToSet" if body.action == "add_mod" else "$pull"
        update = {op: {"moderators": body.user_id}}; event = {"type": "moderators", "user_id": body.user_id, "added": body.action == "add_mod"}
    elif body.action == "settings":
        fields = {}
        if body.blocked_words is not None:
            fields["blocked_words"] = [w.strip().lower() for w in body.blocked_words if w.strip()][:100]
        if body.allow_comments is not None:
            fields["allow_comments"] = body.allow_comments
        update = {"$set": fields}; event = {"type": "settings", **fields}
    else:
        raise HTTPException(status_code=400, detail="Acción inválida")
    if update:
        await db.lives.update_one({"id": live_id}, update)
    if event:
        await _broadcast(live_id, event)
    fresh = await db.lives.find_one({"id": live_id}, {"_id": 0, "moderators": 1, "muted_user_ids": 1, "banned_user_ids": 1, "blocked_words": 1, "allow_comments": 1, "pinned_comment": 1})
    return fresh


@router.post("/api/lives/{live_id}/heart")
async def send_heart(live_id: str, current_user: dict = Depends(get_current_user_from_token)):
    await db.lives.update_one({"id": live_id, "status": "live"}, {"$inc": {"hearts_count": 1}})
    await _broadcast(live_id, {"type": "heart", "user_id": current_user["id"]})
    return {"success": True}


@router.post("/api/lives/{live_id}/gift")
async def send_gift(live_id: str, gift: LiveGift, current_user: dict = Depends(get_current_user_from_token)):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    live = await db.lives.find_one({"id": live_id, "status": "live"})
    if not live:
        raise HTTPException(status_code=404, detail="Live not found or ended")
    if not live["allow_gifts"]:
        raise HTTPException(status_code=403, detail="Gifts disabled")
    if gift.gift_type not in GIFT_VALUES:
        raise HTTPException(status_code=400, detail="Invalid gift type")

    gift_value = GIFT_VALUES[gift.gift_type] * gift.amount
    user = await db.users.find_one({"id": current_user["id"]})
    if user.get("points", 0) < gift_value:
        raise HTTPException(status_code=400, detail="Insufficient points")

    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"points": -gift_value}})
    await db.users.update_one({"id": live["host_id"]}, {"$inc": {"points": int(gift_value * 0.7)}})

    gift_doc = {
        "id": str(uuid.uuid4()),
        "live_id": live_id,
        "sender_id": current_user["id"],
        "sender_name": current_user.get("name", "Usuario"),
        "sender_avatar": current_user.get("avatar_url"),
        "receiver_id": live["host_id"],
        "gift_type": gift.gift_type,
        "amount": gift.amount,
        "value": gift_value,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.live_gifts.insert_one(dict(gift_doc))
    await db.lives.update_one({"id": live_id}, {"$inc": {"total_gifts": gift.amount, "total_gift_value": gift_value}})
    await _broadcast(live_id, {"type": "new_gift", "gift": gift_doc})
    return gift_doc


@router.get("/api/lives/{live_id}/comments")
async def get_live_comments(live_id: str, limit: int = 50, offset: int = 0):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    comments = await db.live_comments.find({"live_id": live_id}, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    return list(reversed(comments))


# ============================================
# WEBSOCKET — signaling + realtime events
# ============================================

@router.websocket("/api/lives/{live_id}/ws")
async def live_ws(websocket: WebSocket, live_id: str, token: str = Query(None), code: str = Query(None)):
    user = await _user_from_token(token)
    if not user:
        await websocket.close(code=4001, reason="Invalid token")
        return
    live = await db.lives.find_one({"id": live_id, "status": "live"}, {"_id": 0})
    if not live:
        await websocket.close(code=4004, reason="Live not found")
        return
    is_host = live["host_id"] == user["id"]
    if user["id"] in (live.get("banned_user_ids") or []):
        await websocket.close(code=4005, reason="Kicked")
        return
    if live.get("is_private") and not is_host and (code or "").strip().upper() != live.get("access_code"):
        await websocket.accept()
        await websocket.send_json({"type": "error", "code": 4003, "detail": "Código de acceso incorrecto"})
        await websocket.close(code=4003, reason="Bad access code")
        return

    await websocket.accept()
    conns = live_connections.setdefault(live_id, {})
    stale = conns.get(user["id"])
    conns[user["id"]] = websocket
    if stale is not None and stale is not websocket:
        try:
            await stale.close(code=4000, reason="Replaced by a newer connection")
        except Exception:
            pass
    viewer = {"id": user["id"], "name": user.get("name", "Usuario"), "avatar_url": user.get("avatar_url")}

    await websocket.send_json({
        "type": "welcome", "is_host": is_host, "self_id": user["id"], "host_id": live["host_id"],
        "viewers": [uid for uid in conns.keys() if uid != live["host_id"]],
        "viewer_count": max(0, len(conns) - (1 if live["host_id"] in conns else 0)),
        "host_online": live["host_id"] in conns,
        "pinned_comment": live.get("pinned_comment"),
        "recording": (live.get("recording") or {}).get("status") == "recording",
    })
    if not is_host:
        vc = _viewer_count(live_id, live["host_id"])
        await db.lives.update_one({"id": live_id}, {"$set": {"viewer_count": vc}, "$max": {"peak_viewers": vc}})
        await _broadcast(live_id, {"type": "viewer_joined", "viewer": viewer, "viewer_count": vc}, exclude=user["id"])
    else:
        await _broadcast(live_id, {"type": "host_online"}, exclude=user["id"])

    try:
        while True:
            data = await websocket.receive_json()
            t = data.get("type")
            if t == "ping":
                await websocket.send_json({"type": "pong"})
            elif t == "heart":
                await db.lives.update_one({"id": live_id}, {"$inc": {"hearts_count": 1}})
                await _broadcast(live_id, {"type": "heart", "user_id": user["id"]})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if conns.get(user["id"]) is not websocket:
            return  # superseded by a newer socket of the same user — keep the live one registered
        conns.pop(user["id"], None)
        if not is_host:
            vc = _viewer_count(live_id, live["host_id"])
            await db.lives.update_one({"id": live_id, "status": "live"}, {"$set": {"viewer_count": vc}})
            await _broadcast(live_id, {"type": "viewer_left", "viewer_id": user["id"], "viewer_count": vc})
        else:
            await _broadcast(live_id, {"type": "host_offline"})


# ═══════════════════════════ INVITADOS · ENCUESTAS · PREGUNTAS · PROGRAMACIÓN ═══════════════════════════
from fastapi import BackgroundTasks, Request  # noqa: E402
from routers.notifications import notify_user  # noqa: E402


class UserRef(BaseModel):
    user_id: str


class PollCreate(BaseModel):
    question: str
    options: list[str]
    duration_s: Optional[int] = 120


class VoteBody(BaseModel):
    option_id: str


class QuestionBody(BaseModel):
    text: str


class ScheduleLiveRequest(CreateLiveRequest):
    scheduled_at: str  # ISO 8601


async def _live_or_404(live_id: str, status: str = "live") -> dict:
    live = await db.lives.find_one({"id": live_id, **({"status": status} if status else {})}, {"_id": 0})
    if not live:
        raise HTTPException(status_code=404, detail="Live not found or ended")
    return live


async def _send_to(live_id: str, user_id: str, payload: dict):
    ws = live_connections.get(live_id, {}).get(user_id)
    if ws:
        try:
            await ws.send_json(payload)
        except Exception:
            pass


def _mini(u: dict) -> dict:
    return {"id": u["id"], "name": u.get("name", "Usuario"), "avatar": u.get("avatar_url")}


# ─── Invitados (co-streaming) ────────────────────────────────────────────
@router.post("/api/lives/{live_id}/guest/request")
async def guest_request(live_id: str, current_user: dict = Depends(get_current_user_from_token)):
    live = await _live_or_404(live_id)
    if current_user["id"] == live["host_id"]:
        raise HTTPException(status_code=400, detail="Eres el anfitrión")
    if current_user["id"] in (live.get("banned_user_ids") or []):
        raise HTTPException(status_code=403, detail="Fuiste expulsado de este live")
    if not live.get("allow_guests", True):
        raise HTTPException(status_code=403, detail="El anfitrión no acepta invitados")
    req = {**_mini(current_user), "at": datetime.now(timezone.utc).isoformat()}
    await db.lives.update_one({"id": live_id}, {"$pull": {"guest_requests": {"id": current_user["id"]}}})
    await db.lives.update_one({"id": live_id}, {"$push": {"guest_requests": req}})
    await _send_to(live_id, live["host_id"], {"type": "guest_request", "user": req})
    return {"requested": True}


@router.post("/api/lives/{live_id}/guest/cancel")
async def guest_cancel(live_id: str, current_user: dict = Depends(get_current_user_from_token)):
    live = await _live_or_404(live_id)
    await db.lives.update_one({"id": live_id}, {"$pull": {"guest_requests": {"id": current_user["id"]}, "guests": {"id": current_user["id"]}}})
    await _broadcast(live_id, {"type": "guest_removed", "user_id": current_user["id"]})
    await _send_to(live_id, live["host_id"], {"type": "guest_request_cancel", "user_id": current_user["id"]})
    return {"ok": True}


@router.post("/api/lives/{live_id}/guest/accept")
async def guest_accept(live_id: str, body: UserRef, current_user: dict = Depends(get_current_user_from_token)):
    live = await _live_or_404(live_id)
    if current_user["id"] != live["host_id"]:
        raise HTTPException(status_code=403, detail="Solo el anfitrión acepta invitados")
    if len(live.get("guests") or []) >= 3:
        raise HTTPException(status_code=400, detail="Máximo 3 invitados a la vez")
    guest = next((g for g in live.get("guest_requests") or [] if g["id"] == body.user_id), None)
    if not guest:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    await db.lives.update_one({"id": live_id}, {"$pull": {"guest_requests": {"id": body.user_id}}, "$addToSet": {"guests": guest, "guest_history": body.user_id}})
    token = await _daily_token(live["room_name"], {"id": guest["id"], "name": guest["name"]}, False, live.get("room_exp") or int(time.time()) + 3600) if _daily_ready() else None
    if token:
        # token de invitado: puede publicar audio/video pero no administrar
        res = await _daily("POST", "/meeting-tokens", {"properties": {"room_name": live["room_name"], "exp": min(live.get("room_exp") or int(time.time()) + 3600, int(time.time()) + 4 * 3600), "is_owner": False, "user_name": guest["name"], "user_id": guest["id"], "permissions": {"hasPresence": True, "canSend": True, "canAdmin": False}}})
        token = res["token"]
    await _send_to(live_id, body.user_id, {"type": "guest_accepted", "rtc": {"url": live.get("room_url"), "token": token}})
    await _broadcast(live_id, {"type": "guest_added", "user": guest})
    return {"accepted": True}


@router.post("/api/lives/{live_id}/guest/reject")
async def guest_reject(live_id: str, body: UserRef, current_user: dict = Depends(get_current_user_from_token)):
    live = await _live_or_404(live_id)
    if not _can_moderate(live, current_user["id"]):
        raise HTTPException(status_code=403, detail="Sin permisos")
    await db.lives.update_one({"id": live_id}, {"$pull": {"guest_requests": {"id": body.user_id}}})
    await _send_to(live_id, body.user_id, {"type": "guest_rejected"})
    return {"rejected": True}


@router.post("/api/lives/{live_id}/guest/remove")
async def guest_remove(live_id: str, body: UserRef, current_user: dict = Depends(get_current_user_from_token)):
    live = await _live_or_404(live_id)
    if not _can_moderate(live, current_user["id"]):
        raise HTTPException(status_code=403, detail="Sin permisos")
    await db.lives.update_one({"id": live_id}, {"$pull": {"guests": {"id": body.user_id}}})
    await _send_to(live_id, body.user_id, {"type": "guest_removed_you"})
    await _broadcast(live_id, {"type": "guest_removed", "user_id": body.user_id})
    return {"removed": True}


# ─── Encuestas en vivo ────────────────────────────────────────────────────
def _poll_public(p: dict) -> dict:
    total = sum(o["votes"] for o in p["options"])
    return {"id": p["id"], "question": p["question"], "status": p["status"], "ends_at": p.get("ends_at"), "total": total,
            "options": [{**o, "pct": round(o["votes"] * 100 / total) if total else 0} for o in p["options"]]}


@router.post("/api/lives/{live_id}/polls")
async def create_live_poll(live_id: str, body: PollCreate, current_user: dict = Depends(get_current_user_from_token)):
    live = await _live_or_404(live_id)
    if not _can_moderate(live, current_user["id"]):
        raise HTTPException(status_code=403, detail="Sin permisos")
    opts = [o.strip() for o in body.options if o.strip()][:4]
    if len(opts) < 2 or not body.question.strip():
        raise HTTPException(status_code=422, detail="Pregunta y al menos 2 opciones")
    await db.live_polls.update_many({"live_id": live_id, "status": "open"}, {"$set": {"status": "closed"}})
    poll = {"id": str(uuid.uuid4()), "live_id": live_id, "question": body.question.strip()[:140], "status": "open",
            "options": [{"id": str(i), "text": t[:60], "votes": 0} for i, t in enumerate(opts)], "voters": {},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "ends_at": datetime.fromtimestamp(time.time() + max(15, min(body.duration_s or 120, 3600)), tz=timezone.utc).isoformat()}
    await db.live_polls.insert_one(dict(poll))
    pub = _poll_public(poll)
    await _broadcast(live_id, {"type": "poll", "poll": pub})
    return pub


@router.post("/api/lives/{live_id}/polls/{poll_id}/vote")
async def vote_live_poll(live_id: str, poll_id: str, body: VoteBody, current_user: dict = Depends(get_current_user_from_token)):
    poll = await db.live_polls.find_one({"id": poll_id, "live_id": live_id}, {"_id": 0})
    if not poll or poll["status"] != "open" or (poll.get("ends_at") and poll["ends_at"] < datetime.now(timezone.utc).isoformat()):
        raise HTTPException(status_code=400, detail="La encuesta está cerrada")
    if body.option_id not in {o["id"] for o in poll["options"]}:
        raise HTTPException(status_code=422, detail="Opción inválida")
    prev = poll["voters"].get(current_user["id"])
    for o in poll["options"]:
        if o["id"] == prev:
            o["votes"] -= 1
        if o["id"] == body.option_id:
            o["votes"] += 1
    poll["voters"][current_user["id"]] = body.option_id
    await db.live_polls.update_one({"id": poll_id}, {"$set": {"options": poll["options"], "voters": poll["voters"]}})
    pub = _poll_public(poll)
    await _broadcast(live_id, {"type": "poll", "poll": pub})
    return {**pub, "my_vote": body.option_id}


@router.post("/api/lives/{live_id}/polls/{poll_id}/close")
async def close_live_poll(live_id: str, poll_id: str, current_user: dict = Depends(get_current_user_from_token)):
    live = await _live_or_404(live_id)
    if not _can_moderate(live, current_user["id"]):
        raise HTTPException(status_code=403, detail="Sin permisos")
    await db.live_polls.update_one({"id": poll_id, "live_id": live_id}, {"$set": {"status": "closed"}})
    poll = await db.live_polls.find_one({"id": poll_id}, {"_id": 0})
    pub = _poll_public(poll)
    await _broadcast(live_id, {"type": "poll", "poll": pub})
    return pub


@router.get("/api/lives/{live_id}/polls/current")
async def current_live_poll(live_id: str, current_user: dict = Depends(get_current_user_from_token)):
    poll = await db.live_polls.find_one({"live_id": live_id}, {"_id": 0}, sort=[("created_at", -1)])
    if not poll:
        return {}
    return {**_poll_public(poll), "my_vote": poll["voters"].get(current_user["id"])}


# ─── Preguntas y respuestas ───────────────────────────────────────────────
def _q_public(q: dict) -> dict:
    return {k: v for k, v in q.items() if k != "upvoters"} | {"upvotes": len(q.get("upvoters") or [])}


@router.get("/api/lives/{live_id}/questions")
async def list_live_questions(live_id: str):
    qs = await db.live_questions.find({"live_id": live_id}, {"_id": 0}).to_list(200)
    qs.sort(key=lambda q: (q.get("answered", False), -len(q.get("upvoters") or [])))
    return [_q_public(q) for q in qs]


@router.post("/api/lives/{live_id}/questions")
async def ask_live_question(live_id: str, body: QuestionBody, current_user: dict = Depends(get_current_user_from_token)):
    live = await _live_or_404(live_id)
    if current_user["id"] in (live.get("banned_user_ids") or []) or current_user["id"] in (live.get("muted_user_ids") or []):
        raise HTTPException(status_code=403, detail="No puedes participar en este live")
    if _blocked(body.text, live.get("blocked_words")):
        raise HTTPException(status_code=422, detail="Tu pregunta contiene palabras bloqueadas")
    q = {"id": str(uuid.uuid4()), "live_id": live_id, "text": body.text.strip()[:200], "user_id": current_user["id"], "user_name": current_user.get("name", "Usuario"),
         "user_avatar": current_user.get("avatar_url"), "upvoters": [current_user["id"]], "answered": False, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.live_questions.insert_one(dict(q))
    pub = _q_public(q)
    await _broadcast(live_id, {"type": "question", "question": pub})
    return pub


@router.post("/api/lives/{live_id}/questions/{qid}/upvote")
async def upvote_live_question(live_id: str, qid: str, current_user: dict = Depends(get_current_user_from_token)):
    q = await db.live_questions.find_one({"id": qid, "live_id": live_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    op = "$pull" if current_user["id"] in q.get("upvoters", []) else "$addToSet"
    await db.live_questions.update_one({"id": qid}, {op: {"upvoters": current_user["id"]}})
    q = await db.live_questions.find_one({"id": qid}, {"_id": 0})
    pub = _q_public(q)
    await _broadcast(live_id, {"type": "question", "question": pub})
    return pub


@router.post("/api/lives/{live_id}/questions/{qid}/answer")
async def answer_live_question(live_id: str, qid: str, current_user: dict = Depends(get_current_user_from_token)):
    live = await _live_or_404(live_id)
    if not _can_moderate(live, current_user["id"]):
        raise HTTPException(status_code=403, detail="Sin permisos")
    q = await db.live_questions.find_one({"id": qid, "live_id": live_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    await db.live_questions.update_one({"id": qid}, {"$set": {"answered": not q.get("answered", False)}})
    q["answered"] = not q.get("answered", False)
    pub = _q_public(q)
    await _broadcast(live_id, {"type": "question", "question": pub, "highlight": q["answered"]})
    return pub


# ─── Programación + recordatorios ────────────────────────────────────────
@router.post("/api/lives/schedule")
async def schedule_live(request: ScheduleLiveRequest, current_user: dict = Depends(get_current_user_from_token)):
    try:
        when = datetime.fromisoformat(request.scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=422, detail="Fecha inválida")
    if when <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="La fecha debe ser futura")
    live_id = str(uuid.uuid4())
    doc = {"id": live_id, "host_id": current_user["id"], "host_name": current_user.get("name", "Usuario"), "host_avatar": current_user.get("avatar_url"),
           "title": request.title[:120], "description": (request.description or "")[:500], "category": request.category or "general", "status": "scheduled",
           "scheduled_at": when.isoformat(), "is_private": request.is_private, "access_code": _gen_code() if request.is_private else None,
           "ticket_price_minor": (int(round(request.ticket_price * 100)) if (request.is_private and request.ticket_price and request.ticket_price > 0) else None), "ticket_currency": (request.ticket_currency or "usd").lower(),
           "allow_comments": request.allow_comments, "allow_gifts": request.allow_gifts, "created_at": datetime.now(timezone.utc).isoformat(), "reminder_count": 0,
           "viewer_count": 0, "total_viewers": 0, "peak_viewers": 0, "comment_count": 0, "like_count": 0, "gift_total": 0, "moderators": [], "muted_user_ids": [], "banned_user_ids": [], "blocked_words": []}
    await db.lives.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/api/lives/{live_id}/remind")
async def toggle_reminder(live_id: str, current_user: dict = Depends(get_current_user_from_token)):
    live = await _live_or_404(live_id, status="scheduled")
    existing = await db.live_reminders.find_one({"live_id": live_id, "user_id": current_user["id"]})
    if existing:
        await db.live_reminders.delete_one({"_id": existing["_id"]})
        await db.lives.update_one({"id": live_id}, {"$inc": {"reminder_count": -1}})
        return {"reminded": False}
    await db.live_reminders.insert_one({"live_id": live_id, "user_id": current_user["id"], "notified_pre": False, "created_at": datetime.now(timezone.utc).isoformat()})
    await db.lives.update_one({"id": live_id}, {"$inc": {"reminder_count": 1}})
    return {"reminded": True, "scheduled_at": live["scheduled_at"]}


@router.delete("/api/lives/{live_id}/scheduled")
async def cancel_scheduled(live_id: str, current_user: dict = Depends(get_current_user_from_token)):
    live = await _live_or_404(live_id, status="scheduled")
    if live["host_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Solo el anfitrión")
    await db.lives.update_one({"id": live_id}, {"$set": {"status": "cancelled"}})
    async for r in db.live_reminders.find({"live_id": live_id}, {"_id": 0, "user_id": 1}):
        await notify_user(r["user_id"], "live_cancelled", "Live cancelado", f"{live['host_name']} canceló «{live['title']}»", {"live_id": live_id}, "/lives")
    await db.live_reminders.delete_many({"live_id": live_id})
    return {"cancelled": True}


@router.post("/api/lives/{live_id}/go-live")
async def go_live_from_schedule(live_id: str, background: BackgroundTasks, current_user: dict = Depends(get_current_user_from_token)):
    """Convierte un live programado en live real (misma sala Daily que create_live) y avisa a quienes pidieron recordatorio."""
    live = await _live_or_404(live_id, status="scheduled")
    if live["host_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Solo el anfitrión")
    if await db.lives.find_one({"host_id": current_user["id"], "status": "live"}):
        raise HTTPException(status_code=400, detail="Ya tienes un live activo")
    room_name = f"bruno-live-{live_id[:13]}"
    exp = int(time.time()) + 6 * 3600
    room = await _daily("POST", "/rooms", {"name": room_name, "privacy": "private", "properties": {"exp": exp, "max_participants": LIVE_MAX_PARTICIPANTS, "eject_at_room_exp": True, "enable_chat": False, "enable_knocking": False, "enable_screenshare": False, "enable_recording": "cloud"}})
    host_token = await _daily_token(room_name, current_user, True, exp)
    now = datetime.now(timezone.utc)
    await db.lives.update_one({"id": live_id}, {"$set": {"status": "live", "started_at": now.isoformat(), "room_name": room_name, "room_url": room.get("url"), "room_exp": exp}})
    active_lives[live_id] = {"host_id": current_user["id"], "viewers": [], "started_at": now}

    async def _notify():
        async for r in db.live_reminders.find({"live_id": live_id}, {"_id": 0, "user_id": 1}):
            await notify_user(r["user_id"], "live_started", "¡Empezó el live!", f"{live['host_name']} está en vivo: «{live['title']}»", {"live_id": live_id}, f"/lives/{live_id}")
    background.add_task(_notify)
    fresh = await db.lives.find_one({"id": live_id}, {"_id": 0})
    return {**fresh, "is_host": True, "rtc": {"url": room.get("url"), "token": host_token}}


@router.post("/api/cron/live-reminders")
async def cron_live_reminders(request: Request, background: BackgroundTasks):
    """Cron (cada 5 min): avisa 10 min antes a quienes tocaron «Avisarme»."""
    async def _run():
        now = time.time()
        window_end = datetime.fromtimestamp(now + 11 * 60, tz=timezone.utc).isoformat()
        async for live in db.lives.find({"status": "scheduled", "scheduled_at": {"$lte": window_end, "$gt": datetime.fromtimestamp(now - 5 * 60, tz=timezone.utc).isoformat()}}, {"_id": 0}):
            async for r in db.live_reminders.find({"live_id": live["id"], "notified_pre": {"$ne": True}}, {"_id": 1, "user_id": 1}):
                await notify_user(r["user_id"], "live_reminder", "Tu live empieza pronto", f"«{live['title']}» de {live['host_name']} empieza en unos minutos", {"live_id": live["id"]}, "/lives")
                await db.live_reminders.update_one({"_id": r["_id"]}, {"$set": {"notified_pre": True}})
    background.add_task(_run)
    return {"ok": True}


# ─── Grabación (Daily cloud recording) · repetición · resumen ───────────────
class ReplayPublished(BaseModel):
    post_id: str


async def _host_live(live_id: str, user_id: str, require_live: bool = False) -> dict:
    live = await db.lives.find_one({"id": live_id}, {"_id": 0})
    if not live:
        raise HTTPException(status_code=404, detail="Live not found")
    if live["host_id"] != user_id:
        raise HTTPException(status_code=403, detail="Solo el anfitrión puede hacer esto")
    if require_live and live.get("status") != "live":
        raise HTTPException(status_code=400, detail="El live ya terminó")
    return live


@router.post("/api/lives/{live_id}/recording/start")
async def recording_start(live_id: str, current_user: dict = Depends(get_current_user_from_token)):
    live = await _host_live(live_id, current_user["id"], require_live=True)
    rec = live.get("recording") or {}
    if rec.get("status") == "recording":
        return rec
    try:
        r = await _daily("POST", f"/rooms/{live['room_name']}/recordings/start", {"layout": {"preset": "default"}})
    except HTTPException as e:
        detail = str(e.detail)
        low = detail.lower()
        if "hosting a call" in low:
            raise HTTPException(status_code=409, detail="La grabación empieza cuando tu cámara ya está en vivo. Espera a ver «En vivo» en verde e inténtalo de nuevo.")
        if "recording" in low or "plan" in low or "payment" in low or "billing" in low:
            raise HTTPException(status_code=402, detail="La grabación en la nube requiere activar facturación en la cuenta de Daily.co (plan de pago). El live sigue en vivo sin grabar.")
        raise
    rec = {"status": "recording", "id": r.get("recordingId") or r.get("id"), "started_at": datetime.now(timezone.utc).isoformat(), "segments": int(rec.get("segments") or 0) + 1}
    await db.lives.update_one({"id": live_id}, {"$set": {"recording": rec}})
    await _broadcast(live_id, {"type": "recording", "status": "recording"})
    return rec


@router.post("/api/lives/{live_id}/recording/stop")
async def recording_stop(live_id: str, current_user: dict = Depends(get_current_user_from_token)):
    live = await _host_live(live_id, current_user["id"], require_live=True)
    rec = live.get("recording") or {}
    if rec.get("status") != "recording":
        return rec or {"status": "none"}
    try:
        await _daily("POST", f"/rooms/{live['room_name']}/recordings/stop")
    except HTTPException:
        pass
    rec["status"] = "stopped"
    rec["stopped_at"] = datetime.now(timezone.utc).isoformat()
    await db.lives.update_one({"id": live_id}, {"$set": {"recording": rec}})
    await _broadcast(live_id, {"type": "recording", "status": "stopped"})
    return rec


def _import_replay_to_cloudinary(live_id: str, draft_id: str, download_link: str):
    """Background: copy the Daily recording into our Cloudinary so the draft never expires."""
    import cloudinary.uploader
    from pymongo import MongoClient
    client = MongoClient(os.environ["MONGO_URL"])
    sdb = client[os.environ["DB_NAME"]]
    try:
        up = cloudinary.uploader.upload(download_link, resource_type="video", folder="bruno/live-replays",
                                        eager=[{"format": "mp4", "video_codec": "h264", "width": 1080, "height": 1920, "crop": "limit"}], eager_async=True)
        url = up.get("secure_url")
        poster = url.rsplit(".", 1)[0] + ".jpg" if url else None
        sdb.post_drafts.update_one({"id": draft_id}, {"$set": {"media_url": url, "poster_url": poster, "media_meta": {"url": url, "poster_url": poster, "public_id": up.get("public_id"), "duration": up.get("duration")}, "expires_at": None}})
        sdb.lives.update_one({"id": live_id}, {"$set": {"recording.status": "ready", "recording.media_url": url}})
    except Exception as e:  # keep the external (expiring) link, be honest about it
        sdb.lives.update_one({"id": live_id}, {"$set": {"recording.status": "ready_external", "recording.import_error": str(e)[:200]}})
    finally:
        client.close()


@router.get("/api/lives/{live_id}/recording")
async def recording_status(live_id: str, background: BackgroundTasks, current_user: dict = Depends(get_current_user_from_token)):
    live = await _host_live(live_id, current_user["id"])
    rec = live.get("recording") or {"status": "none"}
    if rec.get("draft_id"):
        draft = await db.post_drafts.find_one({"id": rec["draft_id"]}, {"_id": 0})
        return {**rec, "draft": draft}
    if rec.get("status") in ("processing", "stopped") and rec.get("id") and live.get("status") == "ended":
        try:
            info = await _daily("GET", f"/recordings/{rec['id']}")
        except HTTPException:
            info = {}
        if info.get("status") == "finished":
            link = await _daily("GET", f"/recordings/{rec['id']}/access-link?valid_for_secs=43200")
            download = link.get("download_link")
            now = datetime.now(timezone.utc)
            draft = {"id": str(uuid.uuid4()), "user_id": current_user["id"], "media_url": download, "media_type": "video",
                     "media_meta": {"url": download, "duration": info.get("duration")}, "caption": f"Repetición del live · {live.get('title', '')}".strip(),
                     "trim_start": None, "trim_end": None, "cover_at": None, "poster_url": None, "live_id": live_id, "source": "live_replay",
                     "expires_at": (datetime.fromtimestamp(now.timestamp() + 43200, tz=timezone.utc)).isoformat(), "updated_at": now.isoformat()}
            await db.post_drafts.insert_one(dict(draft))
            rec = {**rec, "status": "importing", "draft_id": draft["id"], "duration": info.get("duration"), "finished_at": now.isoformat()}
            await db.lives.update_one({"id": live_id}, {"$set": {"recording": rec}})
            background.add_task(_import_replay_to_cloudinary, live_id, draft["id"], download)
            return {**rec, "draft": draft}
        if info.get("status"):
            rec = {**rec, "daily_status": info["status"]}
    return rec


@router.post("/api/lives/{live_id}/replay-published")
async def replay_published(live_id: str, body: ReplayPublished, background: BackgroundTasks, current_user: dict = Depends(get_current_user_from_token)):
    """Host published the replay as a video → notify everyone who was in the live."""
    live = await _host_live(live_id, current_user["id"])
    if (live.get("recording") or {}).get("replay_post_id"):
        return {"notified": 0, "already": True}
    ids = [u for u in set((live.get("participant_ids") or []) + (live.get("guest_history") or [])) if u != current_user["id"]]
    await db.lives.update_one({"id": live_id}, {"$set": {"recording.replay_post_id": body.post_id, "replay_post_id": body.post_id}})
    title = live.get("title", "live")
    msg = f"{current_user.get('name', 'El anfitrión')} publicó la repetición del live «{title}»"
    now = datetime.now(timezone.utc).isoformat()
    try:
        from utils.notification_realtime import emit_notification_ws
    except Exception:
        emit_notification_ws = None
    for uid in ids:
        doc = {"id": str(uuid.uuid4()), "user_id": uid, "actor_id": current_user["id"], "type": "live_replay", "target_id": body.post_id, "target_type": "post",
               "message": msg, "content": msg, "is_read": False, "created_at": now}
        await db.notifications.insert_one(dict(doc))
        if emit_notification_ws:
            try:
                await emit_notification_ws(doc)
            except Exception:
                pass
        background.add_task(notify_user, uid, "live_replay", "Repetición disponible", msg, {"post_id": body.post_id}, f"/reels?id={body.post_id}")
    return {"notified": len(ids)}


@router.get("/api/lives/{live_id}/summary")
async def live_summary(live_id: str, current_user: dict = Depends(get_current_user_from_token)):
    live = await _host_live(live_id, current_user["id"])
    questions = await db.live_questions.count_documents({"live_id": live_id})
    answered = await db.live_questions.count_documents({"live_id": live_id, "answered": True})
    polls = await db.live_polls.find({"live_id": live_id}, {"_id": 0, "options": 1}).to_list(50)
    poll_votes = sum(int(o.get("votes") or 0) for p in polls for o in (p.get("options") or []))
    duration = live.get("duration_seconds") or 0
    if live.get("status") == "live" and live.get("started_at"):
        duration = int((datetime.now(timezone.utc) - datetime.fromisoformat(live["started_at"].replace("Z", "+00:00"))).total_seconds())
    return {
        "id": live_id, "title": live.get("title"), "status": live.get("status"), "started_at": live.get("started_at"), "ended_at": live.get("ended_at"),
        "duration_seconds": duration, "peak_viewers": live.get("peak_viewers") or 0, "total_viewers": live.get("total_viewers") or len(live.get("participant_ids") or []),
        "comments": live.get("comments_count") or 0, "hearts": live.get("hearts_count") or 0, "gifts": live.get("total_gifts") or 0, "gift_value": live.get("total_gift_value") or 0,
        "questions": questions, "questions_answered": answered, "polls": len(polls), "poll_votes": poll_votes,
        "guests": len(set(live.get("guest_history") or [])), "recording": live.get("recording") or {"status": "none"}, "replay_post_id": live.get("replay_post_id"),
    }
