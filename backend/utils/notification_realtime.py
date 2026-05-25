"""Notification realtime helpers — emit WS events for newly created notifications."""
from typing import Optional


async def emit_notification_ws(notif_doc: dict, user_id: Optional[str] = None) -> None:
    """Send a 'notification' event over the user's open WebSocket connections.

    Uses the global ws_manager from server.py. Failures are swallowed so we
    never break the request that created the notification.
    """
    try:
        target = user_id or notif_doc.get("user_id")
        if not target:
            return
        from utils.ws_manager import ws_manager
        payload = {
            "type": "notification",
            "notification": notif_doc,
        }
        await ws_manager.send_personal_message(payload, target)
    except Exception:
        # best-effort — never block the caller
        return
