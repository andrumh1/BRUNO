"""Tests for iteration 117: accent_color preference, feed kind/fill_public, perf slow-country alerts."""
import os
import time
import asyncio
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

USER = {"email": "newtest@bruno.com", "password": "Test1234!"}
ADMIN = {"email": "testc@brunoqa.com", "password": "Prueba1234!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def user_token():
    return _login(USER)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


# ---------- 1) accent_color preference ----------
def test_update_and_get_accent_color_blue(user_token):
    h = {"Authorization": f"Bearer {user_token}"}
    r = requests.put(f"{API}/settings/preferences", json={"accent_color": "blue"}, headers=h, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json().get("accent_color") == "blue"
    g = requests.get(f"{API}/settings/preferences", headers=h, timeout=30)
    assert g.status_code == 200
    assert g.json().get("accent_color") == "blue"


def test_restore_accent_orange(user_token):
    h = {"Authorization": f"Bearer {user_token}"}
    r = requests.put(f"{API}/settings/preferences", json={"accent_color": "orange"}, headers=h, timeout=30)
    assert r.status_code == 200
    assert r.json().get("accent_color") == "orange"


# ---------- 2) /feed/timeline kind & fill_public ----------
def _timeline(user_token, **params):
    h = {"Authorization": f"Bearer {user_token}"}
    r = requests.get(f"{API}/feed/timeline", headers=h, params=params, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_feed_timeline_kind_photo(user_token):
    data = _timeline(user_token, kind="photo", limit=20)
    for p in data["items"]:
        media = p.get("media") or []
        assert media and all((m.get("type") in ("image", "photo")) for m in media), f"non-photo in: {media}"


def test_feed_timeline_kind_video(user_token):
    data = _timeline(user_token, kind="video", limit=20)
    for p in data["items"]:
        media = p.get("media") or []
        assert media and all(m.get("type") == "video" for m in media), f"non-video media: {media}"


def test_feed_timeline_kind_text(user_token):
    data = _timeline(user_token, kind="text", limit=20)
    for p in data["items"]:
        media = p.get("media")
        assert (not media) or len(media) == 0, f"text post has media: {media}"


def test_feed_timeline_fill_public_zero(user_token):
    data = _timeline(user_token, fill_public=0, limit=10)
    assert data.get("source") == "following"


# ---------- 3) Slow-country perf alert ----------
def _mongo():
    import importlib
    from motor.motor_asyncio import AsyncIOMotorClient
    url = os.environ.get("MONGO_URL") or open("/app/backend/.env").read().split("MONGO_URL=")[1].split("\n")[0].strip('"')
    name = os.environ.get("DB_NAME") or open("/app/backend/.env").read().split("DB_NAME=")[1].split("\n")[0].strip('"')
    client = AsyncIOMotorClient(url)
    return client, client[name]


async def _cleanup_perf():
    client, db = _mongo()
    try:
        await db.perf_telemetry.delete_many({"timezone": "America/Santiago", "lcp_ms": 7000})
        await db.perf_alerts.delete_many({"country": "CL"})
        await db.notifications.delete_many({"type": "perf_alert", "target_id": "CL"})
    finally:
        client.close()


@pytest.fixture(scope="module", autouse=True)
def _pre_cleanup():
    asyncio.run(_cleanup_perf())
    yield
    asyncio.run(_cleanup_perf())


def test_perf_alert_triggers_and_cooldown(admin_token):
    # 6 beacons from CL
    beacon = {
        "route": "/reels",
        "timezone": "America/Santiago",
        "device": "móvil",
        "net_type": "3g",
        "lcp_ms": 7000,
        "api_calls": 2,
        "api_failures": [],
    }
    for i in range(6):
        r = requests.post(f"{API}/telemetry/perf", json=beacon, timeout=30)
        assert r.status_code == 202, r.text
    time.sleep(1.5)

    h = {"Authorization": f"Bearer {admin_token}"}
    s = requests.get(f"{API}/telemetry/perf/summary", headers=h, params={"days": 1}, timeout=30)
    assert s.status_code == 200, s.text
    alerts = s.json().get("alerts", [])
    assert any(a.get("country") == "CL" for a in alerts), f"no CL alert in {alerts}"
    assert s.json().get("threshold_ms") == 4000

    # Admin notification
    n = requests.get(f"{API}/notifications", headers=h, timeout=30)
    assert n.status_code == 200
    body = n.json()
    items = body if isinstance(body, list) else (body.get("items") or body.get("notifications") or [])
    found = [x for x in items if x.get("type") == "perf_alert" and "CL" in (x.get("message", "") + str(x.get("target_id", "")))]
    assert found, f"no perf_alert notification mentioning CL: types={set((i.get('type') for i in items))}"

    # 7th beacon should NOT create a 2nd alert (cooldown)
    r = requests.post(f"{API}/telemetry/perf", json=beacon, timeout=30)
    assert r.status_code == 202
    time.sleep(1)
    s2 = requests.get(f"{API}/telemetry/perf/summary", headers=h, params={"days": 1}, timeout=30)
    alerts2 = [a for a in s2.json().get("alerts", []) if a.get("country") == "CL"]
    assert len(alerts2) == 1, f"expected single CL alert due to cooldown, got {len(alerts2)}"
