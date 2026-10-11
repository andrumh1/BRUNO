"""Índice de búsqueda global: adaptador de motor + sincronización desde las colecciones fuente.

El índice (`search_index`) guarda solo texto normalizado y metadatos de presentación. Los permisos
NUNCA se deciden aquí: el router vuelve a comprobar cada resultado contra la colección de origen.
"""
import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

from utils.database import db
from utils.search_text import normalize, tokens

logger = logging.getLogger("bruno.search")

BUSINESS_ROLES = {"business", "company", "empresa", "negocio", "enterprise"}
BUSINESS_CARD_TYPES = {"empresarial", "negocio", "empresa", "business"}
_vocab_cache = {"at": 0.0, "words": []}


def _iso(v) -> str:
    if isinstance(v, datetime):
        return v.isoformat()
    return str(v or "")


def _handle(user: dict) -> str:
    base = user.get("username") or (user.get("name") or "").replace(" ", "_") or (user.get("email") or "").split("@")[0]
    return normalize(base).replace(" ", "_")


def _media_kind(post: dict) -> str:
    if post.get("post_type") == "video" or post.get("video_url") or any((m or {}).get("type") == "video" for m in (post.get("media") or [])):
        return "video"
    return "post"


def _thumb(post: dict) -> Optional[str]:
    for m in post.get("media") or []:
        if not m:
            continue
        if m.get("type") == "video":
            return m.get("poster_url") or m.get("thumbnail_url")
        return m.get("url")
    urls = post.get("media_urls") or []
    return urls[0] if urls else None


def _duration(post: dict):
    for m in post.get("media") or []:
        if m and m.get("type") == "video" and m.get("duration"):
            return m["duration"]
    return None


# ───────────────────────── documentos del índice ─────────────────────────

def doc_post(post: dict, author: Optional[dict]) -> dict:
    kind = _media_kind(post)
    text = post.get("content") or ""
    tags = post.get("hashtags") or []
    title = (post.get("title") or "").strip()
    return {
        "key": f"{kind}:{post['id']}", "kind": kind, "ref_id": post["id"], "owner_id": post.get("user_id"),
        "title": title or text[:80], "title_norm": normalize(title), "body_norm": normalize(f"{text} {' '.join('#' + t for t in tags)} {' '.join('@' + m for m in (post.get('mentions') or []))}"),
        "tokens": tokens(f"{title} {text} {' '.join(tags)}"), "hashtags": [normalize(t) for t in tags],
        "created_at": _iso(post.get("created_at")), "popularity": (post.get("likes_count") or 0) * 2 + (post.get("comments_count") or 0) * 3 + (post.get("views_count") or 0) * 0.2,
        "meta": {"thumb": _thumb(post), "duration": _duration(post), "author_name": (author or {}).get("name"), "author_avatar": (author or {}).get("avatar_url"), "author_id": post.get("user_id"), "post_type": post.get("post_type"), "source": post.get("source")},
    }


def doc_ai_public(post: dict, author: Optional[dict]) -> dict:
    d = doc_post(post, author)
    d.update({"key": f"ai_public:{post['id']}", "kind": "ai_public", "body_norm": normalize(f"{post.get('content') or ''} {post.get('ai_question') or ''}")})
    return d


def doc_comment(c: dict, post: dict, author: Optional[dict]) -> dict:
    return {
        "key": f"comment:{c['id']}", "kind": "comment", "ref_id": c["id"], "owner_id": c.get("user_id"), "post_id": c.get("post_id"),
        "title": "", "title_norm": "", "body_norm": normalize(c.get("content") or ""), "tokens": tokens(c.get("content") or ""),
        "created_at": _iso(c.get("created_at")), "popularity": (c.get("likes_count") or 0) * 2,
        "meta": {"author_name": (author or {}).get("name"), "author_avatar": (author or {}).get("avatar_url"), "post_preview": (post.get("content") or "")[:90], "post_kind": _media_kind(post), "post_author_id": post.get("user_id"), "parent_id": c.get("parent_id")},
    }


