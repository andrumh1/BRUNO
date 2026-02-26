"""Push notifications routes with email support."""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import json
import os

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])

# Notification types
NOTIFICATION_TYPES = {
    "incoming_call": {"title": "Llamada entrante", "icon": "phone"},
    "new_message": {"title": "Nuevo mensaje", "icon": "message"},
    "new_follower": {"title": "Nuevo seguidor", "icon": "user-plus"},
    "post_like": {"title": "Nuevo like", "icon": "heart"},
    "post_comment": {"title": "Nuevo comentario", "icon": "message-circle"},
    "product_favorited": {"title": "Favorito en tu producto", "icon": "star"},
    "product_cart_added": {"title": "Producto agregado al carrito", "icon": "shopping-cart"},
    "new_story": {"title": "Nueva historia", "icon": "camera"},
    "mention": {"title": "Te mencionaron", "icon": "at-sign"},
    "order_update": {"title": "Actualización de pedido", "icon": "package"},
    "promotion": {"title": "Promoción especial", "icon": "tag"}
}


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict
    expirationTime: Optional[str] = None


class SubscribeRequest(BaseModel):
    subscription: dict


class NotificationPayload(BaseModel):
    title: str
    body: str
    icon: Optional[str] = "/bruno-icon.png"
    badge: Optional[str] = "/bruno-icon.png"
    tag: Optional[str] = "bruno-notification"
    type: Optional[str] = None
    data: Optional[dict] = {}
    url: Optional[str] = None


@router.post("/subscribe")
async def subscribe_to_push(
    request: SubscribeRequest,
    current_user: User = Depends(get_current_user)
):
    """Subscribe user to push notifications"""
    subscription_data = request.subscription
    
    # Store subscription in database
    await db.push_subscriptions.update_one(
        {"user_id": current_user.id},
        {
            "$set": {
                "user_id": current_user.id,
                "subscription": subscription_data,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"status": "subscribed"}


@router.delete("/unsubscribe")
async def unsubscribe_from_push(
    current_user: User = Depends(get_current_user)
):
    """Unsubscribe user from push notifications"""
    await db.push_subscriptions.delete_one({"user_id": current_user.id})
    return {"status": "unsubscribed"}


@router.get("/status")
async def get_notification_status(
    current_user: User = Depends(get_current_user)
):
    """Get user's push notification subscription status"""
    subscription = await db.push_subscriptions.find_one(
        {"user_id": current_user.id},
        {"_id": 0}
    )
    
    return {
        "subscribed": subscription is not None,
        "updated_at": subscription.get("updated_at") if subscription else None
    }


# Notification preferences - expanded
class NotificationPreferences(BaseModel):
    # Push notifications
    push_enabled: bool = True
    calls: bool = True
    messages: bool = True
    likes: bool = True
    comments: bool = True
    followers: bool = True
    product_favorites: bool = True
    product_cart: bool = True
    stories: bool = True
    mentions: bool = True
    order_updates: bool = True
    promotions: bool = False
    
    # Email notifications
    email_enabled: bool = False
    email_messages: bool = False
    email_followers: bool = False
    email_product_activity: bool = False
    email_order_updates: bool = True
    email_promotions: bool = False
    email_weekly_digest: bool = False


@router.get("/preferences")
async def get_notification_preferences(
    current_user: User = Depends(get_current_user)
):
    """Get user's notification preferences"""
    prefs = await db.notification_preferences.find_one(
        {"user_id": current_user.id},
        {"_id": 0}
    )
    
    if not prefs:
        # Return defaults
        return NotificationPreferences().model_dump()
    
    return prefs


@router.put("/preferences")
async def update_notification_preferences(
    preferences: NotificationPreferences,
    current_user: User = Depends(get_current_user)
):
    """Update user's notification preferences"""
    await db.notification_preferences.update_one(
        {"user_id": current_user.id},
        {
            "$set": {
                "user_id": current_user.id,
                **preferences.model_dump(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"status": "updated"}


# Helper function to send push notification (called from other parts of the app)
async def send_push_notification(user_id: str, payload: dict):
    """Send push notification to a user"""
    subscription_doc = await db.push_subscriptions.find_one({"user_id": user_id})
    
    if not subscription_doc:
        return False
    
    # Check user preferences
    prefs = await db.notification_preferences.find_one({"user_id": user_id})
    if prefs:
        notification_type = payload.get("type", "")
        if notification_type == "incoming_call" and not prefs.get("calls", True):
            return False
        if notification_type == "new_message" and not prefs.get("messages", True):
            return False
        if notification_type == "post_like" and not prefs.get("likes", True):
            return False
        if notification_type == "post_comment" and not prefs.get("comments", True):
            return False
        if notification_type == "new_follower" and not prefs.get("followers", True):
            return False
    
    # In production, use pywebpush to actually send the notification
    # For now, we'll log it and store for polling
    notification_log = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "payload": payload,
        "sent": False,  # Would be True after pywebpush sends it
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notification_logs.insert_one(notification_log)
    
    return True


# Get recent notifications (for in-app notification center)
@router.get("/recent")
async def get_recent_notifications(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Get recent notifications for user"""
    notifications = await db.notification_logs.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return notifications


@router.post("/mark-read/{notification_id}")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read"""
    result = await db.notification_logs.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"status": "marked_read"}


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read"""
    await db.notification_logs.update_many(
        {"user_id": current_user.id, "read": {"$ne": True}},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "all_marked_read"}
