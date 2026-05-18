"""
Social Router - Social interactions for BRUNO
Follow/Block, Bookmarks, Reactions, Reposts, Suggested, Trending, Polls, Explore
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from jose import jwt
import uuid
import os
from utils.notification_realtime import emit_notification_ws

router = APIRouter(prefix="/api", tags=["social"])
security = HTTPBearer()

db = None

def set_db(database):
    global db
    db = database


# ==================== AUTH HELPERS ====================

SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production-123456789')
ALGORITHM = "HS256"

async def _get_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT token"""
    credentials_exception = HTTPException(status_code=401, detail="Could not validate credentials")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise credentials_exception
        user = await db.users.find_one({"email": email}, {"_id": 0})
        if not user:
            # Try session token
            session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
            if session:
                user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
        if not user:
            raise credentials_exception
        return user
    except Exception:
        # Try session token fallback
        session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if session:
            expires_at = session.get("expires_at", "")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) <= expires_at:
                user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
                if user:
                    return user
        raise credentials_exception

async def _get_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))):
    """Optional auth - returns None if not authenticated"""
    if not credentials:
        return None
    try:
        return await _get_user(credentials)
    except HTTPException:
        return None


# ==================== MODELS ====================

class PollCreate(BaseModel):
    question: str
    options: List[str]
    duration_hours: int = 24

class PollVote(BaseModel):
    option_index: int


# ==================== FOLLOW / UNFOLLOW ====================

