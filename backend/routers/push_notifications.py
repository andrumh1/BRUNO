"""
Push Notifications Router - Web Push API implementation
Handles subscription management and push notification delivery
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
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
    from utils.security import resolve_user_dict_from_token
    user = await resolve_user_dict_from_token(credentials.credentials if credentials else None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    return user


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


# Categoría de push a partir del tag/tipo. Ver NotificationPreferences (routers/notifications.py) para los defaults.
_CATEGORY_RULES = [
    ("incoming_call", "calls"), ("call", "calls"), ("message", "messages"), ("chat", "messages"), ("like", "likes"), ("comment", "comments"),
    ("follower", "followers"), ("follow", "followers"), ("story", "stories"), ("mention", "mentions"), ("order", "order_updates"), ("payment", "order_updates"),
    ("sale", "order_updates"), ("piup", "order_updates"), ("security", "account_security"), ("login", "account_security"), ("password", "account_security"),
    ("post_ready", "my_activity"), ("video_ready", "my_activity"), ("upload", "my_activity"), ("published", "my_activity"), ("my_activity", "my_activity"),
    ("live", "lives"), ("promo", "promotions"), ("favorite", "product_favorites"), ("cart", "product_cart"),
]
ALWAYS_PUSH = {"account_security"}


def push_category(notification: "NotificationPayload") -> str:
    key = f"{(notification.data or {}).get('category', '')} {(notification.data or {}).get('type', '')} {notification.tag or ''}".lower()
    for needle, cat in _CATEGORY_RULES:
        if needle in key:
            return cat
    return "other"


async def push_allowed(user_id: str, notification: "NotificationPayload") -> bool:
    """Preferencias del usuario + anti-duplicados (mismo tag en 10 min). Las notificaciones in-app no pasan por aquí."""
    from routers.notifications import NotificationPreferences
    cat = push_category(notification)
    prefs = await _db.notification_preferences.find_one({"user_id": user_id}, {"_id": 0}) or {}
    merged = {**NotificationPreferences().model_dump(), **prefs}
    if cat not in ALWAYS_PUSH and (not merged.get("push_enabled", True) or cat == "other" or not merged.get(cat, False)):
        return False
    if notification.tag and notification.tag != "incoming_call":
        recent = await _db.push_log.find_one({"user_id": user_id, "tag": notification.tag, "at": {"$gte": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()}}, {"_id": 0})
        if recent:
            return False
    await _db.push_log.insert_one({"user_id": user_id, "tag": notification.tag, "category": cat, "at": datetime.now(timezone.utc).isoformat(), "expires_at": datetime.now(timezone.utc) + timedelta(days=1)})
    return True


async def send_push_notification(user_id: str, notification: NotificationPayload):
    """Send push notification to all user devices (web push + nativo). Respeta preferencias y evita duplicados."""
    if not await push_allowed(user_id, notification):
        return
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        logging.warning("VAPID keys not configured, skipping web push")

    from utils.dnd import is_dnd_active
    if is_dnd_active(await _db.users.find_one({"id": user_id}, {"_id": 0, "dnd": 1})):
        return
    
    subscriptions = await _db.push_subscriptions.find({"user_id": user_id}).to_list(10) if VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY else []
    
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
        "requireInteraction": notification.tag == "incoming_call",
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

    # ── Native push (FCM/APNs) for iOS + Android devices ─────────────────
    try:
        from utils.native_push import send_native_push
        native_payload = {
            "title": notification.title,
            "body": notification.body,
            "image": notification.image,
            "url": notification.url,
            "data": notification.data or {},
        }
        await send_native_push(_db, user_id, native_payload)
    except Exception as e:
        logging.warning(f"Native push failed for {user_id}: {e}")


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
async def notify_new_message(user_id: str, sender_name: str, message_preview: str, chat_id: Optional[str] = None, sender_avatar: Optional[str] = None):
    """Send notification for new chat message — grouped by chat for mobile."""
    tag = f"message_{chat_id}" if chat_id else f"message_{user_id}"
    url = f"/chat?chat={chat_id}" if chat_id else "/chat"
    await send_push_notification(user_id, NotificationPayload(
        title=f"Mensaje de {sender_name}",
        body=message_preview[:120],
        icon=sender_avatar or "/bruno-logo.png",
        badge="/bruno-badge.png",
        url=url,
        tag=tag,
        renotify=True,
        actions=[{"action": "reply", "title": "Responder"}, {"action": "dismiss", "title": "Cerrar"}],
        vibrate=[200, 100, 200],
        data={"chat_id": chat_id, "url": url, "kind": "message"},
    ))

async def notify_new_follower(user_id: str, follower_name: str, follower_id: Optional[str] = None, follower_avatar: Optional[str] = None):
    """Send notification for new follower."""
    profile_url = f"/profile/{follower_id}" if follower_id else "/my-profile"
    await send_push_notification(user_id, NotificationPayload(
        title="Nuevo seguidor",
        body=f"{follower_name} comenzo a seguirte",
        icon=follower_avatar or "/bruno-logo.png",
        badge="/bruno-badge.png",
        url=profile_url,
        tag=f"follower_{follower_id}" if follower_id else "follower",
        actions=[{"action": "view_profile", "title": "Ver perfil"}],
        vibrate=[100, 50, 100],
        data={"profile_url": profile_url, "url": profile_url, "kind": "follower"},
    ))

async def notify_new_like(user_id: str, liker_name: str, content_type: str, post_id: Optional[str] = None, image_url: Optional[str] = None):
    """Send notification for new like — rich preview if image is available."""
    url = f"/post/{post_id}" if post_id else "/feed"
    await send_push_notification(user_id, NotificationPayload(
        title="Nuevo like",
        body=f"A {liker_name} le gusto tu {content_type}",
        icon="/bruno-logo.png",
        badge="/bruno-badge.png",
        url=url,
        tag=f"like_{post_id}" if post_id else "like",
        image=image_url,
        vibrate=[80, 40, 80],
        data={"post_id": post_id, "url": url, "kind": "like"},
    ))

async def notify_new_comment(user_id: str, commenter_name: str, comment_preview: str, post_id: Optional[str] = None, commenter_avatar: Optional[str] = None):
    """Send notification for new comment."""
    url = f"/post/{post_id}" if post_id else "/feed"
    await send_push_notification(user_id, NotificationPayload(
        title=f"Comentario de {commenter_name}",
        body=comment_preview[:120],
        icon=commenter_avatar or "/bruno-logo.png",
        badge="/bruno-badge.png",
        url=url,
        tag=f"comment_{post_id}" if post_id else "comment",
        renotify=True,
        actions=[{"action": "reply", "title": "Responder"}, {"action": "dismiss", "title": "Cerrar"}],
        vibrate=[100, 50, 100, 50, 100],
        data={"post_id": post_id, "url": url, "kind": "comment"},
    ))

async def notify_story_reaction(user_id: str, reactor_name: str, emoji: str, story_id: Optional[str] = None, reactor_avatar: Optional[str] = None):
    """Send notification when someone reacts to a story."""
    url = f"/stories/{story_id}" if story_id else "/my-profile?tab=stories"
    await send_push_notification(user_id, NotificationPayload(
        title=f"{reactor_name} reacciono a tu historia",
        body=f"{emoji}  Toca para ver",
        icon=reactor_avatar or "/bruno-logo.png",
        badge="/bruno-badge.png",
        url=url,
        tag=f"story_reaction_{story_id}" if story_id else "story_reaction",
        vibrate=[100, 50, 100],
        data={"story_id": story_id, "url": url, "kind": "story_reaction"},
    ))

async def notify_incoming_call(user_id: str, caller_name: str, call_id: str, caller_avatar: Optional[str] = None, video: bool = False):
    """Incoming call notification — requireInteraction + persistent actions."""
    url = f"/chat?accept_call={call_id}"
    body = "Llamada de video entrante" if video else "Llamada entrante"
    await send_push_notification(user_id, NotificationPayload(
        title=caller_name,
        body=body,
        icon=caller_avatar or "/bruno-logo.png",
        badge="/bruno-badge.png",
        url=url,
        tag="incoming_call",
        renotify=True,
        silent=False,
        vibrate=[200, 100, 200, 100, 200, 100, 200],
        actions=[{"action": "accept", "title": "Aceptar"}, {"action": "decline", "title": "Rechazar"}],
        data={"call_id": call_id, "url": url, "kind": "call", "video": video},
    ))


async def notify_nfc_scan(
    user_id: str,
    card_id: Optional[str] = None,
    card_title: Optional[str] = None,
    card_image: Optional[str] = None,
    nfc_id: Optional[str] = None,
):
    """Notify the owner when their NFC card/tag is scanned.

    Rich rendering: shows card banner as preview image on mobile, quick action
    to open analytics. Tag is per-NFC so refresh-spam replaces in place.
    """
    url = f"/c/{card_id}/analytics" if card_id else "/nfc-cards"
    body = f"Alguien acaba de escanear tu tarjeta «{card_title}»" if card_title else "Alguien acaba de escanear tu tarjeta NFC"
    await send_push_notification(user_id, NotificationPayload(
        title="Tu tarjeta cobro vida",
        body=body,
        icon="/bruno-logo.png",
        badge="/bruno-badge.png",
        url=url,
        tag=f"nfc_scan_{nfc_id or card_id or 'generic'}",
        image=card_image,
        renotify=False,
        vibrate=[80, 40, 80],
        actions=[{"action": "view_analytics", "title": "Ver analitica"}],
        data={"card_id": card_id, "nfc_id": nfc_id, "url": url, "kind": "nfc_scan"},
    ))
