"""Telemetría de rendimiento real (RUM) por país, dispositivo y red — anónima, sin PII, TTL 30 días."""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import db
from utils.security import get_current_user
from utils.perf import stats_snapshot
from models.user import User
from routers.money import is_admin

router = APIRouter(prefix="/telemetry", tags=["telemetry"])

TZ_COUNTRY = {
    "America/Bogota": "CO", "America/Mexico_City": "MX", "America/Cancun": "MX", "America/Monterrey": "MX", "America/Tijuana": "MX", "America/Chihuahua": "MX", "America/Merida": "MX", "America/Hermosillo": "MX", "America/Mazatlan": "MX",
    "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US", "Pacific/Honolulu": "US", "America/Detroit": "US", "America/Boise": "US", "America/Indiana/Indianapolis": "US",
    "America/Lima": "PE", "America/Caracas": "VE", "America/Guayaquil": "EC", "America/Santiago": "CL", "America/Argentina/Buenos_Aires": "AR", "America/Buenos_Aires": "AR", "America/Sao_Paulo": "BR", "America/Manaus": "BR", "America/Fortaleza": "BR", "America/Bahia": "BR", "America/Recife": "BR",
    "America/Panama": "PA", "America/Costa_Rica": "CR", "America/Guatemala": "GT", "America/El_Salvador": "SV", "America/Tegucigalpa": "HN", "America/Managua": "NI", "America/Santo_Domingo": "DO", "America/Havana": "CU", "America/Puerto_Rico": "PR",
    "America/La_Paz": "BO", "America/Asuncion": "PY", "America/Montevideo": "UY", "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA", "America/Winnipeg": "CA", "America/Halifax": "CA", "America/Jamaica": "JM", "America/Port-au-Prince": "HT",
    "Europe/Madrid": "ES", "Europe/Lisbon": "PT", "Europe/Paris": "FR", "Europe/Rome": "IT", "Europe/London": "GB", "Europe/Berlin": "DE",
}
AMERICAS = {"CO", "MX", "US", "PE", "VE", "EC", "CL", "AR", "BR", "PA", "CR", "GT", "SV", "HN", "NI", "DO", "CU", "PR", "BO", "PY", "UY", "CA", "JM", "HT"}


class ApiFailure(BaseModel):
    path: str = Field(max_length=160)
    status: int = 0
    kind: str = Field(default="error", max_length=32)
    ms: float = 0


class PerfBeacon(BaseModel):
    route: str = Field(max_length=120)
    timezone: Optional[str] = Field(default=None, max_length=64)
    language: Optional[str] = Field(default=None, max_length=16)
    device: Optional[str] = Field(default=None, max_length=24)
    platform: Optional[str] = Field(default=None, max_length=24)
    os: Optional[str] = Field(default=None, max_length=24)
    memory_gb: Optional[float] = None
    cores: Optional[int] = None
    net_type: Optional[str] = Field(default=None, max_length=16)
    net_rtt_ms: Optional[float] = None
    net_downlink_mbps: Optional[float] = None
    save_data: Optional[bool] = None
    ttfb_ms: Optional[float] = None
    fcp_ms: Optional[float] = None
    lcp_ms: Optional[float] = None
    cls: Optional[float] = None
    inp_ms: Optional[float] = None
    dom_ready_ms: Optional[float] = None
    load_ms: Optional[float] = None
    js_bytes: Optional[int] = None
    api_avg_ms: Optional[float] = None
    api_calls: Optional[int] = None
    api_failures: List[ApiFailure] = Field(default_factory=list, max_length=20)
    app_version: Optional[str] = Field(default=None, max_length=32)


def _country_from(request: Request, beacon: PerfBeacon) -> str:
    for h in ("cf-ipcountry", "x-country", "x-vercel-ip-country", "x-appengine-country", "cloudfront-viewer-country"):
        v = request.headers.get(h)
        if v and len(v) == 2 and v.upper() != "XX":
            return v.upper()
    if beacon.timezone and beacon.timezone in TZ_COUNTRY:
        return TZ_COUNTRY[beacon.timezone]
    if beacon.language and "-" in beacon.language:
        return beacon.language.split("-")[1].upper()[:2]
    return "ZZ"


SLOW_LCP_MS = 4000
ALERT_MIN_SESSIONS = 5
ALERT_COOLDOWN_H = 6


