"""Posts, Feed, Chat, Users, Notifications, and Settings routes.
Extracted from server.py to reduce monolith size.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
import os
import hmac
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import re
import logging
import re as re_module

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user, get_current_user_optional
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["posts-feed-social"])


# ─── Models ──────────────────────────────────────────────────────────────────

class SocialLink(BaseModel):
    platform: str
    url: str
    label: Optional[str] = None

class PostMedia(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: str = "image"
    url: str
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = None
    # Video-specific extras — set by /api/upload/image|chat-file for videos
    mp4_url: Optional[str] = None
    f_auto_url: Optional[str] = None
    poster_url: Optional[str] = None
    original_url: Optional[str] = None

class Post(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    content: str = ""
    media: List[PostMedia] = []
    card_id: Optional[str] = None
    post_type: str = "text"
    visibility: str = "public"
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    is_pinned: bool = False
    is_edited: bool = False
    hashtags: List[str] = []
    mentions: List[str] = []
    remix: Optional[dict] = None       # {type: duet|stitch, source_post_id, source_user_id, source_username, source_start, source_end}
    remix_count: int = 0
    audio: Optional[dict] = None       # {source_post_id, name, url, author_username}  ("Usar este sonido")
    sound_uses: int = 0
    text_style: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PostCreate(BaseModel):
    content: str = ""
    media: List[dict] = []
    card_id: Optional[str] = None
    post_type: str = "text"
    visibility: str = "public"
    hashtags: List[str] = []
    remix: Optional[dict] = None
    audio: Optional[dict] = None
    text_style: Optional[dict] = None  # {bg, font} for text-only posts
    scheduled_at: Optional[str] = None  # ISO datetime → post stays hidden until then

class Like(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    target_id: str
    target_type: str = "post"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Comment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    post_id: str
    parent_id: Optional[str] = None
    content: str
    likes_count: int = 0
    replies_count: int = 0
    is_edited: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[str] = None

class Follow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    follower_id: str
    following_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    profession: Optional[str] = None
    company: Optional[str] = None
    is_verified: bool = False
    is_private: bool = False
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    social_links: List[SocialLink] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    profession: Optional[str] = None
    company: Optional[str] = None
    is_private: Optional[bool] = None
    social_links: Optional[List[dict]] = None

class ChatRoom(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = "direct"
    name: Optional[str] = None
    participants: List[str] = []
    last_message_id: Optional[str] = None
    last_message_at: Optional[datetime] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageAttachment(BaseModel):
    type: str = "image"
    url: Optional[str] = None
    filename: Optional[str] = None
    size: Optional[int] = None
    duration: Optional[int] = None
    sticker_id: Optional[str] = None
    emoji: Optional[str] = None
    is_emoji: Optional[bool] = False
    card_id: Optional[str] = None
    card_title: Optional[str] = None
    card_subtitle: Optional[str] = None
    card_type: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    # shared reel / post
    post_id: Optional[str] = None
    poster_url: Optional[str] = None
    caption: Optional[str] = None
    author_name: Optional[str] = None
    kind: Optional[str] = None

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    chat_id: str
    sender_id: str
    content: str = ""
    message_type: str = "text"
    attachments: List[MessageAttachment] = []
    reply_to_id: Optional[str] = None
    is_read: bool = False
    read_by: List[str] = []
    is_edited: bool = False
    is_deleted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    content: str = ""
    message_type: str = "text"
    attachments: List[dict] = []
    reply_to_id: Optional[str] = None
    mentions: List[str] = []  # user ids @mentioned (break through mutes)
    forwarded: bool = False
    forwarded_from: Optional[str] = None

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    actor_id: str
    type: str
    target_id: Optional[str] = None
    target_type: Optional[str] = None
    content: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _extract_hashtags(text: str) -> List[str]:
    """Extract hashtags from post content"""
    if not text:
        return []
    return list(set(re_module.findall(r'#(\w+)', text)))

@router.post("/posts")
async def create_post(
    post_data: PostCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new post (optionally a Duet/Stitch remix of another post)"""
    remix = None
    if post_data.remix and post_data.remix.get("source_post_id"):
        rtype = post_data.remix.get("type")
        if rtype not in ("duet", "stitch"):
            raise HTTPException(status_code=400, detail="remix.type must be duet or stitch")
        src = await db.posts.find_one({"id": post_data.remix["source_post_id"]}, {"_id": 0, "id": 1, "user_id": 1})
        if not src:
            raise HTTPException(status_code=404, detail="Source post not found")
        src_user = await db.users.find_one({"id": src["user_id"]}, {"_id": 0, "name": 1, "username": 1})
        remix = {
            "type": rtype,
            "source_post_id": src["id"],
            "source_user_id": src["user_id"],
            "source_username": (src_user or {}).get("username") or (src_user or {}).get("name") or "usuario",
            "source_start": float(post_data.remix.get("source_start") or 0),
            "source_end": float(post_data.remix.get("source_end") or 0),
        }

    audio = None
    if post_data.audio and post_data.audio.get("source_post_id"):
        src_a = await db.posts.find_one({"id": post_data.audio["source_post_id"]}, {"_id": 0, "id": 1, "user_id": 1, "audio": 1, "media": 1})
        if src_a:
            # Chain to the ORIGINAL sound if the source itself reused one
            origin_id = (src_a.get("audio") or {}).get("source_post_id") or src_a["id"]
            a_user = await db.users.find_one({"id": src_a["user_id"]}, {"_id": 0, "name": 1, "username": 1})
            audio = {
                "source_post_id": origin_id,
                "name": post_data.audio.get("name") or f"Sonido original · @{(a_user or {}).get('username') or (a_user or {}).get('name') or 'usuario'}",
                "url": post_data.audio.get("url") or next((m.get("mp4_url") or m.get("url") for m in (src_a.get("media") or []) if (m or {}).get("type") == "video"), None),
                "author_username": (a_user or {}).get("username") or (a_user or {}).get("name"),
            }

    post = Post(
        user_id=current_user.id,
        content=post_data.content,
        media=[PostMedia(**m) for m in post_data.media] if post_data.media else [],
        card_id=post_data.card_id,
        post_type=post_data.post_type,
        visibility=post_data.visibility,
        hashtags=post_data.hashtags or _extract_hashtags(post_data.content),
        remix=remix,
        audio=audio,
        text_style=post_data.text_style if not post_data.media else None,
    )
    
    post_doc = post.model_dump()
    post_doc['created_at'] = post_doc['created_at'].isoformat()
    post_doc['updated_at'] = post_doc['updated_at'].isoformat()

    # Scheduled publishing: hide under visibility="scheduled" until the cron flips it
    if post_data.scheduled_at:
        try:
            when = datetime.fromisoformat(post_data.scheduled_at.replace("Z", "+00:00"))
            if when.tzinfo is None:
                when = when.replace(tzinfo=timezone.utc)
        except Exception:
            raise HTTPException(status_code=400, detail="Fecha de programación inválida")
        if when > datetime.now(timezone.utc):
            post_doc["scheduled_at"] = when.isoformat()
            post_doc["scheduled_visibility"] = post_doc.get("visibility", "public")
            post_doc["visibility"] = "scheduled"
    
    await db.posts.insert_one(post_doc)
    if audio:
        await db.posts.update_one({"id": audio["source_post_id"]}, {"$inc": {"sound_uses": 1}})
    if remix:
        await db.posts.update_one({"id": remix["source_post_id"]}, {"$inc": {"remix_count": 1}})
        if remix["source_user_id"] != current_user.id:
            await _push_notification(
                user_id=remix["source_user_id"], actor_id=current_user.id, ntype="remix",
                target_id=post.id, target_type="post",
                message=f"{current_user.name or 'Alguien'} hizo un {'dúo con' if remix['type'] == 'duet' else 'stitch de'} tu reel",
            )
    
    # Update user's posts count
    await db.user_profiles.update_one(
        {"user_id": current_user.id},
        {"$inc": {"posts_count": 1}},
        upsert=True
    )
    
    # Remove _id before returning (MongoDB adds it)
    post_doc.pop("_id", None)
    
    # Process @mentions
    await _notify_mentions(post_data.content, current_user.id, current_user.name or "Alguien", post_doc["id"], "post")
    
    return post_doc


# ─── Reels feed: algorithmic video recommendations ──────────────────────────

