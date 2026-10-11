"""Series (listas de reproducción de videos largos) + capítulos automáticos con IA."""
import asyncio
import json
import logging
import os
import re
import tempfile
import uuid
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from models.user import User
from utils.database import db
from utils.security import get_current_user, get_current_user_optional

router = APIRouter(tags=["series"])
logger = logging.getLogger("bruno.series")
LONG_MIN = 180


def _now():
    return datetime.now(timezone.utc).isoformat()


def _is_long(post: dict) -> bool:
    return any((m or {}).get("type") == "video" and (m.get("duration") or 0) >= LONG_MIN for m in post.get("media") or [])


async def _video_cards(ids: List[str]) -> list:
    if not ids:
        return []
    posts = {p["id"]: p async for p in db.posts.find({"id": {"$in": ids}, "is_deleted": {"$ne": True}}, {"_id": 0, "id": 1, "content": 1, "media": 1, "user_id": 1, "likes_count": 1, "views_count": 1, "created_at": 1, "chapters": 1, "visibility": 1})}
    out = []
    for i in ids:
        p = posts.get(i)
        if not p:
            continue
        m = (p.get("media") or [{}])[0]
        out.append({"id": p["id"], "title": (p.get("content") or "").split("\n")[0][:120], "thumb": m.get("poster_url") or m.get("thumbnail_url"), "duration": m.get("duration"), "likes": p.get("likes_count", 0), "views": p.get("views_count", 0), "created_at": p.get("created_at"), "visibility": p.get("visibility", "public")})
    return out


async def _series_out(s: dict, viewer_id: Optional[str]) -> dict:
    owner = await db.users.find_one({"id": s["user_id"]}, {"_id": 0, "id": 1, "name": 1, "avatar_url": 1})
    videos = await _video_cards(s.get("video_ids") or [])
    if viewer_id != s["user_id"]:
        videos = [v for v in videos if v["visibility"] == "public"]
    total = sum((v.get("duration") or 0) for v in videos)
    return {**{k: v for k, v in s.items() if k != "video_ids"}, "videos": videos, "count": len(videos), "total_duration": total, "owner": owner or {"id": s["user_id"], "name": "Creador"},
            "cover_url": s.get("cover_url") or next((v["thumb"] for v in videos if v.get("thumb")), None), "is_owner": viewer_id == s["user_id"]}


def _index_series(s: dict):
    from utils.search_sync import get_engine
    from utils.search_text import normalize, tokens
    doc = {"key": f"series:{s['id']}", "kind": "series", "ref_id": s["id"], "owner_id": s["user_id"], "title": s.get("title") or "", "title_norm": normalize(s.get("title")), "body_norm": normalize(s.get("description")),
           "tokens": tokens(f"{s.get('title') or ''} {s.get('description') or ''}"), "created_at": s.get("created_at") or _now(), "popularity": len(s.get("video_ids") or []) * 2, "meta": {"count": len(s.get("video_ids") or []), "cover": s.get("cover_url")}}
    return get_engine().upsert([doc])


class SeriesBody(BaseModel):
    title: str
    description: Optional[str] = ""
    cover_url: Optional[str] = None
    visibility: Optional[str] = "public"
    video_ids: Optional[List[str]] = None


@router.post("/series")
async def create_series(body: SeriesBody, current_user: User = Depends(get_current_user)):
    title = body.title.strip()
    if not 2 <= len(title) <= 80:
        raise HTTPException(status_code=400, detail="El título debe tener entre 2 y 80 caracteres")
    ids = await _own_long_ids(current_user.id, body.video_ids or [])
    s = {"id": str(uuid.uuid4()), "user_id": current_user.id, "title": title, "description": (body.description or "")[:500], "cover_url": body.cover_url, "visibility": body.visibility if body.visibility in ("public", "private") else "public", "video_ids": ids, "created_at": _now(), "updated_at": _now()}
    await db.series.insert_one(s)
    s.pop("_id", None)
    await _index_series(s)
    return await _series_out(s, current_user.id)


async def _own_long_ids(user_id: str, ids: List[str]) -> List[str]:
    if not ids:
        return []
    ok = {p["id"] async for p in db.posts.find({"id": {"$in": ids}, "user_id": user_id, "is_deleted": {"$ne": True}}, {"_id": 0, "id": 1, "media": 1}) if _is_long(p)}
    seen, out = set(), []
    for i in ids:
        if i in ok and i not in seen:
            seen.add(i); out.append(i)
    return out