def doc_user(user: dict, profile: Optional[dict], is_business: bool, biz: dict) -> dict:
    profile = profile or {}
    name = profile.get("display_name") or user.get("name") or ""
    handle = _handle(user)
    bio = profile.get("bio") or ""
    biz_text = f"{biz.get('name') or ''} {biz.get('category') or ''} {biz.get('description') or ''} {profile.get('company') or ''} {profile.get('profession') or ''}"
    return {
        "key": f"user:{user['id']}", "kind": "user", "ref_id": user["id"], "owner_id": user["id"], "is_business": is_business,
        "title": name, "title_norm": normalize(name), "handle": handle, "body_norm": normalize(f"{bio} {biz_text} {profile.get('location') or ''}"),
        "tokens": tokens(f"{name} {handle} {bio} {biz_text}") + [handle.replace("_", "")], "created_at": _iso(user.get("created_at")),
        "popularity": (profile.get("followers_count") or 0),
        "meta": {"name": name, "handle": handle, "avatar": profile.get("avatar_url") or user.get("avatar_url"), "is_verified": bool(profile.get("is_verified")), "is_private": bool(profile.get("is_private")),
                 "business_name": biz.get("name") or name, "category": biz.get("category") or profile.get("profession"), "location": profile.get("location") or biz.get("location"), "business_image": biz.get("image") or profile.get("avatar_url") or user.get("avatar_url")},
    }


def doc_card(card: dict, owner: Optional[dict]) -> dict:
    # Solo campos autorizados para descubrimiento: título, subtítulo, descripción pública, tipo y nombre del dueño.
    text = f"{card.get('title') or ''} {card.get('subtitle') or ''} {card.get('description') or ''}"
    return {
        "key": f"card:{card['id']}", "kind": "card", "ref_id": card["id"], "owner_id": card.get("user_id"),
        "title": card.get("title") or "", "title_norm": normalize(card.get("title")), "body_norm": normalize(f"{card.get('subtitle') or ''} {card.get('description') or ''} {(owner or {}).get('name') or ''}"),
        "tokens": tokens(f"{text} {(owner or {}).get('name') or ''}"), "created_at": _iso(card.get("created_at")), "popularity": (card.get("views_count") or card.get("views") or 0) * 0.5,
        "meta": {"subtitle": card.get("subtitle"), "card_type": card.get("card_type"), "avatar": card.get("avatar_url"), "bg": card.get("background_color"), "fg": card.get("text_color"), "owner_name": (owner or {}).get("name"), "owner_id": card.get("user_id")},
    }


def doc_product(p: dict, source: str) -> dict:
    name = p.get("title") or p.get("name") or ""
    desc = p.get("description") or ""
    cat = p.get("category") or ""
    images = p.get("images") or []
    return {
        "key": f"product:{p['id']}", "kind": "product", "ref_id": p["id"], "owner_id": p.get("seller_id"), "source": source,
        "title": name, "title_norm": normalize(name), "body_norm": normalize(f"{desc} {cat} {' '.join(p.get('tags') or [])}"),
        "tokens": tokens(f"{name} {desc} {cat} {' '.join(p.get('tags') or [])}"), "created_at": _iso(p.get("created_at")), "popularity": (p.get("views") or 0) * 0.3 + (p.get("favorites") or 0) * 2,
        "meta": {"image": (images[0] if images else None) or p.get("image_url"), "price": p.get("price"), "currency": p.get("currency") or "USD", "seller_name": p.get("seller_name") or ("BRUNO Store" if source == "store" else None), "category": cat, "source": source},
    }


