"""
Push Notifications Router - Web Push API implementation
Handles subscription management and push notification delivery
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from jose import JWTError, jwt
from pywebpush import webpush, WebPushException
import os
import json
import logging

router = APIRouter(prefix="/api/push", tags=["push-notifications"])
security = HTTPBearer()

# Database reference
_db = None
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production-123456789')
ALGORITHM = "HS256"

# VAPID Keys
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_EMAIL = os.environ.get('VAPID_EMAIL', 'mailto:admin@bruno.app')

def set_db(db):
    global _db
    _db = db

# Models
class PushSubscription(BaseModel):
    endpoint: str
    keys: dict  # {p256dh: str, auth: str}

class PushSubscriptionResponse(BaseModel):
    id: str
    user_id: str
    endpoint: str
    created_at: datetime

class NotificationPayload(BaseModel):
    title: str
    body: str
    icon: Optional[str] = "/bruno-logo.png"
    badge: Optional[str] = "/bruno-badge.png"
    url: Optional[str] = "/"
    tag: Optional[str] = None
    data: Optional[dict] = None
    image: Optional[str] = None
    actions: Optional[list] = None
    vibrate: Optional[list] = None
    renotify: bool = False
    silent: bool = False

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify token and get current user"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_identifier = payload.get("sub")
        if not user_identifier:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await _db.users.find_one({"email": user_identifier}, {"_id": 0, "password": 0})
        if not user:
            user = await _db.users.find_one({"id": user_identifier}, {"_id": 0, "password": 0})
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        class UserObj:
            def __init__(self, data):
                for key, value in data.items():
                    setattr(self, key, value)
        
        return UserObj(user)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Get VAPID public key for client subscription"""
    return {"publicKey": VAPID_PUBLIC_KEY}


@router.post("/subscribe")
async def subscribe_to_push(
    subscription: PushSubscription,
    current_user = Depends(get_current_user)
):
    """Subscribe user device to push notifications"""
    import uuid
    
    # Check if subscription already exists
    existing = await _db.push_subscriptions.find_one({
        "user_id": current_user.id,
        "endpoint": subscription.endpoint
    })
    
    if existing:
        return {"message": "Already subscribed", "id": existing.get("id")}
    
    sub_id = str(uuid.uuid4())
    sub_data = {
        "id": sub_id,
        "user_id": current_user.id,
        "endpoint": subscription.endpoint,
        "keys": subscription.keys,
        "created_at": datetime.now(timezone.utc),
        "last_used": datetime.now(timezone.utc)
    }
    
    await _db.push_subscriptions.insert_one(sub_data)
    
    # Update user preferences
    await _db.users.update_one(
        {"id": current_user.id},
        {"$set": {"push_notifications_enabled": True}}
    )
    
    return {"message": "Subscribed successfully", "id": sub_id}


@router.delete("/unsubscribe")
async def unsubscribe_from_push(
    endpoint: str,
    current_user = Depends(get_current_user)
):
    """Unsubscribe device from push notifications"""
    result = await _db.push_subscriptions.delete_one({
        "user_id": current_user.id,
        "endpoint": endpoint
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Check if user has other subscriptions
    remaining = await _db.push_subscriptions.count_documents({"user_id": current_user.id})
    if remaining == 0:
        await _db.users.update_one(
            {"id": current_user.id},
            {"$set": {"push_notifications_enabled": False}}
        )
    
    return {"message": "Unsubscribed successfully"}


@router.get("/subscriptions")
async def get_my_subscriptions(
    current_user = Depends(get_current_user)
):
    """Get all push subscriptions for current user"""
    subs = await _db.push_subscriptions.find(
        {"user_id": current_user.id},
        {"_id": 0, "keys": 0}
    ).to_list(20)
    
    return subs


async def send_push_notification(user_id: str, notification: NotificationPayload):
    """Send push notification to all user devices"""
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        logging.warning("VAPID keys not configured, skipping push notification")
        return
    
    subscriptions = await _db.push_subscriptions.find(
        {"user_id": user_id}
    ).to_list(10)
    
    if not subscriptions:
        return
    
    payload = json.dumps({
        "title": notification.title,
        "body": notification.body,
        "icon": notification.icon,
        "badge": notification.badge,
        "url": notification.url,
        "tag": notification.tag,
        "data": notification.data or {},
        "image": notification.image,
        "actions": notification.actions or [],
        "vibrate": notification.vibrate or [100, 50, 100],
        "renotify": notification.renotify,
        "silent": notification.silent,
        "requireInteraction": True,
    })
    
    failed_endpoints = []
    
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"]
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={
                    "sub": VAPID_EMAIL
                }
            )
            
            # Update last used
            await _db.push_subscriptions.update_one(
                {"id": sub["id"]},
                {"$set": {"last_used": datetime.now(timezone.utc)}}
            )
            
        except WebPushException as e:
            logging.error(f"Push notification failed: {e}")
            # If subscription is invalid, mark for deletion
            if e.response and e.response.status_code in [404, 410]:
                failed_endpoints.append(sub["endpoint"])
    
    # Clean up invalid subscriptions
    if failed_endpoints:
        await _db.push_subscriptions.delete_many({
            "user_id": user_id,
            "endpoint": {"$in": failed_endpoints}
        })


@router.post("/test")
async def send_test_notification(
    current_user = Depends(get_current_user)
):
    """Send a test push notification to the current user"""
    notification = NotificationPayload(
        title="BRUNO",
        body="¡Las notificaciones push están funcionando!",
        icon="/bruno-logo.png",
        url="/feed",
        tag="test"
    )
    
    await send_push_notification(current_user.id, notification)
    return {"message": "Test notification sent"}


# Helper functions for other modules to send notifications
async def notify_new_message(user_id: str, sender_name: str, message_preview: str):
    """Send notification for new chat message"""
    await send_push_notification(user_id, NotificationPayload(
        title=f"Mensaje de {sender_name}",
        body=message_preview[:100],
        icon="/bruno-logo.png",
        url="/chat",
        tag=f"message_{user_id}",
        renotify=True,
        actions=[{"action": "reply", "title": "Responder"}, {"action": "dismiss", "title": "Cerrar"}],
        vibrate=[200, 100, 200],
    ))

async def notify_new_follower(user_id: str, follower_name: str):
    """Send notification for new follower"""
    await send_push_notification(user_id, NotificationPayload(
        title="Nuevo seguidor",
        body=f"{follower_name} comenzo a seguirte",
        icon="/bruno-logo.png",
        url="/my-profile",
        tag="follower",
        actions=[{"action": "view_profile", "title": "Ver perfil"}],
    ))

async def notify_new_like(user_id: str, liker_name: str, content_type: str):
    """Send notification for new like"""
    await send_push_notification(user_id, NotificationPayload(
        title="Nuevo like",
        body=f"A {liker_name} le gusto tu {content_type}",
        icon="/bruno-logo.png",
        url="/feed",
        tag="like",
    ))

async def notify_new_comment(user_id: str, commenter_name: str, comment_preview: str):
    """Send notification for new comment"""
    await send_push_notification(user_id, NotificationPayload(
        title=f"Comentario de {commenter_name}",
        body=comment_preview[:100],
        icon="/bruno-logo.png",
        url="/feed",
        tag="comment"
    ))
