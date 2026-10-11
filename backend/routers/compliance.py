"""
Compliance Router - Handles account deletion, reports, and data export
Required for Apple App Store compliance
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import os

router = APIRouter(tags=["compliance"])

# Database connection will be passed from server.py
db = None

def set_db(database):
    global db
    db = database

# Models
class ReportRequest(BaseModel):
    content_type: str  # 'post', 'user', 'comment', 'product', 'message'
    content_id: str
    reason: str
    additional_info: Optional[str] = ""

class DeleteAccountRequest(BaseModel):
    password: str
    confirm_text: str

# Helper to get current user from token
async def get_current_user_from_token(authorization: str = Header(None)):
    from utils.security import resolve_user_dict_from_token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await resolve_user_dict_from_token(authorization.replace("Bearer ", "", 1))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


# ============================================
# REPORTS
# ============================================

@router.post("/api/reports")
async def create_report(
    report: ReportRequest,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Submit a content report"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    report_doc = {
        "reporter_id": current_user["id"],
        "content_type": report.content_type,
        "content_id": report.content_id,
        "reason": report.reason,
        "additional_info": report.additional_info,
        "status": "pending",  # pending, reviewing, resolved, dismissed
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "reviewed_by": None,
        "action_taken": None
    }
    
    result = await db.reports.insert_one(report_doc)
    
    return {"success": True, "report_id": str(result.inserted_id)}

@router.get("/api/reports/my")
async def get_my_reports(current_user: dict = Depends(get_current_user_from_token)):
    """Get user's submitted reports"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    reports = await db.reports.find(
        {"reporter_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return reports

# ============================================
# ACCOUNT DELETION
# ============================================

@router.delete("/api/profile/delete-account")
async def delete_account(
    request: DeleteAccountRequest,
    current_user: dict = Depends(get_current_user_from_token)
):
    """Delete user account and all associated data - Required by Apple"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if request.confirm_text != "ELIMINAR MI CUENTA":
        raise HTTPException(status_code=400, detail="Confirmation text incorrect")
    
    # Verify password
    import bcrypt
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check password (if user has password - Google auth users may not)
    if user.get("password"):
        if not bcrypt.checkpw(request.password.encode(), user["password"].encode()):
            raise HTTPException(status_code=401, detail="Incorrect password")
    
    user_id = current_user["id"]
    
    # Schedule deletion (for GDPR compliance, we mark for deletion first)
    deletion_record = {
        "user_id": user_id,
        "email": current_user.get("email"),
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "scheduled_deletion": datetime.now(timezone.utc).isoformat(),  # 30 days from now in production
        "status": "scheduled"
    }
    await db.account_deletions.insert_one(deletion_record)
    
    # Immediately delete/anonymize data
    try:
        # Delete user's posts
        await db.posts.delete_many({"author_id": user_id})
        
        # Delete user's cards
        await db.cards.delete_many({"user_id": user_id})
        
        # Delete user's products
        await db.products.delete_many({"seller_id": user_id})
        
        # Delete user's stories
        await db.stories.delete_many({"user_id": user_id})
        
        # Delete user's comments
        await db.comments.delete_many({"author_id": user_id})
        
        # Delete user's messages (keep conversations for other users but anonymize)
        await db.messages.update_many(
            {"sender_id": user_id},
            {"$set": {"sender_id": "deleted_user", "sender_name": "Usuario eliminado"}}
        )
        
        # Remove user from chats
        await db.chats.update_many(
            {"participants": user_id},
            {"$pull": {"participants": user_id}}
        )
        
        # Delete user's notifications
        await db.notifications.delete_many({"user_id": user_id})
        
        # Delete user's points history
        await db.points_history.delete_many({"user_id": user_id})
        
        # Cancel subscriptions
        await db.subscriptions.update_many(
            {"user_id": user_id},
            {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Delete or anonymize the user account
        await db.users.delete_one({"id": user_id})
        
        # Update deletion record
        await db.account_deletions.update_one(
            {"user_id": user_id},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
        
    except Exception as e:
        # Log error but don't fail - partial deletion is still valid
        print(f"Error during account deletion: {e}")
        await db.account_deletions.update_one(
            {"user_id": user_id},
            {"$set": {"status": "partial", "error": str(e)}}
        )
    
    return {"success": True, "message": "Account scheduled for deletion"}

# ============================================
# DATA EXPORT
# ============================================

@router.get("/api/profile/export")
async def export_user_data(current_user: dict = Depends(get_current_user_from_token)):
    """Export all user data - GDPR compliance"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    user_id = current_user["id"]
    
    export_data = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "user_info": {
            "id": current_user.get("id"),
            "name": current_user.get("name"),
            "email": current_user.get("email"),
            "bio": current_user.get("bio"),
            "location": current_user.get("location"),
            "website": current_user.get("website"),
            "created_at": current_user.get("created_at"),
            "subscription_tier": current_user.get("subscription_tier", "free")
        }
    }
    
    # Get user's cards
    cards = await db.cards.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    export_data["cards"] = cards
    
    # Get user's posts
    posts = await db.posts.find(
        {"author_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    export_data["posts"] = posts
    
    # Get user's products
    products = await db.products.find(
        {"seller_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    export_data["products"] = products
    
    # Get user's stories
    stories = await db.stories.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    export_data["stories"] = stories
    
    # Get user's messages sent
    messages = await db.messages.find(
        {"sender_id": user_id},
        {"_id": 0}
    ).to_list(5000)
    export_data["messages_sent"] = messages
    
    # Get user's points history
    points = await db.points_history.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    export_data["points_history"] = points
    
    # Get user's reports
    reports = await db.reports.find(
        {"reporter_id": user_id},
        {"_id": 0}
    ).to_list(100)
    export_data["reports_submitted"] = reports
    
    return export_data

# ============================================
# ADMIN MODERATION (for future use)
# ============================================

def _require_admin(user: dict) -> None:
    if user.get("role") not in ("admin", "superadmin") and not user.get("is_admin") and user.get("subscription_tier") != "admin":
        raise HTTPException(status_code=403, detail="Solo administración")


@router.post("/api/admin/lives/{live_id}/stop")
async def admin_stop_live(live_id: str, report_id: Optional[str] = None, reason: str = "Incumple las normas de BRUNO", current_user: dict = Depends(get_current_user_from_token)):
    """Detiene un live con un toque: cierra la sala, avisa a todos, bloquea nuevas compras y resuelve el reporte."""
    _require_admin(current_user)
    from routers.lives import _broadcast, _daily, active_lives, _refund_live_tickets
    live = await db.lives.find_one({"id": live_id}, {"_id": 0, "status": 1, "room_name": 1, "started_at": 1, "host_id": 1, "title": 1})
    if not live:
        raise HTTPException(status_code=404, detail="Live no encontrado")
    now = datetime.now(timezone.utc)
    if live["status"] in ("live", "preparing"):
        dur = 0
        if live.get("started_at"):
            try:
                dur = max(0, int((now - datetime.fromisoformat(live["started_at"])).total_seconds()))
            except ValueError:
                dur = 0
        await db.lives.update_one({"id": live_id}, {"$set": {"status": "ended", "ended_at": now.isoformat(), "duration_seconds": dur, "end_reason": "admin_stopped", "admin_stop": {"by": current_user["id"], "reason": reason, "at": now.isoformat()}}})
        await _broadcast(live_id, {"type": "live_ended", "reason": "admin_stopped", "message": reason})
        if live.get("room_name"):
            try:
                await _daily("DELETE", f"/rooms/{live['room_name']}")
            except Exception:
                pass
        active_lives.pop(live_id, None)
        if live["status"] == "preparing":
            await _refund_live_tickets(live_id, "admin_stopped_before_start")
        await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": live["host_id"], "actor_id": current_user["id"], "type": "moderation", "message": f"Tu live «{live['title']}» fue detenido por moderación: {reason}", "target_id": live_id, "target_type": "live", "is_read": False, "created_at": now.isoformat()})
        await _log_mod_action(current_user["id"], live["host_id"], "stop_live", reason, "live", live_id, report_id=report_id, source="lives")
    if report_id:
        from bson import ObjectId
        try:
            await db.reports.update_one({"_id": ObjectId(report_id)}, {"$set": {"status": "resolved", "reviewed_at": now.isoformat(), "reviewed_by": current_user["id"], "action_taken": "stop_live"}})
        except Exception:
            pass
    return {"stopped": True, "live_id": live_id}


@router.get("/api/admin/reports")
async def get_pending_reports(
    status: str = "pending",
    current_user: dict = Depends(get_current_user_from_token)
):
    """Get reports for moderation - Admin only"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    _require_admin(current_user)
    q = {} if status == "all" else {"status": status}
    docs = await db.reports.find(q).sort("created_at", -1).to_list(200)
    out = []
    for d in docs:
        d["id"] = str(d.pop("_id"))
        rep = await db.users.find_one({"id": d.get("reporter_id")}, {"_id": 0, "name": 1, "email": 1}) or {}
        d["reporter_name"] = rep.get("name") or rep.get("email") or "—"
        d["target"] = None
        if d.get("content_type") == "live":
            live = await db.lives.find_one({"id": d.get("content_id")}, {"_id": 0, "id": 1, "title": 1, "status": 1, "host_name": 1, "host_id": 1, "is_private": 1})
            if live:
                d["target"] = {**live, "kind": "live", "can_stop": live.get("status") in ("live", "preparing")}
        elif d.get("content_type") == "post":
            post = await db.posts.find_one({"id": d.get("content_id")}, {"_id": 0, "id": 1, "content": 1, "user_id": 1, "visibility": 1})
            if post:
                d["target"] = {"kind": "post", "id": post["id"], "preview": (post.get("content") or "")[:120], "user_id": post.get("user_id"), "visibility": post.get("visibility")}
        elif d.get("content_type") == "user":
            u = await db.users.find_one({"id": d.get("content_id")}, {"_id": 0, "id": 1, "name": 1, "is_active": 1})
            if u:
                d["target"] = {"kind": "user", **u}
        out.append(d)
    return out

@router.put("/api/admin/reports/{report_id}")
async def update_report_status(
    report_id: str,
    action: str,  # 'dismiss', 'warn_user', 'remove_content', 'suspend_user'
    current_user: dict = Depends(get_current_user_from_token)
):
    """Update report status - Admin only"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    _require_admin(current_user)

    from bson import ObjectId

    try:
        report = await db.reports.find_one({"_id": ObjectId(report_id)})
    except Exception:
        report = None
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if action not in ("dismiss", "warn_user", "remove_content", "suspend_user"):
        raise HTTPException(status_code=400, detail="Acción no válida")

    now = datetime.now(timezone.utc).isoformat()
    ctype, cid = report.get("content_type"), report.get("content_id")
    target_user = None
    if ctype == "user":
        target_user = cid
    elif ctype == "post":
        p = await db.posts.find_one({"id": cid}, {"_id": 0, "user_id": 1}); target_user = (p or {}).get("user_id")
    elif ctype == "live":
        l = await db.lives.find_one({"id": cid}, {"_id": 0, "host_id": 1}); target_user = (l or {}).get("host_id")
    elif ctype == "product":
        pr = await db.marketplace_products.find_one({"id": cid}, {"_id": 0, "seller_id": 1, "user_id": 1}); target_user = (pr or {}).get("seller_id") or (pr or {}).get("user_id")
    elif ctype == "comment":
        c = await db.comments.find_one({"id": cid}, {"_id": 0, "user_id": 1}); target_user = (c or {}).get("user_id")

    # Efecto real de cada acción (no solo marcar el reporte)
    if action == "remove_content":
        if ctype == "post":
            await db.posts.update_one({"id": cid}, {"$set": {"visibility": "removed", "removed_by_moderation": True, "removed_at": now}})
        elif ctype == "comment":
            await db.comments.update_one({"id": cid}, {"$set": {"content": "[eliminado por moderación]", "removed_by_moderation": True}})
        elif ctype == "product":
            await db.marketplace_products.update_one({"id": cid}, {"$set": {"status": "removed", "removed_by_moderation": True}})
        elif ctype == "live":
            await admin_stop_live(cid, report_id=None, reason=f"Reporte: {report.get('reason', '')}", current_user=current_user)
    elif action == "suspend_user" and target_user:
        await db.users.update_one({"id": target_user}, {"$set": {"is_active": False, "suspended_at": now, "suspended_reason": report.get("reason")}})
        from utils.security import revoke_all_user_tokens
        try:
            await revoke_all_user_tokens(target_user)
        except Exception:
            pass
        await db.lives.update_many({"host_id": target_user, "status": {"$in": ["live", "preparing"]}}, {"$set": {"status": "ended", "ended_at": now, "end_reason": "admin_suspended"}})
    if action in ("warn_user", "remove_content", "suspend_user") and target_user:
        msgs = {"warn_user": "Advertencia de moderación: tu contenido fue reportado y revisado. Respeta las normas de BRUNO.",
                "remove_content": "Moderación retiró contenido tuyo por incumplir las normas de BRUNO.",
                "suspend_user": "Tu cuenta fue suspendida por moderación."}
        await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": target_user, "actor_id": current_user["id"], "type": "moderation", "message": msgs[action], "target_id": cid, "target_type": ctype, "is_read": False, "created_at": now})

    await db.reports.update_one(
        {"_id": ObjectId(report_id)},
        {"$set": {"status": "dismissed" if action == "dismiss" else "resolved", "reviewed_at": now, "reviewed_by": current_user["id"], "action_taken": action, "target_user_id": target_user}}
    )
    await _log_mod_action(current_user["id"], target_user, action, report.get("reason") or "", ctype, cid, report_id=report_id)
    return {"success": True, "action": action}


async def _log_mod_action(moderator_id: str, target_user_id: Optional[str], action: str, reason: str, content_type: Optional[str], content_id: Optional[str], report_id: Optional[str] = None, source: str = "reports"):
    await db.moderation_actions.insert_one({
        "id": str(uuid.uuid4()), "moderator_id": moderator_id, "target_user_id": target_user_id, "action": action, "reason": reason,
        "content_type": content_type, "content_id": content_id, "report_ids": [report_id] if report_id else [], "source": source,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


@router.get("/api/admin/users/lookup")
async def admin_user_lookup(q: str, current_user: dict = Depends(get_current_user_from_token)):
    """Busca usuarios por nombre, correo o id para abrir su historial de moderación (solo admin)."""
    _require_admin(current_user)
    import re
    q = (q or "").strip()
    if len(q) < 2:
        return []
    rx = {"$regex": re.escape(q), "$options": "i"}
    rows = await db.users.find({"$or": [{"name": rx}, {"email": rx}, {"id": q}]}, {"_id": 0, "id": 1, "name": 1, "email": 1, "avatar_url": 1, "is_active": 1, "is_banned": 1, "role": 1}).limit(12).to_list(None)
    return rows


@router.get("/api/admin/users/{user_id}/moderation-timeline")
async def admin_user_moderation_timeline(user_id: str, current_user: dict = Depends(get_current_user_from_token)):
    """Línea de tiempo de TODO lo que moderación hizo sobre un usuario: quién, qué, por qué y sobre qué contenido."""
    _require_admin(current_user)
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1, "email": 1, "avatar_url": 1, "is_active": 1, "is_banned": 1, "is_suspended": 1, "suspended_at": 1, "suspended_reason": 1, "created_at": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    events = []
    # 1) Acciones registradas (nuevo esquema + esquema antiguo content_type=user)
    async for a in db.moderation_actions.find({"$or": [{"target_user_id": user_id}, {"content_type": "user", "content_id": user_id}]}, {"_id": 0}):
        events.append({"at": a.get("created_at"), "action": a.get("action"), "by": a.get("moderator_id"), "reason": a.get("reason"), "content_type": a.get("content_type"), "content_id": a.get("content_id"), "source": a.get("source") or "moderation", "report_ids": a.get("report_ids") or []})
    seen_reports = {rid for e in events for rid in e["report_ids"]}
    # 2) Reportes revisados contra este usuario que no quedaron registrados como acción
    async for r in db.reports.find({"target_user_id": user_id, "status": {"$in": ["resolved", "dismissed"]}}, {"reviewed_at": 1, "reviewed_by": 1, "action_taken": 1, "reason": 1, "content_type": 1, "content_id": 1}):
        rid = str(r["_id"])
        if rid in seen_reports:
            continue
        events.append({"at": r.get("reviewed_at"), "action": r.get("action_taken") or "review", "by": r.get("reviewed_by"), "reason": r.get("reason"), "content_type": r.get("content_type"), "content_id": r.get("content_id"), "source": "reports", "report_ids": [rid]})
    # 3) Lives detenidos por un admin
    async for l in db.lives.find({"host_id": user_id, "admin_stop": {"$exists": True}}, {"_id": 0, "id": 1, "title": 1, "admin_stop": 1}):
        s = l["admin_stop"]
        events.append({"at": s.get("at"), "action": "stop_live", "by": s.get("by"), "reason": s.get("reason"), "content_type": "live", "content_id": l["id"], "content_label": l.get("title"), "source": "lives", "report_ids": []})
    # 4) Estado de cuenta (suspensión/baneo) sin registro explícito
    if user.get("suspended_at") and not any(e["action"] in ("suspend_user", "suspend", "ban") for e in events):
        events.append({"at": user["suspended_at"], "action": "suspend_user", "by": None, "reason": user.get("suspended_reason"), "content_type": "user", "content_id": user_id, "source": "account", "report_ids": []})
    # 5) Reportes PRESENTADOS por este usuario (contexto)
    reports_made = await db.reports.count_documents({"reporter_id": user_id})
    reports_received = await db.reports.count_documents({"target_user_id": user_id})
    mod_ids = {e["by"] for e in events if e.get("by")}
    mods = {m["id"]: m async for m in db.users.find({"id": {"$in": list(mod_ids)}}, {"_id": 0, "id": 1, "name": 1, "avatar_url": 1})} if mod_ids else {}
    for e in events:
        m = mods.get(e.get("by"))
        e["by"] = {"id": e["by"], "name": m.get("name") if m else ("Sistema" if not e.get("by") else "Admin")} if (e.get("by") or True) else None
    events.sort(key=lambda e: e.get("at") or "", reverse=True)
    strikes = sum(1 for e in events if e["action"] in ("warn_user", "warn", "remove_content", "remove", "suspend_user", "suspend", "ban", "stop_live"))
    return {"user": user, "events": events, "strikes": strikes, "reports_received": reports_received, "reports_made": reports_made}
