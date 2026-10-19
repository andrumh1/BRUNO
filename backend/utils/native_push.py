"""Native push (FCM + APNs via Firebase Cloud Messaging).

Reads a Firebase service-account JSON from FIREBASE_SERVICE_ACCOUNT_JSON
(path OR raw JSON blob). If not set, `send_native_push` becomes a no-op and
logs a warning so the app boots normally in preview/staging.

Send flow:
   backend calls send_push_notification(user_id, payload)
   → send_native_push(user_id, payload) is called AFTER web push
   → we look up mobile_devices for the user
   → build an FCM message per device_token and send in parallel
   → prune tokens returning UNREGISTERED / INVALID_ARGUMENT
"""
import os
import json
import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

_firebase_ready: Optional[bool] = None  # cached tri-state (None=untested)
_messaging = None


def _init_firebase() -> bool:
    """Initialize Firebase Admin SDK once; cached across calls."""
    global _firebase_ready, _messaging
    if _firebase_ready is not None:
        return _firebase_ready

    creds_source = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if not creds_source:
        logger.info("FIREBASE_SERVICE_ACCOUNT_JSON not set — native push disabled (web push still works)")
        _firebase_ready = False
        return False

    try:
        import firebase_admin
        from firebase_admin import credentials, messaging

        # Support both file paths and inline JSON blobs.
        if creds_source.strip().startswith("{"):
            cred = credentials.Certificate(json.loads(creds_source))
        else:
            cred = credentials.Certificate(creds_source)

        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)

        _messaging = messaging
        _firebase_ready = True
        logger.info("Firebase Admin SDK initialized — native push enabled")
        return True
    except Exception as e:
        logger.warning(f"Firebase init failed ({e}) — native push disabled")
        _firebase_ready = False
        return False


async def send_native_push(db, user_id: str, notification_dict: dict) -> int:
    """Send a push to every active FCM/APNs device registered by `user_id`.

    Returns the number of successful deliveries. Prunes dead tokens.
    Orden de preferencia: relay Cloud Run firmado (sin claves de Google) → firebase-admin con clave JSON → nada (solo Web Push).
    """
    from utils.fcm_relay import relay_enabled, relay_send

    if relay_enabled():
        devices = await db.mobile_devices.find({"user_id": user_id, "is_active": True}).to_list(50)
        tokens = [d["device_token"] for d in devices if d.get("device_token")]
        if not tokens:
            return 0
        try:
            res = await relay_send(user_id, tokens, notification_dict.get("title", "BRUNO"), notification_dict.get("body", ""),
                                   data=notification_dict.get("data"), url=notification_dict.get("url"), image=notification_dict.get("image"))
        except Exception as e:  # noqa: BLE001 — el aviso in-app y Web Push ya se enviaron; no se propaga
            logger.warning(f"FCM relay failed for user {user_id}: {e}")
            return 0
        if res.get("invalid_tokens"):
            await db.mobile_devices.update_many({"user_id": user_id, "device_token": {"$in": res["invalid_tokens"]}}, {"$set": {"is_active": False}})
        return int(res.get("sent", 0))

    if not _init_firebase():
        return 0

    # Pull registered devices from mobile_devices collection.
    devices = await db.mobile_devices.find(
        {"user_id": user_id, "is_active": True}
    ).to_list(50)
    if not devices:
        return 0

    from firebase_admin import messaging  # local import so import-time is cheap
    from firebase_admin.exceptions import FirebaseError

    title = notification_dict.get("title", "BRUNO")
    body = notification_dict.get("body", "")
    data = {k: str(v) for k, v in (notification_dict.get("data") or {}).items()}
    image = notification_dict.get("image")
    url = notification_dict.get("url")
    if url:
        data.setdefault("url", url)

    ok = 0
    dead_tokens = []
    for d in devices:
        token = d.get("device_token")
        if not token:
            continue
        try:
            msg = messaging.Message(
                token=token,
                notification=messaging.Notification(title=title, body=body, image=image),
                data=data,
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        icon="ic_notification",
                        color="#FF6B35",
                        sound="default",
                        click_action="FLUTTER_NOTIFICATION_CLICK",
                    ),
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            alert=messaging.ApsAlert(title=title, body=body),
                            sound="default",
                            badge=1,
                            content_available=True,
                        ),
                    ),
                ),
            )
            messaging.send(msg)
            ok += 1
        except FirebaseError as e:
            code = getattr(e, "code", "") or ""
            if any(bad in str(code).lower() for bad in ("unregistered", "invalid-argument", "not-found")):
                dead_tokens.append(token)
            else:
                logger.warning(f"FCM send failed for user {user_id}: {e}")
        except Exception as e:
            logger.warning(f"Unexpected FCM error for user {user_id}: {e}")

    # Prune dead tokens so we don't spam FCM with them next time.
    if dead_tokens:
        await db.mobile_devices.update_many(
            {"user_id": user_id, "device_token": {"$in": dead_tokens}},
            {"$set": {"is_active": False}},
        )

    return ok
