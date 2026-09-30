"""Estadísticas de imágenes compartidas: cuántas veces se escaneó el QR y desde qué red."""
import re
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Request, BackgroundTasks
from pydantic import BaseModel

from utils.database import db
from utils.security import get_current_user
from models.user import User

router = APIRouter(prefix="/share-stats", tags=["share-stats"])

NETWORKS = [
    ("instagram", r"instagram\.com|\bInstagram\b"),
    ("facebook", r"facebook\.com|\bFBAN\b|\bFBAV\b|\bFB_IAB\b"),
    ("whatsapp", r"whatsapp\.com|\bWhatsApp\b"),
    ("telegram", r"\bt\.me\b|telegram\.org|\bTelegram\b"),
    ("x", r"\bt\.co\b|twitter\.com|\bx\.com\b|\bTwitter\b"),
    ("linkedin", r"linkedin\.com|\bLinkedInApp\b"),
    ("tiktok", r"tiktok\.com|\bBytedanceWebview\b|\bmusical_ly\b"),
    ("snapchat", r"snapchat\.com|\bSnapchat\b"),
    ("bruno", r"brunocard\.com|emergentagent\.com"),
]


def detect_network(referrer: str, ua: str) -> str:
    hay = f"{referrer or ''} {ua or ''}"
    for name, pat in NETWORKS:
        if re.search(pat, hay, re.I):
            return name
    return "qr" if not referrer else "web"


class RegisterIn(BaseModel):
    ref: str
    kind: str = "card"
    target_id: Optional[str] = None
    label: Optional[str] = None


class HitIn(BaseModel):
    ref: str
    referrer: Optional[str] = ""
    target: Optional[str] = None


@router.post("/register")
async def register_share(data: RegisterIn, current_user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    await db.share_refs.update_one(
        {"ref": data.ref},
        {"$setOnInsert": {"ref": data.ref, "owner_id": current_user.id, "kind": data.kind, "target_id": data.target_id, "label": data.label, "created_at": now, "scans": 0, "networks": {}}},
        upsert=True,
    )
    return {"ok": True}


@router.post("/hit")
async def register_hit(data: HitIn, request: Request, background: BackgroundTasks):
    ref = (data.ref or "").strip()[:80]
    if not ref:
        return {"ok": False}
    ua = request.headers.get("user-agent", "")
    network = detect_network(data.referrer or "", ua)
    now = datetime.now(timezone.utc).isoformat()
    await db.share_hits.insert_one({"id": str(uuid.uuid4()), "ref": ref, "network": network, "referrer": (data.referrer or "")[:300], "target": data.target, "at": now})
    await db.share_refs.update_one({"ref": ref}, {"$inc": {"scans": 1, f"networks.{network}": 1}, "$set": {"last_scan_at": now}})
    background.add_task(_notify_scan, ref, network)
    return {"ok": True, "network": network}


NETWORK_LABELS = {"instagram": "Instagram", "facebook": "Facebook", "whatsapp": "WhatsApp", "telegram": "Telegram", "x": "X", "linkedin": "LinkedIn", "tiktok": "TikTok", "snapchat": "Snapchat", "bruno": "BRUNO", "qr": "la cámara (QR)", "web": "la web"}
KIND_LABELS = {"card": "tu tarjeta", "profile": "tu perfil", "reel": "tu reel"}


async def _notify_scan(ref: str, network: str):
    """Avisa al dueño de la imagen (máx. 1 aviso por ref cada 10 min para no saturar)."""
    r = await db.share_refs.find_one({"ref": ref}, {"_id": 0})
    if not r or not r.get("owner_id"):
        return
    now = datetime.now(timezone.utc)
    last = r.get("last_notified_at")
    if last:
        try:
            if (now - datetime.fromisoformat(last)).total_seconds() < 600:
                return
        except ValueError:
            pass
    await db.share_refs.update_one({"ref": ref}, {"$set": {"last_notified_at": now.isoformat()}})
    label = r.get("label") or KIND_LABELS.get(r.get("kind"), "tu imagen")
    body = f"Alguien abrió {KIND_LABELS.get(r.get('kind'), 'tu imagen')} “{label}” desde {NETWORK_LABELS.get(network, network)} · {r.get('scans', 0)} escaneos en total"
    try:
        from routers.posts_feed import Notification
        from utils.notification_realtime import emit_notification_ws
        notif = Notification(user_id=r["owner_id"], actor_id=r["owner_id"], type="share_scan", target_id=r.get("target_id") or ref, target_type=r.get("kind") or "share", content=body)
        nd = notif.model_dump(); nd["created_at"] = nd["created_at"].isoformat(); nd["url"] = "/analytics?tab=scans"
        await db.notifications.insert_one(nd)
        await emit_notification_ws(nd)
    except Exception:
        pass
    try:
        from routers.notifications import notify_user
        await notify_user(user_id=r["owner_id"], notification_type="share_scan", title="¡Escanearon tu QR!", body=body,
                          data={"ref": ref, "network": network, "kind": r.get("kind"), "target_id": r.get("target_id")}, url="/analytics?tab=scans")
    except Exception:
        pass


@router.get("/daily")
async def my_daily_stats(days: int = 14, current_user: User = Depends(get_current_user)):
    """Escaneos por día y por red de todas las imágenes del usuario."""
    from datetime import timedelta
    days = max(1, min(days, 90))
    refs = [r["ref"] for r in await db.share_refs.find({"owner_id": current_user.id}, {"_id": 0, "ref": 1}).to_list(500)]
    since = (datetime.now(timezone.utc) - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    by_day = {(since + timedelta(days=i)).date().isoformat(): 0 for i in range(days)}
    by_network: dict = {}
    if refs:
        async for h in db.share_hits.find({"ref": {"$in": refs}, "at": {"$gte": since.isoformat()}}, {"_id": 0, "at": 1, "network": 1}):
            day = h["at"][:10]
            if day in by_day:
                by_day[day] += 1
            by_network[h["network"]] = by_network.get(h["network"], 0) + 1
    return {"days": [{"date": d, "scans": n} for d, n in by_day.items()], "networks": by_network, "total": sum(by_day.values()), "refs": len(refs)}


@router.get("/mine")
async def my_share_stats(current_user: User = Depends(get_current_user)):
    refs = await db.share_refs.find({"owner_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    totals = {"scans": 0, "networks": {}}
    for r in refs:
        totals["scans"] += r.get("scans", 0)
        for k, v in (r.get("networks") or {}).items():
            totals["networks"][k] = totals["networks"].get(k, 0) + v
    return {"refs": refs, "totals": totals}
