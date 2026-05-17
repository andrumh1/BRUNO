"""Posts, Feed, Chat, Users, Notifications, and Settings routes.
Extracted from server.py to reduce monolith size.
"""
from fastapi import APIRouter, HTTPException, Depends, status, Request
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
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
    type: str = "image"
    url: str
    thumbnail_url: Optional[str] = None
    duration: Optional[int] = None

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PostCreate(BaseModel):
    content: str = ""
    media: List[dict] = []
    card_id: Optional[str] = None
    post_type: str = "text"
    visibility: str = "public"
    hashtags: List[str] = []

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
    """Create a new post"""
    post = Post(
        user_id=current_user.id,
        content=post_data.content,
        media=[PostMedia(**m) for m in post_data.media] if post_data.media else [],
        card_id=post_data.card_id,
        post_type=post_data.post_type,
        visibility=post_data.visibility,
        hashtags=post_data.hashtags or _extract_hashtags(post_data.content)
    )
    
    post_doc = post.model_dump()
    post_doc['created_at'] = post_doc['created_at'].isoformat()
    post_doc['updated_at'] = post_doc['updated_at'].isoformat()
    
    await db.posts.insert_one(post_doc)
    
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

@router.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, current_user: User = Depends(get_current_user)):
    """Toggle like on a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing_like = await db.likes.find_one({
        "user_id": current_user.id,
        "target_id": post_id,
        "target_type": "post"
    })
    
    if existing_like:
        # Unlike
        await db.likes.delete_one({"id": existing_like["id"]})
        await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": -1}})
        return {"liked": False, "likes_count": post["likes_count"] - 1}
    else:
        # Like
        like = Like(
            user_id=current_user.id,
            target_id=post_id,
            target_type="post"
        )
        like_doc = like.model_dump()
        like_doc['created_at'] = like_doc['created_at'].isoformat()
        await db.likes.insert_one(like_doc)
        await db.posts.update_one({"id": post_id}, {"$inc": {"likes_count": 1}})
        
        # Create notification (if not own post)
        if post["user_id"] != current_user.id:
            notification = Notification(
                user_id=post["user_id"],
                actor_id=current_user.id,
                type="like",
                target_id=post_id,
                target_type="post"
            )
            notif_doc = notification.model_dump()
            notif_doc['created_at'] = notif_doc['created_at'].isoformat()
            await db.notifications.insert_one(notif_doc)
            
            # Send push notification
            from routers.push_notifications import notify_new_like
            await notify_new_like(post["user_id"], current_user.name or "Alguien", "publicación")
        
        return {"liked": True, "likes_count": post["likes_count"] + 1}

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
    
    # Create notification
    if post["user_id"] != current_user.id:
        notification = Notification(
            user_id=post["user_id"],
            actor_id=current_user.id,
            type="comment",
            target_id=post_id,
            target_type="post",
            content=comment_data.content[:100]
        )
        notif_doc = notification.model_dump()
        notif_doc['created_at'] = notif_doc['created_at'].isoformat()
        await db.notifications.insert_one(notif_doc)
        
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
            
            from routers.push_notifications import send_push_notification, NotificationPayload
            await send_push_notification(mentioned_user["id"], NotificationPayload(
                title="Te mencionaron",
                body=f"{actor_name} te mencionó",
                url="/feed",
                tag="mention"
            ))

# -------------------- USER SEARCH --------------------

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
    limit: int = 20,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get posts from a specific user"""
    posts = await db.posts.find(
        {"user_id": user_id, "is_deleted": False},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get user info
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    profile = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    username = user.get("name") if user else "Unknown"
    
    # Enrich posts
    result = []
    for post in posts:
        # Check if current user liked the post
        is_liked = False
        if current_user:
            like = await db.likes.find_one({
                "user_id": current_user.id,
                "target_id": post["id"],
                "target_type": "post"
            })
            is_liked = like is not None
        
        result.append({
            **post,
            "user": {
                "id": user_id,
                "username": username,
                "display_name": profile.get("display_name") if profile else username,
                "avatar_url": profile.get("avatar_url") if profile else None,
                "is_verified": profile.get("is_verified", False) if profile else False
            },
            "is_liked": is_liked
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
    allowed_keys = {"feed_mode", "language", "theme", "notifications", "privacy", "content"}
    update = {k: v for k, v in prefs_data.items() if k in allowed_keys}
    
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
    
    # Enrich with other participant info and last message
    for chat in chats:
        # Get other participant(s)
        other_ids = [p for p in chat["participants"] if p != current_user.id]
        participants = []
        for uid in other_ids:
            user = await db.users.find_one({"id": uid}, {"_id": 0, "hashed_password": 0})
            profile = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0})
            if user:
                username = user.get("name") or user.get("email", "Unknown").split("@")[0]
                display_name = profile.get("display_name") if profile else None
                avatar_url = profile.get("avatar_url") if profile else user.get("avatar_url")
                participants.append({
                    "id": uid,
                    "username": username,
                    "avatar_url": avatar_url,
                    "display_name": display_name or username
                })
        chat["other_participants"] = participants
        
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
    
    # Create notification for other participants
    from routers.push_notifications import notify_new_message
    for participant_id in chat["participants"]:
        if participant_id != current_user.id:
            notification = Notification(
                user_id=participant_id,
                actor_id=current_user.id,
                type="message",
                target_id=chat_id,
                target_type="chat",
                content=message_data.content[:100] if message_data.content else "Sent an attachment"
            )
            notif_doc = notification.model_dump()
            notif_doc['created_at'] = notif_doc['created_at'].isoformat()
            await db.notifications.insert_one(notif_doc)
            
            # Send push notification
            msg_preview = message_data.content[:50] if message_data.content else "Envió un archivo"
            await notify_new_message(participant_id, current_user.name or "Alguien", msg_preview)
    
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
    
    return notifications

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

from emergentintegrations.llm.chat import LlmChat, UserMessage

# Store active AI chat sessions
ai_chat_sessions = {}

