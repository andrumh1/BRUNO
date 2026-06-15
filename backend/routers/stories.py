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
    location: Optional[dict] = None  # { lat, lng, name, address } — for map display


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

    # Fire-and-forget: notify the publisher + their followers so avatars light up
    import asyncio
    asyncio.create_task(_broadcast_story_published(current_user.id, story_doc["id"]))
    
    return {
        "id": story_doc["id"],
        "message": "Story created",
        "expires_at": expires_at.isoformat()
    }


async def _broadcast_story_published(user_id: str, story_id: str) -> None:
    """Best-effort WS broadcast so every avatar of this user lights up."""
    try:
        from utils.ws_manager import ws_manager
        # Notify the publisher's own session (they have multiple tabs / devices)
        await ws_manager.send_personal_message(
            {"type": "story_published", "kind": "story_published", "user_id": user_id, "story_id": story_id},
            user_id,
        )
        # Also notify their followers so their avatars in feed/chat light up
        followers = await db.follows.find({"following_id": user_id}, {"_id": 0, "follower_id": 1}).to_list(1000)
        for f in followers:
            try:
                await ws_manager.send_personal_message(
                    {"type": "story_published", "kind": "story_published", "user_id": user_id, "story_id": story_id},
                    f["follower_id"],
                )
            except Exception:
                pass
    except Exception:
        pass


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
    """React to a story — also fires a push notification to the owner."""
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

    # Fire-and-forget push notification to the owner (skip if reacting to own story)
    if story.get("user_id") and story["user_id"] != current_user.id:
        import asyncio
        async def _push():
            try:
                from routers.push_notifications import notify_story_reaction
                await notify_story_reaction(
                    user_id=story["user_id"],
                    reactor_name=current_user.name or current_user.email or "Alguien",
                    emoji=reaction,
                    story_id=story_id,
                    reactor_avatar=getattr(current_user, "avatar_url", None),
                )
            except Exception:
                pass
        asyncio.create_task(_push())
    
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


# ==================== SAVED STORIES / HIGHLIGHTS ====================

class HighlightSaveInput(BaseModel):
    collection: str = "Destacadas"  # collection name e.g. "Viajes", "Trabajo"
    cover_url: Optional[str] = None


@router.post("/{story_id}/save")
async def save_story_to_highlights(
    story_id: str,
    payload: HighlightSaveInput,
    current_user: User = Depends(get_current_user),
):
    """Save a 24h story to permanent highlights (Instagram-style).

    Stories normally expire after 24h. Saving copies the media reference
    into the `story_highlights` collection where it lives indefinitely,
    grouped by collection name.
    """
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if story.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can save this story")

    highlight_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "story_id": story_id,
        "collection": (payload.collection or "Destacadas").strip()[:60],
        "cover_url": payload.cover_url or story.get("media_url"),
        "media_url": story.get("media_url"),
        "media_type": story.get("media_type", "image"),
        "caption": story.get("caption"),
        "music": story.get("music"),
        "saved_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.story_highlights.update_one(
        {"user_id": current_user.id, "story_id": story_id},
        {"$set": highlight_doc},
        upsert=True,
    )
    await db.stories.update_one({"id": story_id}, {"$set": {"is_highlighted": True}})

    highlight_doc.pop("_id", None)
    return {"status": "saved", "highlight": highlight_doc}


@router.delete("/{story_id}/save")
async def unsave_story_from_highlights(
    story_id: str,
    current_user: User = Depends(get_current_user),
):
    """Remove a story from highlights (keeps the 24h story intact)."""
    deleted = await db.story_highlights.delete_one({
        "user_id": current_user.id,
        "story_id": story_id,
    })
    if deleted.deleted_count:
        await db.stories.update_one({"id": story_id}, {"$set": {"is_highlighted": False}})
    return {"status": "unsaved", "removed": deleted.deleted_count}


@router.get("/highlights/{user_id}")
async def get_highlights(user_id: str):
    """Public: list a user's highlight collections (grouped by name)."""
    rows = await db.story_highlights.find(
        {"user_id": user_id},
        {"_id": 0},
    ).sort("saved_at", -1).to_list(500)

    collections: dict = {}
    for r in rows:
        col_name = r.get("collection") or "Destacadas"
        if col_name not in collections:
            collections[col_name] = {
                "name": col_name,
                "cover_url": r.get("cover_url") or r.get("media_url"),
                "count": 0,
                "items": [],
            }
        collections[col_name]["count"] += 1
        collections[col_name]["items"].append(r)

    return {
        "user_id": user_id,
        "collections": list(collections.values()),
        "total_items": len(rows),
    }


