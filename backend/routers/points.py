"""Points/gamification system routes."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List
import uuid

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from models.user import User

router = APIRouter(prefix="/points", tags=["points"])

# Point values for different actions
POINT_VALUES = {
    "daily_login": 5,
    "create_post": 10,
    "receive_like": 2,
    "receive_comment": 3,
    "receive_follow": 5,
    "share_card": 15,
    "complete_profile": 50,
    "first_card": 100,
    "invite_friend": 200,
    "purchase": 50,  # Per $10 spent
    "streak_7_days": 50,
    "streak_30_days": 200,
    "verified_account": 500
}

# Level thresholds
LEVELS = [
    {"level": 1, "name": "Novato", "min_points": 0, "badge": "🌱"},
    {"level": 2, "name": "Activo", "min_points": 100, "badge": "⭐"},
    {"level": 3, "name": "Popular", "min_points": 500, "badge": "🔥"},
    {"level": 4, "name": "Influencer", "min_points": 1500, "badge": "💎"},
    {"level": 5, "name": "Embajador", "min_points": 5000, "badge": "👑"},
    {"level": 6, "name": "Leyenda", "min_points": 15000, "badge": "🏆"}
]


class PointsResponse(BaseModel):
    total_points: int
    level: dict
    next_level: Optional[dict]
    points_to_next_level: int
    streak_days: int
    recent_earnings: List[dict]


class PointTransaction(BaseModel):
    action: str
    points: int
    description: str


def get_user_level(points: int) -> dict:
    """Get user's level based on points"""
    current_level = LEVELS[0]
    for level in LEVELS:
        if points >= level["min_points"]:
            current_level = level
    return current_level


def get_next_level(points: int) -> Optional[dict]:
    """Get next level to reach"""
    for level in LEVELS:
        if points < level["min_points"]:
            return level
    return None


@router.get("/me", response_model=PointsResponse)
async def get_my_points(current_user: User = Depends(get_current_user)):
    """Get current user's points and level"""
    # Get or create points document
    points_doc = await db.user_points.find_one({"user_id": current_user.id})
    
    if not points_doc:
        points_doc = {
            "user_id": current_user.id,
            "total_points": 0,
            "streak_days": 0,
            "last_login_date": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_points.insert_one(points_doc)
    
    total_points = points_doc.get("total_points", 0)
    current_level = get_user_level(total_points)
    next_level = get_next_level(total_points)
    
    # Get recent point transactions
    recent = await db.point_transactions.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    points_to_next = next_level["min_points"] - total_points if next_level else 0
    
    return PointsResponse(
        total_points=total_points,
        level=current_level,
        next_level=next_level,
        points_to_next_level=max(0, points_to_next),
        streak_days=points_doc.get("streak_days", 0),
        recent_earnings=recent
    )


@router.post("/daily-check-in")
async def daily_check_in(current_user: User = Depends(get_current_user)):
    """Record daily login and award points"""
    points_doc = await db.user_points.find_one({"user_id": current_user.id})
    today = datetime.now(timezone.utc).date().isoformat()
    
    if not points_doc:
        points_doc = {
            "user_id": current_user.id,
            "total_points": 0,
            "streak_days": 0,
            "last_login_date": None
        }
    
    last_login = points_doc.get("last_login_date")
    streak = points_doc.get("streak_days", 0)
    points_earned = 0
    bonus_message = None
    
    if last_login == today:
        # Already checked in today
        return {
            "already_checked_in": True,
            "streak_days": streak,
            "points_earned": 0
        }
    
    # Calculate streak
    if last_login:
        last_date = datetime.fromisoformat(last_login).date()
        today_date = datetime.now(timezone.utc).date()
        diff = (today_date - last_date).days
        
        if diff == 1:
            streak += 1
        elif diff > 1:
            streak = 1  # Reset streak
    else:
        streak = 1
    
    # Base daily points
    points_earned = POINT_VALUES["daily_login"]
    
    # Streak bonuses
    if streak == 7:
        points_earned += POINT_VALUES["streak_7_days"]
        bonus_message = "¡Racha de 7 días! +50 puntos bonus"
    elif streak == 30:
        points_earned += POINT_VALUES["streak_30_days"]
        bonus_message = "¡Racha de 30 días! +200 puntos bonus"
    elif streak % 7 == 0:
        bonus = (streak // 7) * 10
        points_earned += bonus
        bonus_message = f"¡Racha de {streak} días! +{bonus} puntos bonus"
    
    # Update points
    await db.user_points.update_one(
        {"user_id": current_user.id},
        {
            "$set": {
                "user_id": current_user.id,
                "last_login_date": today,
                "streak_days": streak,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$inc": {"total_points": points_earned}
        },
        upsert=True
    )
    
    # Log transaction
    await db.point_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "action": "daily_login",
        "points": points_earned,
        "description": f"Check-in diario (día {streak})" + (f" - {bonus_message}" if bonus_message else ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "already_checked_in": False,
        "streak_days": streak,
        "points_earned": points_earned,
        "bonus_message": bonus_message
    }


@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = 10,
    current_user: User = Depends(get_current_user)
):
    """Get points leaderboard"""
    # Get top users
    top_users = await db.user_points.find(
        {},
        {"_id": 0}
    ).sort("total_points", -1).limit(limit).to_list(limit)
    
    # Enrich with user info
    leaderboard = []
    for i, entry in enumerate(top_users, 1):
        user = await db.users.find_one({"id": entry["user_id"]}, {"_id": 0, "hashed_password": 0})
        profile = await db.user_profiles.find_one({"user_id": entry["user_id"]}, {"_id": 0})
        
        level = get_user_level(entry.get("total_points", 0))
        
        leaderboard.append({
            "rank": i,
            "user_id": entry["user_id"],
            "username": user.get("name", "Usuario") if user else "Usuario",
            "avatar_url": profile.get("avatar_url") if profile else None,
            "total_points": entry.get("total_points", 0),
            "level": level,
            "streak_days": entry.get("streak_days", 0)
        })
    
    # Find current user's rank
    my_rank = None
    my_points = await db.user_points.find_one({"user_id": current_user.id})
    if my_points:
        higher_count = await db.user_points.count_documents({
            "total_points": {"$gt": my_points.get("total_points", 0)}
        })
        my_rank = higher_count + 1
    
    return {
        "leaderboard": leaderboard,
        "my_rank": my_rank
    }


@router.get("/history")
async def get_points_history(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Get user's points transaction history"""
    transactions = await db.point_transactions.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return transactions


# Helper function to award points (called from other parts of the app)
async def award_points(user_id: str, action: str, custom_description: str = None):
    """Award points to a user for an action"""
    if action not in POINT_VALUES:
        return None
    
    points = POINT_VALUES[action]
    description = custom_description or f"Puntos por: {action.replace('_', ' ')}"
    
    # Update total points
    await db.user_points.update_one(
        {"user_id": user_id},
        {
            "$inc": {"total_points": points},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    # Log transaction
    await db.point_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "points": points,
        "description": description,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return points
