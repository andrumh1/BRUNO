"""
Card Analytics Router - Premium feature for tracking card views and engagement
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from datetime import datetime, timezone, timedelta
from jose import jwt
import uuid
import os

router = APIRouter(prefix="/api/analytics", tags=["card-analytics"])
security = HTTPBearer()

db = None
SECRET_KEY = os.environ.get("SECRET_KEY", "bruno-secret-key-2025-change-in-production")

def set_db(database):
    global db
    db = database

async def _get_user_from_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Decode JWT and return user"""
    secret = os.environ.get("SECRET_KEY", "bruno-secret-key-2025-change-in-production")
    try:
        payload = jwt.decode(credentials.credentials, secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            # Try by email (sub might be email)
            user = await db.users.find_one({"email": user_id}, {"_id": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token")

@router.post("/cards/{card_id}/view")
async def track_card_view(card_id: str, request: Request, source_url: Optional[str] = None):
    """Track a card view - can be called without auth (public cards)"""
    viewer_id = None
    try:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            secret = os.environ.get("SECRET_KEY", "bruno-secret-key-2025-change-in-production")
            payload = jwt.decode(token, secret, algorithms=["HS256"])
            viewer_id = payload.get("sub")
    except Exception:
        pass

    card = await db.cards.find_one({"id": card_id}, {"_id": 0, "user_id": 1})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    user_agent = request.headers.get("User-Agent", "")
    referer = source_url or request.headers.get("Referer", "")
    
    device = "desktop"
    ua_lower = user_agent.lower()
    if "mobile" in ua_lower or "iphone" in ua_lower or "android" in ua_lower:
        device = "mobile"
    elif "tablet" in ua_lower or "ipad" in ua_lower:
        device = "tablet"

    view_event = {
        "id": str(uuid.uuid4()),
        "card_id": card_id,
        "card_owner_id": card.get("user_id"),
        "viewer_id": viewer_id,
        "source_url": referer,
        "user_agent": user_agent,
        "device": device,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.card_analytics.insert_one(view_event)
    await db.cards.update_one({"id": card_id}, {"$inc": {"views_count": 1}})
    
    return {"status": "tracked"}

@router.get("/cards/{card_id}")
async def get_card_analytics(card_id: str, days: int = 30, current_user: dict = Depends(_get_user_from_token)):
    """Get analytics for a specific card - owner only"""
    card = await db.cards.find_one({"id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    if card.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your card")

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    views = await db.card_analytics.find(
        {"card_id": card_id, "created_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    total_views = len(views)
    unique_viewers = len(set(v.get("viewer_id") for v in views if v.get("viewer_id")))
    
    daily_views = {}
    for v in views:
        day = v["created_at"][:10]
        daily_views[day] = daily_views.get(day, 0) + 1
    
    device_breakdown = {}
    for v in views:
        d = v.get("device", "unknown")
        device_breakdown[d] = device_breakdown.get(d, 0) + 1
    
    source_breakdown = {}
    for v in views:
        src = v.get("source_url", "direct") or "direct"
        if src != "direct":
            try:
                from urllib.parse import urlparse
                domain = urlparse(src).netloc or src
                source_breakdown[domain] = source_breakdown.get(domain, 0) + 1
            except Exception:
                source_breakdown[src] = source_breakdown.get(src, 0) + 1
        else:
            source_breakdown["direct"] = source_breakdown.get("direct", 0) + 1
    
    recent_viewers = []
    seen_ids = set()
    for v in views[:50]:
        vid = v.get("viewer_id")
        if vid and vid not in seen_ids and vid != current_user["id"]:
            seen_ids.add(vid)
            viewer = await db.users.find_one({"id": vid}, {"_id": 0, "hashed_password": 0})
            profile = await db.user_profiles.find_one({"user_id": vid}, {"_id": 0})
            if viewer:
                recent_viewers.append({
                    "id": vid,
                    "username": viewer.get("name", ""),
                    "display_name": profile.get("display_name") if profile else viewer.get("name", ""),
                    "avatar_url": profile.get("avatar_url") if profile else None,
                    "viewed_at": v["created_at"],
                    "device": v.get("device", "unknown")
                })
            if len(recent_viewers) >= 20:
                break
    
    return {
        "card_id": card_id,
        "card_title": card.get("title", ""),
        "period_days": days,
        "total_views": total_views,
        "unique_viewers": unique_viewers,
        "views_count": card.get("views_count", 0),
        "daily_views": [{"date": k, "views": v} for k, v in sorted(daily_views.items())],
        "device_breakdown": [{"device": k, "count": v} for k, v in device_breakdown.items()],
        "source_breakdown": [{"source": k, "count": v} for k, v in sorted(source_breakdown.items(), key=lambda x: -x[1])],
        "recent_viewers": recent_viewers
    }

@router.get("/overview")
async def get_analytics_overview(current_user: dict = Depends(_get_user_from_token)):
    """Get analytics overview for all user's cards"""
    cards = await db.cards.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(50)

    card_ids = [c["id"] for c in cards]
    
    if not card_ids:
        return {
            "total_views": 0,
            "total_unique_visitors": 0,
            "cards": [],
            "daily_views": [],
            "recent_activity": []
        }

    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    views = await db.card_analytics.find(
        {"card_id": {"$in": card_ids}, "created_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)

    total_views = len(views)
    unique_visitors = len(set(v.get("viewer_id") for v in views if v.get("viewer_id")))

    card_stats = {}
    for v in views:
        cid = v["card_id"]
        if cid not in card_stats:
            card_stats[cid] = {"views": 0, "unique": set()}
        card_stats[cid]["views"] += 1
        if v.get("viewer_id"):
            card_stats[cid]["unique"].add(v["viewer_id"])

    cards_data = []
    for c in cards:
        stats = card_stats.get(c["id"], {"views": 0, "unique": set()})
        cards_data.append({
            "id": c["id"],
            "title": c.get("title", "Sin titulo"),
            "type": c.get("type", "personal"),
            "views_30d": stats["views"],
            "unique_visitors_30d": len(stats["unique"]),
            "total_views": c.get("views_count", 0)
        })
    
    cards_data.sort(key=lambda x: -x["views_30d"])

    daily = {}
    for v in views:
        day = v["created_at"][:10]
        daily[day] = daily.get(day, 0) + 1

    return {
        "total_views": total_views,
        "total_unique_visitors": unique_visitors,
        "cards": cards_data,
        "daily_views": [{"date": k, "views": v} for k, v in sorted(daily.items())],
        "recent_activity": views[:10]
    }
