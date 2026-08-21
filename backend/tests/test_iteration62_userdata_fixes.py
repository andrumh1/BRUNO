"""Iteration 62 — targeted retest of routers/user_data.py fixes:
   (1) POST /api/user/addresses typed body -> 422 on invalid
   (2) POST /api/user/social-links typed body -> 422 on invalid
   (3) PUT /api/user/saved-data whitelists allowed fields (ignores user_id / unknown keys)
   plus regression sanity on plans / subscription / saved-data / address delete.
"""
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
API = f"{base_url.rstrip('/')}/api"


def _creds():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("missing test_credentials.md")
    c = p.read_text(encoding="utf-8")
    e = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    if not e or not pw:
        pytest.skip("no creds found")
    return {"email": e.group(1), "password": pw.group(1)}


@pytest.fixture(scope="session")
def creds():
    return _creds()


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def H(client, creds):
    r = client.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    t = r.json().get("access_token") or r.json().get("token")
    if not t:
        pytest.fail(f"no token: {r.text[:300]}")
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


# ── FIX 1: POST /api/user/addresses validation ──
class TestAddressValidation:
    @pytest.mark.parametrize("body", [
        {},
        {"label": "x"},
        {"full_name": "QA", "phone": "+34600000000"},  # missing address_line1/city/postal/country
        {"full_name": "QA", "phone": "1", "address_line1": "a", "city": "M", "postal_code": "1"},  # no country
    ])
    def test_invalid_address_returns_422(self, client, H, body):
        r = client.post(f"{API}/user/addresses", headers=H, json=body, timeout=30)
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text[:300]}"
        assert "detail" in r.json()

    def test_valid_address_and_delete(self, client, H):
        before = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        had = bool(before.get("addresses"))

        payload = {
            "label": "TEST_it62", "full_name": "QA Tester62", "phone": "+34600000062",
            "address_line1": "Calle Test 62", "city": "Madrid",
            "postal_code": "28002", "country": "ES",
        }
        r = client.post(f"{API}/user/addresses", headers=H, json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body["message"] == "Address added"
        addr = body["address"]
        assert addr["city"] == "Madrid" and addr["country"] == "ES"
        assert isinstance(addr["id"], str) and len(addr["id"]) > 10
        if not had:
            assert addr["is_default"] is True, "first address must be default"

        g = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        assert any(a["id"] == addr["id"] for a in g["addresses"]), "not persisted"

        d = client.delete(f"{API}/user/addresses/{addr['id']}", headers=H, timeout=30)
        assert d.status_code == 200, d.text[:300]
        g2 = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        assert not any(a["id"] == addr["id"] for a in g2["addresses"]), "not removed"


# ── FIX 2: POST /api/user/social-links validation ──
class TestSocialLinkValidation:
    @pytest.mark.parametrize("body", [
        {},
        {"type": "twitter"},
        {"type": "twitter", "label": "X"},  # missing url
        {"bogus": 1},
    ])
    def test_invalid_social_link_returns_422(self, client, H, body):
        r = client.post(f"{API}/user/social-links", headers=H, json=body, timeout=30)
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text[:300]}"

    def test_valid_social_link(self, client, H):
        r = client.post(f"{API}/user/social-links", headers=H, json={
            "type": "twitter", "label": "TEST_X_it62", "url": "https://x.com/x"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["message"] == "Social link saved"
        g = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        assert any(s["label"] == "TEST_X_it62" for s in g["social_links"])
        # cleanup
        cleaned = [s for s in g["social_links"] if s["label"] != "TEST_X_it62"]
        client.put(f"{API}/user/saved-data", headers=H, json={"social_links": cleaned}, timeout=30)
        g2 = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        assert not any(s["label"] == "TEST_X_it62" for s in g2["social_links"])


# ── FIX 3: PUT /api/user/saved-data whitelist ──
class TestSavedDataWhitelist:
    def test_user_id_is_ignored(self, client, H):
        original = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        original_uid = original["user_id"]

        r = client.put(f"{API}/user/saved-data", headers=H,
                       json={"user_id": "evil", "bio": "TEST_bio_it62"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body["message"] == "Data saved successfully"
        assert set(body["updated_fields"]) == {"bio", "updated_at"}, body["updated_fields"]
        assert "user_id" not in body["updated_fields"]

        g = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        assert g["user_id"] == original_uid, "user_id was overwritten!"
        assert g["user_id"] != "evil"
        assert g["bio"] == "TEST_bio_it62"

    def test_unknown_keys_dropped(self, client, H):
        r = client.put(f"{API}/user/saved-data", headers=H,
                       json={"evil_key": "x", "bio": "TEST_ok_it62"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        fields = r.json()["updated_fields"]
        assert "evil_key" not in fields
        assert set(fields) == {"bio", "updated_at"}, fields

        g = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        assert g["bio"] == "TEST_ok_it62"
        assert "evil_key" not in g

    def test_all_known_fields(self, client, H):
        payload = {"full_name": "QA It62", "phone": "+34611111162",
                   "bio": "TEST_bio_final62", "profession": "QA Engineer"}
        r = client.put(f"{API}/user/saved-data", headers=H, json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        fields = set(r.json()["updated_fields"])
        assert fields == set(payload) | {"updated_at"}, fields
        g = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        for k, v in payload.items():
            assert g[k] == v, f"{k} not persisted"
        assert "_id" not in g


# ── regression sanity ──
class TestRegressions:
    def test_plans(self):
        r = requests.get(f"{API}/plans", timeout=30)
        assert r.status_code == 200, r.text[:300]
        ids = {p["id"] for p in r.json()}
        assert {"free", "pro", "business"}.issubset(ids), ids

    def test_user_subscription(self, client, H):
        r = client.get(f"{API}/user/subscription", headers=H, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["plan_id"] == "free"

    def test_subscribe_free_400(self, client, H):
        r = client.post(f"{API}/subscribe/free", headers=H, timeout=30)
        assert r.status_code == 400, f"{r.status_code} {r.text[:200]}"

    def test_saved_data_unauth(self, client):
        r = requests.get(f"{API}/user/saved-data", timeout=30)
        assert r.status_code in (401, 403), r.status_code

    def test_delete_unknown_address_ok(self, client, H):
        r = client.delete(f"{API}/user/addresses/nonexistent-id-it62", headers=H, timeout=30)
        assert r.status_code == 200, r.text[:200]
