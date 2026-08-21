"""Iteration 61 — sanity gate for newly extracted routers:
   routers/cards.py  and  routers/user_data.py
   plus regression checks on video_calls / posts / i18n / piup / auth.
"""
import os
import re
import base64
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


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
def token(client, creds):
    r = client.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    t = r.json().get("access_token") or r.json().get("token")
    if not t:
        pytest.fail(f"no token in login response: {r.text[:300]}")
    return t


@pytest.fixture(scope="session")
def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def created_cards():
    return []


@pytest.fixture(scope="session", autouse=True)
def cleanup(client, H, created_cards):
    yield
    for cid in created_cards:
        client.delete(f"{API}/cards/{cid}", headers=H, timeout=30)


# ─────────────────── auth / health ───────────────────
class TestAuth:
    def test_auth_me(self, client, H, creds):
        r = client.get(f"{API}/auth/me", headers=H, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["email"] == creds["email"]
        assert "id" in d and isinstance(d["id"], str)
        assert "_id" not in d

    def test_cards_requires_auth(self, client):
        r = client.get(f"{API}/cards", timeout=30)
        assert r.status_code in (401, 403), r.status_code


# ─────────────────── cards CRUD ───────────────────
class TestCardsCRUD:
    def test_list_my_cards(self, client, H):
        r = client.get(f"{API}/cards", headers=H, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list)
        for c in data:
            assert "id" in c and "user_id" in c and "_id" not in c

    def test_create_get_update_delete(self, client, H, created_cards):
        payload = {
            "card_type": "personal",
            "title": "TEST_card_it61",
            "subtitle": "QA subtitle",
            "description": "created by iteration61 test",
            "background_color": "#123456",
            "is_public": True,
            "show_in_feed": True,
        }
        r = client.post(f"{API}/cards", headers=H, json=payload, timeout=30)
        assert r.status_code == 201, f"{r.status_code} {r.text[:400]}"
        card = r.json()
        cid = card["id"]
        created_cards.append(cid)
        assert card["title"] == "TEST_card_it61"
        assert card["background_color"] == "#123456"
        assert card["views"] == 0
        assert "_id" not in card

        # GET one increments views
        g1 = client.get(f"{API}/cards/{cid}", headers=H, timeout=30)
        assert g1.status_code == 200, g1.text[:300]
        assert g1.json()["views"] == 1
        g2 = client.get(f"{API}/cards/{cid}", headers=H, timeout=30)
        assert g2.json()["views"] == 2, "views should increment on each GET"

        # persisted in list
        lst = client.get(f"{API}/cards", headers=H, timeout=30).json()
        assert any(c["id"] == cid for c in lst)

        # UPDATE
        u = client.put(f"{API}/cards/{cid}", headers=H,
                       json={"title": "TEST_card_it61_updated"}, timeout=30)
        assert u.status_code == 200, u.text[:300]
        assert u.json()["title"] == "TEST_card_it61_updated"
        assert u.json()["subtitle"] == "QA subtitle", "unrelated field must stay intact"
        again = client.get(f"{API}/cards/{cid}", headers=H, timeout=30)
        assert again.json()["title"] == "TEST_card_it61_updated"

        # DELETE -> 204, then 404
        d = client.delete(f"{API}/cards/{cid}", headers=H, timeout=30)
        assert d.status_code == 204, f"{d.status_code} {d.text[:200]}"
        created_cards.remove(cid)
        assert client.get(f"{API}/cards/{cid}", headers=H, timeout=30).status_code == 404

    def test_get_nonexistent_card_404(self, client, H):
        r = client.get(f"{API}/cards/does-not-exist-uuid", headers=H, timeout=30)
        assert r.status_code == 404

    def test_update_nonexistent_card_404(self, client, H):
        r = client.put(f"{API}/cards/does-not-exist-uuid", headers=H,
                       json={"title": "x"}, timeout=30)
        assert r.status_code == 404

    def test_delete_nonexistent_card_404(self, client, H):
        r = client.delete(f"{API}/cards/does-not-exist-uuid", headers=H, timeout=30)
        assert r.status_code == 404

    def test_reorder(self, client, H, created_cards):
        ids = []
        for i in range(2):
            r = client.post(f"{API}/cards", headers=H, json={
                "card_type": "personal", "title": f"TEST_reorder_{i}"}, timeout=30)
            assert r.status_code == 201, r.text[:300]
            ids.append(r.json()["id"])
            created_cards.append(r.json()["id"])

        rev = list(reversed(ids))
        r = client.put(f"{API}/cards/reorder", headers=H, json={"card_ids": rev}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("status") == "ok" and body.get("count") == 2

        lst = client.get(f"{API}/cards", headers=H, timeout=30).json()
        order = [c["id"] for c in lst if c["id"] in ids]
        assert order == rev, f"reorder not reflected in list order: {order} vs {rev}"

        for cid in ids:
            assert client.delete(f"{API}/cards/{cid}", headers=H, timeout=30).status_code == 204
            created_cards.remove(cid)


# ─────────────────── public cards ───────────────────
class TestPublicCards:
    def test_public_cards_no_auth(self, client):
        r = requests.get(f"{API}/public/cards?limit=3", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list)
        assert len(data) <= 3
        for c in data:
            assert c["is_public"] is True
            assert "id" in c and "title" in c and "_id" not in c

    def test_explore_no_auth(self):
        r = requests.get(f"{API}/cards/explore?limit=2", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, list) and len(data) <= 2
        for c in data:
            assert c["is_public"] is True


# ─────────────────── card QR ───────────────────
class TestCardQR:
    def test_qr_for_existing_card(self, client, H, created_cards):
        r = client.post(f"{API}/cards", headers=H, json={
            "card_type": "personal", "title": "TEST_qr_card",
            "background_color": "#FF5A00"}, timeout=30)
        assert r.status_code == 201
        cid = r.json()["id"]
        created_cards.append(cid)

        q = client.get(f"{API}/cards/{cid}/qr", timeout=60)
        assert q.status_code == 200, f"{q.status_code} {q.text[:400]}"
        d = q.json()
        assert d["qr_code"].startswith("data:image/png;base64,")
        raw = base64.b64decode(d["qr_code"].split(",", 1)[1])
        assert raw[:8] == b"\x89PNG\r\n\x1a\n", "not a valid PNG"
        assert len(raw) > 500
        assert d["card_url"].endswith(f"/c/{cid}")
        assert d["card_url"].startswith("http"), f"FRONTEND_URL not set: {d['card_url']}"
        assert d["color"] == "#FF5A00"

        client.delete(f"{API}/cards/{cid}", headers=H, timeout=30)
        created_cards.remove(cid)

    def test_qr_nonexistent_404(self, client):
        r = client.get(f"{API}/cards/nope-nope/qr", timeout=30)
        assert r.status_code == 404


# ─────────────────── user saved data ───────────────────
class TestUserSavedData:
    def test_get_saved_data_autocreate(self, client, H):
        r = client.get(f"{API}/user/saved-data", headers=H, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "user_id" in d
        assert isinstance(d.get("addresses"), list)
        assert isinstance(d.get("social_links"), list)
        assert "_id" not in d

    def test_update_saved_data_persists(self, client, H):
        r = client.put(f"{API}/user/saved-data", headers=H,
                       json={"bio": "TEST_bio_it61", "profession": "QA Engineer"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert "message" in r.json()
        g = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        assert g["bio"] == "TEST_bio_it61"
        assert g["profession"] == "QA Engineer"

    def test_address_create_default_and_delete(self, client, H):
        before = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        had_addresses = bool(before.get("addresses"))

        payload = {
            "label": "TEST_Home", "full_name": "QA Tester", "phone": "+34600000000",
            "address_line1": "Calle Test 1", "city": "Madrid",
            "postal_code": "28001", "country": "ES",
        }
        r = client.post(f"{API}/user/addresses", headers=H, json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        addr = r.json()["address"]
        aid = addr["id"]
        assert addr["city"] == "Madrid"
        if not had_addresses:
            assert addr["is_default"] is True, "first address must become default"

        g = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        assert any(a["id"] == aid for a in g["addresses"]), "address not persisted"

        d = client.delete(f"{API}/user/addresses/{aid}", headers=H, timeout=30)
        assert d.status_code == 200, d.text[:300]
        g2 = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        assert not any(a["id"] == aid for a in g2["addresses"]), "address not removed"

    def test_address_invalid_payload(self, client, H):
        r = client.post(f"{API}/user/addresses", headers=H, json={"label": "x"}, timeout=30)
        assert r.status_code in (400, 422), f"expected validation error, got {r.status_code}"

    def test_social_link_add(self, client, H):
        r = client.post(f"{API}/user/social-links", headers=H, json={
            "type": "instagram", "label": "TEST_ig",
            "url": "https://instagram.com/test_it61"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        g = client.get(f"{API}/user/saved-data", headers=H, timeout=30).json()
        assert any(s["label"] == "TEST_ig" for s in g["social_links"])
        # cleanup via PUT (no delete endpoint exists)
        cleaned = [s for s in g["social_links"] if s["label"] != "TEST_ig"]
        client.put(f"{API}/user/saved-data", headers=H,
                   json={"social_links": cleaned}, timeout=30)


# ─────────────────── subscriptions ───────────────────
class TestSubscriptions:
    def test_plans(self, client):
        r = requests.get(f"{API}/plans", timeout=30)
        assert r.status_code == 200, r.text[:300]
        plans = r.json()
        ids = {p["id"] for p in plans}
        assert {"free", "pro", "business"}.issubset(ids), ids
        for p in plans:
            assert "_id" not in p
            assert "price_monthly" in p and "limits" in p and "features" in p

    def test_user_subscription_default_free(self, client, H):
        r = client.get(f"{API}/user/subscription", headers=H, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["plan_id"] == "free"
        assert d["status"] == "active"

    def test_subscribe_free_rejected(self, client, H):
        r = client.post(f"{API}/subscribe/free", headers=H, timeout=30)
        assert r.status_code == 400, f"{r.status_code} {r.text[:300]}"
        assert "Free plan" in r.text

    def test_subscribe_unknown_plan_404(self, client, H):
        r = client.post(f"{API}/subscribe/nonexistent_plan", headers=H, timeout=30)
        assert r.status_code == 404


# ─────────────────── regressions ───────────────────
class TestRegressions:
    def test_calls_start_bad_chat(self, client, H):
        r = client.post(f"{API}/calls/start", headers=H,
                        json={"chat_id": "bad-chat-id", "call_type": "video"}, timeout=30)
        assert r.status_code == 404, f"{r.status_code} {r.text[:300]}"

    def test_recommended_videos(self, client, H):
        r = client.get(f"{API}/posts/recommended-videos", headers=H, timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json(), (list, dict))

    def test_i18n_countries(self, client):
        r = requests.get(f"{API}/i18n/countries", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        countries = data if isinstance(data, list) else data.get("countries", [])
        assert len(countries) > 10
        codes = {c.get("code") for c in countries if isinstance(c, dict)}
        assert "ES" in codes and "US" in codes, codes

    def test_piup_catalog(self, client):
        r = requests.get(f"{API}/piup/catalog", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        products = data if isinstance(data, list) else data.get("products", [])
        assert len(products) == 19, f"expected 19 products, got {len(products)}"
