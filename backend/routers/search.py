"""Búsqueda global de BRUNO: consulta el índice y vuelve a comprobar permisos contra las colecciones de origen."""
import math
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from models.user import User
from utils.database import db
from utils.security import get_current_user, get_current_user_optional
from utils.search_text import parse_query, snippet
from utils.search_sync import get_engine, full_sync

router = APIRouter(prefix="/search", tags=["search"])

TYPE_KINDS = {
    "all": ["video", "series", "post", "user", "card", "hashtag", "product", "comment", "ai_public", "ai_private"],
    "videos": ["video", "series"], "posts": ["post", "video"], "people": ["user"], "businesses": ["user"], "cards": ["card"],
    "hashtags": ["hashtag"], "store": ["product"], "comments": ["comment"], "ai": ["ai_public", "ai_private"],
}
GROUP_SIZE = 4
MAX_Q = 100
_rate: dict = {}


def _rate_limit(key: str, limit: int = 90, window: int = 60):
    now = time.time()
    hits = [t for t in _rate.get(key, []) if now - t < window]
    if len(hits) >= limit:
        raise HTTPException(status_code=429, detail="Demasiadas búsquedas, espera un momento")
    hits.append(now)
    _rate[key] = hits
    if len(_rate) > 5000:
        for k in list(_rate.keys())[:1000]:
            _rate.pop(k, None)


def _clean_q(q: str) -> str:
    q = (q or "").strip()
    if len(q) < 1:
        raise HTTPException(status_code=400, detail="Escribe algo para buscar")
    if len(q) > MAX_Q:
        raise HTTPException(status_code=400, detail=f"Máximo {MAX_Q} caracteres")
    return q


# ───────────────────────── contexto del espectador ─────────────────────────

async def viewer_context(user: Optional[User]) -> dict:
    ctx = {"id": user.id if user else None, "is_adult": False, "following": set(), "hidden": set(), "is_admin": False}
    if not user:
        return ctx
    u = await db.users.find_one({"id": user.id}, {"_id": 0, "birth_date": 1, "role": 1})
    bd = (u or {}).get("birth_date")
    if bd:
        try:
            b = datetime.fromisoformat(str(bd)[:10]); t = datetime.now(timezone.utc)
            ctx["is_adult"] = (t.year - b.year - ((t.month, t.day) < (b.month, b.day))) >= 18
        except ValueError:
            pass
    ctx["is_admin"] = (u or {}).get("role") == "admin"
    async for f in db.follows.find({"follower_id": user.id}, {"_id": 0, "following_id": 1}):
        ctx["following"].add(f["following_id"])
    async for b in db.blocks.find({"$or": [{"blocker_id": user.id}, {"blocked_id": user.id}]}, {"_id": 0, "blocker_id": 1, "blocked_id": 1}):
        ctx["hidden"].add(b["blocked_id"] if b["blocker_id"] == user.id else b["blocker_id"])
    return ctx


async def _users_map(ids: set) -> dict:
    if not ids:
        return {}
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": list(ids)}}, {"_id": 0, "id": 1, "name": 1, "avatar_url": 1, "is_active": 1, "is_banned": 1, "is_suspended": 1, "role": 1})}
    async for p in db.user_profiles.find({"user_id": {"$in": list(ids)}}, {"_id": 0, "user_id": 1, "is_private": 1, "discoverable": 1, "avatar_url": 1, "display_name": 1, "is_verified": 1}):
        if p["user_id"] in users:
            users[p["user_id"]]["profile"] = p
    return users


def _author_ok(uid: str, users: dict, ctx: dict) -> bool:
    if uid == ctx["id"]:
        return True
    u = users.get(uid)
    if u and (u.get("is_active") is False or u.get("is_banned") or u.get("is_suspended")):
        return False
    return uid not in ctx["hidden"]