def doc_ai_private(conv: dict) -> dict:
    rid = conv.get("id") or str(conv.get("_id"))
    q, a = conv.get("user_message") or "", conv.get("ai_response") or ""
    return {
        "key": f"ai_private:{rid}", "kind": "ai_private", "ref_id": rid, "owner_id": conv.get("user_id"), "session_id": conv.get("session_id"),
        "title": q[:120], "title_norm": normalize(q), "body_norm": normalize(a), "tokens": tokens(f"{q} {a}"),
        "created_at": _iso(conv.get("created_at")), "popularity": 0,
        "meta": {"question": q[:200], "answer": a[:400], "session_id": conv.get("session_id"), "model": conv.get("model")},
    }


def doc_hashtag(tag: str, count: int, last: str) -> dict:
    n = normalize(tag)
    return {"key": f"hashtag:{n}", "kind": "hashtag", "ref_id": n, "owner_id": None, "title": tag, "title_norm": n, "handle": n, "body_norm": "", "tokens": [n], "created_at": last, "popularity": count, "meta": {"count": count}}


# ───────────────────────── motor (adaptador) ─────────────────────────

class SearchEngine:
    """Interfaz mínima. Implementa `upsert`, `remove` y `candidates` para enchufar otro proveedor."""
    name = "base"

    async def upsert(self, docs: list):
        raise NotImplementedError

    async def remove(self, keys: list):
        raise NotImplementedError

    async def candidates(self, parsed: dict, kinds: list, owner_id: Optional[str], limit: int, fuzzy: bool, date_from=None, date_to=None) -> list:
        raise NotImplementedError

    async def ensure_indexes(self):
        return None


class MongoSearchEngine(SearchEngine):
    """Motor por defecto: regex sobre texto normalizado + corrección ortográfica por vocabulario (rapidfuzz)."""
    name = "mongo"
    col = "search_index"

    async def ensure_indexes(self):
        c = db[self.col]
        await c.create_index("key", unique=True)
        await c.create_index([("kind", 1), ("created_at", -1)])
        await c.create_index([("kind", 1), ("title_norm", 1)])
        await c.create_index([("kind", 1), ("handle", 1)])
        await c.create_index([("owner_id", 1), ("kind", 1)])
        await c.create_index("tokens")
        await c.create_index("hashtags")

    async def upsert(self, docs: list):
        if not docs:
            return
        from pymongo import UpdateOne
        now = datetime.now(timezone.utc).isoformat()
        ops = [UpdateOne({"key": d["key"]}, {"$set": {**d, "indexed_at": now}}, upsert=True) for d in docs]
        await db[self.col].bulk_write(ops, ordered=False)

    async def remove(self, keys: list):
        if keys:
            await db[self.col].delete_many({"key": {"$in": keys}})

    async def vocab(self) -> list:
        if time.time() - _vocab_cache["at"] > 60 or not _vocab_cache["words"]:
            # Nota de escala: distinct sobre un array se vuelve costoso con millones de docs → mover a colección `search_vocab`.
            words = await db[self.col].distinct("tokens")
            _vocab_cache.update(at=time.time(), words=[w for w in words if isinstance(w, str)])
        return _vocab_cache["words"]

    async def fuzzy_tokens(self, qtokens: list) -> list:
        """Palabras del vocabulario parecidas a cada token (≥4 letras) — 1-2 errores tipográficos."""
        try:
            from rapidfuzz import process
            from rapidfuzz.distance import Levenshtein
        except ImportError:
            return []
        vocab = await self.vocab()
        out = []
        for t in qtokens:
            if len(t) < 4:
                continue
            max_dist = 1 if len(t) < 9 else 2
            # distancia de edición (inserción/borrado/sustitución): 1 error en palabras cortas, 2 en largas
            for word, dist, _ in process.extract(t, vocab, scorer=Levenshtein.distance, limit=5, score_cutoff=max_dist):
                if word != t and word not in out and abs(len(word) - len(t)) <= max_dist:
                    out.append(word)
        return out[:12]

    async def candidates(self, parsed, kinds, owner_id, limit, fuzzy, date_from=None, date_to=None):
        import re
        q = parsed["norm"]
        qtoks = [t for t in parsed["tokens"]]
        base = {"kind": {"$in": kinds}}
        if "ai_private" in kinds:
            base = {"$or": [{"kind": {"$in": [k for k in kinds if k != "ai_private"]}}, {"kind": "ai_private", "owner_id": owner_id}]} if len(kinds) > 1 else {"kind": "ai_private", "owner_id": owner_id}
        if date_from or date_to:
            rng = {}
            if date_from:
                rng["$gte"] = date_from
            if date_to:
                rng["$lte"] = date_to
            base = {"$and": [base, {"created_at": rng}]}
        esc = re.escape(q)
        word_rx = [{"body_norm": {"$regex": rf"(^|[^a-z0-9]){re.escape(t)}"}} for t in qtoks[:6]]
        text_or = [{"title_norm": {"$regex": esc}}, {"body_norm": {"$regex": esc}}, {"handle": {"$regex": f"^{esc}"}}, {"tokens": {"$in": [q.replace(" ", "_"), q.replace("_", "").replace(" ", "")]}}, *word_rx]
        if parsed["kind"] == "hashtag":
            text_or.append({"hashtags": {"$regex": f"^{esc}"}})
        proj = {"_id": 0}
        found = await db[self.col].find({"$and": [base, {"$or": text_or}]}, proj).sort("created_at", -1).limit(max(limit * 8, 300)).to_list(None)
        used_fuzzy = []
        if fuzzy and len(found) < limit * 2 and parsed["kind"] == "text":
            used_fuzzy = await self.fuzzy_tokens(qtoks)
            if used_fuzzy:
                seen = {d["key"] for d in found}
                extra = await db[self.col].find({"$and": [base, {"tokens": {"$in": used_fuzzy}}]}, proj).sort("created_at", -1).limit(150).to_list(None)
                found.extend(d for d in extra if d["key"] not in seen)
        for d in found:
            d["_fuzzy"] = used_fuzzy
        return found


