"""Iteration 81: Reels rail, comment delete, post delete, lives, calls (Jitsi fallback)."""
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
VIEWER2_ID = "3636b29b-ae7d-49c4-8a1e-2312500d0eeb"
SHARED_POST_ID = "fe1ab84f-4951-424f-8c0b-3cd6dcf50c89"
CHAT_ID = "fe8ed855-bf15-488f-bf20-5034b11b5f69"


def login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def tok_newtest():
    return login(NEWTEST)


@pytest.fixture(scope="module")
def tok_viewer2():
    return login(VIEWER2)


# ---------- Comments delete ----------

class TestCommentDelete:
    def test_author_can_delete_own_comment(self, tok_viewer2):
        body = {"content": f"TEST_c_{uuid.uuid4().hex[:6]}"}
        r = requests.post(f"{API}/posts/{SHARED_POST_ID}/comments", json=body, headers=H(tok_viewer2), timeout=15)
        assert r.status_code in (200, 201), r.text
        cid = r.json().get("id") or r.json().get("_id") or r.json().get("comment", {}).get("id")
        assert cid, f"no comment id: {r.json()}"
        d = requests.delete(f"{API}/posts/{SHARED_POST_ID}/comments/{cid}", headers=H(tok_viewer2), timeout=15)
        assert d.status_code == 200, d.text
        j = d.json()
        assert j.get("deleted") is True
        assert "comments_count" in j

    def test_post_owner_can_delete_comment(self, tok_viewer2, tok_newtest):
        body = {"content": f"TEST_c_{uuid.uuid4().hex[:6]}"}
        r = requests.post(f"{API}/posts/{SHARED_POST_ID}/comments", json=body, headers=H(tok_viewer2), timeout=15)
        cid = r.json().get("id") or r.json().get("_id")
        d = requests.delete(f"{API}/posts/{SHARED_POST_ID}/comments/{cid}", headers=H(tok_newtest), timeout=15)
        assert d.status_code == 200, d.text
        assert d.json().get("deleted") is True

    def test_non_owner_non_author_cannot_delete(self, tok_newtest, tok_viewer2):
        body = {"content": f"TEST_c_{uuid.uuid4().hex[:6]}"}
        r = requests.post(f"{API}/posts/{SHARED_POST_ID}/comments", json=body, headers=H(tok_newtest), timeout=15)
        cid = r.json().get("id") or r.json().get("_id")
        d = requests.delete(f"{API}/posts/{SHARED_POST_ID}/comments/{cid}", headers=H(tok_viewer2), timeout=15)
        assert d.status_code == 403, d.text
        # cleanup
        requests.delete(f"{API}/posts/{SHARED_POST_ID}/comments/{cid}", headers=H(tok_newtest), timeout=15)

    def test_comment_removed_from_list_and_count_matches(self, tok_viewer2):
        body = {"content": f"TEST_c_{uuid.uuid4().hex[:6]}"}
        r = requests.post(f"{API}/posts/{SHARED_POST_ID}/comments", json=body, headers=H(tok_viewer2), timeout=15)
        cid = r.json().get("id") or r.json().get("_id")
        d = requests.delete(f"{API}/posts/{SHARED_POST_ID}/comments/{cid}", headers=H(tok_viewer2), timeout=15)
        assert d.status_code == 200
        new_count = d.json().get("comments_count")
        lst = requests.get(f"{API}/posts/{SHARED_POST_ID}/comments", headers=H(tok_viewer2), timeout=15)
        assert lst.status_code == 200
        ids = [c.get("id") or c.get("_id") for c in (lst.json() if isinstance(lst.json(), list) else lst.json().get("comments", []))]
        assert cid not in ids
        p = requests.get(f"{API}/posts/{SHARED_POST_ID}", headers=H(tok_viewer2), timeout=15)
        assert p.status_code == 200
        assert p.json().get("comments_count") == new_count


# ---------- Post delete ----------