def _post_visible(post: dict, users: dict, ctx: dict) -> bool:
    if not post or post.get("is_deleted") or post.get("is_hidden") or post.get("removed_by_moderation") or post.get("moderation_status") in ("removed", "hidden") or post.get("visibility") == "removed":
        return False
    owner = post.get("user_id")
    mine = owner == ctx["id"]
    if not _author_ok(owner, users, ctx):
        return False
    vis = post.get("visibility") or "public"
    if vis == "followers" and not (mine or owner in ctx["following"]):
        return False
    if vis in ("private", "scheduled", "draft") and not mine:
        return False
    if vis not in ("public", "followers", "private", "scheduled", "draft") and not mine:
        return False
    prof = (users.get(owner) or {}).get("profile") or {}
    if prof.get("is_private") and not (mine or owner in ctx["following"]):
        return False
    if (post.get("age_restricted") or post.get("is_adult")) and not ctx["is_adult"] and not mine:
        return False
    return True


def _user_visible(uid: str, users: dict, ctx: dict) -> bool:
    if uid not in users or not _author_ok(uid, users, ctx):
        return False
    prof = (users.get(uid) or {}).get("profile") or {}
    return prof.get("discoverable") is not False or uid == ctx["id"]


# ───────────────────────── relevancia ─────────────────────────

def _score(d: dict, parsed: dict, sort: str) -> float:
    if sort == "newest":
        return _ts(d.get("created_at"))
    if sort == "oldest":
        return -_ts(d.get("created_at"))
    q, toks = parsed["norm"], parsed["tokens"]
    title, body, handle = d.get("title_norm") or "", d.get("body_norm") or "", d.get("handle") or ""
    s = 0.0
    if handle and handle == q.replace(" ", "_"):
        s += 100
    if title and title == q:
        s += 90
    if parsed["kind"] == "hashtag" and d["kind"] == "hashtag" and d["ref_id"] == q:
        s += 100
    if handle and handle.startswith(q):
        s += 40
    if title and q and q in title:
        s += 45 if title.startswith(q) else 30
    if q and q in body:
        s += 25
    dtoks = set(d.get("tokens") or [])
    hit = sum(1 for t in toks if t in dtoks)
    if toks:
        s += 20 * hit / len(toks)
    if d.get("_fuzzy") and any(t in dtoks for t in d["_fuzzy"]) and hit == 0:
        s += 8
    s += min(10, math.log1p(d.get("popularity") or 0) * 1.5)
    age_days = max(0.0, (time.time() - _ts(d.get("created_at"))) / 86400)
    s += 6 / (1 + age_days / 30)
    return s


def _ts(iso) -> float:
    try:
        return datetime.fromisoformat(str(iso).replace("Z", "+00:00")).timestamp()
    except Exception:  # noqa: BLE001
        return 0.0


# ───────────────────────── hidratación con permisos ─────────────────────────

