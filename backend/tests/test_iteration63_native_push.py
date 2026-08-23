"""Iteration 63 — Native app conversion (Capacitor) backend regression.

Coverage:
  1. Health / backend boot after adding firebase-admin + utils/native_push.py
  2. Mobile native device registration + list + unregister (routers/mobile_native.py)
  3. POST /api/push/test graceful fallback when FIREBASE_SERVICE_ACCOUNT_JSON absent
  4. GET /api/mobile/config
  5. Regression of previously extracted routers: cards, user_data, calls,
     posts_feed, i18n, piup
  6. Env integrity (MONGO_URL / DB_NAME / REACT_APP_BACKEND_URL)
"""
import os
import re
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL missing from env and /app/frontend/.env")
BASE_URL = _base.rstrip("/")
API = f"{BASE_URL}/api"


def _creds():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    email = re.search(r"(?im)^\s*[-*]?\s*Email:\s*(\S+)", content).group(1)
    pwd = re.search(r"(?im)^\s*[-*]?\s*Password:\s*(\S+)", content).group(1)
    return {"email": email, "password": pwd}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def token(client):
    c = _creds()
    r = client.post(f"{API}/auth/login", json=c, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("access_token")
    assert tok, f"No access_token in login response: {r.json().keys()}"
    return tok


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_devices():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(client, auth, created_devices):
    yield
    for did in created_devices:
        client.delete(f"{API}/mobile/devices/{did}", headers=auth, timeout=30)


# ── 1. Health / boot ──────────────────────────────────────────────────────────

class TestHealth:
    def test_root_api_reachable(self, client):
        r = client.get(f"{API}/", timeout=30)
        assert r.status_code in (200, 404), r.text[:200]

    def test_native_push_module_imports(self):
        import sys
        sys.path.insert(0, "/app/backend")
        from utils.native_push import send_native_push, _init_firebase
        assert callable(send_native_push)
        # No Firebase creds in preview -> must return False without raising
        assert _init_firebase() is False

    def test_env_integrity(self):
        be = dotenv_values("/app/backend/.env")
        assert be.get("MONGO_URL"), "MONGO_URL missing from backend/.env"
        assert be.get("DB_NAME"), "DB_NAME missing from backend/.env"
        assert frontend_env.get("REACT_APP_BACKEND_URL"), "REACT_APP_BACKEND_URL missing"

    def test_firebase_admin_pinned(self):
        req = Path("/app/backend/requirements.txt").read_text()
        assert "firebase-admin==6.5.0" in req


# ── 2. Mobile device registration ─────────────────────────────────────────────

class TestDeviceRegistration:
    def test_register_android_device(self, client, auth, created_devices):
        token_val = f"TEST_fcm_{uuid.uuid4().hex}"
        payload = {
            "device_token": token_val,
            "platform": "android",
            "app_version": "1.0.0",
            "locale": "es-ES",
        }
        r = client.post(f"{API}/mobile/devices/register", json=payload, headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["platform"] == "android"
        assert d["app_version"] == "1.0.0"
        assert d["locale"] == "es-ES"
        assert isinstance(d["id"], str) and d["id"]
        assert "device_token" not in d, "device_token must never be returned"
        assert "_id" not in d
        created_devices.append(d["id"])
        self.__class__.device_id = d["id"]
        self.__class__.device_token = token_val

    def test_registered_device_persists_in_list(self, client, auth):
        r = client.get(f"{API}/mobile/devices", headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:300]
        devices = r.json()
        assert isinstance(devices, list)
        ids = [x["id"] for x in devices]
        assert self.__class__.device_id in ids, "registered device not persisted"
        for x in devices:
            assert "device_token" not in x, "token leaked in list response"
            assert "_id" not in x

    def test_reregister_same_token_is_upsert(self, client, auth):
        payload = {
            "device_token": self.__class__.device_token,
            "platform": "ios",
            "app_version": "1.0.1",
            "locale": "en-US",
        }
        r = client.post(f"{API}/mobile/devices/register", json=payload, headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["id"] == self.__class__.device_id
        assert r.json()["platform"] == "ios"
        # verify persisted change
        lst = client.get(f"{API}/mobile/devices", headers=auth, timeout=30).json()
        match = [x for x in lst if x["id"] == self.__class__.device_id]
        assert match and match[0]["app_version"] == "1.0.1"

    def test_invalid_platform_returns_400(self, client, auth):
        r = client.post(
            f"{API}/mobile/devices/register",
            json={"device_token": f"TEST_bad_{uuid.uuid4().hex}", "platform": "macos"},
            headers=auth, timeout=30,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:300]}"
        assert "platform" in str(r.json().get("detail", "")).lower()

    def test_missing_device_token_returns_422(self, client, auth):
        r = client.post(f"{API}/mobile/devices/register", json={"platform": "android"},
                        headers=auth, timeout=30)
        assert r.status_code == 422, r.text[:300]

    def test_short_device_token_returns_422(self, client, auth):
        r = client.post(f"{API}/mobile/devices/register",
                        json={"device_token": "abc", "platform": "android"},
                        headers=auth, timeout=30)
        assert r.status_code == 422, r.text[:300]

    def test_register_requires_auth(self, client):
        r = client.post(f"{API}/mobile/devices/register",
                        json={"device_token": "TEST_noauth_token", "platform": "android"},
                        timeout=30)
        assert r.status_code in (401, 403), r.status_code

    def test_list_requires_auth(self, client):
        r = client.get(f"{API}/mobile/devices", timeout=30)
        assert r.status_code in (401, 403), r.status_code

    def test_unregister_unknown_device_404(self, client, auth):
        r = client.delete(f"{API}/mobile/devices/{uuid.uuid4()}", headers=auth, timeout=30)
        assert r.status_code == 404, r.text[:300]

    def test_unregister_device(self, client, auth):
        tok = f"TEST_del_{uuid.uuid4().hex}"
        reg = client.post(f"{API}/mobile/devices/register",
                          json={"device_token": tok, "platform": "expo"},
                          headers=auth, timeout=30)
        assert reg.status_code == 200
        did = reg.json()["id"]
        d = client.delete(f"{API}/mobile/devices/{did}", headers=auth, timeout=30)
        assert d.status_code == 200, d.text[:300]
        assert d.json()["status"] == "unregistered"
        lst = client.get(f"{API}/mobile/devices", headers=auth, timeout=30).json()
        assert did not in [x["id"] for x in lst], "device still listed after unregister"


# ── 3. Push test endpoint graceful fallback ───────────────────────────────────

class TestPushFallback:
    def test_push_test_returns_200_without_firebase(self, client, auth):
        r = client.post(f"{API}/push/test", headers=auth, timeout=60)
        assert r.status_code == 200, f"push/test crashed: {r.status_code} {r.text[:400]}"
        assert isinstance(r.json(), dict)

    def test_push_test_with_native_device_registered(self, client, auth, created_devices):
        """Registered native device must NOT make push/test crash (Firebase absent)."""
        tok = f"TEST_native_{uuid.uuid4().hex}"
        reg = client.post(f"{API}/mobile/devices/register",
                          json={"device_token": tok, "platform": "android",
                                "app_version": "1.0.0", "locale": "es-ES"},
                          headers=auth, timeout=30)
        assert reg.status_code == 200
        created_devices.append(reg.json()["id"])
        r = client.post(f"{API}/push/test", headers=auth, timeout=60)
        assert r.status_code == 200, f"push/test crashed with native device: {r.text[:400]}"

    def test_push_test_requires_auth(self, client):
        r = client.post(f"{API}/push/test", timeout=30)
        assert r.status_code in (401, 403)


# ── 4. Mobile config ─────────────────────────────────────────────────────────

class TestMobileConfig:
    def test_config_public(self, client):
        r = client.get(f"{API}/mobile/config", timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "vapid_public_key" in d and isinstance(d["vapid_public_key"], str)
        assert d["supports"]["fcm"] is True
        assert d["supports"]["apns"] is True
        assert d["endpoints"]["device_register"] == "/api/mobile/devices/register"

    def test_sync_manifest(self, client, auth):
        r = client.get(f"{API}/mobile/sync/manifest", headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert "cards" in r.json()["collections"]


# ── 5. Regression: previously extracted routers ───────────────────────────────

class TestCardsRegression:
    def test_card_crud(self, client, auth):
        payload = {"card_type": "personal", "title": "TEST_it63 Card",
                   "description": "native regression"}
        c = client.post(f"{API}/cards", json=payload, headers=auth, timeout=30)
        assert c.status_code in (200, 201), c.text[:400]
        card = c.json()
        cid = card["id"]
        assert "_id" not in card

        g = client.get(f"{API}/cards/{cid}", headers=auth, timeout=30)
        assert g.status_code == 200
        assert g.json()["title"] == payload["title"]

        u = client.put(f"{API}/cards/{cid}", json={"title": "TEST_it63 Updated"},
                       headers=auth, timeout=30)
        assert u.status_code == 200, u.text[:300]
        assert client.get(f"{API}/cards/{cid}", headers=auth, timeout=30).json()["title"] == "TEST_it63 Updated"

        d = client.delete(f"{API}/cards/{cid}", headers=auth, timeout=30)
        assert d.status_code in (200, 204), d.text[:300]
        assert client.get(f"{API}/cards/{cid}", headers=auth, timeout=30).status_code == 404

    def test_list_cards(self, client, auth):
        r = client.get(f"{API}/cards", headers=auth, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_explore_cards(self, client, auth):
        r = client.get(f"{API}/cards/explore", headers=auth, timeout=30)
        assert r.status_code == 200


class TestUserDataRegression:
    def test_saved_data(self, client, auth):
        r = client.get(f"{API}/user/saved-data", headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert "_id" not in r.json()

    def test_plans(self, client):
        r = client.get(f"{API}/plans", timeout=30)
        assert r.status_code == 200
        ids = [p.get("id") for p in (r.json() if isinstance(r.json(), list) else r.json().get("plans", []))]
        assert "free" in ids, ids

    def test_subscription(self, client, auth):
        r = client.get(f"{API}/user/subscription", headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_address_and_social_validation(self, client, auth):
        assert client.post(f"{API}/user/addresses", json={}, headers=auth, timeout=30).status_code == 422
        assert client.post(f"{API}/user/social-links", json={}, headers=auth, timeout=30).status_code == 422


class TestOtherRoutersRegression:
    def test_calls_start_nonexistent_chat_404(self, client, auth):
        r = client.post(f"{API}/calls/start",
                        json={"chat_id": str(uuid.uuid4()), "call_type": "video"},
                        headers=auth, timeout=30)
        assert r.status_code == 404, f"{r.status_code} {r.text[:300]}"

    def test_recommended_videos(self, client, auth):
        r = client.get(f"{API}/posts/recommended-videos", headers=auth, timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_i18n_countries_and_currencies(self, client):
        for path in ("/i18n/countries", "/i18n/currencies", "/i18n/detect"):
            r = client.get(f"{API}{path}", timeout=30)
            assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"

    def test_piup_catalog(self, client):
        r = client.get(f"{API}/piup/catalog", timeout=30)
        assert r.status_code == 200, r.text[:300]
