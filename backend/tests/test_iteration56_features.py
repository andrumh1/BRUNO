"""Iteration 56: 6-point feature batch tests
- Share OG endpoints (card/user/post)
- Stripe webhook for PIUP
- Auth login with keep_session_active field
- Regression: like/react/comment endpoints
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://premium-launch-13.preview.emergentagent.com').rstrip('/')
EMAIL = "newtest@bruno.com"
PASSWORD = "Test1234!"
TEST_CARD_ID = "d16c2745-e082-4b22-84f8-749beb5e33fd"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token")
    user = data.get("user", {})
    return {"token": token, "user_id": user.get("id"), "headers": {"Authorization": f"Bearer {token}"}}


# --- Share OG endpoints ---
class TestShareOG:
    def test_share_card_valid(self, session):
        r = session.get(f"{BASE_URL}/api/share/c/{TEST_CARD_ID}")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "").lower()
        body = r.text
        assert 'property="og:title"' in body
        assert 'property="og:description"' in body
        assert 'property="og:image"' in body
        assert 'name="twitter:card"' in body
        assert f"/c/{TEST_CARD_ID}" in body

    def test_share_card_not_found(self, session):
        r = session.get(f"{BASE_URL}/api/share/c/nonexistent-id-12345")
        assert r.status_code == 404
        assert "text/html" in r.headers.get("content-type", "").lower()
        assert 'property="og:title"' in r.text
        assert "no encontrada" in r.text.lower() or "not found" in r.text.lower()

    def test_share_user_valid(self, session, auth):
        uid = auth["user_id"]
        r = session.get(f"{BASE_URL}/api/share/u/{uid}")
        assert r.status_code == 200
        assert 'property="og:title"' in r.text
        assert f"/profile/{uid}" in r.text

    def test_share_user_not_found(self, session):
        r = session.get(f"{BASE_URL}/api/share/u/nonexistent-user-id")
        assert r.status_code == 404
        assert 'property="og:title"' in r.text

    def test_share_post_not_found(self, session):
        r = session.get(f"{BASE_URL}/api/share/p/nonexistent-post-id")
        assert r.status_code == 404
        assert 'property="og:title"' in r.text


# --- Stripe webhook ---
class TestStripeWebhook:
    def test_webhook_invalid_payload(self, session):
        # No STRIPE_API_KEY → 503; or with key, missing/invalid signature → 400
        r = session.post(f"{BASE_URL}/api/piup/webhook/stripe", data="invalid", headers={"Stripe-Signature": "bad"})
        assert r.status_code in (400, 503), f"unexpected: {r.status_code} {r.text}"

    def test_webhook_no_signature(self, session):
        r = session.post(f"{BASE_URL}/api/piup/webhook/stripe", json={"foo": "bar"})
        assert r.status_code in (400, 503)


# --- Auth login with keep_session_active ---
class TestAuthKeepSession:
    def test_login_with_extra_field(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMAIL, "password": PASSWORD, "keep_session_active": True
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "user" in data


# --- Regression: like/react/comments ---
class TestPostInteractions:
    @pytest.fixture(scope="class")
    def a_post_id(self, session, auth):
        r = session.get(f"{BASE_URL}/api/posts", headers=auth["headers"])
        assert r.status_code == 200
        posts = r.json()
        if isinstance(posts, dict):
            posts = posts.get("posts", [])
        if not posts:
            # Create a post
            cr = session.post(f"{BASE_URL}/api/posts", json={"content": "TEST_post for iter56"}, headers=auth["headers"])
            assert cr.status_code in (200, 201), cr.text
            return cr.json().get("id")
        return posts[0].get("id")

    def test_like_post(self, session, auth, a_post_id):
        r = session.post(f"{BASE_URL}/api/posts/{a_post_id}/like", headers=auth["headers"])
        assert r.status_code in (200, 201), r.text

    def test_react_post(self, session, auth, a_post_id):
        r = session.post(f"{BASE_URL}/api/posts/{a_post_id}/react?reaction_type=love", headers=auth["headers"])
        assert r.status_code in (200, 201), r.text

    def test_comment_post(self, session, auth, a_post_id):
        r = session.post(f"{BASE_URL}/api/posts/{a_post_id}/comments",
                         json={"content": "TEST_comment iter56"}, headers=auth["headers"])
        assert r.status_code in (200, 201), r.text
        data = r.json()
        # response has either a comment with content or id
        assert "id" in data or "content" in data or "comment" in data
