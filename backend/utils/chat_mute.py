"""Per-chat mutes with optional expiry: chats.muted_by=[uid], chats.mute_until={uid: iso|None}."""
from datetime import datetime, timezone

MUTE_DURATIONS = {"1h": 3600, "8h": 8 * 3600, "1w": 7 * 86400, "forever": None}


def active_mutes(chat: dict | None) -> dict:
    """Return {user_id: until_iso|None} for mutes that are still in effect."""
    now = datetime.now(timezone.utc).isoformat()
    until = (chat or {}).get("mute_until") or {}
    out = {}
    for uid in (chat or {}).get("muted_by") or []:
        u = until.get(uid)
        if u and u <= now:
            continue
        out[uid] = u
    return out


def muted_user_ids(chat: dict | None) -> set:
    return set(active_mutes(chat).keys())
