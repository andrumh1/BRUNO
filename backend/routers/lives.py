"""
Lives Router - TikTok-style live streaming functionality
Uses WebSockets for real-time communication and WebRTC for video streaming
"""

from fastapi import APIRouter, HTTPException, Depends, Header, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import uuid
import json

router = APIRouter(tags=["lives"])

# Database connection will be passed from server.py
db = None

def set_db(database):
    global db
    db = database

# Active lives storage (in production, use Redis)
active_lives = {}  # {live_id: {host_id, viewers: [], data, started_at}}
live_connections = {}  # {live_id: [websocket connections]}

# Models
class CreateLiveRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    category: Optional[str] = "general"
    is_private: bool = False
    allow_comments: bool = True
    allow_gifts: bool = True

class LiveComment(BaseModel):
    text: str

class LiveGift(BaseModel):
    gift_type: str  # 'rose', 'heart', 'star', 'diamond', 'rocket', 'crown'
    amount: int = 1

# Helper to get current user from token
async def get_current_user_from_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    
    import jwt
    try:
        payload = jwt.decode(token, os.environ.get("SECRET_KEY", "super-secret-key"), algorithms=["HS256"])
        email = payload.get("sub")
        user_id = payload.get("user_id")
        
        if user_id:
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        elif email:
            user = await db.users.find_one({"email": email}, {"_id": 0, "password": 0})
        else:
            raise HTTPException(status_code=401, detail="Invalid token format")
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Gift values (for monetization)
GIFT_VALUES = {
    "rose": 1,
    "heart": 5,
    "star": 10,
    "diamond": 50,
    "rocket": 100,
    "crown": 500
}

# ============================================
# LIVE STREAM MANAGEMENT
# ============================================

@router.post("/api/lives")
async def create_live(
    request: CreateLiveRequest,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Start a new live stream"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Check if user already has an active live
    existing_live = await db.lives.find_one({
        "host_id": current_user["id"],
        "status": "live"
    })
    if existing_live:
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
        "allow_comments": request.allow_comments,
        "allow_gifts": request.allow_gifts,
        "status": "live",
        "viewer_count": 0,
        "peak_viewers": 0,
        "total_viewers": 0,
        "total_gifts": 0,
        "total_gift_value": 0,
        "comments_count": 0,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
        "duration_seconds": 0,
        "thumbnail_url": None
    }
    
    await db.lives.insert_one(live_doc)
    
    # Initialize in-memory storage
    active_lives[live_id] = {
        "host_id": current_user["id"],
        "viewers": [],
        "data": live_doc,
        "started_at": datetime.now(timezone.utc)
    }
    live_connections[live_id] = []
    
    return {
        "id": live_id,
        "stream_key": f"bruno_live_{live_id}",
        "rtc_config": {
            "iceServers": [
                {"urls": "stun:stun.l.google.com:19302"},
                {"urls": "stun:stun1.l.google.com:19302"}
            ]
        },
        **live_doc
    }