async def _hydrate_video_posts(posts: list, user_id: Optional[str]):
    """Attach author info + per-viewer flags (is_liked / is_bookmarked / is_following)."""
    author_ids = list({p.get("user_id") for p in posts if p.get("user_id")})
    profiles: dict = {}
    if author_ids:
        async for pr in db.user_profiles.find({"user_id": {"$in": author_ids}}, {"_id": 0}):
            profiles[pr["user_id"]] = pr
        async for u in db.users.find({"id": {"$in": author_ids}}, {"_id": 0, "id": 1, "name": 1, "avatar_url": 1, "username": 1}):
            cur = profiles.setdefault(u["id"], {})
            cur.update({"name": u.get("name"), "avatar_url": cur.get("avatar_url") or u.get("avatar_url"), "username": u.get("username")})

    liked: set = set()
    saved: set = set()
    following: set = set()
    if user_id:
        ids = [p.get("id") for p in posts]
        async for lk in db.likes.find({"user_id": user_id, "target_type": "post", "target_id": {"$in": ids}}, {"_id": 0, "target_id": 1}):
            liked.add(lk["target_id"])
        async for bk in db.bookmarks.find({"user_id": user_id, "post_id": {"$in": ids}}, {"_id": 0, "post_id": 1}):
            saved.add(bk["post_id"])
        async for f in db.follows.find({"follower_id": user_id, "following_id": {"$in": author_ids}}, {"_id": 0, "following_id": 1}):
            following.add(f["following_id"])

    for p in posts:
        prof = profiles.get(p.get("user_id"), {})
        p["user"] = {
            "id": p.get("user_id"),
            "name": prof.get("name") or prof.get("display_name") or "Usuario",
            "display_name": prof.get("display_name") or prof.get("name"),
            "avatar_url": prof.get("avatar_url"),
            "username": prof.get("username"),
            "followers_count": prof.get("followers_count", 0),
        }
        p["is_liked"] = p.get("id") in liked
        p["is_bookmarked"] = p.get("id") in saved
        p["is_following"] = p.get("user_id") in following
    return posts


VIDEO_QUERY = {"$or": [{"media.type": "video"}, {"post_type": "video"}, {"video_url": {"$exists": True, "$ne": None}}]}


@router.get("/posts/recommended-videos")
async def get_recommended_videos(
    skip: int = 0,
    limit: int = 30,
    mode: str = "for_you",
    kind: str = "video",
    exclude: Optional[str] = None,
    seed: Optional[int] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Algorithmic video feed for /reels (TikTok-style fair distribution).

    Signals: unseen ×5 · followed ×3 · affinity ×2 · recency · engagement ·
    UNDER-EXPOSED boost (few views) · SMALL-CREATOR boost (few followers) ·
    seeded jitter for diversity · no two consecutive reels from the same author.
    mode=following limits to accounts the viewer follows.
    """
    import random as _random
    user_id = current_user.id if current_user else None
    exclude_ids = set([x for x in (exclude or "").split(",") if x])

    viewed_ids: set = set()
    follow_ids: set = set()
    affinity_authors: set = set()
    hidden_authors: set = set()
    if user_id:
        # "No me interesa" + bloqueos (en ambos sentidos) nunca aparecen en el feed
        async for h in db.hidden_posts.find({"user_id": user_id}, {"_id": 0, "post_id": 1}):
            exclude_ids.add(h["post_id"])
        async for b in db.blocks.find({"$or": [{"blocker_id": user_id}, {"blocked_id": user_id}]}, {"_id": 0, "blocker_id": 1, "blocked_id": 1}):
            hidden_authors.add(b["blocked_id"] if b["blocker_id"] == user_id else b["blocker_id"])
        async for v in db.video_views.find({"user_id": user_id}, {"_id": 0, "post_id": 1}).sort("created_at", -1).limit(500):
            viewed_ids.add(v["post_id"])
        async for f in db.follows.find({"follower_id": user_id}, {"_id": 0, "following_id": 1}):
            follow_ids.add(f["following_id"])
        liked_ids = [lk["target_id"] async for lk in db.likes.find({"user_id": user_id, "target_type": "post"}, {"_id": 0, "target_id": 1}).sort("created_at", -1).limit(100)]
        if liked_ids:
            async for p in db.posts.find({"id": {"$in": liked_ids}}, {"_id": 0, "user_id": 1}):
                if p.get("user_id"): affinity_authors.add(p["user_id"])

    base_q = {"visibility": "public"} if kind == "all" else {"visibility": "public", **VIDEO_QUERY}
    # Reels are short-form: long videos (≥ 3 min, HLS) stay in the feed/profile/long-video player, not in the vertical swipe feed.
    base_q["media.duration"] = {"$not": {"$gte": 180}}
    if mode == "following":
        if not follow_ids:
            return []
        base_q["user_id"] = {"$in": list(follow_ids)}

    if hidden_authors:
        base_q["user_id"] = {**(base_q.get("user_id") or {}), "$nin": list(hidden_authors)}

    pool: list = []
    async for p in db.posts.find(base_q, {"_id": 0}).sort("created_at", -1).limit(600):
        if p.get("id") not in exclude_ids:
            pool.append(p)

    if not pool and mode != "following":
        async for p in db.posts.find({"visibility": "public", "media": {"$ne": []}, **({"user_id": {"$nin": list(hidden_authors)}} if hidden_authors else {})}, {"_id": 0}).sort("created_at", -1).limit(100):
            if p.get("id") not in exclude_ids: pool.append(p)

    # Follower counts for small-creator boost
    author_ids = list({p.get("user_id") for p in pool if p.get("user_id")})
    followers: dict = {}
    if author_ids:
        async for pr in db.user_profiles.find({"user_id": {"$in": author_ids}}, {"_id": 0, "user_id": 1, "followers_count": 1}):
            followers[pr["user_id"]] = pr.get("followers_count", 0) or 0

    rng = _random.Random(seed if seed is not None else (hash(user_id or "anon") ^ skip))
    now = datetime.now(timezone.utc)

    def score(p):
        s = 1.0
        if kind == "all":
            media_types = {m.get("type") for m in (p.get("media") or []) if isinstance(m, dict)}
            if "video" in media_types or p.get("post_type") == "video": s *= 2.2
            elif media_types: s *= 1.5
        if user_id and p.get("id") not in viewed_ids: s *= 5.0
        if user_id and p.get("user_id") in follow_ids: s *= 3.0
        if user_id and p.get("user_id") in affinity_authors: s *= 2.0
        try:
            created = datetime.fromisoformat((p.get("created_at") or "").replace("Z", "+00:00"))
            age_h = max(1, (now - created).total_seconds() / 3600)
            s *= (1.0 + 24.0 / age_h)
        except Exception:
            pass
        s *= (1.0 + 0.02 * (p.get("likes_count", 0) or 0))
        s *= (1.0 + 0.03 * (p.get("comments_count", 0) or 0))
        # Fair distribution: give under-exposed videos and small creators a real chance
        s *= (1.0 + 3.0 / (1.0 + (p.get("views_count", 0) or 0) / 20.0))
        s *= (1.0 + 1.0 / (1.0 + followers.get(p.get("user_id"), 0) / 50.0))
        s *= rng.uniform(0.85, 1.15)
        return s

    pool.sort(key=score, reverse=True)

    # Author diversity: avoid consecutive reels from the same creator
    ordered: list = []
    deferred: list = []
    last_author = None
    for p in pool:
        if p.get("user_id") == last_author and len(pool) > 3:
            deferred.append(p)
            continue
        ordered.append(p)
        last_author = p.get("user_id")
        if deferred and deferred[0].get("user_id") != last_author:
            d = deferred.pop(0)
            ordered.append(d)
            last_author = d.get("user_id")
    ordered.extend(deferred)

    sliced = ordered[skip: skip + limit]
    return await _hydrate_video_posts(sliced, user_id)


async def _push_notification(user_id: str, actor_id: Optional[str], ntype: str, target_id: str, target_type: str, message: Optional[str] = None):
    """Create (or refresh) a notification like Instagram/TikTok: one row per actor+type+target,
    re-surfaced as unread when it happens again; emitted in realtime over WS."""
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.notifications.find_one({"user_id": user_id, "actor_id": actor_id, "type": ntype, "target_id": target_id}, {"_id": 0})
    if existing:
        await db.notifications.update_one({"id": existing["id"]}, {"$set": {"is_read": False, "read": False, "created_at": now, "message": message or existing.get("message")}})
        doc = {**existing, "is_read": False, "created_at": now, "message": message or existing.get("message")}
    else:
        doc = {"id": str(uuid.uuid4()), "user_id": user_id, "actor_id": actor_id, "type": ntype, "target_id": target_id,
               "target_type": target_type, "message": message, "is_read": False, "created_at": now}
        await db.notifications.insert_one(dict(doc))
    await emit_notification_ws(doc)
    return doc


@router.post("/posts/{post_id}/not-interested")
async def not_interested(post_id: str, current_user: User = Depends(get_current_user)):
    """Oculta la publicación del feed del usuario (persistente). Idempotente."""
    post = await db.posts.find_one({"id": post_id}, {"_id": 0, "id": 1, "user_id": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    await db.hidden_posts.update_one(
        {"user_id": current_user.id, "post_id": post_id},
        {"$set": {"user_id": current_user.id, "post_id": post_id, "author_id": post.get("user_id"), "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    await db.feed_interactions.insert_one({"id": str(uuid.uuid4()), "user_id": current_user.id, "post_id": post_id, "interaction_type": "not_interested", "created_at": datetime.now(timezone.utc).isoformat()})
    return {"hidden": True}


@router.get("/posts/sound/{post_id}")
async def get_posts_by_sound(post_id: str, limit: int = 60, current_user: Optional[User] = Depends(get_current_user_optional)):
    """The original reel + every reel that reused its sound ("Usar este sonido")."""
    origin = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not origin:
        raise HTTPException(status_code=404, detail="Post not found")
    origin_id = (origin.get("audio") or {}).get("source_post_id") or origin["id"]
    if origin_id != origin["id"]:
        origin = await db.posts.find_one({"id": origin_id}, {"_id": 0}) or origin
    uses = [p async for p in db.posts.find({"audio.source_post_id": origin_id, "visibility": "public"}, {"_id": 0}).sort("created_at", -1).limit(limit)]
    items = await _hydrate_video_posts([origin] + [u for u in uses if u["id"] != origin["id"]], current_user.id if current_user else None)
    a_user = items[0]["user"] if items else {}
    return {
        "sound": {
            "source_post_id": origin["id"],
            "name": (origin.get("audio") or {}).get("name") or f"Sonido original · @{a_user.get('username') or a_user.get('name') or 'usuario'}",
            "url": next((m.get("mp4_url") or m.get("url") for m in (origin.get("media") or []) if m.get("type") == "video"), origin.get("video_url")),
            "author": a_user,
            "uses": len(uses),
        },
        "posts": items,
    }


@router.get("/posts/{post_id}/remixes")
async def get_post_remixes(post_id: str, limit: int = 60, current_user: Optional[User] = Depends(get_current_user_optional)):
    """Duets + stitches made from this post."""
    out = [p async for p in db.posts.find({"remix.source_post_id": post_id, "visibility": "public"}, {"_id": 0}).sort("created_at", -1).limit(limit)]
    return await _hydrate_video_posts(out, current_user.id if current_user else None)


async def _publish_due_scheduled_posts():
    now = datetime.now(timezone.utc)
    published = 0
    try:
        from routers.stories import publish_due_scheduled_stories
        await publish_due_scheduled_stories()
    except Exception as e:
        logger.warning("scheduled stories: %s", e)
    async for p in db.posts.find({"visibility": "scheduled", "scheduled_at": {"$lte": now.isoformat()}}, {"_id": 0, "id": 1, "user_id": 1, "content": 1, "scheduled_visibility": 1}):
        await db.posts.update_one({"id": p["id"]}, {"$set": {"visibility": p.get("scheduled_visibility") or "public", "created_at": now.isoformat(), "updated_at": now.isoformat(), "published_at": now.isoformat()}, "$unset": {"scheduled_visibility": ""}})
        published += 1
        # Reminder to the author: in-app notification + push
        notif = Notification(user_id=p["user_id"], actor_id=p["user_id"], type="scheduled_published", target_id=p["id"], target_type="post",
                             content=f"Tu publicación programada ya está en línea: {(p.get('content') or '')[:60]}")
        nd = notif.model_dump(); nd["created_at"] = nd["created_at"].isoformat()
        await db.notifications.insert_one(nd)
        try:
            await emit_notification_ws(nd)
            from routers.push_notifications import send_push_notification, NotificationPayload
            await send_push_notification(p["user_id"], NotificationPayload(title="Publicación en línea", body="Tu publicación programada ya se publicó", url=f"/reels?id={p['id']}"))
        except Exception as e:
            logger.warning(f"scheduled reminder failed: {e}")
    if published:
        logger.info(f"Scheduled posts published: {published}")
    return published


@router.post("/cron/publish-scheduled")
async def cron_publish_scheduled(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET")
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else ""
    if not secret or not token or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    background.add_task(_publish_due_scheduled_posts)
    return {"accepted": True, "run_id": request.headers.get("x-webhook-id")}


@router.get("/posts/scheduled/mine")
async def my_scheduled_posts(current_user: User = Depends(get_current_user)):
    posts = await db.posts.find({"user_id": current_user.id, "visibility": "scheduled"}, {"_id": 0}).sort("scheduled_at", 1).to_list(100)
    return posts


@router.delete("/posts/history/videos")
async def clear_video_history(post_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Clear the whole watch history, or a single post from it."""
    q = {"user_id": current_user.id}
    if post_id:
        q["post_id"] = post_id
    res = await db.video_views.delete_many(q)
    return {"deleted": res.deleted_count}


class PostUpdate(BaseModel):
    content: Optional[str] = None
    text_style: Optional[dict] = None
    visibility: Optional[str] = None


@router.put("/posts/{post_id}")
async def update_post(post_id: str, data: PostUpdate, current_user: User = Depends(get_current_user)):
    """Owner edits caption / text style / visibility."""
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el dueño puede editar")
    upd = {"edited_at": datetime.now(timezone.utc).isoformat()}
    if data.content is not None:
        upd["content"] = data.content.strip()
        upd["hashtags"] = [h[1:] for h in re_module.findall(r"#\w+", data.content)]
    if data.text_style is not None and not post.get("media"):
        upd["text_style"] = data.text_style
    if data.visibility in ("public", "followers", "private"):
        upd["visibility"] = data.visibility
    await db.posts.update_one({"id": post_id}, {"$set": upd})
    return await db.posts.find_one({"id": post_id}, {"_id": 0})


@router.get("/posts/history/videos")
async def get_video_history(
    limit: int = 60,
    current_user: User = Depends(get_current_user),
):
    """Videos the current user has watched, most recent first."""
    views = [v async for v in db.video_views.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).limit(limit)]
    ids = [v["post_id"] for v in views]
    if not ids:
        return []
    posts = {p["id"]: p async for p in db.posts.find({"id": {"$in": ids}}, {"_id": 0})}
    out = []
    for v in views:
        p = posts.get(v["post_id"])
        if p:
            p["watched_at"] = v.get("created_at")
            p["watch_count"] = v.get("watch_count", 1)
            out.append(p)
    return await _hydrate_video_posts(out, current_user.id)


