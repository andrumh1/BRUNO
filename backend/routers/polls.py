"""Group polls: a poll is a chat message (message_type='poll') whose live state lives in `polls`."""
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
import hmac
import os
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import logging
import uuid

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from utils.ws_manager import ws_manager
from models.user import User

router = APIRouter(tags=["polls"])
logger = logging.getLogger(__name__)


class PollCreate(BaseModel):
    question: str
    options: List[str]
    multiple: bool = False
    anonymous: bool = False
    duration_hours: Optional[float] = None  # None = sin límite


class VoteIn(BaseModel):
    option_ids: List[str]


async def _poll_view(poll: dict, user_id: str) -> dict:
    votes = poll.get("votes") or {}  # {user_id: [option_id]}
    counts = {o["id"]: 0 for o in poll["options"]}
    for uid, opts in votes.items():
        for oid in opts:
            if oid in counts:
                counts[oid] += 1
    voters = list(votes.keys())
    names = {}
    if not poll.get("anonymous") and voters:
        async for u in db.users.find({"id": {"$in": voters}}, {"_id": 0, "id": 1, "name": 1}):
            names[u["id"]] = u.get("name") or "Usuario"
    total_voters = len(voters)
    options = []
    for o in poll["options"]:
        who = [] if poll.get("anonymous") else [{"id": uid, "name": names.get(uid, "Usuario")} for uid, opts in votes.items() if o["id"] in opts]
        options.append({"id": o["id"], "text": o["text"], "votes": counts[o["id"]], "pct": round(counts[o["id"]] * 100 / total_voters) if total_voters else 0, "voters": who})
    return {"id": poll["id"], "chat_id": poll["chat_id"], "message_id": poll.get("message_id"), "question": poll["question"], "multiple": poll.get("multiple", False),
            "anonymous": poll.get("anonymous", False), "closed": poll.get("closed", False), "created_by": poll["created_by"], "created_at": poll["created_at"], "closes_at": poll.get("closes_at"),
            "options": options, "total_voters": total_voters, "my_votes": votes.get(user_id, [])}


async def _broadcast(poll: dict):
    chat = await db.chats.find_one({"id": poll["chat_id"]}, {"_id": 0, "participants": 1})
    if not chat:
        return
    view = await _poll_view(poll, "")
    view.pop("my_votes", None)
    try:
        await ws_manager.broadcast_to_users({"type": "poll_update", "chat_id": poll["chat_id"], "poll": {**view, "votes": poll.get("votes") or {}}}, chat["participants"])
    except Exception as e:
        logger.warning(f"poll broadcast failed: {e}")


