"""
Iteration 79: Likes list + text_style features
- GET /api/posts/{id}/likes
- POST /api/posts with text_style (text-only vs media)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

NEWTEST = {"email": "newtest@bruno.com", "password": "Test1234!"}
VIEWER2 = {"email": "viewer2@bruno.com", "password": "Test1234!"}

STYLED_POST_ID = "eefc6ba6-499a-41a0-82be-eca32f4b64f3"
CAROUSEL_POST_ID = "0ded4d5f-867d-4e1a-aafb-c8ffecfd30ac"


def login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok
    return tok, r.json().get("user", {})


@pytest.fixture(scope="module")
def newtest_auth():
    tok, user = login(NEWTEST)
    return {"headers": {"Authorization": f"Bearer {tok}"}, "user": user}


@pytest.fixture(scope="module")
def viewer2_auth():
    tok, user = login(VIEWER2)
    return {"headers": {"Authorization": f"Bearer {tok}"}, "user": user}


# ---- Likes list ----
class TestPostLikes:
    def test_likes_authenticated_is_me(self, newtest_auth):
        r = requests.get(f"{API}/posts/{STYLED_POST_ID}/likes", headers=newtest_auth["headers"], timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        assert isinstance(data["users"], list) and len(data["users"]) >= 1
        # Find the current user in the list
        me = [u for u in data["users"] if u.get("is_me")]
        assert len(me) == 1, f"expected exactly one is_me user, got: {data['users']}"
        assert me[0]["id"] == newtest_auth["user"].get("id")

    def test_likes_unknown_post(self, newtest_auth):
        r = requests.get(f"{API}/posts/nonexistent-id-xyz/likes", headers=newtest_auth["headers"], timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data == {"total": 0, "users": []}

    def test_likes_unauthenticated(self):
        r = requests.get(f"{API}/posts/{STYLED_POST_ID}/likes", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        # no user should be is_me
        assert all(not u.get("is_me") for u in data["users"])

    def test_likes_viewer2_shows_follow_flag(self, viewer2_auth):
        r = requests.get(f"{API}/posts/{STYLED_POST_ID}/likes", headers=viewer2_auth["headers"], timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        # viewer2 should not be is_me for this post (liked by newtest)
        for u in data["users"]:
            assert "is_following" in u
            assert "is_me" in u


# ---- Text style ----
class TestTextStyle:
    _created_ids = []

    def test_create_text_only_with_style(self, newtest_auth):
        payload = {
            "content": "TEST_ text style plum hand",
            "media": [],
            "text_style": {"bg": "plum", "font": "hand"},
        }
        r = requests.post(f"{API}/posts", json=payload, headers=newtest_auth["headers"], timeout=20)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("text_style") == {"bg": "plum", "font": "hand"}
        pid = data["id"]
        self._created_ids.append(pid)
        # GET verify persistence
        g = requests.get(f"{API}/posts/{pid}", headers=newtest_auth["headers"], timeout=15)
        assert g.status_code == 200
        assert g.json().get("text_style") == {"bg": "plum", "font": "hand"}

    def test_create_media_post_ignores_text_style(self, newtest_auth):
        payload = {
            "content": "TEST_ media ignores style",
            "media": [{"url": "https://picsum.photos/seed/x/400/400", "type": "image"}],
            "text_style": {"bg": "plum", "font": "hand"},
        }
        r = requests.post(f"{API}/posts", json=payload, headers=newtest_auth["headers"], timeout=20)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("text_style") in (None, {})
        pid = data["id"]
        self._created_ids.append(pid)
        g = requests.get(f"{API}/posts/{pid}", headers=newtest_auth["headers"], timeout=15)
        assert g.status_code == 200
        assert g.json().get("text_style") in (None, {})

    def test_existing_styled_post_returns_style(self, newtest_auth):
        r = requests.get(f"{API}/posts/{STYLED_POST_ID}", headers=newtest_auth["headers"], timeout=15)
        assert r.status_code == 200
        ts = r.json().get("text_style")
        assert isinstance(ts, dict) and ts.get("bg") and ts.get("font")


# ---- Regression: carousel post has multiple images ----
class TestCarouselRegression:
    def test_carousel_post_has_media(self, newtest_auth):
        r = requests.get(f"{API}/posts/{CAROUSEL_POST_ID}", headers=newtest_auth["headers"], timeout=15)
        assert r.status_code == 200
        media = r.json().get("media") or []
        assert len(media) >= 2, f"expected multi-image carousel, got {len(media)} items"