@router.get("/series/mine")
async def my_series(current_user: User = Depends(get_current_user)):
    rows = await db.series.find({"user_id": current_user.id}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return [await _series_out(s, current_user.id) for s in rows]


@router.get("/series/candidates")
async def series_candidates(current_user: User = Depends(get_current_user)):
    """Videos largos del creador disponibles para añadir a una serie."""
    ids = [p["id"] async for p in db.posts.find({"user_id": current_user.id, "is_deleted": {"$ne": True}, "media.duration": {"$gte": LONG_MIN}}, {"_id": 0, "id": 1}).sort("created_at", -1).limit(200)]
    return await _video_cards(ids)


@router.get("/users/{user_id}/series")
async def user_series(user_id: str, current_user: Optional[User] = Depends(get_current_user_optional)):
    viewer = current_user.id if current_user else None
    q = {"user_id": user_id} if viewer == user_id else {"user_id": user_id, "visibility": "public"}
    rows = await db.series.find(q, {"_id": 0}).sort("updated_at", -1).to_list(100)
    out = [await _series_out(s, viewer) for s in rows]
    return [s for s in out if s["count"] or s["is_owner"]]


@router.get("/series/{series_id}")
async def get_series(series_id: str, current_user: Optional[User] = Depends(get_current_user_optional)):
    s = await db.series.find_one({"id": series_id}, {"_id": 0})
    viewer = current_user.id if current_user else None
    if not s or (s.get("visibility") == "private" and viewer != s["user_id"]):
        raise HTTPException(status_code=404, detail="Serie no encontrada")
    return await _series_out(s, viewer)


@router.get("/series/{series_id}/play")
async def play_series(series_id: str, current_user: Optional[User] = Depends(get_current_user_optional)):
    """Lista ordenada para el reproductor (misma forma que recommended-videos)."""
    s = await db.series.find_one({"id": series_id}, {"_id": 0})
    viewer = current_user.id if current_user else None
    if not s or (s.get("visibility") == "private" and viewer != s["user_id"]):
        raise HTTPException(status_code=404, detail="Serie no encontrada")
    ids = s.get("video_ids") or []
    q = {"id": {"$in": ids}, "is_deleted": {"$ne": True}}
    if viewer != s["user_id"]:
        q["visibility"] = "public"
    posts = {p["id"]: p async for p in db.posts.find(q, {"_id": 0})}
    ordered = [posts[i] for i in ids if i in posts]
    author = await db.users.find_one({"id": s["user_id"]}, {"_id": 0, "id": 1, "name": 1, "avatar_url": 1})
    for idx, p in enumerate(ordered):
        p["author"] = author
        p["series"] = {"id": s["id"], "title": s["title"], "index": idx, "count": len(ordered)}
    return ordered


@router.put("/series/{series_id}")
async def update_series(series_id: str, body: SeriesBody, current_user: User = Depends(get_current_user)):
    s = await db.series.find_one({"id": series_id, "user_id": current_user.id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Serie no encontrada")
    upd = {"updated_at": _now()}
    if body.title and 2 <= len(body.title.strip()) <= 80:
        upd["title"] = body.title.strip()
    if body.description is not None:
        upd["description"] = body.description[:500]
    if body.cover_url is not None:
        upd["cover_url"] = body.cover_url or None
    if body.visibility in ("public", "private"):
        upd["visibility"] = body.visibility
    if body.video_ids is not None:
        upd["video_ids"] = await _own_long_ids(current_user.id, body.video_ids)
    await db.series.update_one({"id": series_id}, {"$set": upd})
    fresh = await db.series.find_one({"id": series_id}, {"_id": 0})
    await _index_series(fresh)
    return await _series_out(fresh, current_user.id)


@router.delete("/series/{series_id}")
async def delete_series(series_id: str, current_user: User = Depends(get_current_user)):
    r = await db.series.delete_one({"id": series_id, "user_id": current_user.id})
    if not r.deleted_count:
        raise HTTPException(status_code=404, detail="Serie no encontrada")
    from utils.search_sync import get_engine
    await get_engine().remove([f"series:{series_id}"])
    return {"deleted": True}


# ───────────────────────── capítulos automáticos con IA ─────────────────────────

def _audio_url(video_url: str) -> str:
    """Cloudinary: pide el audio en MP3 a 48 kbps para que quepa en el límite de Whisper (25 MB ≈ 70 min)."""
    if "res.cloudinary.com" in video_url and "/video/upload/" in video_url:
        base = re.sub(r"\.[a-zA-Z0-9]+(\?.*)?$", "", video_url)
        return base.replace("/video/upload/", "/video/upload/br_48k,f_mp3/") + ".mp3"
    return video_url


async def generate_chapters(post: dict) -> list:
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="BRUNO IA no está configurada")
    media = next((m for m in post.get("media") or [] if (m or {}).get("type") == "video"), None)
    if not media or not media.get("url"):
        raise HTTPException(status_code=400, detail="El post no tiene video")
    duration = media.get("duration") or 0
    from emergentintegrations.llm.openai import OpenAISpeechToText
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    url = _audio_url(media["url"])
    async with httpx.AsyncClient(timeout=180, follow_redirects=True) as client:
        r = await client.get(url)
        if r.status_code != 200:
            r = await client.get(media["url"])
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="No se pudo descargar el audio del video")
        data = r.content
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="El audio supera 25 MB; acorta el video o escribe los capítulos a mano")
    suffix = ".mp3" if url.endswith(".mp3") else ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data); path = tmp.name
    try:
        stt = OpenAISpeechToText(api_key=api_key)
        with open(path, "rb") as f:
            res = await stt.transcribe(file=f, model="whisper-1", response_format="verbose_json", language="es", timestamp_granularities=["segment"])
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
    segments = getattr(res, "segments", None) or (res.get("segments") if isinstance(res, dict) else None) or []
    lines = []
    for sg in segments:
        start = sg.get("start") if isinstance(sg, dict) else getattr(sg, "start", 0)
        text = (sg.get("text") if isinstance(sg, dict) else getattr(sg, "text", "")) or ""
        lines.append(f"[{int(start // 60):02d}:{int(start % 60):02d}] {text.strip()}")
    if not lines:
        text = getattr(res, "text", "") or ""
        if not text.strip():
            raise HTTPException(status_code=422, detail="No se detectó voz en el video")
        lines = [f"[00:00] {text[:4000]}"]
    transcript = "\n".join(lines)[:60000]
    spoken = " ".join(l.split("] ", 1)[-1] for l in lines)
    if len(spoken.split()) < 15 or re.search(r"amara\.org|subt[ií]tulos realizados", spoken, re.I):
        raise HTTPException(status_code=422, detail="No se detectó suficiente voz en el video para proponer capítulos")
    n = max(3, min(12, int(duration // 150) if duration else 6))
    system = ("Eres BRUNO IA. A partir de una transcripción con marcas de tiempo [mm:ss], propone capítulos para el video. "
              f"Devuelve SOLO JSON: {{\"chapters\":[{{\"time\":segundos_enteros,\"title\":\"título corto en español (máx 6 palabras)\"}}]}}. "
              f"Entre 3 y {n} capítulos, el primero en 0, en orden, sin inventar contenido que no esté en la transcripción.")
    chat = LlmChat(api_key=api_key, session_id=f"chapters_{uuid.uuid4()}", system_message=system).with_model("openai", "gpt-5.4-mini")
    answer = await chat.send_message(UserMessage(text=f"Duración: {int(duration)} s\n\nTranscripción:\n{transcript}"))
    m = re.search(r"\{.*\}", answer, re.S)
    try:
        parsed = json.loads(m.group(0) if m else answer)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="BRUNO IA devolvió un formato inesperado")
    out = []
    for c in parsed.get("chapters", [])[:20]:
        try:
            t = max(0, int(float(c.get("time", 0)))); title = str(c.get("title") or "").strip()[:80]
        except (TypeError, ValueError, AttributeError):
            continue
        if title and (not duration or t < duration):
            out.append({"time": t, "title": title})
    out.sort(key=lambda c: c["time"])
    if out and out[0]["time"] > 0:
        out.insert(0, {"time": 0, "title": "Inicio"})
    return out


@router.post("/posts/{post_id}/chapters/ai")
async def ai_chapters(post_id: str, current_user: User = Depends(get_current_user)):
    """Transcribe el audio del video largo y propone capítulos. El creador los revisa antes de guardar."""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user.id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    if not _is_long(post):
        raise HTTPException(status_code=400, detail="Solo disponible para videos de más de 3 minutos")
    chapters = await generate_chapters(post)
    await db.posts.update_one({"id": post_id}, {"$set": {"chapters_suggested": chapters, "chapters_suggested_at": _now()}})
    return {"chapters": chapters, "generated": True}


async def suggest_chapters_background(post_id: str):
    """Al subir un video largo: genera una sugerencia (no se aplica sola; el creador la revisa en el editor)."""
    try:
        post = await db.posts.find_one({"id": post_id}, {"_id": 0})
        if not post or not _is_long(post) or post.get("chapters"):
            return
        chapters = await generate_chapters(post)
        await db.posts.update_one({"id": post_id}, {"$set": {"chapters_suggested": chapters, "chapters_suggested_at": _now()}})
        await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": post["user_id"], "actor_id": post["user_id"], "type": "system", "message": "BRUNO IA preparó capítulos para tu video largo. Revísalos en el reproductor.", "target_id": post_id, "target_type": "post", "is_read": False, "created_at": _now()})
    except Exception as e:  # noqa: BLE001
        logger.warning("auto chapters failed for %s: %s", post_id, e)