@router.get("/api/lives")
async def get_active_lives(
    category: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    """Get list of active live streams"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    query = {"status": "live", "is_private": False}
    if category:
        query["category"] = category
    
    lives = await db.lives.find(
        query,
        {"_id": 0}
    ).sort("viewer_count", -1).skip(offset).limit(limit).to_list(limit)
    
    return lives

# Categories - MUST be before /{live_id} route
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
    {"id": "technology", "name": "Tecnología", "icon": "cpu"}
]

@router.get("/api/lives/categories")
async def get_live_categories():
    """Get available live categories"""
    return LIVE_CATEGORIES

@router.get("/api/lives/following")
async def get_following_lives(
    current_user: dict = Depends(get_current_user_from_token)
):
    """Get live streams from users the current user follows"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get following list
    following = await db.follows.find(
        {"follower_id": current_user["id"]},
        {"following_id": 1}
    ).to_list(1000)
    
    following_ids = [f["following_id"] for f in following]
    
    lives = await db.lives.find(
        {"host_id": {"$in": following_ids}, "status": "live"},
        {"_id": 0}
    ).sort("started_at", -1).to_list(50)
    
    return lives

@router.get("/api/lives/{live_id}")
async def get_live_details(live_id: str):
    """Get details of a specific live stream"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    live = await db.lives.find_one({"id": live_id}, {"_id": 0})
    if not live:
        raise HTTPException(status_code=404, detail="Live not found")
    
    return live

@router.post("/api/lives/{live_id}/end")
async def end_live(
    live_id: str,
    current_user: dict = Depends(get_current_user_from_token)
):
    """End a live stream"""
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
        {"$set": {
            "status": "ended",
            "ended_at": ended_at.isoformat(),
            "duration_seconds": duration
        }}
    )
    
    # Clean up in-memory storage
    if live_id in active_lives:
        del active_lives[live_id]
    if live_id in live_connections:
        # Notify all viewers
        for ws in live_connections[live_id]:
            try:
                await ws.send_json({"type": "live_ended", "live_id": live_id})
            except:
                pass
        del live_connections[live_id]
    
    # Award points to host
    if duration >= 60:  # Minimum 1 minute
        points = min(duration // 60, 100)  # 1 point per minute, max 100
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"points": points}}
        )
    
    return {"success": True, "duration_seconds": duration}

@router.post("/api/lives/{live_id}/join")
async def join_live(
    live_id: str,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Join a live stream as viewer"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    live = await db.lives.find_one({"id": live_id, "status": "live"})
    if not live:
        raise HTTPException(status_code=404, detail="Live not found or ended")
    
    # Increment viewer count
    await db.lives.update_one(
        {"id": live_id},
        {
            "$inc": {"viewer_count": 1, "total_viewers": 1},
            "$max": {"peak_viewers": live["viewer_count"] + 1}
        }
    )
    
    # Add viewer to in-memory list
    if live_id in active_lives:
        if current_user["id"] not in active_lives[live_id]["viewers"]:
            active_lives[live_id]["viewers"].append(current_user["id"])
    
    return {
        "success": True,
        "live": live,
        "rtc_config": {
            "iceServers": [
                {"urls": "stun:stun.l.google.com:19302"},
                {"urls": "stun:stun1.l.google.com:19302"}
            ]
        }
    }

@router.post("/api/lives/{live_id}/leave")
async def leave_live(
    live_id: str,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Leave a live stream"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Decrement viewer count
    await db.lives.update_one(
        {"id": live_id, "viewer_count": {"$gt": 0}},
        {"$inc": {"viewer_count": -1}}
    )
    
    # Remove viewer from in-memory list
    if live_id in active_lives:
        if current_user["id"] in active_lives[live_id]["viewers"]:
            active_lives[live_id]["viewers"].remove(current_user["id"])
    
    return {"success": True}

@router.post("/api/lives/{live_id}/comment")
async def post_comment(
    live_id: str,
    comment: LiveComment,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Post a comment on a live stream"""
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
        "text": comment.text[:200],  # Limit comment length
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.live_comments.insert_one(comment_doc)
    await db.lives.update_one({"id": live_id}, {"$inc": {"comments_count": 1}})
    
    # Broadcast to all viewers
    if live_id in live_connections:
        message = {
            "type": "new_comment",
            "comment": {k: v for k, v in comment_doc.items() if k != "_id"}
        }
        for ws in live_connections[live_id]:
            try:
                await ws.send_json(message)
            except:
                pass
    
    return {k: v for k, v in comment_doc.items() if k != "_id"}

@router.post("/api/lives/{live_id}/gift")
async def send_gift(
    live_id: str,
    gift: LiveGift,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Send a gift to a live streamer"""
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
    
    # Check if user has enough points
    user = await db.users.find_one({"id": current_user["id"]})
    if user.get("points", 0) < gift_value:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    # Deduct points from sender
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"points": -gift_value}}
    )
    
    # Award points to host (70% of value)
    host_reward = int(gift_value * 0.7)
    await db.users.update_one(
        {"id": live["host_id"]},
        {"$inc": {"points": host_reward}}
    )
    
    # Record gift
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.live_gifts.insert_one(gift_doc)
    await db.lives.update_one(
        {"id": live_id},
        {"$inc": {"total_gifts": gift.amount, "total_gift_value": gift_value}}
    )
    
    # Broadcast to all viewers
    if live_id in live_connections:
        message = {
            "type": "new_gift",
            "gift": {k: v for k, v in gift_doc.items() if k != "_id"}
        }
        for ws in live_connections[live_id]:
            try:
                await ws.send_json(message)
            except:
                pass
    
    return {k: v for k, v in gift_doc.items() if k != "_id"}

@router.get("/api/lives/{live_id}/comments")
async def get_live_comments(
    live_id: str,
    limit: int = 50,
    offset: int = 0
):
    """Get comments for a live stream"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    comments = await db.live_comments.find(
        {"live_id": live_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    return list(reversed(comments))  # Return in chronological order

# ============================================
# LIVE CATEGORIES
# ============================================

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
    {"id": "technology", "name": "Tecnología", "icon": "cpu"}
]

@router.get("/api/lives/categories")
async def get_live_categories():
    """Get available live categories"""
    return LIVE_CATEGORIES

# ============================================
# WEBSOCKET FOR REAL-TIME LIVE EVENTS
# ============================================

async def verify_token_from_header(token: str):
    """Verify JWT token and return user"""
    if not token:
        return None
    
    import jwt
    try:
        payload = jwt.decode(token, os.environ.get("SECRET_KEY", "super-secret-key"), algorithms=["HS256"])
        email = payload.get("sub")
        user_id = payload.get("user_id")
        
        if user_id:
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        elif email:
            user = await db.users.find_one({"email": email}, {"_id": 0, "password": 0})
        else:
            return None
        
        return user
    except:
        return None