@router.patch("/highlights/{highlight_id}")
async def update_highlight(
    highlight_id: str,
    payload: HighlightSaveInput,
    current_user: User = Depends(get_current_user),
):
    """Rename a highlight's collection or change its cover."""
    h = await db.story_highlights.find_one({"id": highlight_id})
    if not h:
        raise HTTPException(status_code=404, detail="Highlight not found")
    if h.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not yours")

    updates = {}
    if payload.collection:
        updates["collection"] = payload.collection.strip()[:60]
    if payload.cover_url:
        updates["cover_url"] = payload.cover_url

    if updates:
        await db.story_highlights.update_one({"id": highlight_id}, {"$set": updates})

    return {"status": "updated", "updates": updates}


@router.delete("/highlights/{highlight_id}")
async def delete_highlight(
    highlight_id: str,
    current_user: User = Depends(get_current_user),
):
    """Remove a single highlight."""
    h = await db.story_highlights.find_one({"id": highlight_id})
    if not h:
        raise HTTPException(status_code=404, detail="Highlight not found")
    if h.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not yours")

    await db.story_highlights.delete_one({"id": highlight_id})
    return {"status": "deleted"}


@router.get("/active-users")
async def get_users_with_active_stories(
    user_ids: str,  # comma-separated user_ids
):
    """Public: which of these users have at least one non-expired story right now?

    Used by the Feed/Profile to draw a gradient ring around their avatars
    when there is something to watch.
    """
    ids = [u.strip() for u in user_ids.split(",") if u.strip()]
    if not ids:
        return {"active": {}}
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor = db.stories.aggregate([
        {"$match": {"user_id": {"$in": ids}, "expires_at": {"$gt": now_iso}}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
    ])
    active = {}
    async for row in cursor:
        active[row["_id"]] = row["count"]
    return {"active": active, "checked": len(ids)}


@router.get("/located")
async def stories_with_location(
    min_lat: Optional[float] = None,
    max_lat: Optional[float] = None,
    min_lng: Optional[float] = None,
    max_lng: Optional[float] = None,
    limit: int = 100,
):
    """Return active (non-expired) public stories that have a `location` field.

    Used by the map's pill bar to show located stories. Optionally filters by
    bounding box when the map is zoomed in.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    q: dict = {
        "expires_at": {"$gt": now_iso},
        "visibility": "public",
        "location": {"$exists": True, "$ne": None},
        "media_url": {"$ne": ""},
    }
    if None not in (min_lat, max_lat, min_lng, max_lng):
        q["location.lat"] = {"$gte": min_lat, "$lte": max_lat}
        q["location.lng"] = {"$gte": min_lng, "$lte": max_lng}

    rows = await db.stories.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)

    # Hydrate with user info in batch
    user_ids = list({r.get("user_id") for r in rows if r.get("user_id")})
    users = {}
    if user_ids:
        async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "avatar_url": 1}):
            users[u["id"]] = u

    items = []
    for r in rows:
        u = users.get(r.get("user_id"), {})
        loc = r.get("location") or {}
        items.append({
            "id": r["id"],
            "user_id": r.get("user_id"),
            "user_name": u.get("name") or r.get("user_name") or "Bruno",
            "avatar_url": u.get("avatar_url"),
            "media_url": r.get("media_url"),
            "media_type": r.get("media_type", "image"),
            "caption": r.get("caption"),
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "place_name": loc.get("name") or loc.get("address"),
            "created_at": r.get("created_at"),
            "expires_at": r.get("expires_at"),
        })

    return {"stories": items, "count": len(items)}


# ==================== INSIGHTS / RESPONSES (analytics) ====================

class QuestionAnswerInput(BaseModel):
    answer: str


@router.post("/{story_id}/answer")
async def answer_story_question(
    story_id: str,
    payload: QuestionAnswerInput,
    current_user: User = Depends(get_current_user),
):
    """Submit a free-text answer to a story's overlay question.

    Stored on the story doc under `question_responses`. One answer per user
    (subsequent answers from the same user update the previous one).
    """
    text = (payload.answer or "").strip()[:280]
    if not text:
        raise HTTPException(status_code=400, detail="Empty answer")

    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    # Replace any previous answer from this user
    await db.stories.update_one(
        {"id": story_id},
        {"$pull": {"question_responses": {"user_id": current_user.id}}},
    )
    await db.stories.update_one(
        {"id": story_id},
        {"$push": {"question_responses": {
            "user_id": current_user.id,
            "user_name": current_user.name,
            "answer": text,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }}},
    )

    # Best-effort notify the story owner
    if story.get("user_id") and story["user_id"] != current_user.id:
        import asyncio
        async def _notify():
            try:
                from utils.ws_manager import ws_manager
                await ws_manager.send_personal_message(
                    {
                        "type": "story_answer",
                        "kind": "story_answer",
                        "story_id": story_id,
                        "from_user": current_user.id,
                        "from_name": current_user.name,
                        "preview": text[:80],
                    },
                    story["user_id"],
                )
            except Exception:
                pass
        asyncio.create_task(_notify())

    return {"status": "answered"}


@router.get("/{story_id}/insights")
async def get_story_insights(
    story_id: str,
    current_user: User = Depends(get_current_user),
):
    """Return aggregate insights for a story: views, reactions, poll results,
    and free-text question responses. Only the story owner can read this."""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if story.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can view insights")

    views = story.get("views", []) or []
    reactions = story.get("reactions", []) or []
    answers = story.get("question_responses", []) or []

    # Reactions broken down by emoji
    reaction_counts: dict = {}
    for r in reactions:
        em = r.get("reaction") or ""
        if not em:
            continue
        reaction_counts[em] = reaction_counts.get(em, 0) + 1

    # Poll results if there's a poll attached
    poll_payload = None
    if story.get("poll_id"):
        poll = await db.polls.find_one({"id": story["poll_id"]}, {"_id": 0})
        if poll:
            total_votes = sum((o.get("votes", 0) or 0) for o in poll.get("options", []))
            options = []
            for o in poll.get("options", []):
                v = o.get("votes", 0) or 0
                pct = (v * 100 / total_votes) if total_votes else 0
                options.append({"text": o.get("text", ""), "votes": v, "pct": round(pct, 1)})
            poll_payload = {
                "id": poll["id"],
                "question": poll.get("question"),
                "options": options,
                "total_votes": total_votes,
                "voters_count": len(poll.get("voters", []) or []),
            }

    # Sort answers most-recent first, hydrate avatar
    user_ids = list({a.get("user_id") for a in answers if a.get("user_id")})
    avatars: dict = {}
    if user_ids:
        async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "avatar_url": 1, "name": 1}):
            avatars[u["id"]] = {"avatar_url": u.get("avatar_url"), "name": u.get("name")}
    answer_list = [
        {
            **a,
            "avatar_url": avatars.get(a.get("user_id"), {}).get("avatar_url"),
        }
        for a in sorted(answers, key=lambda x: x.get("created_at", ""), reverse=True)
    ]

    return {
        "story_id": story_id,
        "views_count": len(views),
        "reactions_count": len(reactions),
        "reactions_by_emoji": reaction_counts,
        "poll": poll_payload,
        "answers_count": len(answers),
        "answers": answer_list,
    }


@router.get("/{story_id}/public-insights")
async def get_story_public_insights(
    story_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Return aggregate-only counters (no PII) viewers can see when tapping
    'Ver resultados' on a poll/question. Does NOT expose individual answers."""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    poll_payload = None
    if story.get("poll_id"):
        poll = await db.polls.find_one({"id": story["poll_id"]}, {"_id": 0})
        if poll:
            total_votes = sum((o.get("votes", 0) or 0) for o in poll.get("options", []))
            options = []
            for o in poll.get("options", []):
                v = o.get("votes", 0) or 0
                pct = (v * 100 / total_votes) if total_votes else 0
                options.append({"text": o.get("text", ""), "votes": v, "pct": round(pct, 1)})
            poll_payload = {
                "id": poll["id"],
                "question": poll.get("question"),
                "options": options,
                "total_votes": total_votes,
                "has_voted": bool(current_user and current_user.id in (poll.get("voters") or [])),
            }

    answers_count = len(story.get("question_responses", []) or [])
    return {
        "story_id": story_id,
        "answers_count": answers_count,
        "poll": poll_payload,
    }