@router.post("/chats/{chat_id}/polls")
async def create_poll(chat_id: str, data: PollCreate, current_user: User = Depends(get_current_user)):
    chat = await db.chats.find_one({"id": chat_id, "participants": current_user.id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    q = (data.question or "").strip()
    opts = [o.strip() for o in data.options if o and o.strip()][:10]
    if not q or len(opts) < 2:
        raise HTTPException(status_code=400, detail="Escribe una pregunta y al menos 2 opciones")
    now = datetime.now(timezone.utc).isoformat()
    poll = {"id": str(uuid.uuid4()), "chat_id": chat_id, "question": q[:200], "options": [{"id": str(uuid.uuid4())[:8], "text": o[:80]} for o in opts],
            "multiple": data.multiple, "anonymous": data.anonymous, "votes": {}, "closed": False, "created_by": current_user.id, "created_at": now,
            "closes_at": (datetime.now(timezone.utc) + timedelta(hours=float(data.duration_hours))).isoformat() if data.duration_hours else None, "reminded": False}
    msg = {"id": str(uuid.uuid4()), "chat_id": chat_id, "sender_id": current_user.id, "content": f"📊 Encuesta: {poll['question']}", "message_type": "poll",
           "attachments": [{"type": "poll", "poll_id": poll["id"]}], "is_read": False, "is_deleted": False, "read_by": [current_user.id], "created_at": now, "updated_at": now}
    poll["message_id"] = msg["id"]
    await db.polls.insert_one(dict(poll))
    await db.messages.insert_one(dict(msg))
    await db.chats.update_one({"id": chat_id}, {"$set": {"last_message_id": msg["id"], "last_message_at": now, "updated_at": now}})
    msg["sender"] = {"id": current_user.id, "username": current_user.name, "avatar_url": None}
    msg["poll"] = await _poll_view(poll, current_user.id)
    try:
        await ws_manager.broadcast_to_users({"type": "new_message", "chat_id": chat_id, "message": msg}, chat["participants"])
        from utils.chat_notify import notify_chat_message
        await notify_chat_message(chat, current_user.id, current_user.name or "Alguien", msg["content"], [], False)
    except Exception as e:
        logger.warning(f"poll message broadcast failed: {e}")
    return msg


@router.get("/polls/{poll_id}")
async def get_poll(poll_id: str, current_user: User = Depends(get_current_user)):
    poll = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    if not poll:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    if not await db.chats.find_one({"id": poll["chat_id"], "participants": current_user.id}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    return await _poll_view(poll, current_user.id)


@router.post("/polls/{poll_id}/vote")
async def vote_poll(poll_id: str, data: VoteIn, current_user: User = Depends(get_current_user)):
    poll = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    if not poll:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    if not await db.chats.find_one({"id": poll["chat_id"], "participants": current_user.id}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    if poll.get("closed"):
        raise HTTPException(status_code=400, detail="La encuesta está cerrada")
    valid = {o["id"] for o in poll["options"]}
    chosen = [o for o in dict.fromkeys(data.option_ids) if o in valid]
    if not poll.get("multiple"):
        chosen = chosen[:1]
    votes = poll.get("votes") or {}
    if chosen:
        votes[current_user.id] = chosen
    else:
        votes.pop(current_user.id, None)  # empty list = retract vote
    await db.polls.update_one({"id": poll_id}, {"$set": {"votes": votes}})
    poll["votes"] = votes
    await _broadcast(poll)
    return await _poll_view(poll, current_user.id)


@router.post("/polls/{poll_id}/close")
async def close_poll(poll_id: str, current_user: User = Depends(get_current_user)):
    poll = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    if not poll:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    chat = await db.chats.find_one({"id": poll["chat_id"]}, {"_id": 0, "admin_id": 1, "participants": 1})
    if poll["created_by"] != current_user.id and (chat or {}).get("admin_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Solo quien creó la encuesta o el admin puede cerrarla")
    await db.polls.update_one({"id": poll_id}, {"$set": {"closed": True}})
    poll["closed"] = True
    await _broadcast(poll)
    return await _poll_view(poll, current_user.id)


# ─── Cron: remind non-voters before close + auto-close expired polls ─────────
async def run_poll_reminders():
    from routers.posts_feed import _push_notification
    now = datetime.now(timezone.utc)
    soon = (now + timedelta(hours=2)).isoformat()
    async for poll in db.polls.find({"closed": False, "closes_at": {"$ne": None, "$lte": soon}, "reminded": {"$ne": True}}, {"_id": 0}):
        chat = await db.chats.find_one({"id": poll["chat_id"]}, {"_id": 0, "participants": 1, "name": 1})
        if not chat:
            continue
        voters = set((poll.get("votes") or {}).keys())
        pending = [p for p in chat["participants"] if p not in voters]
        for uid in pending:
            try:
                await _push_notification(user_id=uid, actor_id=poll["created_by"], ntype="poll_reminder", target_id=poll["chat_id"], target_type="chat",
                                         message=f"La encuesta «{poll['question'][:60]}» de {chat.get('name') or 'tu chat'} cierra pronto y aún no has votado")
            except Exception as e:
                logger.warning(f"poll reminder failed: {e}")
        await db.polls.update_one({"id": poll["id"]}, {"$set": {"reminded": True}})
    async for poll in db.polls.find({"closed": False, "closes_at": {"$ne": None, "$lte": now.isoformat()}}, {"_id": 0}):
        await db.polls.update_one({"id": poll["id"]}, {"$set": {"closed": True}})
        poll["closed"] = True
        await _broadcast(poll)


@router.post("/cron/poll-reminders")
async def cron_poll_reminders(request: Request, background: BackgroundTasks):
    secret = os.environ.get("WEBHOOK_CRON_SECRET")
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else ""
    if not secret or not token or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    background.add_task(run_poll_reminders)
    return {"accepted": True, "run_id": request.headers.get("x-webhook-id")}
