"""Analytics routes for Pro/Business users."""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


class CardView(BaseModel):
    id: str
    card_id: str
    viewer_id: Optional[str] = None
    viewer_ip: Optional[str] = None
    viewer_location: Optional[dict] = None
    viewer_device: Optional[str] = None
    referrer: Optional[str] = None
    duration_seconds: Optional[int] = None
    created_at: datetime


class AnalyticsSummary(BaseModel):
    total_views: int
    unique_visitors: int
    views_today: int
    views_this_week: int
    views_this_month: int
    top_locations: List[dict]
    views_by_day: List[dict]
    top_referrers: List[dict]
    average_view_duration: float
    returning_visitors: int


# ============================================================================
# TRACK VIEWS
# ============================================================================

@router.post("/track/card/{card_id}")
async def track_card_view(
    card_id: str,
    viewer_ip: Optional[str] = None,
    viewer_location: Optional[dict] = None,
    viewer_device: Optional[str] = None,
    referrer: Optional[str] = None,
    current_user: Optional[User] = None
):
    """Track a card view (called when someone views a card)"""
    view_doc = {
        "id": str(uuid.uuid4()),
        "card_id": card_id,
        "viewer_id": current_user.id if current_user else None,
        "viewer_ip": viewer_ip,
        "viewer_location": viewer_location,
        "viewer_device": viewer_device,
        "referrer": referrer,
        "duration_seconds": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.card_views.insert_one(view_doc)
    
    # Update card view count
    await db.cards.update_one(
        {"id": card_id},
        {"$inc": {"views": 1}}
    )
    
    return {"tracked": True, "view_id": view_doc["id"]}


@router.post("/track/card/{card_id}/duration")
async def track_view_duration(
    card_id: str,
    view_id: str,
    duration_seconds: int
):
    """Update view duration when user leaves the card page"""
    await db.card_views.update_one(
        {"id": view_id, "card_id": card_id},
        {"$set": {"duration_seconds": duration_seconds}}
    )
    return {"updated": True}


@router.post("/track/post/{post_id}")
async def track_post_view(
    post_id: str,
    current_user: Optional[User] = None
):
    """Track a post view"""
    view_doc = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "viewer_id": current_user.id if current_user else None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.post_views.insert_one(view_doc)
    
    # Update post view count
    await db.posts.update_one(
        {"id": post_id},
        {"$inc": {"views": 1}}
    )
    
    return {"tracked": True}


# ============================================================================
# ANALYTICS DASHBOARD (Pro/Business only)
# ============================================================================

@router.get("/cards/{card_id}")
async def get_card_analytics(
    card_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user)
):
    """Get analytics for a specific card (Pro/Business only)"""
    # Check subscription tier
    user_doc = await db.users.find_one({"id": current_user.id})
    tier = user_doc.get("subscription_tier", "free")
    
    if tier == "free":
        raise HTTPException(
            status_code=403, 
            detail="Analytics available for Pro and Business users only. Upgrade to access."
        )
    
    # Verify card ownership
    card = await db.cards.find_one({"id": card_id, "user_id": current_user.id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found or not owned by you")
    
    # Date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    views = await db.card_views.find({
        "card_id": card_id,
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    return {
        "card_id": card_id,
        "card_title": card.get("title"),
        "period_days": days,
        **_compute_view_metrics(views, days),
    }


def _compute_view_metrics(views: list, days: int) -> dict:
    """Compute all analytics metrics from a list of views."""
    total_views = len(views)
    unique_ips = {v.get("viewer_ip") for v in views if v.get("viewer_ip")}
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    views_today = sum(1 for v in views if v.get("created_at", "") >= today.isoformat())
    views_this_week = sum(1 for v in views if v.get("created_at", "") >= week_ago.isoformat())
    views_this_month = sum(1 for v in views if v.get("created_at", "") >= month_ago.isoformat())
    
    # Aggregate locations, referrers, and daily views
    location_counts = {}
    referrer_counts = {}
    ip_view_counts = {}
    
    for v in views:
        loc = v.get("viewer_location", {})
        if loc and loc.get("country"):
            key = f"{loc.get('city', 'Unknown')}, {loc.get('country')}"
            location_counts[key] = location_counts.get(key, 0) + 1
        
        ref = v.get("referrer", "Direct")
        if ref:
            referrer_counts[ref] = referrer_counts.get(ref, 0) + 1
        
        ip = v.get("viewer_ip")
        if ip:
            ip_view_counts[ip] = ip_view_counts.get(ip, 0) + 1
    
    top_locations = sorted(
        [{"location": k, "views": v} for k, v in location_counts.items()],
        key=lambda x: x["views"], reverse=True
    )[:10]
    
    top_referrers = sorted(
        [{"referrer": k, "views": v} for k, v in referrer_counts.items()],
        key=lambda x: x["views"], reverse=True
    )[:10]
    
    views_by_day = []
    for i in range(min(days, 30)):
        day = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        views_by_day.append({"date": day_str, "views": sum(1 for v in views if v.get("created_at", "").startswith(day_str))})
    views_by_day.reverse()
    
    durations = [v.get("duration_seconds", 0) for v in views if v.get("duration_seconds")]
    
    return {
        "total_views": total_views,
        "unique_visitors": len(unique_ips),
        "views_today": views_today,
        "views_this_week": views_this_week,
        "views_this_month": views_this_month,
        "top_locations": top_locations,
        "views_by_day": views_by_day,
        "top_referrers": top_referrers,
        "average_view_duration": round(sum(durations) / len(durations), 1) if durations else 0,
        "returning_visitors": sum(1 for count in ip_view_counts.values() if count > 1),
    }


@router.get("/overview")
async def get_analytics_overview(
    current_user: User = Depends(get_current_user)
):
    """Get analytics overview for all user's cards"""
    # Check subscription tier
    user_doc = await db.users.find_one({"id": current_user.id})
    tier = user_doc.get("subscription_tier", "free")
    
    if tier == "free":
        raise HTTPException(
            status_code=403,
            detail="Analytics available for Pro and Business users only"
        )
    
    # Get all user's cards
    cards = await db.cards.find(
        {"user_id": current_user.id},
        {"_id": 0, "id": 1, "title": 1, "views": 1}
    ).to_list(100)
    
    # Get views from last 30 days
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    total_views = 0
    card_stats = []
    
    for card in cards:
        views = await db.card_views.count_documents({
            "card_id": card["id"],
            "created_at": {"$gte": thirty_days_ago}
        })
        total_views += views
        card_stats.append({
            "card_id": card["id"],
            "card_title": card.get("title", "Sin título"),
            "views_30d": views,
            "total_views": card.get("views", 0)
        })
    
    # Sort by views
    card_stats.sort(key=lambda x: x["views_30d"], reverse=True)
    
    # Get post views
    posts = await db.posts.find(
        {"user_id": current_user.id},
        {"_id": 0, "id": 1, "views": 1}
    ).to_list(100)
    
    total_post_views = sum(p.get("views", 0) for p in posts)
    
    return {
        "subscription_tier": tier,
        "total_cards": len(cards),
        "total_card_views_30d": total_views,
        "total_post_views": total_post_views,
        "cards": card_stats[:10],  # Top 10 cards
        "period": "30 days"
    }


@router.get("/recent-visitors/{card_id}")
async def get_recent_visitors(
    card_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user)
):
    """Get recent visitors for a card (Business only)"""
    # Check subscription tier
    user_doc = await db.users.find_one({"id": current_user.id})
    tier = user_doc.get("subscription_tier", "free")
    
    if tier != "business":
        raise HTTPException(
            status_code=403,
            detail="Detailed visitor info available for Business users only"
        )
    
    # Verify card ownership
    card = await db.cards.find_one({"id": card_id, "user_id": current_user.id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Get recent views
    views = await db.card_views.find(
        {"card_id": card_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with viewer info if logged in
    enriched_views = []
    for view in views:
        viewer_info = None
        if view.get("viewer_id"):
            viewer = await db.users.find_one(
                {"id": view["viewer_id"]},
                {"_id": 0, "id": 1, "name": 1}
            )
            profile = await db.user_profiles.find_one(
                {"user_id": view["viewer_id"]},
                {"_id": 0, "display_name": 1, "avatar_url": 1}
            )
            if viewer:
                viewer_info = {
                    "id": viewer["id"],
                    "name": profile.get("display_name") if profile else viewer.get("name"),
                    "avatar_url": profile.get("avatar_url") if profile else None
                }
        
        enriched_views.append({
            **view,
            "viewer": viewer_info
        })
    
    return {
        "card_id": card_id,
        "visitors": enriched_views
    }


@router.get("/export/{card_id}")
async def export_analytics(
    card_id: str,
    days: int = Query(30, ge=1, le=365),
    format: str = Query("json", enum=["json", "csv"]),
    current_user: User = Depends(get_current_user)
):
    """Export analytics data (Business only)"""
    # Check subscription tier
    user_doc = await db.users.find_one({"id": current_user.id})
    tier = user_doc.get("subscription_tier", "free")
    
    if tier != "business":
        raise HTTPException(
            status_code=403,
            detail="Data export available for Business users only"
        )
    
    # Verify card ownership
    card = await db.cards.find_one({"id": card_id, "user_id": current_user.id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Get views
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    views = await db.card_views.find(
        {"card_id": card_id, "created_at": {"$gte": start_date}},
        {"_id": 0}
    ).to_list(10000)
    
    if format == "csv":
        # Generate CSV
        csv_lines = ["date,viewer_id,location,device,referrer,duration_seconds"]
        for v in views:
            loc = v.get("viewer_location", {})
            location_str = f"{loc.get('city', '')}, {loc.get('country', '')}" if loc else ""
            csv_lines.append(
                f"{v.get('created_at', '')},{v.get('viewer_id', '')},"
                f"{location_str},{v.get('viewer_device', '')},"
                f"{v.get('referrer', '')},{v.get('duration_seconds', '')}"
            )
        return {"format": "csv", "data": "\n".join(csv_lines)}
    
    return {"format": "json", "data": views}
