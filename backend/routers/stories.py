"""Stories routes - 24h stories and static card stories."""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user, get_current_user_optional
from models.user import User

router = APIRouter(prefix="/stories", tags=["stories"])

# Story duration (24 hours)
STORY_DURATION_HOURS = 24


class StoryCreate(BaseModel):
    media_url: str = ""
    media_type: str = "image"  # image, video, poll
    caption: Optional[str] = None
    duration: int = 5  # seconds for viewing
    visibility: str = "public"  # public, followers, private
    link_url: Optional[str] = None
    link_text: Optional[str] = None
    poll_id: Optional[str] = None  # attach a poll to story
    music: Optional[dict] = None  # { trackId, title, url, volume, start, end }


class CardStoryCreate(BaseModel):
    card_id: str
    media_url: str
    media_type: str = "image"
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    link_url: Optional[str] = None
    order: int = 0


# ==================== USER STORIES (24h) ====================

@router.post("/")
async def create_story(
    story: StoryCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new 24h story"""
    expires_at = datetime.now(timezone.utc) + timedelta(hours=STORY_DURATION_HOURS)
    
    story_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "user_name": current_user.name,
        **story.model_dump(),
        "views": [],
        "reactions": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat()
    }
    
    await db.stories.insert_one(story_doc)
    
    return {
        "id": story_doc["id"],
        "message": "Story created",
        "expires_at": expires_at.isoformat()
    }


@router.get("/feed")
async def get_stories_feed(
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get stories from followed users and self"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Build query based on visibility
    if current_user:
        # Get users being followed
        following = await db.follows.find(
            {"follower_id": current_user.id}
        ).to_list(1000)
        following_ids = [f["following_id"] for f in following]
        following_ids.append(current_user.id)  # Include own stories
        
        query = {
            "expires_at": {"$gt": now},
            "$or": [
                {"user_id": {"$in": following_ids}},
                {"visibility": "public"}
            ]
        }
    else:
        query = {
            "expires_at": {"$gt": now},
            "visibility": "public"
        }
    
    stories = await db.stories.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Group by user
    users_stories = {}
    for story in stories:
        user_id = story["user_id"]
        if user_id not in users_stories:
            # Get user profile
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
            profile = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
            
            users_stories[user_id] = {
                "user_id": user_id,
                "user_name": user.get("name", "") if user else "",
                "avatar_url": profile.get("avatar_url") if profile else user.get("avatar_url") if user else None,
                "stories": [],
                "has_unseen": False
            }
        
        # Check if current user has seen this story
        if current_user:
            story["is_seen"] = current_user.id in story.get("views", [])
            if not story["is_seen"]:
                users_stories[user_id]["has_unseen"] = True
        
        users_stories[user_id]["stories"].append(story)
    
    # Sort: unseen first, then by most recent
    result = sorted(
        users_stories.values(),
        key=lambda x: (not x["has_unseen"], x["stories"][0]["created_at"]),
        reverse=True
    )
    
    return result


@router.get("/user/{user_id}")
async def get_user_stories(
    user_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get stories for a specific user"""
    now = datetime.now(timezone.utc).isoformat()
    
    query = {
        "user_id": user_id,
        "expires_at": {"$gt": now}
    }
    
    # Filter by visibility
    if not current_user or current_user.id != user_id:
        # Check if following
        is_following = False
        if current_user:
            follow = await db.follows.find_one({
                "follower_id": current_user.id,
                "following_id": user_id
            })
            is_following = follow is not None
        
        if is_following:
            query["visibility"] = {"$in": ["public", "followers"]}
        else:
            query["visibility"] = "public"
    
    stories = await db.stories.find(query, {"_id": 0}).sort("created_at", 1).to_list(100)
    
    # Mark seen status
    if current_user:
        for story in stories:
            story["is_seen"] = current_user.id in story.get("views", [])
    
    return stories


@router.post("/{story_id}/view")
async def mark_story_viewed(
    story_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark a story as viewed"""
    story = await db.stories.find_one({"id": story_id})
    
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Add to views if not already viewed
    if current_user.id not in story.get("views", []):
        await db.stories.update_one(
            {"id": story_id},
            {"$addToSet": {"views": current_user.id}}
        )
    
    return {"status": "viewed"}


@router.post("/{story_id}/react")
async def react_to_story(
    story_id: str,
    reaction: str,  # emoji
    current_user: User = Depends(get_current_user)
):
    """React to a story"""
    story = await db.stories.find_one({"id": story_id})
    
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    await db.stories.update_one(
        {"id": story_id},
        {"$push": {"reactions": {
            "user_id": current_user.id,
            "reaction": reaction,
            "created_at": datetime.now(timezone.utc).isoformat()
        }}}
    )
    
    return {"status": "reacted"}


@router.delete("/{story_id}")
async def delete_story(
    story_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a story"""
    story = await db.stories.find_one({"id": story_id})
    
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.stories.delete_one({"id": story_id})
    return {"status": "deleted"}


# ==================== CARD STORIES (STATIC/CATALOG) ====================

@router.post("/card")
async def create_card_story(
    story: CardStoryCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a static story for a card (catalog item)"""
    # Verify card ownership
    card = await db.cards.find_one({"id": story.card_id})
    
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    if card["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    story_doc = {
        "id": str(uuid.uuid4()),
        "card_id": story.card_id,
        "user_id": current_user.id,
        **story.model_dump(exclude={"card_id"}),
        "views": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.card_stories.insert_one(story_doc)
    
    return {"id": story_doc["id"], "message": "Card story created"}


@router.get("/card/{card_id}")
async def get_card_stories(
    card_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get all stories for a card (catalog)"""
    stories = await db.card_stories.find(
        {"card_id": card_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    # Increment views
    for story in stories:
        await db.card_stories.update_one(
            {"id": story["id"]},
            {"$inc": {"views": 1}}
        )
    
    return stories


@router.put("/card/{story_id}")
async def update_card_story(
    story_id: str,
    updates: dict,
    current_user: User = Depends(get_current_user)
):
    """Update a card story"""
    story = await db.card_stories.find_one({"id": story_id})
    
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    allowed_fields = ["media_url", "media_type", "title", "description", "price", "link_url", "order"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    await db.card_stories.update_one(
        {"id": story_id},
        {"$set": update_data}
    )
    
    return {"status": "updated"}


@router.delete("/card/{story_id}")
async def delete_card_story(
    story_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a card story"""
    story = await db.card_stories.find_one({"id": story_id})
    
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.card_stories.delete_one({"id": story_id})
    return {"status": "deleted"}


@router.put("/card/{card_id}/reorder")
async def reorder_card_stories(
    card_id: str,
    story_ids: List[str],
    current_user: User = Depends(get_current_user)
):
    """Reorder stories for a card"""
    # Verify card ownership
    card = await db.cards.find_one({"id": card_id})
    
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    if card["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    for i, story_id in enumerate(story_ids):
        await db.card_stories.update_one(
            {"id": story_id, "card_id": card_id},
            {"$set": {"order": i}}
        )
    
    return {"status": "reordered"}