class TestPostDelete:
    def test_owner_can_delete_own_post(self, tok_viewer2):
        r = requests.post(f"{API}/posts", json={"content": f"TEST_del_{uuid.uuid4().hex[:6]}", "post_type": "text"}, headers=H(tok_viewer2), timeout=15)
        assert r.status_code in (200, 201), r.text
        pid = r.json().get("id") or r.json().get("_id")
        d = requests.delete(f"{API}/posts/{pid}", headers=H(tok_viewer2), timeout=15)
        assert d.status_code == 200
        g = requests.get(f"{API}/posts/{pid}", headers=H(tok_viewer2), timeout=15)
        assert g.status_code == 404 or g.json().get("is_deleted") is True

    def test_non_owner_cannot_delete(self, tok_viewer2, tok_newtest):
        r = requests.post(f"{API}/posts", json={"content": f"TEST_del_{uuid.uuid4().hex[:6]}", "post_type": "text"}, headers=H(tok_viewer2), timeout=15)
        pid = r.json().get("id") or r.json().get("_id")
        d = requests.delete(f"{API}/posts/{pid}", headers=H(tok_newtest), timeout=15)
        assert d.status_code in (403, 404), d.text
        # cleanup
        requests.delete(f"{API}/posts/{pid}", headers=H(tok_viewer2), timeout=15)


# ---------- Reels rail regression ----------

class TestReelsRail:
    def test_like_toggle(self, tok_newtest):
        p0 = requests.get(f"{API}/posts/{SHARED_POST_ID}", headers=H(tok_newtest), timeout=15).json()
        c0 = p0.get("likes_count", 0)
        r1 = requests.post(f"{API}/posts/{SHARED_POST_ID}/like", headers=H(tok_newtest), timeout=15)
        assert r1.status_code == 200
        p1 = requests.get(f"{API}/posts/{SHARED_POST_ID}", headers=H(tok_newtest), timeout=15).json()
        c1 = p1.get("likes_count", 0)
        r2 = requests.post(f"{API}/posts/{SHARED_POST_ID}/like", headers=H(tok_newtest), timeout=15)
        assert r2.status_code == 200
        p2 = requests.get(f"{API}/posts/{SHARED_POST_ID}", headers=H(tok_newtest), timeout=15).json()
        assert abs(c1 - c0) == 1
        assert p2.get("likes_count") == c0

    def test_bookmark_toggle_and_saved_list(self, tok_newtest):
        # ensure unsaved
        s0 = requests.get(f"{API}/posts/saved/list", headers=H(tok_newtest), timeout=15).json()
        ids0 = [p.get("id") for p in (s0 if isinstance(s0, list) else s0.get("posts", []))]
        if SHARED_POST_ID in ids0:
            requests.post(f"{API}/posts/{SHARED_POST_ID}/bookmark", headers=H(tok_newtest), timeout=15)
        r = requests.post(f"{API}/posts/{SHARED_POST_ID}/bookmark", headers=H(tok_newtest), timeout=15)
        assert r.status_code == 200
        s1 = requests.get(f"{API}/posts/saved/list", headers=H(tok_newtest), timeout=15).json()
        ids1 = [p.get("id") for p in (s1 if isinstance(s1, list) else s1.get("posts", []))]
        assert SHARED_POST_ID in ids1
        # untoggle
        requests.post(f"{API}/posts/{SHARED_POST_ID}/bookmark", headers=H(tok_newtest), timeout=15)
        s2 = requests.get(f"{API}/posts/saved/list", headers=H(tok_newtest), timeout=15).json()
        ids2 = [p.get("id") for p in (s2 if isinstance(s2, list) else s2.get("posts", []))]
        assert SHARED_POST_ID not in ids2

    def test_view_and_history(self, tok_newtest):
        v = requests.post(f"{API}/posts/{SHARED_POST_ID}/view", headers=H(tok_newtest), timeout=15)
        assert v.status_code in (200, 201)
        h = requests.get(f"{API}/posts/history/videos", headers=H(tok_newtest), timeout=15)
        assert h.status_code == 200
        ids = [p.get("id") for p in (h.json() if isinstance(h.json(), list) else h.json().get("posts", []))]
        assert SHARED_POST_ID in ids

    def test_follow_unfollow(self, tok_newtest):
        f = requests.post(f"{API}/users/{VIEWER2_ID}/follow", headers=H(tok_newtest), timeout=15)
        assert f.status_code in (200, 201), f.text
        u = requests.post(f"{API}/users/{VIEWER2_ID}/follow", headers=H(tok_newtest), timeout=15)
        assert u.status_code in (200, 201)

    def test_sound_url(self, tok_newtest):
        r = requests.get(f"{API}/posts/sound/{SHARED_POST_ID}", headers=H(tok_newtest), timeout=15)
        assert r.status_code == 200
        assert r.json().get("url") is not None or r.json().get("sound", {}).get("url") is not None

    def test_remixes_and_likes(self, tok_newtest):
        r = requests.get(f"{API}/posts/{SHARED_POST_ID}/remixes", headers=H(tok_newtest), timeout=15)
        assert r.status_code == 200
        l = requests.get(f"{API}/posts/{SHARED_POST_ID}/likes", headers=H(tok_newtest), timeout=15)
        assert l.status_code == 200