@router.post("/users/{user_id}/follow")
async def toggle_follow(user_id: str, current_user: dict = Depends(_get_user)):
    """Follow or unfollow a user"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    existing = await db.follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    })

    if existing:
        await db.follows.delete_one({"_id": existing["_id"]})
        await db.user_profiles.update_one({"user_id": current_user["id"]}, {"$inc": {"following_count": -1}})
        await db.user_profiles.update_one({"user_id": user_id}, {"$inc": {"followers_count": -1}})
        return {"following": False}
    else:
        follow_doc = {
            "id": str(uuid.uuid4()),
            "follower_id": current_user["id"],
            "following_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.follows.insert_one(follow_doc)
        await db.user_profiles.update_one({"user_id": current_user["id"]}, {"$inc": {"following_count": 1}}, upsert=True)
        await db.user_profiles.update_one({"user_id": user_id}, {"$inc": {"followers_count": 1}}, upsert=True)

        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "actor_id": current_user["id"],
            "type": "follow",
            "message": f"{current_user.get('name', 'Alguien')} comenzo a seguirte",
            "from_user_id": current_user["id"],
            "target_id": current_user["id"],
            "target_type": "user",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        await emit_notification_ws(notification)

        try:
            from routers.push_notifications import notify_new_follower
            await notify_new_follower(user_id, current_user.get("name", "Alguien"))
        except Exception:
            pass

        return {"following": True}


# Legacy route for backward compat
@router.post("/profile/{user_id}/follow")
async def toggle_follow_legacy(user_id: str, current_user: dict = Depends(_get_user)):
    return await toggle_follow(user_id, current_user)


# ==================== BLOCK / UNBLOCK ====================

@router.post("/users/{user_id}/block")
async def toggle_block(user_id: str, current_user: dict = Depends(_get_user)):
    """Block or unblock a user"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot block yourself")

    existing = await db.blocks.find_one({"blocker_id": current_user["id"], "blocked_id": user_id})

    if existing:
        await db.blocks.delete_one({"_id": existing["_id"]})
        return {"blocked": False}
    else:
        block_doc = {
            "id": str(uuid.uuid4()),
            "blocker_id": current_user["id"],
            "blocked_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.blocks.insert_one(block_doc)
        await db.follows.delete_many({"follower_id": current_user["id"], "following_id": user_id})
        await db.follows.delete_many({"follower_id": user_id, "following_id": current_user["id"]})
        return {"blocked": True}


# ==================== FOLLOWERS / FOLLOWING LISTS ====================

@router.get("/users/{user_id}/followers")
async def get_followers(user_id: str, skip: int = 0, limit: int = 50):
    """Get list of followers for a user"""
    follows = await db.follows.find(
        {"following_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    result = []
    for f in follows:
        u = await db.users.find_one({"id": f["follower_id"]}, {"_id": 0, "hashed_password": 0})
        p = await db.user_profiles.find_one({"user_id": f["follower_id"]}, {"_id": 0})
        if u:
            result.append({
                "id": u["id"],
                "name": u.get("name"),
                "avatar_url": p.get("avatar_url") if p else None,
                "bio": p.get("bio") if p else None,
                "followed_at": f.get("created_at")
            })
    return result

@router.get("/users/{user_id}/following")
async def get_following(user_id: str, skip: int = 0, limit: int = 50):
    """Get list of users that a user follows"""
    follows = await db.follows.find(
        {"follower_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    result = []
    for f in follows:
        u = await db.users.find_one({"id": f["following_id"]}, {"_id": 0, "hashed_password": 0})
        p = await db.user_profiles.find_one({"user_id": f["following_id"]}, {"_id": 0})
        if u:
            result.append({
                "id": u["id"],
                "name": u.get("name"),
                "avatar_url": p.get("avatar_url") if p else None,
                "bio": p.get("bio") if p else None,
                "followed_at": f.get("created_at")
            })
    return result

@router.get("/users/me/blocked")
async def get_blocked_users(current_user: dict = Depends(_get_user)):
    """Get list of blocked users"""
    blocks = await db.blocks.find(
        {"blocker_id": current_user["id"]}, {"_id": 0}
    ).to_list(100)

    result = []
    for b in blocks:
        u = await db.users.find_one({"id": b["blocked_id"]}, {"_id": 0, "hashed_password": 0})
        p = await db.user_profiles.find_one({"user_id": b["blocked_id"]}, {"_id": 0})
        if u:
            result.append({
                "id": u["id"],
                "name": u.get("name"),
                "avatar_url": p.get("avatar_url") if p else None,
                "blocked_at": b.get("created_at")
            })
    return result


# ==================== BOOKMARKS ====================

@router.post("/posts/{post_id}/bookmark")
async def toggle_bookmark(post_id: str, current_user: dict = Depends(_get_user)):
    """Toggle bookmark/save a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = await db.bookmarks.find_one({"user_id": current_user["id"], "post_id": post_id})
    if existing:
        await db.bookmarks.delete_one({"_id": existing["_id"]})
        return {"bookmarked": False}
    else:
        bookmark = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "post_id": post_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.bookmarks.insert_one(bookmark)
        return {"bookmarked": True}

@router.get("/posts/saved/list")
async def get_saved_posts(skip: int = 0, limit: int = 20, current_user: dict = Depends(_get_user)):
    """Get user's saved/bookmarked posts"""
    bookmarks = await db.bookmarks.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    posts = []
    for bm in bookmarks:
        post = await db.posts.find_one({"id": bm["post_id"]}, {"_id": 0})
        if not post:
            continue
        user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = {
            "id": user["id"] if user else None,
            "username": user.get("name", "Unknown") if user else "Unknown",
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": profile.get("display_name") if profile else None,
        }
        post["is_liked"] = bool(await db.likes.find_one({"user_id": current_user["id"], "target_id": post["id"], "target_type": "post"}))
        post["is_bookmarked"] = True
        posts.append(post)

    return posts


# ==================== REACTIONS (Multi-emoji) ====================

@router.post("/posts/{post_id}/react")
async def toggle_reaction(post_id: str, reaction_type: str = "like", current_user: dict = Depends(_get_user)):
    """Add/remove reaction to a post (like, love, fire, laugh, wow, sad)"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    valid_types = ["like", "love", "fire", "laugh", "wow", "sad"]
    if reaction_type not in valid_types:
        reaction_type = "like"

    existing = await db.reactions.find_one({
        "user_id": current_user["id"],
        "target_id": post_id,
        "target_type": "post"
    })

    if existing:
        if existing.get("reaction_type") == reaction_type:
            await db.reactions.delete_one({"_id": existing["_id"]})
            await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": -1}})
            return {"reacted": False, "reaction_type": None}
        else:
            await db.reactions.update_one(
                {"_id": existing["_id"]},
                {"$set": {"reaction_type": reaction_type}}
            )
            return {"reacted": True, "reaction_type": reaction_type}
    else:
        reaction = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "target_id": post_id,
            "target_type": "post",
            "reaction_type": reaction_type,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.reactions.insert_one(reaction)
        await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": 1}})
        return {"reacted": True, "reaction_type": reaction_type}

@router.get("/posts/{post_id}/reactions")
async def get_reactions(post_id: str):
    """Get reaction summary for a post"""
    pipeline = [
        {"$match": {"target_id": post_id, "target_type": "post"}},
        {"$group": {"_id": "$reaction_type", "count": {"$sum": 1}}},
    ]
    result = {"total": 0, "types": {}}
    async for doc in db.reactions.aggregate(pipeline):
        result["types"][doc["_id"]] = doc["count"]
        result["total"] += doc["count"]
    return result


# ==================== REPOST / SHARE ====================

@router.post("/posts/{post_id}/repost")
async def repost(post_id: str, quote: str = "", current_user: dict = Depends(_get_user)):
    """Repost/share a post with optional quote"""
    original = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Post not found")

    repost_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "content": quote,
        "post_type": "repost",
        "original_post_id": post_id,
        "original_user_id": original["user_id"],
        "media": original.get("media", []),
        "visibility": "public",
        "likes_count": 0,
        "comments_count": 0,
        "shares_count": 0,
        "hashtags": [],
        "mentions": [],
        "is_pinned": False,
        "is_edited": False,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.posts.insert_one(repost_doc)
    await db.posts.update_one({"id": post_id}, {"$inc": {"shares_count": 1}})

    if original["user_id"] != current_user["id"]:
        notif = {
            "id": str(uuid.uuid4()),
            "user_id": original["user_id"],
            "actor_id": current_user["id"],
            "type": "repost",
            "target_id": post_id,
            "target_type": "post",
            "message": f"{current_user.get('name', 'Alguien')} compartio tu publicacion",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notif)
        await emit_notification_ws(notif)

    repost_doc.pop("_id", None)
    return repost_doc


# ==================== SUGGESTED USERS ====================

@router.get("/social/suggested")
async def get_suggested_users_auth(limit: int = 8, current_user: dict = Depends(_get_user)):
    """Get personalized suggested users"""
    my_follows = await db.follows.find(
        {"follower_id": current_user["id"]}, {"_id": 0, "following_id": 1}
    ).to_list(500)
    followed_ids = {f["following_id"] for f in my_follows}
    followed_ids.add(current_user["id"])

    # Strategy 1: Mutual follows (friends of friends)
    mutual_candidates = set()
    for fid in list(followed_ids)[:20]:
        their_follows = await db.follows.find(
            {"follower_id": fid}, {"_id": 0, "following_id": 1}
        ).limit(20).to_list(20)
        for tf in their_follows:
            if tf["following_id"] not in followed_ids:
                mutual_candidates.add(tf["following_id"])

    # Strategy 2: Popular users
    popular = []
    pipeline = [
        {"$group": {"_id": "$following_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit * 3}
    ]
    async for doc in db.follows.aggregate(pipeline):
        if doc["_id"] and doc["_id"] not in followed_ids:
            popular.append(doc["_id"])

    # Strategy 3: Recent active users
    recent = await db.users.find(
        {"id": {"$nin": list(followed_ids)}, "is_active": True},
        {"_id": 0, "id": 1}
    ).sort("created_at", -1).limit(limit * 2).to_list(limit * 2)
    recent_ids = [u["id"] for u in recent]

    # Combine and deduplicate
    combined = list(mutual_candidates)[:limit // 2] + popular[:limit // 2] + recent_ids
    seen = set()
    unique = []
    for uid in combined:
        if uid not in seen and uid not in followed_ids:
            seen.add(uid)
            unique.append(uid)

    result = []
    for uid in unique[:limit]:
        user = await db.users.find_one({"id": uid}, {"_id": 0, "hashed_password": 0})
        if not user:
            continue
        profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
        fc = await db.follows.count_documents({"following_id": uid})
        mc = 0
        for fid in list(followed_ids)[:20]:
            if await db.follows.find_one({"follower_id": fid, "following_id": uid}):
                mc += 1

        result.append({
            "id": uid,
            "name": user.get("name"),
            "username": user.get("name", user.get("email", "").split("@")[0]),
            "avatar_url": profile.get("avatar_url") if profile else None,
            "bio": profile.get("bio", "") if profile else "",
            "is_verified": profile.get("is_verified", False) if profile else False,
            "followers_count": fc,
            "mutual_count": mc,
        })

    return result


# ==================== TRENDING & HASHTAGS ====================

@router.get("/social/trending")
async def get_trending_tags(limit: int = 10):
    """Get trending hashtags"""
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
        trending.append({"hashtag": doc["_id"], "count": doc["count"]})

    if not trending:
        trending = [
            {"hashtag": "bruno", "count": 0},
            {"hashtag": "networking", "count": 0},
            {"hashtag": "business", "count": 0},
            {"hashtag": "emprendimiento", "count": 0},
            {"hashtag": "tecnologia", "count": 0},
        ]
    return trending

@router.get("/social/hashtag/{tag}")
async def get_posts_by_tag(tag: str, skip: int = 0, limit: int = 20, current_user: dict = Depends(_get_user_optional)):
    """Get posts by hashtag"""
    posts = await db.posts.find(
        {"hashtags": {"$regex": f"^{tag}$", "$options": "i"}, "is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    for post in posts:
        user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = {
            "id": user["id"] if user else None,
            "username": user.get("name", "Unknown") if user else "Unknown",
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": profile.get("display_name") if profile else None,
        }
        if current_user:
            like = await db.likes.find_one({"user_id": current_user["id"], "target_id": post["id"], "target_type": "post"})
            post["is_liked"] = like is not None
            bm = await db.bookmarks.find_one({"user_id": current_user["id"], "post_id": post["id"]})
            post["is_bookmarked"] = bm is not None
        else:
            post["is_liked"] = False
            post["is_bookmarked"] = False

    return posts


# ==================== EXPLORE / DISCOVER ====================

@router.get("/social/explore")
async def explore_feed(
    skip: int = 0, limit: int = 20, category: str = "trending",
    current_user: dict = Depends(_get_user_optional)
):
    """Explore/discover content"""
    query = {"is_deleted": {"$ne": True}, "visibility": "public"}
    sort_field = "likes_count"

    if category == "recent":
        sort_field = "created_at"
    elif category == "media":
        query["media"] = {"$exists": True, "$ne": []}
    elif category == "cards":
        query["post_type"] = "card_share"

    posts = await db.posts.find(query, {"_id": 0}).sort(sort_field, -1).skip(skip).limit(limit).to_list(limit)

    for post in posts:
        user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
        post["user"] = {
            "id": user["id"] if user else None,
            "username": user.get("name", "Unknown") if user else "Unknown",
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": profile.get("display_name") if profile else None,
        }
        if current_user:
            like = await db.likes.find_one({"user_id": current_user["id"], "target_id": post["id"], "target_type": "post"})
            post["is_liked"] = like is not None
            bm = await db.bookmarks.find_one({"user_id": current_user["id"], "post_id": post["id"]})
            post["is_bookmarked"] = bm is not None
        else:
            post["is_liked"] = False
            post["is_bookmarked"] = False

    return posts


# ==================== POLLS ====================

@router.post("/social/polls")
async def create_poll(poll_data: PollCreate, current_user: dict = Depends(_get_user)):
    """Create a poll"""
    poll = {
        "id": str(uuid.uuid4()),
        "creator_id": current_user["id"],
        "question": poll_data.question,
        "options": [{"text": opt, "votes": 0} for opt in poll_data.options],
        "total_votes": 0,
        "voters": [],
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=poll_data.duration_hours)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.polls.insert_one(poll)
    poll.pop("_id", None)
    return poll

@router.post("/social/polls/{poll_id}/vote")
async def vote_poll(poll_id: str, vote: PollVote, current_user: dict = Depends(_get_user)):
    """Vote on a poll"""
    poll = await db.polls.find_one({"id": poll_id})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    if current_user["id"] in poll.get("voters", []):
        raise HTTPException(status_code=400, detail="Already voted")
    if vote.option_index < 0 or vote.option_index >= len(poll["options"]):
        raise HTTPException(status_code=400, detail="Invalid option")

    await db.polls.update_one(
        {"id": poll_id},
        {
            "$inc": {f"options.{vote.option_index}.votes": 1, "total_votes": 1},
            "$push": {"voters": current_user["id"]}
        }
    )

    updated = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    return updated

@router.get("/social/polls/{poll_id}")
async def get_poll(poll_id: str):
    """Get poll details"""
    poll = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    return poll