@router.post("/posts/{post_id}/view")
async def track_video_view(
    post_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Record that the current user watched this video. Used by the reels
    algorithm to avoid re-showing the same content and to boost what they
    skip vs. dwell on."""
    if not current_user:
        # Track anonymous globally — increments view counter only
        await db.posts.update_one({"id": post_id}, {"$inc": {"views_count": 1}})
        return {"status": "ok"}
    await db.video_views.update_one(
        {"user_id": current_user.id, "post_id": post_id},
        {"$set": {"created_at": datetime.now(timezone.utc).isoformat()}, "$inc": {"watch_count": 1}},
        upsert=True,
    )
    await db.posts.update_one({"id": post_id}, {"$inc": {"views_count": 1}})
    return {"status": "ok"}

@router.get("/posts")
async def get_posts(
    skip: int = 0,
    limit: int = 20,
    user_id: Optional[str] = None,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get posts feed"""
    query = {"visibility": "public"}
    
    if user_id:
        query["user_id"] = user_id
        # If viewing own posts, show all visibility levels
        if current_user and current_user.id == user_id:
            del query["visibility"]
    
    posts = await db.posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Batch-enrich posts with user info and like/bookmark status
    user_ids = list({post["user_id"] for post in posts})
    post_ids = [post["id"] for post in posts]
    
    users_map = {}
    profiles_map = {}
    if user_ids:
        async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "hashed_password": 0}):
            users_map[u["id"]] = u
        async for p in db.user_profiles.find({"user_id": {"$in": user_ids}}, {"_id": 0}):
            profiles_map[p["user_id"]] = p
    
    liked_set = set()
    bookmarked_set = set()
    if current_user and post_ids:
        async for like in db.likes.find({"user_id": current_user.id, "target_id": {"$in": post_ids}, "target_type": "post"}, {"_id": 0, "target_id": 1}):
            liked_set.add(like["target_id"])
        async for bm in db.bookmarks.find({"user_id": current_user.id, "post_id": {"$in": post_ids}}, {"_id": 0, "post_id": 1}):
            bookmarked_set.add(bm["post_id"])
    
    for post in posts:
        user = users_map.get(post["user_id"])
        profile = profiles_map.get(post["user_id"])
        
        username = "Unknown"
        display_name = None
        if user:
            username = user.get("name") or user.get("email", "Unknown").split("@")[0]
        if profile:
            display_name = profile.get("display_name")
        
        post["user"] = {
            "id": user["id"] if user else None,
            "username": username,
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": display_name or username,
            "is_verified": user.get("is_verified", False) if user else False,
            "subscription_tier": user.get("subscription_tier", "free") if user else "free"
        }
        
        post["is_liked"] = post["id"] in liked_set if current_user else False
        post["is_bookmarked"] = post["id"] in bookmarked_set if current_user else False
    
    return posts


