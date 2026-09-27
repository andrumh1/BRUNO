"""
Iteration 86 backend tests
- POST /api/cards/{card_id}/save (non-owner first / already / owner-400 / 404)
- Received cards contains via='chat' after save
- POST /api/chats/{chat_id}/messages with mentions and reply_to_id
- GET /api/chats/{chat_id}/messages returns mentions / reply_to_id
- WS send_message echoes reply_to and mentions

Regression: also see test_iteration85_groups_mute_calls_transfer.py (kept green).
"""
import os
import json
import uuid
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_URL_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws/chat"

GROUP_ID = "655d23d2-b133-4188-a95c-bd8a777c04f4"
CARD_ID = "d16c2745-e082-4b22-84f8-749beb5e33fd"

OWNER = ("newtest@bruno.com", "Test1234!")
VIEWER2 = ("viewer2@bruno.com", "Test1234!")
VIEWER3 = ("viewer3@bruno.com", "Test1234!")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _me(tok):
    r = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=15)
    assert r.status_code == 200
    return r.json()


# ---------- Cards save ----------
class TestCardSave:
    def test_save_unknown_card_404(self):
        tok = _login(*VIEWER3)
        r = requests.post(f"{API}/cards/{uuid.uuid4()}/save?via=chat", headers=_h(tok), timeout=15)
        assert r.status_code == 404

    def test_owner_cannot_save_own_card(self):
        tok = _login(*OWNER)
        r = requests.post(f"{API}/cards/{CARD_ID}/save?via=chat", headers=_h(tok), timeout=15)
        assert r.status_code == 400
        assert "ya es tuya" in r.json().get("detail", "")

    def test_non_owner_save_first_and_already(self):
        # Use viewer3 to make first-save deterministic (viewer2 may already have saved)
        tok = _login(*VIEWER3)
        # Clean previous received for isolation
        requests.delete(f"{API}/transfer/received/{CARD_ID}", headers=_h(tok), timeout=15)

        r1 = requests.post(f"{API}/cards/{CARD_ID}/save?via=chat", headers=_h(tok), timeout=15)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1.get("saved") is True
        assert d1.get("already") is False
        assert d1.get("card_id") == CARD_ID

        r2 = requests.post(f"{API}/cards/{CARD_ID}/save?via=chat", headers=_h(tok), timeout=15)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("saved") is True
        assert d2.get("already") is True

        # Received list contains card with via 'chat'
        r3 = requests.get(f"{API}/transfer/received/mine", headers=_h(tok), timeout=15)
        assert r3.status_code == 200
        rows = r3.json()
        match = [c for c in rows if c.get("id") == CARD_ID]
        assert match, f"card {CARD_ID} not in received/mine"
        assert match[0].get("via") == "chat"


# ---------- Chat messages with mentions & reply_to ----------
class TestChatRepliesAndMentions:
    def test_rest_send_with_mentions_and_reply(self):
        owner_tok = _login(*OWNER)
        v2_tok = _login(*VIEWER2)
        owner = _me(owner_tok)
        v2 = _me(v2_tok)

        # 1) owner posts a base message
        base = requests.post(
            f"{API}/chats/{GROUP_ID}/messages",
            headers=_h(owner_tok),
            json={"content": "TEST_iter86 base " + uuid.uuid4().hex[:6], "message_type": "text"},
            timeout=15,
        )
        assert base.status_code == 200, base.text
        base_id = base.json()["id"]

        # 2) viewer2 replies with mention to owner
        reply = requests.post(
            f"{API}/chats/{GROUP_ID}/messages",
            headers=_h(v2_tok),
            json={
                "content": f"TEST_iter86 reply @{owner.get('name') or 'owner'}",
                "message_type": "text",
                "reply_to_id": base_id,
                "mentions": [owner["id"]],
            },
            timeout=15,
        )
        assert reply.status_code == 200, reply.text
        rj = reply.json()
        assert rj.get("reply_to_id") == base_id
        assert owner["id"] in (rj.get("mentions") or [])

        # 3) GET messages returns both
        listr = requests.get(f"{API}/chats/{GROUP_ID}/messages?limit=50", headers=_h(v2_tok), timeout=15)
        assert listr.status_code == 200
        msgs = listr.json()
        by_id = {m["id"]: m for m in msgs}
        assert rj["id"] in by_id
        m = by_id[rj["id"]]
        assert m.get("reply_to_id") == base_id
        assert owner["id"] in (m.get("mentions") or [])

    def test_mentions_filtered_to_participants(self):
        # mentions that are not participants must be dropped
        v2_tok = _login(*VIEWER2)
        fake = str(uuid.uuid4())
        r = requests.post(
            f"{API}/chats/{GROUP_ID}/messages",
            headers=_h(v2_tok),
            json={"content": "TEST_iter86 fake mention", "mentions": [fake]},
            timeout=15,
        )
        assert r.status_code == 200
        assert fake not in (r.json().get("mentions") or [])


class TestWSReplyEcho:
    def test_ws_send_message_echoes_reply_to(self):
        async def run():
            owner_tok = _login(*OWNER)
            v2_tok = _login(*VIEWER2)
            owner = _me(owner_tok)

            # Base message via REST first
            base = requests.post(
                f"{API}/chats/{GROUP_ID}/messages",
                headers=_h(owner_tok),
                json={"content": "TEST_iter86 ws base"},
                timeout=15,
            )
            assert base.status_code == 200
            base_id = base.json()["id"]
            base_sender_name = owner.get("name") or "owner"

            # Open WS as viewer2 and send a reply
            uri = f"{WS_URL_BASE}/{v2_tok}"
            async with websockets.connect(uri, ping_interval=None) as ws:
                reply_obj = {
                    "id": base_id,
                    "sender_id": owner["id"],
                    "sender_name": base_sender_name,
                    "content_preview": "TEST_iter86 ws base",
                }
                await ws.send(json.dumps({
                    "action": "send_message",
                    "chat_id": GROUP_ID,
                    "content": "TEST_iter86 ws reply",
                    "mentions": [owner["id"]],
                    "reply_to": reply_obj,
                }))
                # read until we get new_message for our chat
                deadline = asyncio.get_event_loop().time() + 8
                found = None
                while asyncio.get_event_loop().time() < deadline:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=6)
                    except asyncio.TimeoutError:
                        break
                    try:
                        d = json.loads(raw)
                    except Exception:
                        continue
                    if d.get("type") == "new_message" and d.get("message", {}).get("chat_id") == GROUP_ID and d["message"].get("content") == "TEST_iter86 ws reply":
                        found = d["message"]
                        break
                assert found is not None, "did not receive echoed new_message"
                assert found.get("reply_to", {}).get("id") == base_id
                assert owner["id"] in (found.get("mentions") or [])

        asyncio.get_event_loop().run_until_complete(run())
