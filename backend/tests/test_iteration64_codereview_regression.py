"""Iteration 64 - Regression after code-review fixes (console.warn + composite keys).
Verifies core endpoints touched by the edited frontend pages still respond 200.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EMAIL = os.environ.get("TEST_USER_EMAIL", "newtest@bruno.com")
PASSWORD = os.environ.get("TEST_USER_PASSWORD", "Test1234!")

CARD_ID = "d16c2745-e082-4b22-84f8-749beb5e33fd"
USER_ID = "b6a3059d-3c5c-4ffd-9fc2-b8dff4a420b9"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def token(session):
    r = session.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert "access_token" in data, f"No access_token in {data}"
    assert data.get("user", {}).get("email") == EMAIL
    return data["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_login_ok(self, token):
        assert isinstance(token, str) and len(token) > 20

    def test_login_bad_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": EMAIL, "password": "wrongpass!!"}, timeout=30)
        assert r.status_code in (400, 401), r.status_code

    def test_me(self, session, headers):
        r = session.get(f"{API}/auth/me", headers=headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["email"] == EMAIL
        assert "_id" not in r.json()


# ---------- ViewCardPage endpoints ----------
class TestViewCard:
    def test_get_card(self, session):
        r = session.get(f"{API}/cards/{CARD_ID}", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["id"] == CARD_ID
        assert "title" in data
        assert "_id" not in data

    def test_card_qr(self, session):
        r = session.get(f"{API}/cards/{CARD_ID}/qr", timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body.get("qr_code", "").startswith("data:image")
        assert CARD_ID in body.get("card_url", "")

    def test_card_view_analytics(self, session):
        r = session.post(f"{API}/analytics/cards/{CARD_ID}/view", timeout=30)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:300]}"

    def test_card_not_found(self, session):
        r = session.get(f"{API}/cards/does-not-exist-xyz", timeout=30)
        assert r.status_code == 404, r.status_code


# ---------- UserProfilePage endpoints ----------
class TestUserProfile:
    def test_profile(self, session, headers):
        r = session.get(f"{API}/users/{USER_ID}/profile", headers=headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "_id" not in data
        assert data.get("id") == USER_ID or data.get("user_id") == USER_ID

    def test_user_posts(self, session, headers):
        r = session.get(f"{API}/social/users/{USER_ID}/posts", headers=headers, timeout=30)
        assert r.status_code in (200, 404), r.status_code
        if r.status_code == 200:
            assert isinstance(r.json(), (list, dict))

    def test_followers_list(self, session, headers):
        r = session.get(f"{API}/social/users/{USER_ID}/followers", headers=headers, timeout=30)
        assert r.status_code in (200, 404), f"{r.status_code} {r.text[:200]}"


# ---------- StorePage endpoints ----------
class TestStore:
    def test_products(self, session):
        r = session.get(f"{API}/store/products", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        items = data if isinstance(data, list) else data.get("products", [])
        assert isinstance(items, list)
        for p in items[:5]:
            assert "_id" not in p
            assert "id" in p or "sku" in p


# ---------- Stories / polls (Stories.jsx key fix) ----------
class TestStories:
    def test_stories_feed(self, session, headers):
        r = session.get(f"{API}/stories/feed", headers=headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json(), list)