@router.get("/users/me/liked-posts")
async def get_my_liked_posts(
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
):
    """Return all posts the current user has liked, grouped by author.

    Used by the "Me gusta" virtual album under Albums.
    """
    # 1. Find all like rows for this user, newest first
    like_cursor = db.likes.find(
        {"user_id": current_user.id, "target_type": "post"},
        {"_id": 0, "target_id": 1, "created_at": 1},
    ).sort("created_at", -1).skip(skip).limit(limit)
    likes = await like_cursor.to_list(limit)
    if not likes:
        return {"total_likes": 0, "groups": []}

    post_ids = [lk["target_id"] for lk in likes]
    like_order = {pid: i for i, pid in enumerate(post_ids)}

    # 2. Fetch the actual posts (some may have been deleted — skip silently)
    posts = await db.posts.find({"id": {"$in": post_ids}}, {"_id": 0}).to_list(len(post_ids))

    # 3. Enrich with author info
    author_ids = list({p["user_id"] for p in posts})
    users_map: dict = {}
    profiles_map: dict = {}
    if author_ids:
        async for u in db.users.find({"id": {"$in": author_ids}}, {"_id": 0, "hashed_password": 0}):
            users_map[u["id"]] = u
        async for pr in db.user_profiles.find({"user_id": {"$in": author_ids}}, {"_id": 0}):
            profiles_map[pr["user_id"]] = pr

    # 4. Stamp is_liked=True (we already know) and inject author block
    for post in posts:
        u = users_map.get(post["user_id"])
        pr = profiles_map.get(post["user_id"])
        username = (u.get("name") if u else None) or (u.get("email", "Unknown").split("@")[0] if u else "Unknown")
        post["user"] = {
            "id": u["id"] if u else None,
            "username": username,
            "display_name": (pr.get("display_name") if pr else None) or username,
            "avatar_url": pr.get("avatar_url") if pr else None,
            "is_verified": (u.get("is_verified", False) if u else False),
            "subscription_tier": (u.get("subscription_tier", "free") if u else "free"),
        }
        post["is_liked"] = True

    # Preserve like-order (newest like first)
    posts.sort(key=lambda p: like_order.get(p["id"], 999999))

    # 5. Group by author_id, preserve insertion order
    groups_dict: dict = {}
    for post in posts:
        author_id = post["user_id"]
        if author_id not in groups_dict:
            groups_dict[author_id] = {
                "user": post["user"],
                "posts": [],
                "count": 0,
            }
        groups_dict[author_id]["posts"].append(post)
        groups_dict[author_id]["count"] += 1

    return {
        "total_likes": len(posts),
        "groups": list(groups_dict.values()),
    }


@router.get("/users/me/likes-received")
async def get_likes_received(
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 200,
):
    """Return all likes RECEIVED on the current user's own posts, grouped by liker.

    This is the data the user actually wants to see under the "Likes" stat —
    "who liked my stuff", not "what I liked".

    Response shape:
    {
      "total_likes": N,
      "groups": [
        {
          "user": liker_info,
          "posts": [ {id, content, media, liked_at} ],  // posts the liker liked
          "count": int
        }, ...
      ]
    }
    """
    # 1. Find all my posts
    my_post_ids = [
        p["id"] async for p in db.posts.find(
            {"user_id": current_user.id}, {"_id": 0, "id": 1}
        )
    ]
    if not my_post_ids:
        return {"total_likes": 0, "groups": []}

    # 2. Find all like rows for my posts (newest first)
    like_cursor = db.likes.find(
        {"target_id": {"$in": my_post_ids}, "target_type": "post",
         "user_id": {"$ne": current_user.id}},  # exclude self-likes
        {"_id": 0, "user_id": 1, "target_id": 1, "created_at": 1},
    ).sort("created_at", -1).skip(skip).limit(limit)
    likes = await like_cursor.to_list(limit)
    if not likes:
        return {"total_likes": 0, "groups": []}

    # 3. Resolve liker users + the specific posts they liked
    liker_ids = list({lk["user_id"] for lk in likes})
    post_ids_liked = list({lk["target_id"] for lk in likes})

    users_map: dict = {}
    profiles_map: dict = {}
    posts_map: dict = {}
    async for u in db.users.find({"id": {"$in": liker_ids}}, {"_id": 0, "hashed_password": 0}):
        users_map[u["id"]] = u
    async for pr in db.user_profiles.find({"user_id": {"$in": liker_ids}}, {"_id": 0}):
        profiles_map[pr["user_id"]] = pr
    async for p in db.posts.find({"id": {"$in": post_ids_liked}}, {"_id": 0}):
        posts_map[p["id"]] = p

    # 4. Group by liker, preserve newest-first order
    groups_dict: dict = {}
    for lk in likes:
        liker_id = lk["user_id"]
        u = users_map.get(liker_id)
        pr = profiles_map.get(liker_id)
        if not u:
            continue  # liker deleted account
        post = posts_map.get(lk["target_id"])
        if not post:
            continue
        if liker_id not in groups_dict:
            username = u.get("name") or u.get("email", "Unknown").split("@")[0]
            groups_dict[liker_id] = {
                "user": {
                    "id": u["id"],
                    "username": username,
                    "display_name": (pr.get("display_name") if pr else None) or username,
                    "avatar_url": pr.get("avatar_url") if pr else None,
                    "is_verified": u.get("is_verified", False),
                    "subscription_tier": u.get("subscription_tier", "free"),
                },
                "posts": [],
                "count": 0,
            }
        # Attach a minimal post snapshot + liked_at timestamp
        groups_dict[liker_id]["posts"].append({
            "id": post["id"],
            "content": post.get("content", ""),
            "media": post.get("media", []),
            "created_at": post.get("created_at"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "liked_at": lk.get("created_at"),
        })
        groups_dict[liker_id]["count"] += 1

    return {
        "total_likes": sum(g["count"] for g in groups_dict.values()),
        "groups": list(groups_dict.values()),
    }


@router.get("/posts/{post_id}")
async def get_post(post_id: str, current_user: Optional[User] = Depends(get_current_user_optional)):
    """Get a single post"""
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Get user info
    user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0, "hashed_password": 0})
    profile = await db.user_profiles.find_one({"user_id": post["user_id"]}, {"_id": 0})
    post["user"] = {
        "id": user["id"] if user else None,
        "username": user.get("username") if user else "Unknown",
        "avatar_url": profile.get("avatar_url") if profile else None,
        "display_name": profile.get("display_name") if profile else None,
        "is_verified": user.get("is_verified", False) if user else False,
        "subscription_tier": user.get("subscription_tier", "free") if user else "free"
    }
    
    if current_user:
        like = await db.likes.find_one({
            "user_id": current_user.id,
            "target_id": post["id"],
            "target_type": "post"
        })
        post["is_liked"] = like is not None
    else:
        post["is_liked"] = False
    
    return post

@router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: User = Depends(get_current_user)):
    """Delete a post"""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user.id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found or not authorized")
    
    await db.posts.delete_one({"id": post_id})
    await db.likes.delete_many({"target_id": post_id, "target_type": "post"})
    await db.comments.delete_many({"post_id": post_id})
    
    # Update posts count
    await db.user_profiles.update_one(
        {"user_id": current_user.id},
        {"$inc": {"posts_count": -1}}
    )
    
    return {"message": "Post deleted"}

# -------------------- LIKES --------------------

@router.get("/posts/{post_id}/likes")
async def get_post_likers(post_id: str, limit: int = 100, current_user: Optional[User] = Depends(get_current_user_optional)):
    """Users who liked a post (newest first) with is_following for the viewer."""
    likes = await db.likes.find({"target_id": post_id, "target_type": "post"}, {"_id": 0, "user_id": 1, "created_at": 1}).sort("created_at", -1).to_list(limit * 2)
    seen: set = set()
    ordered_ids = []
    for lk in likes:
        if lk["user_id"] not in seen:
            seen.add(lk["user_id"]); ordered_ids.append(lk["user_id"])
    ordered_ids = ordered_ids[:limit]
    if not ordered_ids:
        return {"total": 0, "users": []}
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": ordered_ids}}, {"_id": 0, "id": 1, "name": 1, "username": 1, "avatar_url": 1})}
    profiles = {p["user_id"]: p async for p in db.user_profiles.find({"user_id": {"$in": ordered_ids}}, {"_id": 0, "user_id": 1, "display_name": 1, "avatar_url": 1, "is_verified": 1})}
    following: set = set()
    if current_user:
        following = {f["following_id"] async for f in db.follows.find({"follower_id": current_user.id, "following_id": {"$in": ordered_ids}}, {"_id": 0, "following_id": 1})}
    out = []
    for uid in ordered_ids:
        u, p = users.get(uid, {}), profiles.get(uid, {})
        out.append({"id": uid, "username": u.get("username") or u.get("name"), "display_name": p.get("display_name") or u.get("name"),
                    "avatar_url": p.get("avatar_url") or u.get("avatar_url"), "is_verified": bool(p.get("is_verified")),
                    "is_following": uid in following, "is_me": bool(current_user and uid == current_user.id)})
    return {"total": len(seen), "users": out}


@router.delete("/posts/{post_id}/comments/{comment_id}")
async def delete_comment(post_id: str, comment_id: str, current_user: User = Depends(get_current_user)):
    """Delete a comment: allowed for the comment author or the post owner."""
    comment = await db.comments.find_one({"id": comment_id, "post_id": post_id}, {"_id": 0})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    post = await db.posts.find_one({"id": post_id}, {"_id": 0, "user_id": 1})
    if comment.get("user_id") != current_user.id and (post or {}).get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="No puedes borrar este comentario")
    replies = await db.comments.count_documents({"parent_id": comment_id})
    await db.comments.delete_many({"$or": [{"id": comment_id}, {"parent_id": comment_id}]})
    if comment.get("parent_id"):
        await db.comments.update_one({"id": comment["parent_id"]}, {"$inc": {"replies_count": -1}})
    total = await db.comments.count_documents({"post_id": post_id})
    await db.posts.update_one({"id": post_id}, {"$set": {"comments_count": total}})
    return {"deleted": True, "removed": 1 + replies, "comments_count": total}


