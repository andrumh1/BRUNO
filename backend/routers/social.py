"""
Social Router - Modern social networking features for BRUNO
Includes: Suggested Users, Hashtags & Trending, Bookmarks, Reactions, Reposts, Explore
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import re

router = APIRouter()

# ==================== MODELS ====================

class ReactionCreate(BaseModel):
    reaction_type: str = "like"  # like, love, fire, laugh, wow, sad

class RepostCreate(BaseModel):
    quote: str = ""

class PollCreate(BaseModel):
    question: str
    options: List[str]
    duration_hours: int = 24

class PollVote(BaseModel):
    option_index: int

# ==================== DEPENDENCY IMPORTS ====================
# These are imported from server.py at mount time via app.state

def get_db():
    from server import db
    return db

def get_deps():
    from server import get_current_user, get_current_user_optional, User
    return get_current_user, get_current_user_optional, User

# ==================== SUGGESTED USERS ====================

@router.get("/api/social/suggested-users")
async def get_suggested_users(limit: int = 10):
    """Get suggested users based on popularity"""
    db = get_db()
    get_current_user, _, User = get_deps()
    
    # Get users with most followers
    pipeline = [
        {"$group": {"_id": "$following_id", "followers_count": {"$sum": 1}}},
        {"$sort": {"followers_count": -1}},
        {"$limit": limit * 3}  # Get more to filter
    ]
    
    top_users_cursor = db.follows.aggregate(pipeline)
    top_user_ids = []
    async for doc in top_users_cursor:
        if doc["_id"]:
            top_user_ids.append(doc["_id"])
    
    # If not enough from follows, get recent active users
    if len(top_user_ids) < limit:
        recent_users = await db.users.find(
            {"is_active": True},
            {"_id": 0, "id": 1}
        ).sort("created_at", -1).limit(limit * 2).to_list(limit * 2)
        for u in recent_users:
            if u["id"] not in top_user_ids:
                top_user_ids.append(u["id"])
    
    # Build user profiles
    result = []
    for uid in top_user_ids[:limit]:
        user = await db.users.find_one({"id": uid}, {"_id": 0, "hashed_password": 0})
        if not user:
            continue
        profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
        followers_count = await db.follows.count_documents({"following_id": uid})
        posts_count = await db.posts.count_documents({"user_id": uid, "is_deleted": {"$ne": True}})
        
        result.append({
            "id": uid,
            "name": user.get("name"),
            "username": user.get("name", user.get("email", "").split("@")[0]),
            "avatar_url": profile.get("avatar_url") if profile else None,
            "bio": profile.get("bio", "") if profile else "",
            "is_verified": profile.get("is_verified", False) if profile else False,
            "followers_count": followers_count,
            "posts_count": posts_count
        })
    
    return result

@router.get("/api/social/suggested-for-user")
async def get_personalized_suggestions(limit: int = 8):
    """Get personalized user suggestions based on mutual follows and activity"""
    db = get_db()
    get_current_user, _, User = get_deps()
    
    # For now return popular users - can be enhanced with ML later
    return await get_suggested_users(limit)

# ==================== HASHTAGS & TRENDING ====================

@router.get("/api/social/trending")
async def get_trending(limit: int = 10):
    """Get trending hashtags from recent posts"""
    db = get_db()
    
    # Get posts from last 7 days
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}, "hashtags": {"$exists": True, "$ne": []}}},
        {"$unwind": "$hashtags"},
        {"$group": {"_id": {"$toLower": "$hashtags"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ]
    
    trending = []
    async for doc in db.posts.aggregate(pipeline):
        trending.append({
            "hashtag": doc["_id"],
            "count": doc["count"]
        })
    
    # If no hashtags, return popular generic ones
    if not trending:
        trending = [
            {"hashtag": "bruno", "count": 0},
            {"hashtag": "networking", "count": 0},
            {"hashtag": "business", "count": 0},
            {"hashtag": "emprendimiento", "count": 0},
            {"hashtag": "tecnologia", "count": 0},
        ]
    
    return trending

@router.get("/api/social/hashtag/{tag}")
async def get_posts_by_hashtag(tag: str, skip: int = 0, limit: int = 20):
    """Get posts with a specific hashtag"""
    db = get_db()
    
    posts = await db.posts.find(
        {"hashtags": {"$regex": f"^{tag}$", "$options": "i"}, "is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user info
    for post in posts:
        user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = {
            "id": user["id"] if user else None,
            "username": user.get("name", "Unknown") if user else "Unknown",
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": profile.get("display_name") if profile else None,
        }
    
    return posts

# ==================== BOOKMARKS ====================

@router.post("/api/social/bookmarks/{post_id}")
async def toggle_bookmark(post_id: str):
    """Toggle bookmark on a post"""
    db = get_db()
    get_current_user, _, User = get_deps()
    
    # We need to get user from token - simplified approach
    # The actual auth will be handled by the main app's dependency
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"message": "Use /api/posts/{post_id}/bookmark instead"}

@router.post("/api/posts/{post_id}/bookmark")
async def toggle_post_bookmark(post_id: str):
    """Placeholder - actual implementation in server.py with auth"""
    return {"message": "Endpoint available via main router"}

# ==================== REACTIONS ====================

@router.get("/api/social/reactions/{post_id}")
async def get_post_reactions(post_id: str):
    """Get reaction counts for a post"""
    db = get_db()
    
    pipeline = [
        {"$match": {"target_id": post_id, "target_type": "post"}},
        {"$group": {"_id": "$reaction_type", "count": {"$sum": 1}}},
    ]
    
    result = {}
    async for doc in db.reactions.aggregate(pipeline):
        result[doc["_id"]] = doc["count"]
    
    return result

# ==================== EXPLORE / DISCOVER ====================

@router.get("/api/social/explore")
async def explore_content(skip: int = 0, limit: int = 20, category: str = "all"):
    """Discover content - posts, users, hashtags"""
    db = get_db()
    
    # Get trending posts (most liked in last 7 days)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    query = {"is_deleted": {"$ne": True}, "visibility": "public"}
    if category == "media":
        query["media"] = {"$exists": True, "$ne": []}
    elif category == "cards":
        query["post_type"] = "card_share"
    
    posts = await db.posts.find(
        query, {"_id": 0}
    ).sort("likes_count", -1).skip(skip).limit(limit).to_list(limit)
    
    for post in posts:
        user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = {
            "id": user["id"] if user else None,
            "username": user.get("name", "Unknown") if user else "Unknown",
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": profile.get("display_name") if profile else None,
        }
    
    return posts

# ==================== POLLS ====================

@router.get("/api/social/polls/{poll_id}")
async def get_poll(poll_id: str):
    """Get poll details and results"""
    db = get_db()
    poll = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    return poll
