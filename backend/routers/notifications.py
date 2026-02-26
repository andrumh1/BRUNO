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
async def send_push_notification(user_id: str, payload: dict, send_email: bool = False):
    """Send push notification to a user, optionally with email"""
    subscription_doc = await db.push_subscriptions.find_one({"user_id": user_id})
    
    # Check user preferences
    prefs = await db.notification_preferences.find_one({"user_id": user_id})
    notification_type = payload.get("type", "")
    
    push_allowed = True
    email_allowed = False
    
    if prefs:
        # Check if push is enabled globally
        if not prefs.get("push_enabled", True):
            push_allowed = False
        else:
            # Check specific notification type preferences
            type_map = {
                "incoming_call": "calls",
                "new_message": "messages",
                "post_like": "likes",
                "post_comment": "comments",
                "new_follower": "followers",
                "product_favorited": "product_favorites",
                "product_cart_added": "product_cart",
                "new_story": "stories",
                "mention": "mentions",
                "order_update": "order_updates",
                "promotion": "promotions"
            }
            pref_key = type_map.get(notification_type)
            if pref_key and not prefs.get(pref_key, True):
                push_allowed = False
        
        # Check email preferences
        if prefs.get("email_enabled", False) and send_email:
            email_type_map = {
                "new_message": "email_messages",
                "new_follower": "email_followers",
                "product_favorited": "email_product_activity",
                "product_cart_added": "email_product_activity",
                "order_update": "email_order_updates",
                "promotion": "email_promotions"
            }
            email_pref_key = email_type_map.get(notification_type)
            if email_pref_key and prefs.get(email_pref_key, False):
                email_allowed = True
    
    # Store notification log
    notification_log = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "payload": payload,
        "type": notification_type,
        "push_sent": False,
        "email_sent": False,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Send push notification if allowed and subscribed
    if push_allowed and subscription_doc:
        # In production, use pywebpush to actually send
        notification_log["push_sent"] = True
        # TODO: Actual push send with pywebpush
    
    # Send email notification if allowed
    if email_allowed:
        # Get user email
        user_doc = await db.users.find_one({"id": user_id}, {"email": 1})
        if user_doc and user_doc.get("email"):
            notification_log["email_sent"] = True
            # TODO: Integrate with email service (SendGrid/Resend)
            # await send_email_notification(user_doc["email"], payload)
    
    await db.notification_logs.insert_one(notification_log)
    
    return {"push_sent": notification_log["push_sent"], "email_sent": notification_log["email_sent"]}


# Unified notification sender for different event types
async def notify_user(
    user_id: str,
    notification_type: str,
    title: str,
    body: str,
    data: dict = None,
    url: str = None
):
    """
    Unified function to send notifications from anywhere in the app.
    Usage:
        await notify_user(
            user_id="xxx",
            notification_type="new_message",
            title="Nuevo mensaje",
            body="Juan te envió un mensaje",
            data={"chat_id": "xxx"},
            url="/chat/xxx"
        )
    """
    payload = {
        "title": title,
        "body": body,
        "type": notification_type,
        "data": data or {},
        "url": url,
        "icon": NOTIFICATION_TYPES.get(notification_type, {}).get("icon", "bell"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    return await send_push_notification(user_id, payload, send_email=True)


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


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user)
):
    """Get unread notification count"""
    count = await db.notification_logs.count_documents({
        "user_id": current_user.id,
        "read": {"$ne": True}
    })
    return {"count": count}


@router.get("/types")
async def get_notification_types():
    """Get all notification types with their info"""
    return NOTIFICATION_TYPES