@router.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, current_user: User = Depends(get_current_user)):
    """Toggle like on a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    like_q = {"user_id": current_user.id, "target_id": post_id, "target_type": "post"}
    existing_like = await db.likes.find_one(like_q)

    if existing_like:
        # Unlike → remove every like row for this user/post (self-heals duplicates) + retract notification
        await db.likes.delete_many(like_q)
        await db.notifications.delete_many({"user_id": post["user_id"], "actor_id": current_user.id, "type": "like", "target_id": post_id})
        liked = False
    else:
        like = Like(
            user_id=current_user.id,
            target_id=post_id,
            target_type="post"
        )
        like_doc = like.model_dump()
        like_doc['created_at'] = like_doc['created_at'].isoformat()
        await db.likes.insert_one(like_doc)
        liked = True

        # Create notification (if not own post) — deduped per actor/post
        if post["user_id"] != current_user.id:
            await _push_notification(user_id=post["user_id"], actor_id=current_user.id, ntype="like", target_id=post_id, target_type="post")

            # Send push notification
            from routers.push_notifications import notify_new_like
            await notify_new_like(post["user_id"], current_user.name or "Alguien", "publicación")

    # Authoritative count: one like per user, derived from the likes collection (never $inc drift)
    likers = await db.likes.distinct("user_id", {"target_id": post_id, "target_type": "post"})
    likes_count = len(likers)
    await db.posts.update_one({"id": post_id}, {"$set": {"likes_count": likes_count}})
    return {"liked": liked, "likes_count": likes_count}

# -------------------- COMMENTS --------------------

@router.post("/posts/{post_id}/comments")
async def create_comment(
    post_id: str,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a comment on a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = Comment(
        user_id=current_user.id,
        post_id=post_id,
        parent_id=comment_data.parent_id,
        content=comment_data.content
    )
    
    comment_doc = comment.model_dump()
    comment_doc['created_at'] = comment_doc['created_at'].isoformat()
    comment_doc['updated_at'] = comment_doc['updated_at'].isoformat()
    
    await db.comments.insert_one(comment_doc)
    
    # Update post's comment count
    await db.posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    
    # If it's a reply, update parent's replies count
    if comment_data.parent_id:
        await db.comments.update_one({"id": comment_data.parent_id}, {"$inc": {"replies_count": 1}})
    
    # Notifications: post owner (comment) + parent comment author (reply). Target = the comment itself so the app can highlight it.
    preview = comment_data.content[:80]
    notified = {current_user.id}
    if comment_data.parent_id:
        parent = await db.comments.find_one({"id": comment_data.parent_id}, {"_id": 0, "user_id": 1})
        if parent and parent["user_id"] not in notified:
            notified.add(parent["user_id"])
            await _push_notification(user_id=parent["user_id"], actor_id=current_user.id, ntype="reply", target_id=comment.id, target_type="comment",
                                     message=f"{current_user.name or 'Alguien'} respondió a tu comentario: “{preview}”")
    if post["user_id"] not in notified:
        notified.add(post["user_id"])
        await _push_notification(user_id=post["user_id"], actor_id=current_user.id, ntype="comment", target_id=comment.id, target_type="comment",
                                 message=f"{current_user.name or 'Alguien'} comentó tu {'reel' if (post.get('post_type') == 'video' or any((m or {}).get('type') == 'video' for m in (post.get('media') or []))) else 'publicación'}: “{preview}”")
    if post["user_id"] != current_user.id:
        # Send push notification
        from routers.push_notifications import notify_new_comment
        await notify_new_comment(post["user_id"], current_user.name or "Alguien", comment_data.content[:50])
    
    # Get user info for response
    profile = await db.user_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    
    # Remove _id before returning (MongoDB adds it)
    comment_doc.pop("_id", None)
    
    # Determine display name - User model has 'name' not 'username'
    username = current_user.name or current_user.email.split("@")[0]
    display_name = profile.get("display_name") if profile else None
    
    comment_doc["user"] = {
        "id": current_user.id,
        "username": username,
        "avatar_url": profile.get("avatar_url") if profile else None,
        "display_name": display_name or username
    }
    
    # Process @mentions in comment
    await _notify_mentions(comment_data.content, current_user.id, current_user.name or "Alguien", post_id, "comment")
    
    return comment_doc

@router.get("/posts/{post_id}/comments")
async def get_comments(post_id: str, skip: int = 0, limit: int = 50):
    """Get comments for a post"""
    comments = await db.comments.find(
        {"post_id": post_id, "parent_id": None},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user info
    for comment in comments:
        user = await db.users.find_one({"id": comment["user_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": comment["user_id"]}, {"_id": 0})
        
        # Determine display name - User model has 'name' not 'username'
        username = "Unknown"
        display_name = None
        if user:
            username = user.get("name") or user.get("email", "Unknown").split("@")[0]
        if profile:
            display_name = profile.get("display_name")
            
        comment["user"] = {
            "id": user["id"] if user else None,
            "username": username,
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": display_name or username
        }
        
        # Get replies
        if comment["replies_count"] > 0:
            replies = await db.comments.find(
                {"parent_id": comment["id"]},
                {"_id": 0}
            ).sort("created_at", 1).limit(3).to_list(3)
            
            for reply in replies:
                reply_user = await db.users.find_one({"id": reply["user_id"]}, {"_id": 0, "hashed_password": 0})
                reply_profile = await db.user_profiles.find_one({"user_id": reply["user_id"]}, {"_id": 0})
                reply["user"] = {
                    "id": reply_user["id"] if reply_user else None,
                    "username": reply_user.get("username") if reply_user else "Unknown",
                    "avatar_url": reply_profile.get("avatar_url") if reply_profile else None
                }
            
            comment["replies"] = replies
    
    return comments

# -------------------- USER PROFILE --------------------

@router.get("/profile/{user_id}")
async def get_user_profile(user_id: str, current_user: Optional[User] = Depends(get_current_user_optional)):
    """Get a user's profile"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    profile = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    if not profile:
        # Create default profile
        profile = UserProfile(user_id=user_id).model_dump()
        profile['created_at'] = profile['created_at'].isoformat()
        profile['updated_at'] = profile['updated_at'].isoformat()
        await db.user_profiles.insert_one(profile)
    
    # Combine user and profile data
    result = {
        "id": user["id"],
        "username": user.get("username"),
        "email": user.get("email") if current_user and current_user.id == user_id else None,
        **profile
    }
    
    # Check if current user follows this profile
    if current_user and current_user.id != user_id:
        follow = await db.follows.find_one({
            "follower_id": current_user.id,
            "following_id": user_id
        })
        result["is_following"] = follow is not None
    else:
        result["is_following"] = False
    
    # Get user's cards
    cards = await db.cards.find(
        {"user_id": user_id, "is_public": True},
        {"_id": 0}
    ).limit(10).to_list(10)
    result["cards"] = cards
    
    return result