async def hydrate(cands: list, parsed: dict, ctx: dict, business_only: bool = False) -> list:
    by_kind: dict = {}
    for c in cands:
        by_kind.setdefault(c["kind"], []).append(c)
    out = []
    owners = {c.get("owner_id") for c in cands if c.get("owner_id")}
    for c in by_kind.get("comment", []):
        owners.add(c["meta"].get("post_author_id"))
    users = await _users_map({o for o in owners if o})

    post_ids = {c["ref_id"] for k in ("video", "post", "ai_public") for c in by_kind.get(k, [])} | {c.get("post_id") for c in by_kind.get("comment", [])}
    posts = {p["id"]: p async for p in db.posts.find({"id": {"$in": list(post_ids)}}, {"_id": 0, "id": 1, "user_id": 1, "visibility": 1, "is_deleted": 1, "is_hidden": 1, "moderation_status": 1, "age_restricted": 1, "removed_by_moderation": 1, "content": 1, "media": 1, "post_type": 1, "likes_count": 1, "comments_count": 1, "created_at": 1, "source": 1})} if post_ids else {}
    comment_ids = [c["ref_id"] for c in by_kind.get("comment", [])]
    comments = {c["id"]: c async for c in db.comments.find({"id": {"$in": comment_ids}}, {"_id": 0, "id": 1, "post_id": 1, "content": 1, "user_id": 1, "parent_id": 1, "removed_by_moderation": 1})} if comment_ids else {}
    card_ids = [c["ref_id"] for c in by_kind.get("card", [])]
    cards = {c["id"]: c async for c in db.cards.find({"id": {"$in": card_ids}}, {"_id": 0, "id": 1, "user_id": 1, "is_public": 1, "title": 1, "subtitle": 1, "card_type": 1, "avatar_url": 1, "background_color": 1, "text_color": 1})} if card_ids else {}
    series_ids = [c["ref_id"] for c in by_kind.get("series", [])]
    series = {x["id"]: x async for x in db.series.find({"id": {"$in": series_ids}}, {"_id": 0})} if series_ids else {}
    prod_ids = [c["ref_id"] for c in by_kind.get("product", [])]
    products = {}
    if prod_ids:
        async for p in db.marketplace_products.find({"id": {"$in": prod_ids}}, {"_id": 0, "id": 1, "status": 1, "seller_id": 1, "title": 1, "price": 1, "currency": 1, "images": 1, "seller_name": 1}):
            products[p["id"]] = {**p, "_src": "marketplace"}
        async for p in db.store_products.find({"id": {"$in": prod_ids}}, {"_id": 0, "id": 1, "is_active": 1, "name": 1, "price": 1, "currency": 1, "image_url": 1}):
            products[p["id"]] = {**p, "_src": "store"}

    for c in cands:
        k, rid, meta = c["kind"], c["ref_id"], c.get("meta") or {}
        item = {"kind": k, "id": rid, "created_at": c.get("created_at")}
        if k in ("video", "post", "ai_public"):
            p = posts.get(rid)
            if not _post_visible(p, users, ctx):
                continue
            au = users.get(p["user_id"]) or {}
            item.update({"title": c.get("title"), "snippet": snippet(p.get("content"), parsed["tokens"]), "thumb": meta.get("thumb"), "duration": meta.get("duration"),
                         "author": {"id": p["user_id"], "name": au.get("name"), "avatar": au.get("avatar_url") or (au.get("profile") or {}).get("avatar_url")},
                         "likes": p.get("likes_count", 0), "comments": p.get("comments_count", 0), "is_long": bool((meta.get("duration") or 0) >= 180),
                         "url": (f"/video/{rid}" if (meta.get("duration") or 0) >= 180 else f"/reels?id={rid}") if k == "video" else f"/post/{rid}"})
            if k == "ai_public":
                item["badge"] = "Respuesta pública de BRUNO IA"
        elif k == "comment":
            cm = comments.get(rid)
            p = posts.get(c.get("post_id")) if cm else None
            if not cm or cm.get("removed_by_moderation") or not _post_visible(p, users, ctx) or not _author_ok(cm["user_id"], users, ctx):
                continue
            au = users.get(cm["user_id"]) or {}
            is_video = (p.get("post_type") == "video") or any((m or {}).get("type") == "video" for m in (p.get("media") or []))
            item.update({"snippet": snippet(cm.get("content"), parsed["tokens"]), "author": {"id": cm["user_id"], "name": au.get("name"), "avatar": au.get("avatar_url") or (au.get("profile") or {}).get("avatar_url")},
                         "post": {"id": p["id"], "preview": (p.get("content") or "")[:90], "is_video": is_video},
                         "url": f"/reels?id={p['id']}&comments=1&comment={rid}" if is_video else f"/post/{p['id']}?comment={rid}"})
        elif k == "user":
            if not _user_visible(rid, users, ctx):
                continue
            if business_only and not c.get("is_business"):
                continue
            u = users.get(rid) or {}
            prof = u.get("profile") or {}
            item.update({"kind": "business" if business_only else "user", "name": prof.get("display_name") or u.get("name") or meta.get("name"), "handle": meta.get("handle"), "avatar": prof.get("avatar_url") or u.get("avatar_url"),
                         "is_verified": bool(prof.get("is_verified")), "is_private": bool(prof.get("is_private")), "is_business": bool(c.get("is_business")),
                         "is_following": rid in ctx["following"], "is_me": rid == ctx["id"], "url": f"/profile/{rid}"})
            if c.get("is_business"):
                item.update({"business_name": meta.get("business_name"), "category": meta.get("category"), "location": meta.get("location"), "image": meta.get("business_image")})
        elif k == "card":
            card = cards.get(rid)
            if not card or not card.get("is_public") or not _author_ok(card["user_id"], users, ctx):
                continue
            own = users.get(card["user_id"]) or {}
            item.update({"title": card.get("title"), "subtitle": card.get("subtitle"), "card_type": card.get("card_type"), "avatar": card.get("avatar_url"), "bg": card.get("background_color"), "fg": card.get("text_color"),
                         "owner": {"id": card["user_id"], "name": own.get("name")}, "url": f"/c/{rid}"})
        elif k == "hashtag":
            item.update({"tag": c.get("title"), "count": meta.get("count", 0), "url": f"/hashtag/{rid}"})
        elif k == "product":
            p = products.get(rid)
            if not p:
                continue
            if p["_src"] == "marketplace":
                if p.get("status") != "active" and p.get("seller_id") != ctx["id"]:
                    continue
                if p.get("seller_id") and p["seller_id"] in ctx["hidden"]:
                    continue
                imgs = p.get("images") or []
                item.update({"title": p.get("title"), "price": p.get("price"), "currency": p.get("currency") or "USD", "image": imgs[0] if imgs else None, "seller": p.get("seller_name"), "url": f"/marketplace/{rid}"})
            else:
                if p.get("is_active") is False:
                    continue
                img = p.get("image_url") if str(p.get("image_url") or "").startswith("http") else None
                item.update({"title": p.get("name"), "price": p.get("price"), "currency": p.get("currency") or "USD", "image": img, "seller": "BRUNO Store", "url": f"/store?product={rid}"})
        elif k == "series":
            sr = series.get(rid)
            if not sr or (sr.get("visibility") == "private" and sr["user_id"] != ctx["id"]) or not _author_ok(sr["user_id"], users, ctx):
                continue
            own = users.get(sr["user_id"]) or {}
            item.update({"title": sr.get("title"), "snippet": (sr.get("description") or "")[:140], "count": len(sr.get("video_ids") or []), "cover": sr.get("cover_url") or meta.get("cover"), "author": {"id": sr["user_id"], "name": own.get("name")}, "url": f"/series/{rid}"})
        elif k == "ai_private":
            if not ctx["id"] or c.get("owner_id") != ctx["id"]:
                continue
            item.update({"question": meta.get("question"), "snippet": snippet(meta.get("answer"), parsed["tokens"]), "session_id": meta.get("session_id"), "url": f"/search?ai={meta.get('session_id')}:{rid}", "badge": "Mi conversación"})
        else:
            continue
        item["_score"] = c.get("_score", 0)
        out.append(item)
    return out


