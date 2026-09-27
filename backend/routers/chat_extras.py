"""Chat extras: message reactions (toggle, who reacted) and in-conversation search."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import logging
import re

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from utils.ws_manager import ws_manager
from models.user import User

router = APIRouter(tags=["chat-extras"])
logger = logging.getLogger(__name__)


async def _chat_for(chat_id: str, user_id: str) -> dict:
    chat = await db.chats.find_one({"id": chat_id, "participants": user_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


async def _names(ids):
    ids = list({i for i in ids if i})
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1})}
    profiles = {p["user_id"]: p async for p in db.user_profiles.find({"user_id": {"$in": ids}}, {"_id": 0, "user_id": 1, "display_name": 1, "avatar_url": 1})}
    out = {}
    for i in ids:
        u, p = users.get(i, {}), profiles.get(i, {})
        out[i] = {"id": i, "name": p.get("display_name") or u.get("name") or (u.get("email") or "Usuario").split("@")[0], "avatar_url": p.get("avatar_url")}
    return out


@router.post("/chats/{chat_id}/messages/{message_id}/react")
async def react_to_message(chat_id: str, message_id: str, emoji: str = "❤️", current_user: User = Depends(get_current_user)):
    """Toggle my reaction: same emoji again removes it, a different emoji replaces it."""
    chat = await _chat_for(chat_id, current_user.id)
    msg = await db.messages.find_one({"id": message_id, "chat_id": chat_id}, {"_id": 0, "reactions": 1, "sender_id": 1})
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    emoji = (emoji or "❤️")[:8]
    reactions = [r for r in (msg.get("reactions") or []) if r.get("user_id") != current_user.id]
    mine = next((r for r in (msg.get("reactions") or []) if r.get("user_id") == current_user.id), None)
    action = "removed"
    if not mine or mine.get("emoji") != emoji:
        reactions.append({"user_id": current_user.id, "emoji": emoji, "created_at": datetime.now(timezone.utc).isoformat()})
        action = "added"
    await db.messages.update_one({"id": message_id}, {"$set": {"reactions": reactions}})
    payload = {"type": "message_reaction", "chat_id": chat_id, "message_id": message_id, "reactions": reactions, "by": current_user.id, "emoji": emoji, "action": action}
    try:
        await ws_manager.broadcast_to_users(payload, chat["participants"])
    except Exception as e:
        logger.warning(f"reaction broadcast failed: {e}")
    return {"action": action, "reactions": reactions}


@router.get("/chats/{chat_id}/messages/{message_id}/reactions")
async def message_reactions(chat_id: str, message_id: str, current_user: User = Depends(get_current_user)):
    """Who reacted, grouped by emoji."""
    await _chat_for(chat_id, current_user.id)
    msg = await db.messages.find_one({"id": message_id, "chat_id": chat_id}, {"_id": 0, "reactions": 1})
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    reactions = msg.get("reactions") or []
    names = await _names([r.get("user_id") for r in reactions])
    grouped = {}
    for r in reactions:
        grouped.setdefault(r.get("emoji"), []).append({**names.get(r.get("user_id"), {"id": r.get("user_id"), "name": "Usuario"}), "created_at": r.get("created_at"), "is_me": r.get("user_id") == current_user.id})
    return {"total": len(reactions), "groups": [{"emoji": e, "count": len(u), "users": u} for e, u in grouped.items()]}


@router.get("/chats/{chat_id}/messages/search")
async def search_messages(chat_id: str, q: str, limit: int = 30, current_user: User = Depends(get_current_user)):
    """Find messages by word; `offset` = how many newer messages exist (so the client knows how far to load)."""
    await _chat_for(chat_id, current_user.id)
    q = (q or "").strip()
    if len(q) < 2:
        return {"total": 0, "results": []}
    rx = re.compile(re.escape(q), re.IGNORECASE)
    hits = await db.messages.find({"chat_id": chat_id, "is_deleted": False, "content": {"$regex": rx}}, {"_id": 0, "id": 1, "content": 1, "sender_id": 1, "created_at": 1, "message_type": 1}).sort("created_at", -1).limit(limit).to_list(limit)
    names = await _names([h["sender_id"] for h in hits])
    results = []
    for h in hits:
        offset = await db.messages.count_documents({"chat_id": chat_id, "is_deleted": False, "created_at": {"$gt": h["created_at"]}})
        m = rx.search(h.get("content") or "")
        start = max(0, (m.start() if m else 0) - 30)
        snippet = (h.get("content") or "")[start:start + 110]
        results.append({"id": h["id"], "created_at": h["created_at"], "message_type": h.get("message_type"), "snippet": ("…" if start > 0 else "") + snippet,
                        "sender": names.get(h["sender_id"], {"id": h["sender_id"], "name": "Usuario"}), "offset": offset})
    total = await db.messages.count_documents({"chat_id": chat_id, "is_deleted": False, "content": {"$regex": rx}})
    return {"total": total, "results": results}
