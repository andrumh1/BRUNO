"""Iteration 82: PUT /api/posts/{id} edit + DELETE /api/posts/history/videos."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

NEWTEST = {"email": "newtest@bruno.com", "password": "Test1234!"}
VIEWER2 = {"email": "viewer2@bruno.com", "password": "Test1234!"}
NEWTEST_ID = "b6a3059d-3c5c-4ffd-9fc2-b8dff4a420b9"
TEXT_POST_ID = "27bd9e2f-ae16-49db-bc33-34ab1befe4c8"
MEDIA_POST_ID = "fe1ab84f-4951-424f-8c0b-3cd6dcf50c89"


def login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def tok_newtest():
    return login(NEWTEST)


@pytest.fixture(scope="module")
def tok_viewer2():
    return login(VIEWER2)


# ---------- Edit post ----------

class TestEditPost:
    def test_owner_edit_text_post_updates_content_hashtags_text_style(self, tok_newtest):
        content = f"Nuevo #tag {uuid.uuid4().hex[:6]}"
        style = {"bg": "plum", "font": "mono", "align": "left", "emoji": "💡"}
        r = requests.put(f"{API}/posts/{TEXT_POST_ID}", json={"content": content, "text_style": style}, headers=H(tok_newtest), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("content") == content
        assert "tag" in (j.get("hashtags") or [])
        assert j.get("text_style", {}).get("bg") == "plum"
        assert j.get("text_style", {}).get("font") == "mono"
        assert j.get("text_style", {}).get("align") == "left"
        assert j.get("edited_at")

    def test_non_owner_cannot_edit_returns_403(self, tok_viewer2):
        r = requests.put(f"{API}/posts/{TEXT_POST_ID}", json={"content": "hack"}, headers=H(tok_viewer2), timeout=15)
        assert r.status_code == 403, r.text

    def test_unknown_post_id_returns_404(self, tok_newtest):
        r = requests.put(f"{API}/posts/nonexistent-{uuid.uuid4().hex}", json={"content": "x"}, headers=H(tok_newtest), timeout=15)
        assert r.status_code == 404, r.text

    def test_media_post_ignores_text_style_but_updates_content(self, tok_newtest):
        # Fetch current text_style (may be None) to verify unchanged
        p0 = requests.get(f"{API}/posts/{MEDIA_POST_ID}", headers=H(tok_newtest), timeout=15).json()
        original_style = p0.get("text_style")
        new_caption = f"Media caption {uuid.uuid4().hex[:6]}"
        r = requests.put(
            f"{API}/posts/{MEDIA_POST_ID}",
            json={"content": new_caption, "text_style": {"bg": "teal", "font": "sans", "align": "center"}},
            headers=H(tok_newtest),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("content") == new_caption
        # text_style must NOT have been overwritten
        assert j.get("text_style") == original_style


# ---------- Watch history ----------

class TestVideoHistory:
    def _clear(self, tok):
        requests.delete(f"{API}/posts/history/videos", headers=H(tok), timeout=15)

    def test_history_add_remove_one_and_clear(self, tok_viewer2):
        self._clear(tok_viewer2)
        # Create 2 throwaway text posts by newtest? We need 2 real posts to view.
        # Use fixtures MEDIA_POST_ID and TEXT_POST_ID as viewable posts.
        for pid in (TEXT_POST_ID, MEDIA_POST_ID):
            v = requests.post(f"{API}/posts/{pid}/view", headers=H(tok_viewer2), timeout=15)
            assert v.status_code in (200, 201), v.text

        h = requests.get(f"{API}/posts/history/videos", headers=H(tok_viewer2), timeout=15)
        assert h.status_code == 200
        data = h.json()
        items = data if isinstance(data, list) else data.get("posts", [])
        ids = [p.get("id") for p in items]
        assert TEXT_POST_ID in ids
        assert MEDIA_POST_ID in ids

        # Remove one
        d = requests.delete(f"{API}/posts/history/videos", params={"post_id": TEXT_POST_ID}, headers=H(tok_viewer2), timeout=15)
        assert d.status_code == 200
        assert d.json().get("deleted") >= 1

        h2 = requests.get(f"{API}/posts/history/videos", headers=H(tok_viewer2), timeout=15).json()
        items2 = h2 if isinstance(h2, list) else h2.get("posts", [])
        ids2 = [p.get("id") for p in items2]
        assert TEXT_POST_ID not in ids2
        assert MEDIA_POST_ID in ids2

        # Clear all
        d2 = requests.delete(f"{API}/posts/history/videos", headers=H(tok_viewer2), timeout=15)
        assert d2.status_code == 200
        h3 = requests.get(f"{API}/posts/history/videos", headers=H(tok_viewer2), timeout=15).json()
        items3 = h3 if isinstance(h3, list) else h3.get("posts", [])
        assert items3 == [] or len(items3) == 0


# ---------- Regression: delete own throwaway post (owner) ----------

class TestOwnerDeletePost:
    def test_owner_delete_throwaway(self, tok_newtest):
        r = requests.post(f"{API}/posts", json={"content": f"TEST_del_{uuid.uuid4().hex[:6]}", "post_type": "text"}, headers=H(tok_newtest), timeout=15)
        assert r.status_code in (200, 201), r.text
        pid = r.json().get("id")
        assert pid
        d = requests.delete(f"{API}/posts/{pid}", headers=H(tok_newtest), timeout=15)
        assert d.status_code == 200