async def run_search(q: str, type_: str, sort: str, page: int, limit: int, user: Optional[User], date_from=None, date_to=None, fuzzy=True) -> dict:
    parsed = parse_query(q)
    ctx = await viewer_context(user)
    kinds = list(TYPE_KINDS.get(type_) or TYPE_KINDS["all"])
    if not ctx["id"]:
        kinds = [k for k in kinds if k != "ai_private"]
    if parsed["kind"] == "hashtag" and type_ == "all":
        kinds = ["hashtag", "video", "post"]
    if parsed["kind"] == "handle" and type_ == "all":
        kinds = ["user", "video", "post", "card"]
    eng = get_engine()
    cands = await eng.candidates(parsed, kinds, ctx["id"], limit, fuzzy, date_from, date_to)
    for c in cands:
        c["_score"] = _score(c, parsed, sort)
    cands.sort(key=lambda c: (-c["_score"], c.get("created_at") or "", c["key"]))
    items = await hydrate(cands, parsed, ctx, business_only=(type_ == "businesses"))
    used_fuzzy = (cands[0].get("_fuzzy") if cands else []) or []
    if type_ == "all":
        groups: dict = {}
        order = ["user", "business", "hashtag", "video", "series", "post", "card", "product", "comment", "ai_public", "ai_private"]
        for it in items:
            groups.setdefault(it["kind"], []).append(it)
            if it["kind"] == "user" and it.get("is_business"):
                groups.setdefault("business", []).append({**it, "kind": "business"})
        out_groups = [{"kind": k, "total": len(v), "items": v[:GROUP_SIZE], "has_more": len(v) > GROUP_SIZE} for k in order for v in [groups.get(k, [])] if v]
        return {"q": q, "type": type_, "groups": out_groups, "total": len(items), "fuzzy_terms": used_fuzzy}
    start = page * limit
    page_items = items[start:start + limit]
    return {"q": q, "type": type_, "items": page_items, "page": page, "limit": limit, "total": len(items), "has_more": start + limit < len(items), "fuzzy_terms": used_fuzzy}