class ExternalSearchEngine(SearchEngine):
    """Plantilla para un proveedor hospedado (Algolia/Meilisearch/Typesense). Sin credenciales no se activa."""
    name = "external"

    def __init__(self):
        self.provider = os.environ.get("SEARCH_PROVIDER")
        self.app_id = os.environ.get("SEARCH_APP_ID")
        self.api_key = os.environ.get("SEARCH_API_KEY")
        if not (self.provider and self.api_key):
            raise RuntimeError("SEARCH_PROVIDER/SEARCH_API_KEY no configurados")

    async def upsert(self, docs):  # pragma: no cover - requiere SDK y cuenta del proveedor
        raise NotImplementedError(f"Implementar upsert para {self.provider}")

    async def remove(self, keys):  # pragma: no cover
        raise NotImplementedError(f"Implementar remove para {self.provider}")

    async def candidates(self, *a, **k):  # pragma: no cover
        raise NotImplementedError(f"Implementar candidates para {self.provider}")


_engine: Optional[SearchEngine] = None


def get_engine() -> SearchEngine:
    global _engine
    if _engine is None:
        if os.environ.get("SEARCH_ENGINE", "mongo") == "external":
            try:
                _engine = ExternalSearchEngine()
            except Exception as e:  # noqa: BLE001
                logger.warning("Motor externo no disponible (%s); usando MongoDB", e)
                _engine = MongoSearchEngine()
        else:
            _engine = MongoSearchEngine()
    return _engine


# ───────────────────────── sincronización ─────────────────────────

async def _author(uid: Optional[str]) -> Optional[dict]:
    if not uid:
        return None
    u = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "name": 1, "avatar_url": 1})
    if u and not u.get("avatar_url"):
        p = await db.user_profiles.find_one({"user_id": uid}, {"_id": 0, "avatar_url": 1})
        if p:
            u["avatar_url"] = p.get("avatar_url")
    return u


