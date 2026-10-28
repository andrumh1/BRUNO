"""Rendimiento: timing por ruta (Server-Timing), gzip selectivo, Cache-Control público e índices Mongo."""
import logging
import time
from collections import defaultdict

from starlette.middleware.gzip import GZipMiddleware

from utils.database import db

logger = logging.getLogger("bruno.perf")

SLOW_MS = 750
_stats = defaultdict(lambda: {"count": 0, "errors": 0, "total_ms": 0.0, "max_ms": 0.0, "samples": []})
_MAX_SAMPLES = 200

# Respuestas públicas (sin sesión) que el navegador/CDN pueden cachear brevemente.
PUBLIC_CACHE = {
    "/api/piup/catalog": 120,
    "/api/marketplace/categories": 300,
    "/api/card-examples": 300,
    "/api/store/products": 120,
    "/api/store/plans": 300,
    "/api/i18n": 3600,
    "/api/gifts/catalog": 300,
    "/api/places": 300,
}
NO_GZIP_SUFFIXES = ("/stream",)


def _route_key(scope) -> str:
    route = scope.get("route")
    path = getattr(route, "path", None) or "/".join(scope["path"].split("/")[:4])
    return f"{scope['method']} {path}"


def _record(key: str, ms: float, status: int):
    s = _stats[key]
    s["count"] += 1
    s["total_ms"] += ms
    s["max_ms"] = max(s["max_ms"], ms)
    if status >= 500:
        s["errors"] += 1
    s["samples"].append(ms)
    if len(s["samples"]) > _MAX_SAMPLES:
        del s["samples"][: len(s["samples"]) - _MAX_SAMPLES]


def _pct(samples, p):
    if not samples:
        return 0
    ordered = sorted(samples)
    return round(ordered[min(len(ordered) - 1, int(len(ordered) * p))], 1)


def stats_snapshot(limit: int = 60):
    rows = []
    for key, s in _stats.items():
        rows.append({"route": key, "count": s["count"], "errors_5xx": s["errors"], "avg_ms": round(s["total_ms"] / max(1, s["count"]), 1), "p50_ms": _pct(s["samples"], 0.5), "p95_ms": _pct(s["samples"], 0.95), "max_ms": round(s["max_ms"], 1)})
    rows.sort(key=lambda r: r["p95_ms"] * r["count"], reverse=True)
    return rows[:limit]


