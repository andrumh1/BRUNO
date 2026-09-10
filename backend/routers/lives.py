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
import uuid
import secrets
import string

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
    if not token:
        return None
    import jwt
    try:
        payload = jwt.decode(token, os.environ.get("SECRET_KEY", "super-secret-key"), algorithms=["HS256"])
        email = payload.get("sub")
        user_id = payload.get("user_id")
        if user_id:
            return await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0, "hashed_password": 0})
        if email:
            return await db.users.find_one({"email": email}, {"_id": 0, "password": 0, "hashed_password": 0})
    except Exception:
        return None
    return None


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

    live_id = str(uuid.uuid4())
    live_doc = {
        "id": live_id,
        "host_id": current_user["id"],
        "host_name": current_user.get("name", "Usuario"),
        "host_avatar": current_user.get("avatar_url"),
        "host_tier": current_user.get("subscription_tier", "free"),
        "title": request.title,
        "description": request.description,
        "category": request.category,
        "is_private": request.is_private,
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

    return {**live_doc, "stream_key": f"bruno_live_{live_id}", "rtc_config": {"iceServers": ICE_SERVERS}}


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
    return live or {}


@router.get("/api/lives/by-code/{code}")
async def resolve_live_by_code(code: str):
    live = await db.lives.find_one({"access_code": code.strip().upper(), "status": "live"}, {"_id": 0, "id": 1, "title": 1, "host_name": 1})
    if not live:
        raise HTTPException(status_code=404, detail="Código inválido o live finalizado")
    return live


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
    await _broadcast(live_id, {"type": "live_ended", "live_id": live_id})
    live_connections.pop(live_id, None)

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
    if live.get("is_private") and not is_host:
        code = ((body.access_code if body else None) or "").strip().upper()
        if not code or code != live.get("access_code"):
            raise HTTPException(status_code=403, detail="Código de acceso incorrecto")

    if not is_host:
        await db.lives.update_one(
            {"id": live_id},
            {"$inc": {"viewer_count": 1, "total_viewers": 1}, "$max": {"peak_viewers": live["viewer_count"] + 1}},
        )
        if live_id in active_lives and current_user["id"] not in active_lives[live_id]["viewers"]:
            active_lives[live_id]["viewers"].append(current_user["id"])

    return {"success": True, "live": _public(live, current_user["id"]), "is_host": is_host, "rtc_config": {"iceServers": ICE_SERVERS}}


@router.post("/api/lives/{live_id}/leave")
async def leave_live(live_id: str, current_user: dict = Depends(get_current_user_from_token)):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    await db.lives.update_one({"id": live_id, "viewer_count": {"$gt": 0}}, {"$inc": {"viewer_count": -1}})
    if live_id in active_lives and current_user["id"] in active_lives[live_id]["viewers"]:
        active_lives[live_id]["viewers"].remove(current_user["id"])
    return {"success": True}


@router.post("/api/lives/{live_id}/comment")
async def post_comment(live_id: str, comment: LiveComment, current_user: dict = Depends(get_current_user_from_token)):
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    live = await db.lives.find_one({"id": live_id, "status": "live"})
    if not live:
        raise HTTPException(status_code=404, detail="Live not found or ended")
    if not live["allow_comments"]:
        raise HTTPException(status_code=403, detail="Comments disabled")

    comment_doc = {
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
        "rtc_config": {"iceServers": ICE_SERVERS},
    })
    if not is_host:
        await _broadcast(live_id, {"type": "viewer_joined", "viewer": viewer, "viewer_count": max(0, len(conns) - (1 if live["host_id"] in conns else 0))}, exclude=user["id"])
    else:
        await _broadcast(live_id, {"type": "host_online"}, exclude=user["id"])

    try:
        while True:
            data = await websocket.receive_json()
            t = data.get("type")
            if t in ("offer", "answer", "ice"):
                target = conns.get(data.get("to"))
                if target:
                    try:
                        await target.send_json({**data, "from": user["id"]})
                    except Exception:
                        pass
            elif t == "ping":
                await websocket.send_json({"type": "pong"})
            elif t == "heart":
                await db.lives.update_one({"id": live_id}, {"$inc": {"hearts_count": 1}})
                await _broadcast(live_id, {"type": "heart", "user_id": user["id"]})
            elif t == "request_stream" and not is_host:
                host_ws = conns.get(live["host_id"])
                if host_ws:
                    await host_ws.send_json({"type": "viewer_joined", "viewer": viewer, "viewer_count": max(0, len(conns) - 1)})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if conns.get(user["id"]) is not websocket:
            return  # superseded by a newer socket of the same user — keep the live one registered
        conns.pop(user["id"], None)
        if not is_host:
            await db.lives.update_one({"id": live_id, "viewer_count": {"$gt": 0}}, {"$inc": {"viewer_count": -1}})
            await _broadcast(live_id, {"type": "viewer_left", "viewer_id": user["id"], "viewer_count": max(0, len(conns) - (1 if live["host_id"] in conns else 0))})
        else:
            await _broadcast(live_id, {"type": "host_offline"})