# ───────────────────────── endpoints ─────────────────────────

@router.get("")
async def search(request: Request, q: str = Query(...), type: str = "all", sort: str = "relevance", page: int = 0, limit: int = 20,
                 date_from: Optional[str] = None, date_to: Optional[str] = None, fuzzy: bool = True, save: bool = True,
                 current_user: Optional[User] = Depends(get_current_user_optional)):
    q = _clean_q(q)
    _rate_limit(current_user.id if current_user else (request.client.host if request.client else "anon"))
    if type not in TYPE_KINDS:
        raise HTTPException(status_code=400, detail="Filtro inválido")
    if sort not in ("relevance", "newest", "oldest"):
        raise HTTPException(status_code=400, detail="Orden inválido")
    limit = max(1, min(limit, 40)); page = max(0, min(page, 200))
    res = await run_search(q, type, sort, page, limit, current_user, date_from, date_to, fuzzy)
    if current_user and save and page == 0:
        pref = await db.user_preferences.find_one({"user_id": current_user.id}, {"_id": 0, "search_history_enabled": 1})
        if not pref or pref.get("search_history_enabled", True):
            now = datetime.now(timezone.utc).isoformat()
            await db.search_history.update_one({"user_id": current_user.id, "q_norm": q.lower()}, {"$set": {"q": q, "type": type, "at": now}, "$setOnInsert": {"id": str(uuid.uuid4())}}, upsert=True)
    return res


@router.get("/suggest")
async def suggest(request: Request, q: str = Query(...), current_user: Optional[User] = Depends(get_current_user_optional)):
    q = _clean_q(q)
    _rate_limit(("s:" + current_user.id) if current_user else ("s:" + (request.client.host if request.client else "anon")), limit=180)
    parsed = parse_query(q)
    import re
    esc = re.escape(parsed["norm"])
    ctx = await viewer_context(current_user)
    kinds = ["user", "hashtag"] if parsed["kind"] != "text" else ["user", "hashtag", "video", "post", "card", "product"]
    rows = await db.search_index.find({"kind": {"$in": kinds}, "$or": [{"title_norm": {"$regex": f"^{esc}"}}, {"handle": {"$regex": f"^{esc}"}}, {"title_norm": {"$regex": f"(^|[^a-z0-9]){esc}"}}]}, {"_id": 0}).sort("popularity", -1).limit(30).to_list(None)
    for r in rows:
        r["_score"] = _score(r, parsed, "relevance")
    rows.sort(key=lambda r: -r["_score"])
    items = await hydrate(rows, parsed, ctx)
    seen, out = set(), []
    for it in items:
        label = it.get("handle") and f"@{it['handle']}" if it["kind"] == "user" else (f"#{it['tag']}" if it["kind"] == "hashtag" else (it.get("title") or it.get("snippet") or ""))
        if not label or label in seen:
            continue
        seen.add(label)
        out.append({"kind": it["kind"], "id": it["id"], "label": label, "sub": it.get("name") if it["kind"] == "user" else (f"{it.get('count')} publicaciones" if it["kind"] == "hashtag" else None), "avatar": it.get("avatar") or it.get("thumb") or it.get("image"), "url": it.get("url")})
        if len(out) >= 8:
            break
    return out


@router.get("/trending")
async def trending(limit: int = 8):
    rows = await db.search_index.find({"kind": "hashtag"}, {"_id": 0, "title": 1, "ref_id": 1, "meta": 1}).sort([("popularity", -1), ("created_at", -1)]).limit(limit).to_list(None)
    return [{"tag": r["title"], "count": (r.get("meta") or {}).get("count", 0), "url": f"/hashtag/{r['ref_id']}"} for r in rows]