class PerfMiddleware:
    """ASGI puro (sin BaseHTTPMiddleware) para no añadir latencia."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        start = time.perf_counter()
        headers = dict(scope.get("headers") or [])
        is_public = b"authorization" not in headers and b"bruno_session" not in headers.get(b"cookie", b"")
        path = scope["path"]
        status_holder = {"status": 0}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                ms = (time.perf_counter() - start) * 1000
                raw = list(message.get("headers") or [])
                raw.append((b"server-timing", f"app;dur={ms:.1f}".encode()))
                if scope["method"] == "GET" and message["status"] == 200:
                    ttl = next((v for k, v in PUBLIC_CACHE.items() if path == k or path.startswith(k + "/")), None)
                    if ttl and is_public and not any(k == b"cache-control" for k, _ in raw):
                        raw.append((b"cache-control", f"public, max-age={ttl}, stale-while-revalidate={ttl * 5}".encode()))
                    elif not any(k == b"cache-control" for k, _ in raw) and any(k == b"content-type" and v.startswith(b"application/json") for k, v in raw):
                        raw.append((b"cache-control", b"private, no-cache"))
                message["headers"] = raw
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            ms = (time.perf_counter() - start) * 1000
            key = _route_key(scope)
            _record(key, ms, status_holder["status"])
            if ms > SLOW_MS or status_holder["status"] >= 500:
                logger.warning("slow/err %s %s %.0fms status=%s", key, path, ms, status_holder["status"])


class SelectiveGZipMiddleware(GZipMiddleware):
    """No comprime SSE (/stream) para que los eventos lleguen sin buffering."""

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"].endswith(NO_GZIP_SUFFIXES):
            return await self.app(scope, receive, send)
        return await super().__call__(scope, receive, send)


INDEXES = {
    "users": [[("email", 1)], [("id", 1)], [("username", 1)]],
    "posts": [[("user_id", 1), ("created_at", -1)], [("created_at", -1)], [("visibility", 1), ("created_at", -1)], [("id", 1)], [("post_type", 1), ("created_at", -1)]],
    "comments": [[("post_id", 1), ("created_at", -1)], [("user_id", 1)]],
    "likes": [[("target_id", 1), ("target_type", 1)], [("user_id", 1), ("target_id", 1)]],
    "reactions": [[("target_id", 1), ("target_type", 1)], [("user_id", 1), ("target_id", 1)]],
    "bookmarks": [[("user_id", 1), ("post_id", 1)]],
    "follows": [[("follower_id", 1), ("following_id", 1)], [("following_id", 1)]],
    "blocks": [[("blocker_id", 1), ("blocked_id", 1)], [("blocked_id", 1)]],
    "notifications": [[("user_id", 1), ("created_at", -1)], [("user_id", 1), ("is_read", 1)]],
    "interactions": [[("user_id", 1), ("created_at", -1)], [("post_id", 1), ("interaction_type", 1)]],
    "feed_interactions": [[("user_id", 1), ("created_at", -1)]],
    "video_views": [[("user_id", 1), ("post_id", 1)], [("post_id", 1)]],
    "video_progress": [[("user_id", 1), ("post_id", 1)], [("user_id", 1), ("updated_at", -1)]],
    "series_follows": [[("series_id", 1), ("user_id", 1)], [("user_id", 1), ("created_at", -1)]],
    "service_requests": [[("id", 1)], [("email_status", 1), ("created_at", -1)], [("user_id", 1), ("created_at", -1)], [("production_status", 1), ("created_at", -1)]],
    "service_payments": [[("id", 1)], [("provider", 1), ("provider_ref", 1)], [("order_id", 1)]],
    "review_tokens": [[("token_hash", 1)], [("order_id", 1), ("revoked_at", 1)]],
    "packages": [[("id", 1)], [("advisor_id", 1), ("created_at", -1)], [("claim_token_hash", 1)], [("claimed_by", 1)]],
    "post_views": [[("post_id", 1), ("viewer_id", 1)]],
    "hidden_posts": [[("user_id", 1), ("post_id", 1)]],
    "cards": [[("user_id", 1)], [("id", 1)]],
    "card_views": [[("card_id", 1), ("created_at", -1)]],
    "card_analytics": [[("card_id", 1), ("created_at", -1)], [("card_owner_id", 1), ("created_at", -1)]],
    "nfc_cards": [[("nfc_id", 1)], [("user_id", 1)]],
    "stories": [[("user_id", 1), ("created_at", -1)], [("created_at", -1)]],
    "story_highlights": [[("user_id", 1)]],
    "series": [[("user_id", 1)]],
    "lives": [[("status", 1), ("created_at", -1)], [("host_id", 1), ("created_at", -1)], [("id", 1)]],
    "live_comments": [[("live_id", 1), ("created_at", -1)]],
    "chats": [[("participants", 1), ("last_message_at", -1)], [("id", 1)]],
    "messages": [[("chat_id", 1), ("id", 1)], [("sender_id", 1)]],
    "marketplace_products": [[("seller_id", 1), ("created_at", -1)], [("category", 1), ("created_at", -1)], [("id", 1)]],
    "marketplace_orders": [[("buyer_id", 1), ("created_at", -1)], [("seller_id", 1), ("created_at", -1)]],
    "piup_products": [[("active", 1), ("category", 1)], [("id", 1)]],
    "piup_orders": [[("user_id", 1), ("created_at", -1)]],
    "store_orders": [[("user_id", 1), ("created_at", -1)]],
    "payment_transactions": [[("session_id", 1)], [("user_id", 1), ("created_at", -1)]],
    "ledger_entries": [[("buyer_id", 1), ("created_at", -1)], [("seller_id", 1), ("created_at", -1)], [("ref_id", 1)]],
    "stripe_events": [[("id", 1)]],
    "user_profiles": [[("user_id", 1)]],
    "user_preferences": [[("user_id", 1)]],
    "user_points": [[("user_id", 1)]],
    "user_sessions": [[("session_token", 1)], [("user_id", 1)]],
    "refresh_tokens": [[("token_hash", 1)], [("user_id", 1)], [("family_id", 1)]],
    "revoked_tokens": [[("jti", 1)]],
    "revoked_families": [[("family_id", 1)]],
    "push_subscriptions": [[("user_id", 1)]],
    "mobile_devices": [[("user_id", 1)], [("device_token", 1)]],
    "push_log": [[("user_id", 1), ("tag", 1)]],
    "audit_logs": [[("user_id", 1), ("created_at", -1)]],
    "polls": [[("creator_id", 1), ("created_at", -1)]],
    "albums": [[("user_id", 1)]],
    "shopping_carts": [[("user_id", 1)]],
    "search_history": [[("user_id", 1), ("at", -1)]],
    "translations": [[("key", 1)]],
    "perf_telemetry": [[("created_at", -1)], [("country", 1), ("created_at", -1)]],
    "saved_places": [[("user_id", 1), ("place_id", 1)], [("user_id", 1), ("created_at", -1)]],
}
TTL_INDEXES = {"perf_telemetry": ("expires_at", 0), "push_log": ("expires_at", 0), "refresh_tokens": ("expires_dt", 0), "revoked_tokens": ("expires_at", 0), "revoked_families": ("expires_at", 0)}


async def ensure_indexes():
    created = 0
    for coll, specs in INDEXES.items():
        for spec in specs:
            try:
                await db[coll].create_index(spec, background=True)
                created += 1
            except Exception as e:  # índice en conflicto con uno previo: no bloquear el arranque
                logger.warning("index %s %s: %s", coll, spec, e)
    for coll, (field, ttl) in TTL_INDEXES.items():
        try:
            await db[coll].create_index(field, expireAfterSeconds=ttl, background=True)
        except Exception as e:
            logger.warning("ttl index %s: %s", coll, e)
    logger.info("perf: %d índices asegurados", created)