async def index_post(post: dict):
    eng = get_engine()
    author = await _author(post.get("user_id"))
    docs = [doc_post(post, author)]
    other = "post" if docs[0]["kind"] == "video" else "video"
    await eng.remove([f"{other}:{post['id']}"])
    if post.get("source") == "bruno_ai":
        docs.append(doc_ai_public(post, author))
    await eng.upsert(docs)


async def remove_post(post_id: str):
    await get_engine().remove([f"post:{post_id}", f"video:{post_id}", f"ai_public:{post_id}"])
    await db.search_index.delete_many({"kind": "comment", "post_id": post_id})


async def index_comment(comment: dict, post: Optional[dict] = None):
    post = post or await db.posts.find_one({"id": comment.get("post_id")}, {"_id": 0})
    if not post:
        return
    await get_engine().upsert([doc_comment(comment, post, await _author(comment.get("user_id")))])


async def remove_comment(comment_id: str):
    await get_engine().remove([f"comment:{comment_id}"])
    await db.search_index.delete_many({"kind": "comment", "meta.parent_id": comment_id})


async def index_card(card: dict):
    await get_engine().upsert([doc_card(card, await _author(card.get("user_id")))])


async def remove_card(card_id: str):
    await get_engine().remove([f"card:{card_id}"])


async def index_product(p: dict, source: str = "marketplace"):
    await get_engine().upsert([doc_product(p, source)])


async def remove_product(product_id: str):
    await get_engine().remove([f"product:{product_id}"])


async def index_ai_conversation(conv: dict):
    await get_engine().upsert([doc_ai_private(conv)])


async def index_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        await get_engine().remove([f"user:{user_id}"])
        return
    profile = await db.user_profiles.find_one({"user_id": user_id}, {"_id": 0})
    biz_card = await db.cards.find_one({"user_id": user_id, "card_type": {"$in": list(BUSINESS_CARD_TYPES)}, "is_public": True}, {"_id": 0, "title": 1, "subtitle": 1, "description": 1, "avatar_url": 1})
    has_store = await db.marketplace_products.count_documents({"seller_id": user_id, "status": "active"}) > 0
    is_business = (user.get("role") in BUSINESS_ROLES) or bool(user.get("is_business")) or bool(biz_card) or has_store
    biz = {"name": (biz_card or {}).get("title"), "category": (biz_card or {}).get("subtitle") or (profile or {}).get("profession"), "description": (biz_card or {}).get("description"), "image": (biz_card or {}).get("avatar_url")}
    await get_engine().upsert([doc_user(user, profile, is_business, biz)])


async def index_hashtags():
    # Los contadores solo cuentan publicaciones públicas de cuentas públicas (no revelan contenido restringido)
    private_ids = await db.user_profiles.distinct("user_id", {"is_private": True})
    pipeline = [
        {"$match": {"visibility": "public", "is_deleted": {"$ne": True}, "hashtags.0": {"$exists": True}, "user_id": {"$nin": private_ids}}},
        {"$unwind": "$hashtags"},
        {"$group": {"_id": {"$toLower": "$hashtags"}, "count": {"$sum": 1}, "last": {"$max": "$created_at"}}},
    ]
    rows = await db.posts.aggregate(pipeline).to_list(None)
    docs = [doc_hashtag(r["_id"], r["count"], _iso(r.get("last"))) for r in rows if r["_id"]]
    await db.search_index.delete_many({"kind": "hashtag", "ref_id": {"$nin": [d["ref_id"] for d in docs]}})
    await get_engine().upsert(docs)