async def _check_slow_country(country: str):
    """Si la carga (LCP p75, 24 h) de un país supera 4 s, avisa a los administradores (centro + push), máx. 1 vez cada 6 h."""
    if country == "ZZ":
        return
    last = await db.perf_alerts.find_one({"country": country}, {"_id": 0, "at": 1})
    now = datetime.now(timezone.utc)
    if last and last.get("at") and datetime.fromisoformat(last["at"]) > now - timedelta(hours=ALERT_COOLDOWN_H):
        return
    since = (now - timedelta(hours=24)).isoformat()
    rows = await db.perf_telemetry.find({"country": country, "created_at": {"$gte": since}, "lcp_ms": {"$ne": None}}, {"_id": 0, "lcp_ms": 1}).to_list(2000)
    if len(rows) < ALERT_MIN_SESSIONS:
        return
    p75 = _p([r["lcp_ms"] for r in rows], 0.75)
    if not p75 or p75 <= SLOW_LCP_MS:
        return
    await db.perf_alerts.update_one({"country": country}, {"$set": {"country": country, "at": now.isoformat(), "lcp_p75_ms": p75, "sessions": len(rows)}}, upsert=True)
    from routers.posts_feed import _push_notification
    from routers.push_notifications import send_push_notification, NotificationPayload
    msg = f"BRUNO carga lento en {country}: {int(p75 / 1000)} s (p75, {len(rows)} sesiones en 24 h). Revisa /admin/rendimiento."
    async for admin in db.users.find({"role": "admin"}, {"_id": 0, "id": 1}):
        await _push_notification(admin["id"], None, "perf_alert", country, "perf", msg)
        try:
            await send_push_notification(admin["id"], NotificationPayload(title="Alerta de lentitud", body=msg, url="/admin/rendimiento", tag=f"perf-{country}", data={"type": "perf_alert", "country": country}))
        except Exception:
            pass


@router.post("/perf", status_code=202)
async def ingest_perf(beacon: PerfBeacon, request: Request):
    now = datetime.now(timezone.utc)
    doc = beacon.model_dump()
    doc.update({"id": str(uuid.uuid4()), "country": _country_from(request, beacon), "created_at": now.isoformat(), "expires_at": now + timedelta(days=30)})
    await db.perf_telemetry.insert_one(doc)
    try:
        await _check_slow_country(doc["country"])
    except Exception as e:  # la alerta nunca debe romper la ingesta
        import logging; logging.getLogger("bruno.perf").warning("perf alert: %s", e)
    return {"ok": True}


def _p(values, q):
    vals = sorted(v for v in values if isinstance(v, (int, float)))
    return round(vals[min(len(vals) - 1, int(len(vals) * q))], 0) if vals else None


def _group(rows: List[Dict[str, Any]], key: str):
    groups: Dict[str, list] = {}
    for r in rows:
        groups.setdefault(str(r.get(key) or "desconocido"), []).append(r)
    out = []
    for g, items in groups.items():
        fails = sum(len(i.get("api_failures") or []) for i in items)
        calls = sum(i.get("api_calls") or 0 for i in items)
        out.append({key: g, "sessions": len(items), "lcp_p75_ms": _p([i.get("lcp_ms") for i in items], 0.75), "ttfb_p75_ms": _p([i.get("ttfb_ms") for i in items], 0.75), "load_p75_ms": _p([i.get("load_ms") for i in items], 0.75), "inp_p75_ms": _p([i.get("inp_ms") for i in items], 0.75), "api_avg_ms": _p([i.get("api_avg_ms") for i in items], 0.5), "api_fail_rate_pct": round(100 * fails / calls, 2) if calls else 0, "net_rtt_p75_ms": _p([i.get("net_rtt_ms") for i in items], 0.75)})
    out.sort(key=lambda r: r["sessions"], reverse=True)
    return out


@router.get("/perf/summary")
async def perf_summary(days: int = 7, user: User = Depends(get_current_user)):
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    since = (datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 30)))).isoformat()
    rows = await db.perf_telemetry.find({"created_at": {"$gte": since}}, {"_id": 0}).to_list(5000)
    by_country = _group(rows, "country")
    for r in by_country:
        r["region"] = "américa" if r["country"] in AMERICAS else ("europa" if r["country"] in ("ES", "PT", "FR", "IT", "GB", "DE") else "otro")
    alerts = await db.perf_alerts.find({}, {"_id": 0}).sort("at", -1).to_list(20)
    return {"days": days, "sessions": len(rows), "alerts": alerts, "threshold_ms": SLOW_LCP_MS, "by_country": by_country, "by_device": _group(rows, "device"), "by_network": _group(rows, "net_type"), "by_route": _group(rows, "route")[:25], "server_routes": stats_snapshot()}