@router.put("/profile")
async def update_user_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update current user's profile"""
    update_data = profile_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if profile_update.social_links is not None:
        update_data["social_links"] = profile_update.social_links
    
    await db.user_profiles.update_one(
        {"user_id": current_user.id},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Profile updated successfully"}

@router.get("/profile")
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Get current user's profile"""
    return await get_user_profile(current_user.id, current_user)

# -------------------- FOLLOW (moved to routers/social.py) --------------------

# -------------------- @MENTION SEARCH --------------------

@router.get("/users/mention-search")
async def mention_search(
    q: str,
    limit: int = 8,
    current_user: User = Depends(get_current_user)
):
    """Quick search for @mention autocomplete (min 1 char)"""
    if len(q) < 1:
        return []
    
    users = await db.users.find({
        "$and": [
            {"id": {"$ne": current_user.id}},
            {"name": {"$regex": f"^{q}", "$options": "i"}}
        ]
    }, {"_id": 0, "hashed_password": 0}).limit(limit).to_list(limit)
    
    result = []
    for u in users:
        profile = await db.user_profiles.find_one({"user_id": u["id"]}, {"_id": 0})
        username = u.get("name") or u.get("email", "Unknown").split("@")[0]
        result.append({
            "id": u["id"],
            "username": username,
            "display_name": profile.get("display_name") if profile else username,
            "avatar_url": profile.get("avatar_url") if profile else None,
        })
    
    return result

# -------------------- @MENTION NOTIFICATION --------------------

async def _notify_mentions(content: str, actor_id: str, actor_name: str, target_id: str, target_type: str):
    """Parse @mentions from content and send notifications"""
    if not content:
        return
    mentions = re_module.findall(r'@(\w+)', content)
    if not mentions:
        return
    
    for mention_name in set(mentions):
        mentioned_user = await db.users.find_one(
            {"name": {"$regex": f"^{mention_name}$", "$options": "i"}},
            {"_id": 0}
        )
        if mentioned_user and mentioned_user["id"] != actor_id:
            notif = {
                "id": str(uuid.uuid4()),
                "user_id": mentioned_user["id"],
                "actor_id": actor_id,
                "type": "mention",
                "target_id": target_id,
                "target_type": target_type,
                "message": f"{actor_name} te mencionó en una publicación",
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notif)
            await emit_notification_ws(notif)
            
            from routers.push_notifications import send_push_notification, NotificationPayload
            await send_push_notification(mentioned_user["id"], NotificationPayload(
                title="Te mencionaron",
                body=f"{actor_name} te mencionó",
                url="/feed",
                tag="mention"
            ))

# -------------------- USER SEARCH --------------------

@router.get("/users/by-username/{username}")
async def user_by_username(username: str):
    """Resuelve @usuario → id (para menciones en reels)."""
    rx = {"$regex": f"^{re.escape(username)}$", "$options": "i"}
    u = await db.users.find_one({"$or": [{"username": rx}, {"name": rx}, {"name": {"$regex": f"^{re.escape(username.replace('_', ' '))}$", "$options": "i"}}]}, {"_id": 0, "id": 1, "username": 1, "name": 1, "avatar_url": 1})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return u


@router.get("/users/search")
async def search_users(
    q: str,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Search users by name or email"""
    if len(q) < 2:
        return []
    
    # Search in users collection
    users = await db.users.find({
        "$and": [
            {"id": {"$ne": current_user.id}},  # Exclude current user
            {"$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"email": {"$regex": q, "$options": "i"}}
            ]}
        ]
    }, {"_id": 0, "hashed_password": 0}).limit(limit).to_list(limit)
    
    # Enrich with profile info
    result = []
    for user in users:
        profile = await db.user_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
        username = user.get("name") or user.get("email", "Unknown").split("@")[0]
        result.append({
            "id": user["id"],
            "username": username,
            "email": user.get("email"),
            "display_name": profile.get("display_name") if profile else username,
            "avatar_url": profile.get("avatar_url") if profile else None,
            "is_verified": profile.get("is_verified", False) if profile else False
        })
    
    return result

# -------------------- USER PROFILE --------------------

@router.get("/users/{user_id}/profile")
async def get_user_public_profile(user_id: str, request: Request = None, current_user: Optional[User] = Depends(get_current_user_optional)):
    """Get public profile of a user"""
    # Get user
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get profile
    profile = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    # Get followers/following counts
    followers_count = await db.follows.count_documents({"following_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})
    
    # Get posts count
    posts_count = await db.posts.count_documents({"user_id": user_id, "is_deleted": False})
    
    username = user.get("name") or user.get("email", "Unknown").split("@")[0]
    
    # Check relationship with current user
    is_following = False
    is_blocked_by_me = False
    is_blocked_by_them = False
    if current_user and current_user.id != user_id:
        follow = await db.follows.find_one({"follower_id": current_user.id, "following_id": user_id})
        is_following = follow is not None
        block = await db.blocks.find_one({"blocker_id": current_user.id, "blocked_id": user_id})
        is_blocked_by_me = block is not None
        block2 = await db.blocks.find_one({"blocker_id": user_id, "blocked_id": current_user.id})
        is_blocked_by_them = block2 is not None
    
    return {
        "id": user_id,
        "name": user.get("name"),
        "email": user.get("email"),
        "username": username,
        "display_name": profile.get("display_name") if profile else username,
        "avatar_url": profile.get("avatar_url") if profile else None,
        "banner_url": profile.get("banner_url") if profile else None,
        "bio": profile.get("bio") if profile else None,
        "location": profile.get("location") if profile else None,
        "website": profile.get("website") if profile else None,
        "is_verified": profile.get("is_verified", False) if profile else False,
        "created_at": user.get("created_at"),
        "followers_count": followers_count,
        "following_count": following_count,
        "posts_count": posts_count,
        "is_following": is_following,
        "is_blocked_by_me": is_blocked_by_me,
        "is_blocked_by_them": is_blocked_by_them
    }

@router.get("/users/{user_id}/posts")
async def get_user_posts(
    user_id: str,
    skip: int = 0,
    limit: int = 500,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get posts from a specific user (owner sees everything incl. private/followers-only)"""
    q = {"user_id": user_id, "is_deleted": {"$ne": True}}
    if not current_user or current_user.id != user_id:
        q["visibility"] = "public"
    posts = await db.posts.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get user info
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    profile = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    username = user.get("name") if user else "Unknown"
    
    # Enrich posts
    post_ids = [p["id"] for p in posts]
    liked_ids: set = set()
    saved_ids: set = set()
    if current_user and post_ids:
        async for lk in db.likes.find({"user_id": current_user.id, "target_type": "post", "target_id": {"$in": post_ids}}, {"_id": 0, "target_id": 1}):
            liked_ids.add(lk["target_id"])
        async for bm in db.bookmarks.find({"user_id": current_user.id, "post_id": {"$in": post_ids}}, {"_id": 0, "post_id": 1}):
            saved_ids.add(bm["post_id"])
    result = []
    for post in posts:
        result.append({
            **post,
            "user": {
                "id": user_id,
                "username": username,
                "display_name": profile.get("display_name") if profile else username,
                "avatar_url": profile.get("avatar_url") if profile else None,
                "is_verified": profile.get("is_verified", False) if profile else False
            },
            "is_liked": post["id"] in liked_ids,
            "is_bookmarked": post["id"] in saved_ids,
        })
    
    return result


# ==================== SOCIAL ENDPOINTS (moved to routers/social.py) ====================
# Follow, Block, Followers/Following, Bookmarks, Reactions, Reposts,
# Suggested Users, Trending, Hashtags, Explore, Polls



# ==================== FOR YOU PERSONALIZED FEED ====================

@router.get("/feed/for-you")
async def get_for_you_feed(
    skip: int = 0, limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Personalized 'For You' feed based on user interactions, follows, and preferences"""
    
    # 1. Collect user's interest signals
    # - Hashtags from posts user has liked/bookmarked/reacted to
    liked_ids = await db.reactions.find(
        {"user_id": current_user.id, "target_type": "post"},
        {"_id": 0, "target_id": 1}
    ).to_list(200)
    liked_post_ids = [lk["target_id"] for lk in liked_ids]
    
    bookmarked = await db.bookmarks.find(
        {"user_id": current_user.id},
        {"_id": 0, "post_id": 1}
    ).to_list(200)
    bookmarked_ids = [b["post_id"] for b in bookmarked]
    
    interacted_ids = set(liked_post_ids + bookmarked_ids)
    
    # 2. Extract preferred hashtags from interacted posts
    preferred_hashtags = []
    if interacted_ids:
        interacted_posts = await db.posts.find(
            {"id": {"$in": list(interacted_ids)}, "hashtags": {"$exists": True, "$ne": []}},
            {"_id": 0, "hashtags": 1}
        ).to_list(200)
        for p in interacted_posts:
            preferred_hashtags.extend(p.get("hashtags", []))
    
    # Count hashtag frequency for weighting
    hashtag_freq = {}
    for h in preferred_hashtags:
        hl = h.lower()
        hashtag_freq[hl] = hashtag_freq.get(hl, 0) + 1
    top_hashtags = sorted(hashtag_freq, key=hashtag_freq.get, reverse=True)[:15]
    
    # 3. Get who user follows
    follows = await db.follows.find(
        {"follower_id": current_user.id}, {"_id": 0, "following_id": 1}
    ).to_list(500)
    followed_ids = {f["following_id"] for f in follows}
    
    # 4. Build candidate posts from multiple sources with scoring
    seen_ids = set()
    scored_posts = []
    
    # Source A: Posts from followed users (high relevance)
    if followed_ids:
        following_posts = await db.posts.find(
            {"user_id": {"$in": list(followed_ids)}, "is_deleted": {"$ne": True}, "visibility": "public"},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit * 2).to_list(limit * 2)
        for p in following_posts:
            if p["id"] not in seen_ids:
                seen_ids.add(p["id"])
                score = 80 + (p.get("likes_count", 0) * 0.5)
                scored_posts.append((score, p))
    
    # Source B: Posts matching preferred hashtags (medium-high relevance)
    if top_hashtags:
        hashtag_posts = await db.posts.find(
            {"hashtags": {"$in": top_hashtags}, "is_deleted": {"$ne": True}, "visibility": "public", "user_id": {"$ne": current_user.id}},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit * 2).to_list(limit * 2)
        for p in hashtag_posts:
            if p["id"] not in seen_ids:
                seen_ids.add(p["id"])
                matching = sum(1 for h in p.get("hashtags", []) if h.lower() in top_hashtags)
                score = 50 + (matching * 15) + (p.get("likes_count", 0) * 0.3)
                scored_posts.append((score, p))
    
    # Source C: Trending/popular posts (medium relevance)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    popular_posts = await db.posts.find(
        {"created_at": {"$gte": week_ago}, "is_deleted": {"$ne": True}, "visibility": "public", "user_id": {"$ne": current_user.id}},
        {"_id": 0}
    ).sort("likes_count", -1).limit(limit * 2).to_list(limit * 2)
    for p in popular_posts:
        if p["id"] not in seen_ids:
            seen_ids.add(p["id"])
            score = 30 + (p.get("likes_count", 0) * 1.5) + (p.get("comments_count", 0) * 2)
            scored_posts.append((score, p))
    
    # Source D: Recent posts from new users (discovery)
    new_posts = await db.posts.find(
        {"is_deleted": {"$ne": True}, "visibility": "public", "user_id": {"$ne": current_user.id}},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    for p in new_posts:
        if p["id"] not in seen_ids:
            seen_ids.add(p["id"])
            score = 10 + (p.get("likes_count", 0) * 0.5)
            scored_posts.append((score, p))
    
    # 5. Sort by score, apply pagination
    scored_posts.sort(key=lambda x: x[0], reverse=True)
    paginated = [p for _, p in scored_posts[skip:skip + limit]]
    
    # 6. Batch-enrich with user info
    user_ids_foru = list({post["user_id"] for post in paginated})
    post_ids_foru = [post["id"] for post in paginated]
    
    users_map_foru = {}
    profiles_map_foru = {}
    if user_ids_foru:
        async for u in db.users.find({"id": {"$in": user_ids_foru}}, {"_id": 0, "hashed_password": 0}):
            users_map_foru[u["id"]] = u
        async for p in db.user_profiles.find({"user_id": {"$in": user_ids_foru}}, {"_id": 0}):
            profiles_map_foru[p["user_id"]] = p
    
    liked_set_foru = set()
    bookmarked_set_foru = set()
    if post_ids_foru:
        async for like in db.reactions.find({"user_id": current_user.id, "target_id": {"$in": post_ids_foru}, "target_type": "post"}, {"_id": 0, "target_id": 1}):
            liked_set_foru.add(like["target_id"])
        async for bm in db.bookmarks.find({"user_id": current_user.id, "post_id": {"$in": post_ids_foru}}, {"_id": 0, "post_id": 1}):
            bookmarked_set_foru.add(bm["post_id"])
    
    for post in paginated:
        user_doc = users_map_foru.get(post["user_id"])
        profile = profiles_map_foru.get(post["user_id"])
        username = "Unknown"
        display_name = None
        if user_doc:
            username = user_doc.get("name") or user_doc.get("email", "Unknown").split("@")[0]
        if profile:
            display_name = profile.get("display_name")
        post["user"] = {
            "id": user_doc["id"] if user_doc else None,
            "username": username,
            "avatar_url": profile.get("avatar_url") if profile else None,
            "display_name": display_name or username,
            "is_verified": user_doc.get("is_verified", False) if user_doc else False,
            "subscription_tier": user_doc.get("subscription_tier", "free") if user_doc else "free"
        }
        post["is_liked"] = post["id"] in liked_set_foru
        post["is_bookmarked"] = post["id"] in bookmarked_set_foru
        post["_for_you_reason"] = (
            "following" if post["user_id"] in followed_ids else
            "hashtag_match" if any(h.lower() in top_hashtags for h in post.get("hashtags", [])) else
            "trending" if post.get("likes_count", 0) > 2 else
            "discover"
        )
    
    return paginated

# ---- Interaction Tracking ----

@router.post("/feed/interaction")
async def track_interaction(
    post_id: str,
    interaction_type: str = "view",
    current_user: User = Depends(get_current_user)
):
    """Track user interaction with content for recommendation improvement"""
    valid_types = ["view", "click", "expand", "share", "dwell"]
    if interaction_type not in valid_types:
        interaction_type = "view"
    
    interaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "post_id": post_id,
        "interaction_type": interaction_type,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.interactions.insert_one(interaction)
    return {"tracked": True}

# ---- User Preferences / Settings ----

@router.get("/settings/preferences")
async def get_preferences(current_user: User = Depends(get_current_user)):
    """Get user preferences"""
    prefs = await db.user_preferences.find_one(
        {"user_id": current_user.id}, {"_id": 0}
    )
    if not prefs:
        prefs = {
            "user_id": current_user.id,
            "feed_mode": "for_you",
            "language": "es",
            "theme": "system",
            "notifications": {
                "likes": True,
                "comments": True,
                "follows": True,
                "messages": True,
                "mentions": True
            },
            "privacy": {
                "show_online_status": True,
                "allow_messages_from": "everyone",
                "show_read_receipts": True,
                "profile_visibility": "public"
            },
            "content": {
                "autoplay_videos": True,
                "show_sensitive_content": False,
                "default_post_visibility": "public"
            }
        }
        await db.user_preferences.insert_one({**prefs})
    
    prefs.pop("_id", None)
    return prefs

@router.put("/settings/preferences")
async def update_preferences(prefs_data: dict, current_user: User = Depends(get_current_user)):
    """Update user preferences"""
    allowed_keys = {"feed_mode", "language", "theme", "notifications", "privacy", "content", "auto_translate", "custom_seal_url"}
    update = {k: v for k, v in prefs_data.items() if k in allowed_keys}
    if "custom_seal_url" in update:
        u = await db.users.find_one({"id": current_user.id}, {"_id": 0, "subscription_tier": 1})
        if update["custom_seal_url"] and (u or {}).get("subscription_tier", "free") == "free":
            raise HTTPException(status_code=403, detail="El sello personalizado es exclusivo de suscriptores Premium")
    
    await db.user_preferences.update_one(
        {"user_id": current_user.id},
        {"$set": update},
        upsert=True
    )
    
    return await get_preferences(current_user)



# -------------------- CHAT / MESSAGING --------------------

@router.get("/chats")
async def get_chats(current_user: User = Depends(get_current_user)):
    """Get all chat rooms for current user"""
    chats = await db.chats.find(
        {"participants": current_user.id},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(100)
    
    # Batch-load every participant once
    all_ids = list({p for c in chats for p in c.get("participants", [])})
    users_map = {u["id"]: u async for u in db.users.find({"id": {"$in": all_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1, "avatar_url": 1})}
    profiles_map = {p["user_id"]: p async for p in db.user_profiles.find({"user_id": {"$in": all_ids}}, {"_id": 0, "user_id": 1, "display_name": 1, "avatar_url": 1})}

    def brief(uid):
        user = users_map.get(uid)
        if not user:
            return None
        profile = profiles_map.get(uid, {})
        username = user.get("name") or user.get("email", "Unknown").split("@")[0]
        return {"id": uid, "username": username, "avatar_url": profile.get("avatar_url") or user.get("avatar_url"), "display_name": profile.get("display_name") or username}

    from utils.chat_mute import active_mutes
    for chat in chats:
        other_ids = [p for p in chat["participants"] if p != current_user.id]
        chat["other_participants"] = [b for b in (brief(uid) for uid in other_ids) if b]
        chat["is_group"] = bool(chat.get("is_group") or chat.get("type") == "group")
        chat["members_count"] = len(chat["participants"])
        mutes = active_mutes(chat)
        chat["is_muted"] = current_user.id in mutes
        chat["muted_until"] = mutes.get(current_user.id)
        chat.pop("mute_until", None)
        
        # Get last message
        if chat.get("last_message_id"):
            last_msg = await db.messages.find_one({"id": chat["last_message_id"]}, {"_id": 0})
            chat["last_message"] = last_msg
        
        # Count unread messages
        unread_count = await db.messages.count_documents({
            "chat_id": chat["id"],
            "sender_id": {"$ne": current_user.id},
            "read_by": {"$nin": [current_user.id]}
        })
        chat["unread_count"] = unread_count
    
    return chats

@router.post("/chats")
async def create_or_get_chat(
    participant_id: str,
    current_user: User = Depends(get_current_user)
):
    """Create a new direct chat or get existing one"""
    if participant_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot chat with yourself")
    if not await db.users.find_one({"id": participant_id}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Check if direct chat already exists
    existing_chat = await db.chats.find_one({
        "type": "direct",
        "participants": {"$all": [current_user.id, participant_id], "$size": 2}
    }, {"_id": 0})
    
    if existing_chat:
        return existing_chat
    
    # Create new chat
    chat = ChatRoom(
        type="direct",
        participants=[current_user.id, participant_id],
        created_by=current_user.id
    )
    
    chat_doc = chat.model_dump()
    chat_doc['created_at'] = chat_doc['created_at'].isoformat()
    chat_doc['updated_at'] = chat_doc['updated_at'].isoformat()
    
    await db.chats.insert_one(chat_doc)
    
    # Remove _id before returning
    chat_doc.pop("_id", None)
    return chat_doc

@router.get("/chats/{chat_id}/messages")
async def get_messages(
    chat_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get messages from a chat"""
    # Verify user is participant
    chat = await db.chats.find_one({
        "id": chat_id,
        "participants": current_user.id
    })
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    messages = await db.messages.find(
        {"chat_id": chat_id, "is_deleted": False},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Mark messages as read
    await db.messages.update_many(
        {
            "chat_id": chat_id,
            "sender_id": {"$ne": current_user.id},
            "read_by": {"$nin": [current_user.id]}
        },
        {"$addToSet": {"read_by": current_user.id}, "$set": {"is_read": True}}
    )
    
    # Enrich with sender info
    for msg in messages:
        user = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": msg["sender_id"]}, {"_id": 0})
        username = "Unknown"
        if user:
            username = user.get("name") or user.get("email", "Unknown").split("@")[0]
        msg["sender"] = {
            "id": msg["sender_id"],
            "username": username,
            "avatar_url": profile.get("avatar_url") if profile else None
        }
    
    return messages[::-1]  # Return in chronological order

class MuteRequest(BaseModel):
    duration: Optional[str] = None  # "1h" | "8h" | "1w" | "forever" | None(=toggle)


@router.post("/chats/{chat_id}/mute")
async def toggle_chat_mute(chat_id: str, data: Optional[MuteRequest] = None, current_user: User = Depends(get_current_user)):
    """Silence only this chat (1h / 8h / 1w / forever, auto-expires). No body → toggle."""
    from utils.chat_mute import active_mutes, MUTE_DURATIONS
    chat = await db.chats.find_one({"id": chat_id, "participants": current_user.id}, {"_id": 0, "id": 1, "muted_by": 1, "mute_until": 1})
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    duration = (data.duration if data else None)
    currently = current_user.id in active_mutes(chat)
    if duration is None:
        duration = "unmute" if currently else "forever"
    if duration == "unmute":
        await db.chats.update_one({"id": chat_id}, {"$pull": {"muted_by": current_user.id}, "$unset": {f"mute_until.{current_user.id}": ""}})
        return {"muted": False, "muted_until": None}
    if duration not in MUTE_DURATIONS:
        raise HTTPException(status_code=400, detail="Duración inválida")
    secs = MUTE_DURATIONS[duration]
    until = (datetime.now(timezone.utc) + timedelta(seconds=secs)).isoformat() if secs else None
    await db.chats.update_one({"id": chat_id}, {"$addToSet": {"muted_by": current_user.id}, "$set": {f"mute_until.{current_user.id}": until}})
    return {"muted": True, "muted_until": until, "duration": duration}


@router.post("/chats/{chat_id}/messages")
async def send_message(
    chat_id: str,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user)
):
    """Send a message in a chat"""
    # Verify user is participant
    chat = await db.chats.find_one({
        "id": chat_id,
        "participants": current_user.id
    })
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        content=message_data.content,
        message_type=message_data.message_type,
        attachments=[MessageAttachment(**a) for a in message_data.attachments] if message_data.attachments else [],
        reply_to_id=message_data.reply_to_id,
        read_by=[current_user.id]
    )
    
    message_doc = message.model_dump()
    message_doc["mentions"] = [m for m in (message_data.mentions or []) if m in chat["participants"]]
    if message_data.forwarded:
        message_doc["forwarded"] = True
        message_doc["forwarded_from"] = (message_data.forwarded_from or "")[:80]
    message_doc['created_at'] = message_doc['created_at'].isoformat()
    message_doc['updated_at'] = message_doc['updated_at'].isoformat()
    
    await db.messages.insert_one(message_doc)
    
    # Update chat's last message
    await db.chats.update_one(
        {"id": chat_id},
        {
            "$set": {
                "last_message_id": message.id,
                "last_message_at": message_doc['created_at'],
                "updated_at": message_doc['updated_at']
            }
        }
    )
    
    if message_data.message_type == "audio" and message_data.attachments:
        import asyncio
        from routers.chat_extras import transcribe_message_audio
        asyncio.create_task(transcribe_message_audio(message.id))

    # Notifications (muted participants skipped unless @mentioned)
    from utils.chat_notify import notify_chat_message
    await notify_chat_message(chat, current_user.id, current_user.name or "Alguien", message_data.content, message_data.mentions, bool(message_data.attachments))

    # Add sender info to response
    profile = await db.user_profiles.find_one({"user_id": current_user.id}, {"_id": 0})
    username = current_user.name or current_user.email.split("@")[0]
    message_doc.pop("_id", None)
    message_doc["sender"] = {
        "id": current_user.id,
        "username": username,
        "avatar_url": profile.get("avatar_url") if profile else None
    }
    
    return message_doc

# -------------------- NOTIFICATIONS --------------------

@router.get("/notifications")
async def get_notifications(
    skip: int = 0,
    limit: int = 50,
    group: bool = True,
    current_user: User = Depends(get_current_user)
):
    """Get notifications for current user"""
    notifications = await db.notifications.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with actor info
    for notif in notifications:
        actor_id = notif.get("actor_id")
        if actor_id:
            actor = await db.users.find_one({"id": actor_id}, {"_id": 0, "hashed_password": 0})
            profile = await db.user_profiles.find_one({"user_id": actor_id}, {"_id": 0})
            username = "Unknown"
            if actor:
                username = actor.get("name") or actor.get("email", "Unknown").split("@")[0]
            notif["actor"] = {
                "id": actor_id,
                "username": username,
                "avatar_url": profile.get("avatar_url") if profile else None
            }
        else:
            notif["actor"] = {
                "id": None,
                "username": "Sistema",
                "avatar_url": None
            }
        try:
            await enrich_notification(notif)
        except Exception:
            notif.setdefault("url", "/notifications")
    
    return _group_notifications(notifications) if group else notifications


GROUPABLE = {"like", "comment", "reply", "repost", "remix", "follow", "live_started"}
GROUP_WINDOW_H = 48


def _group_message(ntype: str, actors: list, count: int, label: Optional[str], single_message: Optional[str]) -> str:
    if count <= 1:
        return single_message or ""
    names = [a.get("username") or "Alguien" for a in actors[:2]]
    others = count - len(names)
    who = names[0] if len(names) == 1 else f"{names[0]} y {names[1]}" if others <= 0 else f"{names[0]} y {others + 1} personas más"
    what = label or "publicación"
    verbs = {
        "like": (f"A {who} les gustó tu {what}", f"A {who} le gustó tu {what}"),
        "comment": (f"{who} comentaron tu {what}", f"{who} comentó tu {what}"),
        "reply": (f"{who} respondieron a tu comentario", f"{who} respondió a tu comentario"),
        "repost": (f"{who} compartieron tu {what}", f"{who} compartió tu {what}"),
        "remix": (f"{who} hicieron remixes de tu {what}", f"{who} hizo un remix de tu {what}"),
        "follow": (f"{who} comenzaron a seguirte", f"{who} comenzó a seguirte"),
        "live_started": (f"{who} están en vivo", f"{who} está en vivo"),
    }
    plural, singular = verbs.get(ntype, (f"{who} interactuaron con tu {what}", f"{who} interactuó con tu {what}"))
    return plural if (others > 0 or len(names) > 1) else singular


def _group_notifications(items: list) -> list:
    """Instagram-style stacking: same type + same target (or all follows) within 48h → one row
    with stacked actors, count and a combined message. Newest activity keeps the position."""
    groups: dict = {}
    out: list = []
    for n in items:  # items are newest-first
        ntype = n.get("type")
        if ntype not in GROUPABLE:
            out.append(n)
            continue
        key = (ntype, "*" if ntype in ("follow", "live_started") else n.get("target_id"))
        g = groups.get(key)
        try:
            ts = datetime.fromisoformat((n.get("created_at") or "").replace("Z", "+00:00"))
        except Exception:
            ts = None
        if g and ts and g["_latest_ts"] and (g["_latest_ts"] - ts).total_seconds() > GROUP_WINDOW_H * 3600:
            g = None  # too old for this stack → start a new one
        if not g:
            g = {**n, "ids": [n["id"]], "actors": [], "count": 0, "_latest_ts": ts, "_seen_actors": set()}
            groups[key] = g
            out.append(g)
        actor = n.get("actor") or {}
        if actor.get("id") and actor["id"] not in g["_seen_actors"]:
            g["_seen_actors"].add(actor["id"])
            g["actors"].append(actor)
        elif not actor.get("id"):
            g["actors"].append(actor)
        if n["id"] not in g["ids"]:
            g["ids"].append(n["id"])
        g["count"] = len(g["actors"]) if ntype != "comment" else len(g["ids"])
        g["is_read"] = bool(g.get("is_read", True)) and bool(n.get("is_read") or n.get("read"))
        if not g.get("preview_url") and n.get("preview_url"):
            g["preview_url"] = n["preview_url"]
    for g in out:
        if "ids" in g:
            g["message"] = _group_message(g.get("type"), g["actors"], g["count"], g.get("target_label"), g.get("message"))
            g.pop("_latest_ts", None); g.pop("_seen_actors", None)
    return out


class ReadManyRequest(BaseModel):
    ids: List[str]


@router.put("/notifications/read-many")
async def mark_many_notifications_read(body: ReadManyRequest, current_user: User = Depends(get_current_user)):
    """Mark a set of notifications (e.g. a grouped row) as read"""
    await db.notifications.update_many(
        {"user_id": current_user.id, "id": {"$in": body.ids}},
        {"$set": {"is_read": True, "read": True}}
    )
    return {"updated": len(body.ids)}

@router.put("/notifications/read")
async def mark_notifications_read(current_user: User = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user.id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

@router.get("/notifications/unread-count")
async def get_unread_count(current_user: User = Depends(get_current_user)):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "user_id": current_user.id,
        "is_read": False
    })
    return {"count": count}

# ============================================================================
# BRUNO AI ASSISTANT
# ============================================================================

from utils.notification_realtime import emit_notification_ws, enrich_notification

# Store active AI chat sessions
ai_chat_sessions = {}