async def full_sync(batch: int = 300) -> dict:
    """Reindexa todo por lotes (seguro de ejecutar en caliente; idempotente)."""
    eng = get_engine()
    await eng.ensure_indexes()
    stats = {"posts": 0, "comments": 0, "users": 0, "cards": 0, "products": 0, "ai": 0}
    users = {u["id"]: u async for u in db.users.find({}, {"_id": 0, "id": 1, "name": 1, "avatar_url": 1})}
    live_keys = set()

    buf = []
    async for p in db.posts.find({"is_deleted": {"$ne": True}}, {"_id": 0}):
        d = doc_post(p, users.get(p.get("user_id")))
        buf.append(d); live_keys.add(d["key"])
        if p.get("source") == "bruno_ai":
            d2 = doc_ai_public(p, users.get(p.get("user_id"))); buf.append(d2); live_keys.add(d2["key"])
        stats["posts"] += 1
        if len(buf) >= batch:
            await eng.upsert(buf); buf = []; await asyncio.sleep(0)
    await eng.upsert(buf); buf = []

    post_cache = {}
    async for c in db.comments.find({}, {"_id": 0}):
        pid = c.get("post_id")
        if pid not in post_cache:
            post_cache[pid] = await db.posts.find_one({"id": pid}, {"_id": 0, "id": 1, "content": 1, "user_id": 1, "media": 1, "post_type": 1})
        if not post_cache[pid]:
            continue
        d = doc_comment(c, post_cache[pid], users.get(c.get("user_id"))); buf.append(d); live_keys.add(d["key"]); stats["comments"] += 1
        if len(buf) >= batch:
            await eng.upsert(buf); buf = []; await asyncio.sleep(0)
    await eng.upsert(buf); buf = []

    for uid in list(users.keys()):
        await index_user(uid); live_keys.add(f"user:{uid}"); stats["users"] += 1
        if stats["users"] % 50 == 0:
            await asyncio.sleep(0)

    async for card in db.cards.find({}, {"_id": 0}):
        d = doc_card(card, users.get(card.get("user_id"))); buf.append(d); live_keys.add(d["key"]); stats["cards"] += 1
    await eng.upsert(buf); buf = []

    async for p in db.marketplace_products.find({}, {"_id": 0}):
        d = doc_product(p, "marketplace"); buf.append(d); live_keys.add(d["key"]); stats["products"] += 1
    async for p in db.store_products.find({}, {"_id": 0}):
        d = doc_product(p, "store"); buf.append(d); live_keys.add(d["key"]); stats["products"] += 1
    await eng.upsert(buf); buf = []

    async for conv in db.ai_conversations.find({}):
        if not conv.get("id"):
            await db.ai_conversations.update_one({"_id": conv["_id"]}, {"$set": {"id": str(conv["_id"])}})
            conv["id"] = str(conv["_id"])
        d = doc_ai_private(conv); buf.append(d); live_keys.add(d["key"]); stats["ai"] += 1
        if len(buf) >= batch:
            await eng.upsert(buf); buf = []; await asyncio.sleep(0)
    await eng.upsert(buf)

    async for sr in db.series.find({}, {"_id": 0}):
        from routers.series import _index_series
        await _index_series(sr); live_keys.add(f"series:{sr['id']}")

    await index_hashtags()
    # Retira del índice lo que ya no existe en origen (excepto hashtags, que se recalculan arriba)
    stale = await db.search_index.find({"kind": {"$ne": "hashtag"}}, {"_id": 0, "key": 1}).to_list(None)
    gone = [s["key"] for s in stale if s["key"] not in live_keys]
    await eng.remove(gone)
    stats["removed"] = len(gone)
    await db.search_meta.update_one({"key": "sync"}, {"$set": {"key": "sync", "last_full_sync": datetime.now(timezone.utc).isoformat(), "stats": stats}}, upsert=True)
    _vocab_cache["at"] = 0
    return stats


async def sync_loop(interval: int = 600):
    """Reindexado periódico de respaldo (los hooks de escritura mantienen el índice fresco entre ciclos)."""
    while True:
        try:
            await full_sync()
        except Exception as e:  # noqa: BLE001
            logger.error("search sync failed: %s", e)
        await asyncio.sleep(interval)
