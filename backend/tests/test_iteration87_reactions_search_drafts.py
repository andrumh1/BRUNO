"""
Iteration 87 backend tests:
- POST /api/chats/{chat_id}/messages/{message_id}/react (toggle/replace/participant/404)
- GET  /api/chats/{chat_id}/messages/{message_id}/reactions (grouping + is_me)
- GET  /api/chats/{chat_id}/messages/search (results / offset / short q / non-participant)
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

GROUP_ID = "655d23d2-b133-4188-a95c-bd8a777c04f4"
OWNER = ("newtest@bruno.com", "Test1234!")
VIEWER2 = ("viewer2@bruno.com", "Test1234!")
VIEWER3 = ("viewer3@bruno.com", "Test1234!")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _post_msg(tok, content):
    r = requests.post(f"{API}/chats/{GROUP_ID}/messages", headers=_h(tok), json={"content": content, "message_type": "text"}, timeout=15)
    assert r.status_code in (200, 201), f"post msg: {r.status_code} {r.text}"
    j = r.json()
    return j.get("id") or j.get("message", {}).get("id")


# ---------- Reactions ----------
class TestReactions:
    @classmethod
    def setup_class(cls):
        cls.tok_owner = _login(*OWNER)
        cls.tok_v2 = _login(*VIEWER2)
        cls.tok_v3 = _login(*VIEWER3)
        cls.msg_id = _post_msg(cls.tok_owner, f"iter87-react-{uuid.uuid4().hex[:6]}")

    def test_react_added(self):
        r = requests.post(f"{API}/chats/{GROUP_ID}/messages/{self.msg_id}/react", headers=_h(self.tok_v2), params={"emoji": "❤️"}, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["action"] == "added"
        assert any(x["emoji"] == "❤️" for x in j["reactions"])

    def test_react_replaced(self):
        r = requests.post(f"{API}/chats/{GROUP_ID}/messages/{self.msg_id}/react", headers=_h(self.tok_v2), params={"emoji": "😂"}, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["action"] == "added"
        mine = [x for x in j["reactions"] if x["emoji"] == "😂"]
        assert len(mine) == 1
        # No more heart from viewer2
        assert not any(x["emoji"] == "❤️" for x in j["reactions"])

    def test_react_removed(self):
        # same emoji again → removed
        r = requests.post(f"{API}/chats/{GROUP_ID}/messages/{self.msg_id}/react", headers=_h(self.tok_v2), params={"emoji": "😂"}, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["action"] == "removed"
        assert not j["reactions"]

    def test_react_non_participant_404(self):
        r = requests.post(f"{API}/chats/{GROUP_ID}/messages/{self.msg_id}/react", headers=_h(self.tok_v3), params={"emoji": "❤️"}, timeout=15)
        assert r.status_code == 404

    def test_react_unknown_message_404(self):
        r = requests.post(f"{API}/chats/{GROUP_ID}/messages/{uuid.uuid4()}/react", headers=_h(self.tok_v2), params={"emoji": "❤️"}, timeout=15)
        assert r.status_code == 404

    def test_reactions_grouping_is_me(self):
        # viewer2 ❤️, owner 😂
        requests.post(f"{API}/chats/{GROUP_ID}/messages/{self.msg_id}/react", headers=_h(self.tok_v2), params={"emoji": "❤️"}, timeout=15)
        requests.post(f"{API}/chats/{GROUP_ID}/messages/{self.msg_id}/react", headers=_h(self.tok_owner), params={"emoji": "😂"}, timeout=15)
        r = requests.get(f"{API}/chats/{GROUP_ID}/messages/{self.msg_id}/reactions", headers=_h(self.tok_v2), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["total"] == 2
        emojis = {g["emoji"]: g for g in j["groups"]}
        assert "❤️" in emojis and "😂" in emojis
        heart_users = emojis["❤️"]["users"]
        assert heart_users[0]["is_me"] is True
        assert heart_users[0].get("name")
        # owner is not me from v2's perspective
        laugh_users = emojis["😂"]["users"]
        assert laugh_users[0]["is_me"] is False
        # cleanup
        requests.post(f"{API}/chats/{GROUP_ID}/messages/{self.msg_id}/react", headers=_h(self.tok_v2), params={"emoji": "❤️"}, timeout=15)
        requests.post(f"{API}/chats/{GROUP_ID}/messages/{self.msg_id}/react", headers=_h(self.tok_owner), params={"emoji": "😂"}, timeout=15)


# ---------- Search ----------
class TestSearch:
    @classmethod
    def setup_class(cls):
        cls.tok_owner = _login(*OWNER)
        cls.tok_v2 = _login(*VIEWER2)
        cls.tok_v3 = _login(*VIEWER3)
        cls.token = f"iter87search{uuid.uuid4().hex[:6]}"
        cls.msg_ids = [_post_msg(cls.tok_owner, f"hola {cls.token} uno"),
                       _post_msg(cls.tok_owner, f"hola {cls.token} dos"),
                       _post_msg(cls.tok_owner, f"HOLA {cls.token} tres MAYUS")]
        time.sleep(0.5)

    def test_search_finds_case_insensitive(self):
        r = requests.get(f"{API}/chats/{GROUP_ID}/messages/search", headers=_h(self.tok_v2), params={"q": self.token}, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["total"] >= 3
        for res in j["results"]:
            assert self.token.lower() in res["snippet"].lower()
            assert "sender" in res and res["sender"].get("name")
            assert "created_at" in res
            assert "offset" in res and isinstance(res["offset"], int)

    def test_search_offset_matches_ordering(self):
        # /messages returns newest-first typically. Verify offset for the most recent hit is 0
        r = requests.get(f"{API}/chats/{GROUP_ID}/messages/search", headers=_h(self.tok_v2), params={"q": self.token}, timeout=15)
        results = r.json()["results"]
        # Most recent result (results are sorted desc by created_at) should have offset 0
        assert results[0]["offset"] == 0
        # Offsets should be non-decreasing as we move to older messages
        offsets = [x["offset"] for x in results]
        assert offsets == sorted(offsets)

    def test_search_short_query(self):
        r = requests.get(f"{API}/chats/{GROUP_ID}/messages/search", headers=_h(self.tok_v2), params={"q": "a"}, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["total"] == 0
        assert j["results"] == []

    def test_search_non_participant_404(self):
        r = requests.get(f"{API}/chats/{GROUP_ID}/messages/search", headers=_h(self.tok_v3), params={"q": "hola"}, timeout=15)
        assert r.status_code == 404
