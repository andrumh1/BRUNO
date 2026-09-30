"""Estadísticas de imágenes compartidas: cuántas veces se escaneó el QR y desde qué red."""
import re
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Request
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
async def register_hit(data: HitIn, request: Request):
    ref = (data.ref or "").strip()[:80]
    if not ref:
        return {"ok": False}
    ua = request.headers.get("user-agent", "")
    network = detect_network(data.referrer or "", ua)
    now = datetime.now(timezone.utc).isoformat()
    await db.share_hits.insert_one({"id": str(uuid.uuid4()), "ref": ref, "network": network, "referrer": (data.referrer or "")[:300], "target": data.target, "at": now})
    await db.share_refs.update_one({"ref": ref}, {"$inc": {"scans": 1, f"networks.{network}": 1}, "$set": {"last_scan_at": now}})
    return {"ok": True, "network": network}


@router.get("/mine")
async def my_share_stats(current_user: User = Depends(get_current_user)):
    refs = await db.share_refs.find({"owner_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    totals = {"scans": 0, "networks": {}}
    for r in refs:
        totals["scans"] += r.get("scans", 0)
        for k, v in (r.get("networks") or {}).items():
            totals["networks"][k] = totals["networks"].get(k, 0) + v
    return {"refs": refs, "totals": totals}