# ---------- Lives ----------

class TestLives:
    def test_lives_lifecycle(self, tok_newtest, tok_viewer2):
        # end any existing active live first
        mine = requests.get(f"{API}/lives/mine/active", headers=H(tok_newtest), timeout=15)
        if mine.status_code == 200:
            data = mine.json()
            existing_id = data.get("id") if isinstance(data, dict) else None
            if existing_id:
                requests.post(f"{API}/lives/{existing_id}/end", headers=H(tok_newtest), timeout=15)
        c = requests.post(f"{API}/lives", json={"title": f"TEST_live_{uuid.uuid4().hex[:6]}", "category": "chat"}, headers=H(tok_newtest), timeout=15)
        assert c.status_code == 200, c.text
        lid = c.json().get("id")
        assert lid
        lst = requests.get(f"{API}/lives", headers=H(tok_newtest), timeout=15).json()
        ids = [x.get("id") for x in (lst if isinstance(lst, list) else lst.get("lives", []))]
        assert lid in ids
        j = requests.post(f"{API}/lives/{lid}/join", headers=H(tok_viewer2), timeout=15)
        assert j.status_code == 200, j.text
        cm = requests.post(f"{API}/lives/{lid}/comment", json={"text": "hola"}, headers=H(tok_viewer2), timeout=15)
        assert cm.status_code == 200, cm.text
        e = requests.post(f"{API}/lives/{lid}/end", headers=H(tok_newtest), timeout=15)
        assert e.status_code == 200
        lst2 = requests.get(f"{API}/lives", headers=H(tok_newtest), timeout=15).json()
        ids2 = [x.get("id") for x in (lst2 if isinstance(lst2, list) else lst2.get("lives", []))]
        assert lid not in ids2


# ---------- Calls (Jitsi fallback) ----------

class TestCalls:
    def test_call_start_answer_end(self, tok_newtest, tok_viewer2):
        s = requests.post(f"{API}/calls/start", json={"chat_id": CHAT_ID, "call_type": "audio"}, headers=H(tok_newtest), timeout=15)
        assert s.status_code == 200, s.text
        j = s.json()
        assert "room_url" in j and j["room_url"]
        assert "meet.jit.si" in j["room_url"] or "daily" in j["room_url"]
        cid = j.get("call_id") or j.get("id")
        assert cid
        a = requests.post(f"{API}/calls/{cid}/answer", headers=H(tok_viewer2), timeout=15)
        assert a.status_code == 200, a.text
        assert "room_url" in a.json()
        e = requests.post(f"{API}/calls/{cid}/end", headers=H(tok_newtest), timeout=15)
        assert e.status_code == 200
