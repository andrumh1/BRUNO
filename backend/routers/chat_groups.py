"""Group chats: create with name/photo, members management, leave, info."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import logging

import sys
sys.path.insert(0, '/app/backend')

from utils.database import db
from utils.security import get_current_user
from utils.ws_manager import ws_manager
from models.user import User

router = APIRouter(tags=["chat-groups"])
logger = logging.getLogger(__name__)


class GroupCreate(BaseModel):
    name: str
    participant_ids: List[str]
    avatar_url: Optional[str] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class MembersAdd(BaseModel):
    user_ids: List[str]


async def _users_brief(ids: List[str]) -> dict:
    out = {}
    if not ids:
        return out
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1, "username": 1, "avatar_url": 1})}
    profiles = {p["user_id"]: p async for p in db.user_profiles.find({"user_id": {"$in": ids}}, {"_id": 0, "user_id": 1, "display_name": 1, "avatar_url": 1})}
    for uid in ids:
        u, p = users.get(uid), profiles.get(uid, {})
        if not u:
            continue
        username = u.get("name") or (u.get("email") or "Usuario").split("@")[0]
        out[uid] = {"id": uid, "username": username, "display_name": p.get("display_name") or username, "avatar_url": p.get("avatar_url") or u.get("avatar_url")}
    return out


async def _system_message(chat_id: str, actor_id: str, text: str, participants: List[str]):
    now = datetime.now(timezone.utc).isoformat()
    msg = {"id": str(uuid.uuid4()), "chat_id": chat_id, "sender_id": actor_id, "content": text, "message_type": "system",
           "attachments": [], "is_read": True, "is_deleted": False, "read_by": participants, "created_at": now, "updated_at": now}
    await db.messages.insert_one(dict(msg))
    await db.chats.update_one({"id": chat_id}, {"$set": {"last_message_id": msg["id"], "last_message_at": now, "updated_at": now}})
    try:
        await ws_manager.broadcast_to_users({"type": "new_message", "chat_id": chat_id, "message": msg}, participants)
    except Exception as e:
        logger.warning(f"WS system message failed: {e}")


async def _get_group(chat_id: str, user_id: str) -> dict:
    chat = await db.chats.find_one({"id": chat_id, "participants": user_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if not chat.get("is_group"):
        raise HTTPException(status_code=400, detail="Este chat no es un grupo")
    return chat


@router.post("/chats/group")
async def create_group(data: GroupCreate, current_user: User = Depends(get_current_user)):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El grupo necesita un nombre")
    ids = [i for i in dict.fromkeys(data.participant_ids) if i and i != current_user.id]
    if len(ids) < 1:
        raise HTTPException(status_code=400, detail="Elige al menos un contacto")
    valid = await db.users.count_documents({"id": {"$in": ids}})
    if valid != len(ids):
        raise HTTPException(status_code=400, detail="Algún contacto no existe")
    now = datetime.now(timezone.utc).isoformat()
    participants = [current_user.id] + ids
    chat = {"id": str(uuid.uuid4()), "type": "group", "is_group": True, "name": name[:60], "avatar_url": data.avatar_url,
            "admin_id": current_user.id, "participants": participants, "created_by": current_user.id,
            "last_message_id": None, "last_message_at": now, "created_at": now, "updated_at": now}
    await db.chats.insert_one(dict(chat))
    await _system_message(chat["id"], current_user.id, f"{current_user.name or 'Alguien'} creó el grupo “{name}”", participants)
    try:
        await ws_manager.broadcast_to_users({"type": "group_created", "chat_id": chat["id"], "name": name, "by": current_user.name}, ids)
    except Exception:
        pass
    members = await _users_brief(participants)
    chat["members"] = list(members.values())
    chat["other_participants"] = [members[i] for i in ids if i in members]
    chat["is_muted"] = False
    chat["unread_count"] = 0
    return chat


@router.get("/chats/{chat_id}/info")
async def group_info(chat_id: str, current_user: User = Depends(get_current_user)):
    chat = await db.chats.find_one({"id": chat_id, "participants": current_user.id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat no encontrado")
    members = await _users_brief(chat["participants"])
    chat["members"] = [{**members[i], "is_admin": i == chat.get("admin_id")} for i in chat["participants"] if i in members]
    chat["is_admin"] = chat.get("admin_id") == current_user.id
    return chat


@router.put("/chats/{chat_id}/group")
async def update_group(chat_id: str, data: GroupUpdate, current_user: User = Depends(get_current_user)):
    chat = await _get_group(chat_id, current_user.id)
    if chat.get("admin_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el administrador puede editar el grupo")
    upd = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.name is not None and data.name.strip():
        upd["name"] = data.name.strip()[:60]
    if data.avatar_url is not None:
        upd["avatar_url"] = data.avatar_url
    await db.chats.update_one({"id": chat_id}, {"$set": upd})
    if "name" in upd:
        await _system_message(chat_id, current_user.id, f"{current_user.name or 'Alguien'} cambió el nombre del grupo a “{upd['name']}”", chat["participants"])
    return {"ok": True, **upd}


@router.post("/chats/{chat_id}/members")
async def add_members(chat_id: str, data: MembersAdd, current_user: User = Depends(get_current_user)):
    chat = await _get_group(chat_id, current_user.id)
    new_ids = [i for i in dict.fromkeys(data.user_ids) if i and i not in chat["participants"]]
    if not new_ids:
        return {"added": []}
    if len(chat["participants"]) + len(new_ids) > 50:
        raise HTTPException(status_code=400, detail="Máximo 50 miembros por grupo")
    brief = await _users_brief(new_ids)
    new_ids = [i for i in new_ids if i in brief]
    participants = chat["participants"] + new_ids
    await db.chats.update_one({"id": chat_id}, {"$set": {"participants": participants, "updated_at": datetime.now(timezone.utc).isoformat()}})
    names = ", ".join(brief[i]["display_name"] for i in new_ids)
    await _system_message(chat_id, current_user.id, f"{current_user.name or 'Alguien'} añadió a {names}", participants)
    try:
        await ws_manager.broadcast_to_users({"type": "group_created", "chat_id": chat_id, "name": chat.get("name"), "by": current_user.name}, new_ids)
    except Exception:
        pass
    return {"added": [brief[i] for i in new_ids]}


@router.delete("/chats/{chat_id}/members/{user_id}")
async def remove_member(chat_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    """Admin removes a member, or a member leaves (user_id == me)."""
    chat = await _get_group(chat_id, current_user.id)
    leaving = user_id == current_user.id
    if not leaving and chat.get("admin_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Solo el administrador puede quitar miembros")
    if user_id not in chat["participants"]:
        raise HTTPException(status_code=404, detail="Ese usuario no está en el grupo")
    remaining = [p for p in chat["participants"] if p != user_id]
    upd = {"participants": remaining, "updated_at": datetime.now(timezone.utc).isoformat()}
    if user_id == chat.get("admin_id") and remaining:
        upd["admin_id"] = remaining[0]
    if not remaining:
        await db.chats.delete_one({"id": chat_id})
        return {"left": True, "deleted": True}
    await db.chats.update_one({"id": chat_id}, {"$set": upd, "$pull": {"muted_by": user_id}})
    who = (await _users_brief([user_id])).get(user_id, {}).get("display_name", "Alguien")
    text = f"{who} salió del grupo" if leaving else f"{current_user.name or 'El administrador'} quitó a {who}"
    await _system_message(chat_id, current_user.id, text, remaining)
    return {"left": leaving, "removed": user_id, "admin_id": upd.get("admin_id", chat.get("admin_id"))}
