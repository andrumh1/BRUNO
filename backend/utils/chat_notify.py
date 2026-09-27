"""Chat message notifications shared by the REST and WebSocket send paths.
Muted participants are skipped — unless they were @mentioned (mentions always break through)."""
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional

from utils.database import db
from utils.chat_mute import muted_user_ids
from utils.notification_realtime import emit_notification_ws

logger = logging.getLogger(__name__)


async def notify_chat_message(chat: dict, sender_id: str, sender_name: str, content: str, mentions: Optional[List[str]] = None, has_attachment: bool = False):
    from routers.push_notifications import notify_new_message
    mentions = set(mentions or []) & set(chat.get("participants") or [])
    muted = muted_user_ids(chat)
    group_name = chat.get("name") if chat.get("is_group") else None
    sender_label = f"{sender_name} · {group_name}" if group_name else sender_name
    preview = (content or "")[:100] or ("Envió un archivo" if has_attachment else "Nuevo mensaje")
    now = datetime.now(timezone.utc).isoformat()
    for uid in chat.get("participants") or []:
        if uid == sender_id:
            continue
        mentioned = uid in mentions
        if uid in muted and not mentioned:
            continue
        ntype = "mention" if mentioned else "message"
        text = f"{sender_name} te mencionó en {group_name}: {preview[:60]}" if mentioned and group_name else (f"{sender_name} te mencionó: {preview[:60]}" if mentioned else preview)
        doc = {"id": str(uuid.uuid4()), "user_id": uid, "actor_id": sender_id, "type": ntype, "target_id": chat["id"], "target_type": "chat",
               "content": text, "message": text, "is_read": False, "created_at": now}
        try:
            await db.notifications.insert_one(dict(doc))
            await emit_notification_ws(doc)
            await notify_new_message(uid, f"{sender_name} te mencionó" + (f" en {group_name}" if group_name else "") if mentioned else sender_label, preview[:50])
        except Exception as e:
            logger.warning(f"chat notification failed for {uid}: {e}")
