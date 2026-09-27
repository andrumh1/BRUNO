"""Do-Not-Disturb helpers: users.dnd = {enabled, start:"22:00", end:"07:00", tz_offset_min}."""
from datetime import datetime, timedelta, timezone


def _minutes(hhmm: str, default: int) -> int:
    try:
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)
    except Exception:
        return default


def is_dnd_active(user_doc: dict | None) -> bool:
    dnd = (user_doc or {}).get("dnd") or {}
    if not dnd.get("enabled"):
        return False
    offset = int(dnd.get("tz_offset_min") or 0)  # minutes east of UTC (JS: -getTimezoneOffset())
    local = datetime.now(timezone.utc) + timedelta(minutes=offset)
    now_m = local.hour * 60 + local.minute
    start, end = _minutes(dnd.get("start", "22:00"), 22 * 60), _minutes(dnd.get("end", "07:00"), 7 * 60)
    if start == end:
        return True
    return start <= now_m < end if start < end else (now_m >= start or now_m < end)
