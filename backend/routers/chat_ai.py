"""AI helpers for chat: catch-up summary of unread group messages + one-tap translation (any text)."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from models.user import User

router = APIRouter(tags=["chat-ai"])
logger = logging.getLogger(__name__)

LANG_NAMES = {"es": "español", "en": "inglés", "pt": "portugués", "fr": "francés", "de": "alemán", "it": "italiano", "zh": "chino", "ja": "japonés", "ar": "árabe", "ru": "ruso", "ko": "coreano", "hi": "hindi"}


async def _llm(system: str, prompt: str, model: str = "gpt-4o-mini") -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    chat = LlmChat(api_key=api_key, session_id=f"chatai-{uuid.uuid4()}", system_message=system).with_model("openai", model)
    res = await chat.send_message(UserMessage(text=prompt))
    return (res or "").strip()


class TranslateIn(BaseModel):
    text: str
    target: Optional[str] = "es"
    source_hint: Optional[str] = None


@router.post("/ai/translate")
async def translate_text(body: TranslateIn, current_user: User = Depends(get_current_user)):
    """Translate any text (chat message, transcript, comment...) to the user's language. Cached by hash."""
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Texto vacío")
    if len(text) > 4000:
        text = text[:4000]
    target = (body.target or "es").lower()[:5]
    key = hashlib.sha1(f"{target}:{text}".encode()).hexdigest()
    cached = await db.translations.find_one({"key": key}, {"_id": 0})
    if cached:
        return {"translated": cached["translated"], "detected": cached.get("detected"), "target": target, "cached": True}
    lang = LANG_NAMES.get(target, target)
    out = await _llm(
        "Eres un traductor. Devuelve SOLO el texto traducido, sin comillas ni explicaciones. Conserva emojis, menciones (@nombre), enlaces y saltos de línea. "
        "Formato de salida obligatorio: línea 1 = código ISO-639-1 (2 letras) del idioma en que está ESCRITO EL TEXTO ORIGINAL (p. ej. 'en' si el original está en inglés); "
        "línea 2 en adelante = la traducción completa.",
        f"Idioma destino: {lang}.\nTexto original:\n\"\"\"{text}\"\"\"")
    lines = out.split("\n", 1)
    detected = lines[0].strip().lower()[:5] if len(lines) > 1 and len(lines[0].strip()) <= 5 else None
    translated = lines[1].strip() if detected else out
    await db.translations.update_one({"key": key}, {"$set": {"key": key, "translated": translated, "detected": detected, "target": target, "created_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    translated = translated.strip().strip('"').strip()
    same = translated.lower() == text.lower()
    return {"translated": translated, "detected": detected, "target": target, "same_language": same, "cached": False}


@router.post("/chats/{chat_id}/summary")
async def summarize_unread(chat_id: str, limit: int = 120, since: Optional[str] = None, count: Optional[int] = None, current_user: User = Depends(get_current_user)):
    """Summarize what I missed: unread messages, the last `count` messages from others, or since a timestamp."""
    chat = await db.chats.find_one({"id": chat_id, "participants": current_user.id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    query = {"chat_id": chat_id, "is_deleted": False, "sender_id": {"$ne": current_user.id}, "message_type": {"$nin": ["system", "call"]}}
    if since:
        query["created_at"] = {"$gt": since}
    elif count:
        if int(count) < 3:
            return {"count": int(count), "summary": None, "reason": "few"}
        limit = min(int(count), limit)
    else:
        query["read_by"] = {"$nin": [current_user.id]}
    msgs = await db.messages.find(query, {"_id": 0, "sender_id": 1, "content": 1, "message_type": 1, "created_at": 1, "transcript": 1, "attachments": 1}).sort("created_at", -1).limit(limit).to_list(limit)
    msgs.reverse()
    if len(msgs) < 3:
        return {"count": len(msgs), "summary": None, "reason": "few"}
    ids = list({m["sender_id"] for m in msgs})
    users = {u["id"]: (u.get("name") or "Alguien") async for u in db.users.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "name": 1})}
    lines = []
    for m in msgs:
        body = m.get("content") or m.get("transcript") or {"image": "[foto]", "video": "[video]", "audio": "[nota de voz]", "card": "[tarjeta compartida]", "poll": "[encuesta]", "sticker": "[sticker]"}.get(m.get("message_type"), "[adjunto]")
        lines.append(f"{users.get(m['sender_id'], 'Alguien')}: {body[:300]}")
    transcript = "\n".join(lines)[:12000]
    title = chat.get("name") or "este chat"
    summary = await _llm(
        "Eres el asistente de BRUNO. Resume conversaciones de chat en español, en 3 a 6 viñetas cortas (máx. 18 palabras cada una), tono cercano. "
        "Destaca decisiones, preguntas dirigidas al lector, fechas/planes y enlaces. Empieza cada viñeta con '• '. No inventes nada.",
        f"Conversación de «{title}» ({len(msgs)} mensajes nuevos que el lector no vio):\n\n{transcript}\n\nResumen:")
    return {"count": len(msgs), "summary": summary, "from": msgs[0]["created_at"], "to": msgs[-1]["created_at"]}
