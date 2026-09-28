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
    if msg is None:
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


# ─── Pinned message (group admin / any 1:1 participant) ──────────────────────
@router.post("/chats/{chat_id}/pin/{message_id}")
async def pin_message(chat_id: str, message_id: str, current_user: User = Depends(get_current_user)):
    chat = await _chat_for(chat_id, current_user.id)
    if chat.get("is_group") and chat.get("admin_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el administrador puede fijar mensajes")
    msg = await db.messages.find_one({"id": message_id, "chat_id": chat_id, "is_deleted": False}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    names = await _names([msg["sender_id"]])
    preview = msg.get("content") or {"image": "📷 Foto", "video": "🎬 Video", "audio": "🎤 Nota de voz", "card": "📇 Tarjeta", "file": "📎 Archivo"}.get(msg.get("message_type"), "Mensaje")
    pinned = {"id": message_id, "content": preview[:160], "message_type": msg.get("message_type"), "sender_name": names.get(msg["sender_id"], {}).get("name", "Usuario"),
              "pinned_by": current_user.id, "pinned_by_name": current_user.name, "pinned_at": datetime.now(timezone.utc).isoformat()}
    await db.chats.update_one({"id": chat_id}, {"$set": {"pinned_message": pinned}})
    try:
        await ws_manager.broadcast_to_users({"type": "message_pinned", "chat_id": chat_id, "pinned_message": pinned}, chat["participants"])
    except Exception as e:
        logger.warning(f"pin broadcast failed: {e}")
    return {"pinned_message": pinned}


@router.delete("/chats/{chat_id}/pin")
async def unpin_message(chat_id: str, current_user: User = Depends(get_current_user)):
    chat = await _chat_for(chat_id, current_user.id)
    if chat.get("is_group") and chat.get("admin_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el administrador puede quitar el mensaje fijado")
    await db.chats.update_one({"id": chat_id}, {"$unset": {"pinned_message": ""}})
    try:
        await ws_manager.broadcast_to_users({"type": "message_pinned", "chat_id": chat_id, "pinned_message": None}, chat["participants"])
    except Exception:
        pass
    return {"pinned_message": None}


# ─── Read receipts: who has seen a message ───────────────────────────────────
@router.get("/chats/{chat_id}/messages/{message_id}/read-by")
async def message_read_by(chat_id: str, message_id: str, current_user: User = Depends(get_current_user)):
    chat = await _chat_for(chat_id, current_user.id)
    msg = await db.messages.find_one({"id": message_id, "chat_id": chat_id}, {"_id": 0, "read_by": 1, "sender_id": 1, "created_at": 1})
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    read = set(msg.get("read_by") or [])
    others = [p for p in chat["participants"] if p != msg["sender_id"]]
    names = await _names(others)
    seen = [names[p] for p in others if p in read and p in names]
    pending = [names[p] for p in others if p not in read and p in names]
    return {"seen": seen, "pending": pending, "seen_count": len(seen), "total": len(others)}


# ─── Voice notes → text (whisper-1 via Emergent key) ─────────────────────────
async def transcribe_message_audio(message_id: str):
    """Background: download the audio attachment, transcribe, store `transcript`, broadcast."""
    import os, tempfile, httpx
    from emergentintegrations.llm.openai import OpenAISpeechToText
    msg = await db.messages.find_one({"id": message_id}, {"_id": 0, "chat_id": 1, "attachments": 1, "transcript": 1})
    if not msg or msg.get("transcript") is not None:
        return
    att = next((a for a in (msg.get("attachments") or []) if str(a.get("type", "")).startswith("audio") or a.get("url", "").endswith((".webm", ".m4a", ".mp3", ".wav", ".ogg"))), None)
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not att or not att.get("url") or not api_key:
        return
    await db.messages.update_one({"id": message_id}, {"$set": {"transcript_status": "processing"}})
    path = None
    try:
        async with httpx.AsyncClient(timeout=40) as client:
            r = await client.get(att["url"]); r.raise_for_status()
        ctype = r.headers.get("content-type", "")
        ext = "mp4" if "mp4" in ctype or att["url"].endswith((".m4a", ".mp4")) else "mp3" if "mpeg" in ctype or att["url"].endswith(".mp3") else "wav" if "wav" in ctype else "ogg" if "ogg" in ctype else "webm"
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
            tmp.write(r.content); path = tmp.name
        stt = OpenAISpeechToText(api_key=api_key)
        with open(path, "rb") as f:
            res = await stt.transcribe(file=f, model="whisper-1", response_format="json", language="es")
        text = (getattr(res, "text", "") or "").strip()
        await db.messages.update_one({"id": message_id}, {"$set": {"transcript": text, "transcript_status": "done"}})
        chat = await db.chats.find_one({"id": msg["chat_id"]}, {"_id": 0, "participants": 1})
        if chat:
            await ws_manager.broadcast_to_users({"type": "message_transcript", "chat_id": msg["chat_id"], "message_id": message_id, "transcript": text}, chat["participants"])
    except Exception as e:
        logger.warning(f"transcription failed for {message_id}: {e}")
        await db.messages.update_one({"id": message_id}, {"$set": {"transcript_status": "failed"}})
    finally:
        if path:
            try: os.remove(path)
            except Exception: pass


@router.post("/chats/{chat_id}/messages/{message_id}/transcribe")
async def request_transcription(chat_id: str, message_id: str, current_user: User = Depends(get_current_user)):
    await _chat_for(chat_id, current_user.id)
    msg = await db.messages.find_one({"id": message_id, "chat_id": chat_id}, {"_id": 0, "transcript": 1, "transcript_status": 1})
    if msg is None:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    if msg.get("transcript") is not None:
        return {"transcript": msg["transcript"], "status": "done"}
    import asyncio
    asyncio.create_task(transcribe_message_audio(message_id))
    return {"transcript": None, "status": "processing"}