@router.get("/history")
async def get_history(current_user: User = Depends(get_current_user)):
    pref = await db.user_preferences.find_one({"user_id": current_user.id}, {"_id": 0, "search_history_enabled": 1})
    enabled = not pref or pref.get("search_history_enabled", True)
    rows = await db.search_history.find({"user_id": current_user.id}, {"_id": 0}).sort("at", -1).limit(15).to_list(None) if enabled else []
    return {"enabled": enabled, "items": rows}


@router.delete("/history")
async def clear_history(id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    flt = {"user_id": current_user.id}
    if id:
        flt["id"] = id
    r = await db.search_history.delete_many(flt)
    return {"deleted": r.deleted_count}


class HistorySettings(BaseModel):
    enabled: bool


@router.put("/history/settings")
async def history_settings(body: HistorySettings, current_user: User = Depends(get_current_user)):
    await db.user_preferences.update_one({"user_id": current_user.id}, {"$set": {"search_history_enabled": body.enabled}}, upsert=True)
    if not body.enabled:
        await db.search_history.delete_many({"user_id": current_user.id})
    return {"enabled": body.enabled}


class AskBody(BaseModel):
    q: str
    type: str = "all"


@router.post("/ask")
async def ask_bruno(body: AskBody, current_user: User = Depends(get_current_user)):
    """Genera una respuesta nueva de BRUNO IA usando SOLO los resultados que el usuario puede ver."""
    q = _clean_q(body.q)
    _rate_limit("ask:" + current_user.id, limit=15)
    res = await run_search(q, "all", "relevance", 0, 8, current_user, fuzzy=True)
    sources = []
    for g in res["groups"]:
        for it in g["items"]:
            if it["kind"] == "ai_private":
                continue
            label = it.get("title") or it.get("name") or it.get("tag") or it.get("snippet") or it.get("question") or ""
            sources.append({"n": len(sources) + 1, "kind": it["kind"], "label": label[:120], "snippet": (it.get("snippet") or it.get("subtitle") or "")[:220], "url": it.get("url"), "author": (it.get("author") or {}).get("name") or (it.get("owner") or {}).get("name") or it.get("seller")})
            if len(sources) >= 10:
                break
    if not sources:
        return {"answer": "No encontré contenido visible para ti sobre esa consulta, así que no puedo resumir nada. Prueba con otras palabras.", "sources": [], "generated": True}
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="BRUNO IA no está configurada")
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    ctx_lines = "\n".join(f"[{s['n']}] ({s['kind']}) {s['label']} — {s['snippet']} {('· por ' + s['author']) if s['author'] else ''}" for s in sources)
    system = ("Eres BRUNO IA dentro del buscador de BRUNO. Resume en español, en 3-5 frases, qué hay en los resultados listados. "
              "Cita las fuentes con su número entre corchetes, p. ej. [2]. NUNCA inventes publicaciones, perfiles, tarjetas ni datos que no estén en la lista. "
              "Si la lista no responde a la pregunta, dilo claramente.")
    chat = LlmChat(api_key=api_key, session_id=f"search_ask_{uuid.uuid4()}", system_message=system).with_model("openai", "gpt-5.4-mini")
    try:
        answer = await chat.send_message(UserMessage(text=f"Consulta del usuario: {q}\n\nResultados visibles:\n{ctx_lines}"))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"BRUNO IA no respondió: {e}")
    return {"answer": answer, "sources": sources, "generated": True}


@router.post("/admin/reindex")
async def admin_reindex(current_user: User = Depends(get_current_user)):
    u = await db.users.find_one({"id": current_user.id}, {"_id": 0, "role": 1})
    if (u or {}).get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo administración")
    return await full_sync()


@router.get("/status")
async def status(current_user: User = Depends(get_current_user)):
    meta = await db.search_meta.find_one({"key": "sync"}, {"_id": 0})
    return {"engine": get_engine().name, "indexed": await db.search_index.estimated_document_count(), "last_full_sync": (meta or {}).get("last_full_sync"), "stats": (meta or {}).get("stats")}
