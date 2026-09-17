"""
Backend tests for BRUNO iteration 80:
- Reel share via chat message (message_type='reel' with attachment fields preserved)
- Text-only post with align + emoji in text_style
- /stories/feed returning active stories groups
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

NEWTEST = {"email": "newtest@bruno.com", "password": "Test1234!"}
VIEWER2 = {"email": "viewer2@bruno.com", "password": "Test1234!"}
CHAT_ID = "fe8ed855-bf15-488f-bf20-5034b11b5f69"
REEL_POST_ID = "27bd9e2f-ae16-49db-bc33-34ab1befe4c8"


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in response: {data}"
    return token


@pytest.fixture(scope="module")
def newtest_headers():
    return {"Authorization": f"Bearer {_login(NEWTEST)}"}


@pytest.fixture(scope="module")
def viewer2_headers():
    return {"Authorization": f"Bearer {_login(VIEWER2)}"}


# ---- Reel share via chat ----
class TestReelChatMessage:
    def test_send_reel_message(self, newtest_headers):
        payload = {
            "message_type": "reel",
            "content": "",
            "attachments": [{
                "type": "reel",
                "post_id": REEL_POST_ID,
                "url": "x",
                "poster_url": None,
                "caption": "c",
                "author_name": "a",
                "kind": "text"
            }]
        }
        r = requests.post(f"{API}/chats/{CHAT_ID}/messages",
                          json=payload, headers=newtest_headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert data.get("message_type") == "reel"
        atts = data.get("attachments") or []
        assert len(atts) >= 1
        a = atts[0]
        assert a.get("post_id") == REEL_POST_ID
        assert a.get("caption") == "c"
        assert a.get("author_name") == "a"
        assert a.get("kind") == "text"

    def test_get_messages_preserves_reel(self, newtest_headers):
        r = requests.get(f"{API}/chats/{CHAT_ID}/messages",
                         headers=newtest_headers, timeout=30)
        assert r.status_code == 200
        msgs = r.json()
        assert isinstance(msgs, list)
        # Find latest reel message
        reel_msgs = [m for m in msgs if m.get("message_type") == "reel"]
        assert reel_msgs, "no reel message found"
        m = reel_msgs[-1]
        atts = m.get("attachments") or []
        assert atts, "reel message has no attachments"
        a = atts[0]
        assert a.get("post_id")
        assert "caption" in a
        assert "author_name" in a
        assert "kind" in a


# ---- Text-only post with align + emoji ----
class TestTextStylePost:
    def test_create_text_post_with_align_emoji(self, newtest_headers):
        payload = {
            "content": "TEST_iter80 styled post",
            "visibility": "public",
            "text_style": {"bg": "rose", "font": "hand", "align": "left", "emoji": "🔥"}
        }
        r = requests.post(f"{API}/posts", json=payload,
                          headers=newtest_headers, timeout=30)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        data = r.json()
        pid = data.get("id") or data.get("post_id")
        assert pid
        ts = data.get("text_style") or {}
        assert ts.get("align") == "left", f"align missing in create resp: {ts}"
        assert ts.get("emoji") == "🔥", f"emoji missing in create resp: {ts}"

        # GET to verify persistence
        g = requests.get(f"{API}/posts/{pid}", headers=newtest_headers, timeout=30)
        assert g.status_code == 200
        gd = g.json()
        gts = gd.get("text_style") or {}
        assert gts.get("align") == "left"
        assert gts.get("emoji") == "🔥"


# ---- Stories feed ----
class TestStoriesFeed:
    def test_stories_feed_has_viewer2_group(self, newtest_headers):
        r = requests.get(f"{API}/stories/feed",
                         headers=newtest_headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        groups = data if isinstance(data, list) else data.get("groups") or data.get("items") or []
        assert len(groups) >= 1, f"expected ≥1 story group, got {data}"
        g0 = groups[0]
        assert "user_id" in g0
        assert "user_name" in g0
        assert "has_unseen" in g0
