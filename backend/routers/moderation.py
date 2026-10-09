"""
Moderation Router - Content moderation and auto-filtering
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import re
from utils.notification_realtime import emit_notification_ws

router = APIRouter(tags=["moderation"])

# Database connection
db = None

def set_db(database):
    global db
    db = database

# Prohibited words/patterns (basic filter)
PROHIBITED_PATTERNS = [
    # Violence
    r'\b(matar|asesinar|muerte|violencia|sangre|golpe)\b',
    # Hate speech indicators
    r'\b(odio|racista|homofob|xenofob)\b',
    # Spam patterns
    r'(www\.|http|\.com|\.net|\.org){3,}',  # Multiple URLs
    r'(\$+|dinero fácil|gana dinero|hazte rico)',
    # Adult content
    r'\b(xxx|porn|sex\w*|adult)\b',
]

# Severity levels
SEVERITY = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4
}

# Helper to get current user
async def get_current_user_from_token(authorization: str = Header(None)):
    from utils.security import resolve_user_dict_from_token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await resolve_user_dict_from_token(authorization.replace("Bearer ", "", 1))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


def check_admin(user: dict):
    """Check if user has admin/moderator privileges"""
    tier = user.get("subscription_tier", "free")
    role = user.get("role", "user")
    return tier in ["admin", "business"] or role in ["admin", "moderator"]

# ============================================
# AUTO CONTENT FILTER
# ============================================

def auto_filter_content(text: str) -> dict:
    """
    Automatically scan text content for prohibited patterns
    Returns: {is_clean: bool, flags: [], severity: str}
    """
    if not text:
        return {"is_clean": True, "flags": [], "severity": "none", "score": 0}
    
    flags = []
    max_severity = 0
    text_lower = text.lower()
    
    for pattern in PROHIBITED_PATTERNS:
        matches = re.findall(pattern, text_lower, re.IGNORECASE)
        if matches:
            flags.append({
                "pattern": pattern,
                "matches": matches[:5],  # Limit matches shown
                "severity": "medium"
            })
            max_severity = max(max_severity, SEVERITY["medium"])
    
    # Check for excessive caps (shouting)
    caps_ratio = sum(1 for c in text if c.isupper()) / max(len(text), 1)
    if caps_ratio > 0.7 and len(text) > 20:
        flags.append({
            "pattern": "excessive_caps",
            "matches": ["Text has >70% uppercase"],
            "severity": "low"
        })
        max_severity = max(max_severity, SEVERITY["low"])
    
    # Check for spam-like repetition
    words = text_lower.split()
    if len(words) > 5:
        unique_words = set(words)
        if len(unique_words) / len(words) < 0.3:
            flags.append({
                "pattern": "repetitive_content",
                "matches": ["High word repetition detected"],
                "severity": "low"
            })
            max_severity = max(max_severity, SEVERITY["low"])
    
    severity_names = {0: "none", 1: "low", 2: "medium", 3: "high", 4: "critical"}
    
    return {
        "is_clean": len(flags) == 0,
        "flags": flags,
        "severity": severity_names.get(max_severity, "none"),
        "score": max_severity
    }

@router.post("/api/moderation/check")
async def check_content(
    content: str,
    content_type: str = "text"  # text, post, comment, message
):
    """Check content against auto-moderation rules (public endpoint for preview)"""
    result = auto_filter_content(content)
    return result

# ============================================
# MODERATION QUEUE
# ============================================

@router.get("/api/moderation/queue")
async def get_moderation_queue(
    status: str = "pending",
    content_type: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Get items in moderation queue (admin only)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if not check_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {"status": status}
    if content_type:
        query["content_type"] = content_type
    
    # Get reports that need review
    reports = await db.reports.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get auto-flagged content
    flagged = await db.moderation_flags.find(
        {"status": status},
        {"_id": 0}
    ).sort("severity_score", -1).limit(limit).to_list(limit)
    
    return {
        "reports": reports,
        "auto_flagged": flagged,
        "total_pending": len(reports) + len(flagged)
    }

@router.get("/api/moderation/stats")
async def get_moderation_stats(
    current_user: dict = Depends(get_current_user_from_token)
):
    """Get moderation statistics (admin only)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if not check_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Count reports by status
    pending_reports = await db.reports.count_documents({"status": "pending"})
    resolved_reports = await db.reports.count_documents({"status": "resolved"})
    
    # Count auto-flagged
    pending_flags = await db.moderation_flags.count_documents({"status": "pending"})
    
    # Count actions taken today
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    actions_today = await db.moderation_actions.count_documents({
        "created_at": {"$gte": today}
    })
    
    # Get top reported users
    top_reported = await db.reports.aggregate([
        {"$match": {"content_type": "user"}},
        {"$group": {"_id": "$content_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]).to_list(5)
    
    return {
        "pending_reports": pending_reports,
        "resolved_reports": resolved_reports,
        "pending_auto_flags": pending_flags,
        "actions_today": actions_today,
        "top_reported_users": top_reported
    }

@router.post("/api/moderation/action")
async def take_moderation_action(
    content_type: str,  # post, user, comment, product
    content_id: str,
    action: str,  # warn, remove, suspend, ban
    reason: str,
    report_ids: Optional[List[str]] = None,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Take moderation action on content (admin only)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if not check_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Map collections
    collections = {
        "post": "posts",
        "user": "users",
        "comment": "comments",
        "product": "products"
    }
    
    collection = collections.get(content_type)
    if not collection:
        raise HTTPException(status_code=400, detail="Invalid content type")
    
    # Get the content
    content = await db[collection].find_one({"id": content_id})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Execute action
    if action == "remove":
        # Delete the content
        await db[collection].delete_one({"id": content_id})
    elif action == "suspend":
        # Suspend user
        if content_type == "user":
            await db.users.update_one(
                {"id": content_id},
                {"$set": {
                    "is_suspended": True,
                    "suspended_at": datetime.now(timezone.utc).isoformat(),
                    "suspended_reason": reason
                }}
            )
    elif action == "ban":
        # Ban user permanently
        if content_type == "user":
            await db.users.update_one(
                {"id": content_id},
                {"$set": {
                    "is_banned": True,
                    "banned_at": datetime.now(timezone.utc).isoformat(),
                    "ban_reason": reason
                }}
            )
    elif action == "warn":
        # Send warning (create notification)
        user_id = content.get("author_id") or content.get("user_id") or content_id
        warn_notif = {
            "user_id": user_id,
            "type": "moderation_warning",
            "title": "Advertencia de Moderación",
            "message": reason,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "read": False
        }
        await db.notifications.insert_one(warn_notif)
        await emit_notification_ws(warn_notif)
    
    # Record the action
    action_doc = {
        "moderator_id": current_user["id"],
        "content_type": content_type,
        "content_id": content_id,
        "action": action,
        "reason": reason,
        "report_ids": report_ids or [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.moderation_actions.insert_one(action_doc)
    
    # Update related reports
    if report_ids:
        await db.reports.update_many(
            {"id": {"$in": report_ids}},
            {"$set": {
                "status": "resolved",
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "resolved_by": current_user["id"],
                "action_taken": action
            }}
        )
    
    return {
        "success": True,
        "action": action,
        "content_type": content_type,
        "content_id": content_id
    }

@router.get("/api/moderation/history")
async def get_moderation_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Get moderation action history (admin only)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if not check_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    history = await db.moderation_actions.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with moderator names
    for action in history:
        mod = await db.users.find_one(
            {"id": action["moderator_id"]},
            {"name": 1, "avatar_url": 1}
        )
        if mod:
            action["moderator_name"] = mod.get("name", "Unknown")
    
    return history

# ============================================
# USER WARNINGS & STRIKES
# ============================================

@router.get("/api/moderation/user/{user_id}/strikes")
async def get_user_strikes(
    user_id: str,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Get user's moderation strikes (admin only)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if not check_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all actions against this user
    actions = await db.moderation_actions.find(
        {"content_id": user_id, "content_type": "user"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get user info
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    return {
        "user": user,
        "strikes": len([a for a in actions if a["action"] in ["warn", "suspend"]]),
        "actions": actions,
        "is_suspended": user.get("is_suspended", False) if user else False,
        "is_banned": user.get("is_banned", False) if user else False
    }
