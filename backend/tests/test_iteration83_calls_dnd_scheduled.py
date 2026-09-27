"""Iteration 83: Daily calls, DND, scheduled posts, cron."""
import os
import time
import requests
import pytest
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
CHAT_ID = "fe8ed855-bf15-488f-bf20-5034b11b5f69"
NEWTEST_ID = "b6a3059d-3c5c-4ffd-9fc2-b8dff4a420b9"

def _login(email, password="Test1234!"):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]

@pytest.fixture(scope="module")
def newtest_tok():
    return _login("newtest@bruno.com")

@pytest.fixture(scope="module")
def viewer2_tok():
    return _login("viewer2@bruno.com")

def _h(tok): return {"Authorization": f"Bearer {tok}"}

# ─── Calls: Daily active ─────────────────────────────────────────────────────
class TestCalls:
    def test_start_call_returns_tokened_daily_url(self, newtest_tok):
        r = requests.post(f"{API}/calls/start", json={"chat_id": CHAT_ID, "call_type": "video"}, headers=_h(newtest_tok), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["room_url"].startswith("https://ovcgroup.daily.co/"), d
        assert "?t=" in d["room_url"]
        assert d["call_id"]
        assert d.get("dnd") is False
        pytest.call_id_answer = d["call_id"]

    def test_answer_returns_different_tokened_url(self, viewer2_tok):
        cid = pytest.call_id_answer
        r = requests.post(f"{API}/calls/{cid}/answer", headers=_h(viewer2_tok), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "answered"
        assert d["room_url"].startswith("https://ovcgroup.daily.co/")
        assert "?t=" in d["room_url"]

    def test_end_after_answer_logs_ended_message(self, newtest_tok):
        cid = pytest.call_id_answer
        time.sleep(1)
        r = requests.post(f"{API}/calls/{cid}/end", headers=_h(newtest_tok), timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "ended"
        # Verify chat message logged
        msgs = requests.get(f"{API}/chats/{CHAT_ID}/messages?limit=10", headers=_h(newtest_tok), timeout=15).json()
        call_msgs = [m for m in msgs if m.get("message_type") == "call" and m.get("attachments", [{}])[0].get("call_id") == cid]
        assert call_msgs, "No call message logged"
        m = call_msgs[0]
        assert m["content"].startswith("Videollamada ·"), m["content"]
        assert m["attachments"][0]["status"] == "ended"

    def test_decline_flow(self, newtest_tok, viewer2_tok):
        r = requests.post(f"{API}/calls/start", json={"chat_id": CHAT_ID, "call_type": "video"}, headers=_h(newtest_tok), timeout=20)
        assert r.status_code == 200
        cid = r.json()["call_id"]
        r2 = requests.post(f"{API}/calls/{cid}/decline", headers=_h(viewer2_tok), timeout=15)
        assert r2.status_code == 200
        assert r2.json()["status"] == "declined"
        msgs = requests.get(f"{API}/chats/{CHAT_ID}/messages?limit=10", headers=_h(newtest_tok), timeout=15).json()
        cm = next((m for m in msgs if m.get("attachments", [{}])[0].get("call_id") == cid), None)
        assert cm and cm["content"] == "Videollamada rechazada", cm

    def test_end_without_answer_is_missed(self, newtest_tok):
        r = requests.post(f"{API}/calls/start", json={"chat_id": CHAT_ID, "call_type": "video"}, headers=_h(newtest_tok), timeout=20)
        assert r.status_code == 200
        cid = r.json()["call_id"]
        r2 = requests.post(f"{API}/calls/{cid}/end", headers=_h(newtest_tok), timeout=15)
        assert r2.status_code == 200
        assert r2.json()["status"] == "missed"
        msgs = requests.get(f"{API}/chats/{CHAT_ID}/messages?limit=10", headers=_h(newtest_tok), timeout=15).json()
        cm = next((m for m in msgs if m.get("attachments", [{}])[0].get("call_id") == cid), None)
        assert cm and cm["content"] == "Videollamada perdida", cm

    def test_two_calls_in_a_row_unique_rooms(self, newtest_tok):
        r1 = requests.post(f"{API}/calls/start", json={"chat_id": CHAT_ID, "call_type": "video"}, headers=_h(newtest_tok), timeout=20)
        assert r1.status_code == 200
        room1 = r1.json()["room_url"].split("?")[0]
        # end first
        requests.post(f"{API}/calls/{r1.json()['call_id']}/end", headers=_h(newtest_tok), timeout=15)
        r2 = requests.post(f"{API}/calls/start", json={"chat_id": CHAT_ID, "call_type": "video"}, headers=_h(newtest_tok), timeout=20)
        assert r2.status_code == 200, r2.text
        room2 = r2.json()["room_url"].split("?")[0]
        assert room1 != room2
        requests.post(f"{API}/calls/{r2.json()['call_id']}/end", headers=_h(newtest_tok), timeout=15)

# ─── DND ────────────────────────────────────────────────────────────────────
class TestDND:
    def test_dnd_full_flow(self, newtest_tok, viewer2_tok):
        # Enable DND all-day
        r = requests.put(f"{API}/auth/me/dnd", json={"enabled": True, "start": "00:00", "end": "00:00", "tz_offset_min": 0}, headers=_h(viewer2_tok), timeout=15)
        assert r.status_code == 200
        assert r.json()["active"] is True
        # GET reflects it
        r2 = requests.get(f"{API}/auth/me/dnd", headers=_h(viewer2_tok), timeout=15)
        assert r2.status_code == 200 and r2.json()["enabled"] is True

        # Call from newtest → dnd:true, empty room_url
        rc = requests.post(f"{API}/calls/start", json={"chat_id": CHAT_ID, "call_type": "audio"}, headers=_h(newtest_tok), timeout=20)
        assert rc.status_code == 200
        d = rc.json()
        assert d["dnd"] is True
        assert d["room_url"] == ""
        cid = d["call_id"]
        # Chat message logged with "(No molestar)"
        msgs = requests.get(f"{API}/chats/{CHAT_ID}/messages?limit=10", headers=_h(newtest_tok), timeout=15).json()
        cm = next((m for m in msgs if m.get("attachments", [{}])[0].get("call_id") == cid), None)
        assert cm and "(No molestar)" in cm["content"], cm
        assert cm["content"].startswith("Llamada de voz perdida"), cm["content"]

        # Disable DND
        r3 = requests.put(f"{API}/auth/me/dnd", json={"enabled": False, "start": "00:00", "end": "00:00", "tz_offset_min": 0}, headers=_h(viewer2_tok), timeout=15)
        assert r3.status_code == 200
        assert r3.json()["active"] is False

        # Now call rings again
        rc2 = requests.post(f"{API}/calls/start", json={"chat_id": CHAT_ID, "call_type": "video"}, headers=_h(newtest_tok), timeout=20)
        assert rc2.status_code == 200
        assert rc2.json()["dnd"] is False
        requests.post(f"{API}/calls/{rc2.json()['call_id']}/end", headers=_h(newtest_tok), timeout=15)

    def test_dnd_window_not_active(self, viewer2_tok):
        # Set a 1-hour window that does NOT contain current UTC time
        now_utc = datetime.now(timezone.utc)
        # pick a window 2h from now, 1h long
        start = (now_utc + timedelta(hours=2)).strftime("%H:%M")
        end = (now_utc + timedelta(hours=3)).strftime("%H:%M")
        r = requests.put(f"{API}/auth/me/dnd", json={"enabled": True, "start": start, "end": end, "tz_offset_min": 0}, headers=_h(viewer2_tok), timeout=15)
        assert r.status_code == 200
        assert r.json()["active"] is False, r.json()
        # cleanup: leave viewer2 with DND disabled per instructions
        r2 = requests.put(f"{API}/auth/me/dnd", json={"enabled": False, "start": "22:00", "end": "07:00", "tz_offset_min": 0}, headers=_h(viewer2_tok), timeout=15)
        assert r2.status_code == 200
        assert r2.json()["enabled"] is False

# ─── Scheduled posts ─────────────────────────────────────────────────────────
class TestScheduled:
    def test_scheduled_lifecycle(self, newtest_tok, viewer2_tok):
        future = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat()
        r = requests.post(f"{API}/posts", json={"content": "TEST_scheduled iteration83", "scheduled_at": future}, headers=_h(newtest_tok), timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["visibility"] == "scheduled"
        assert p.get("scheduled_at")
        post_id = p["id"]
        pytest.sched_future_id = post_id

        # NOT in viewer2 recommended-videos (kind=all)
        rec = requests.get(f"{API}/posts/recommended-videos?kind=all&limit=60", headers=_h(viewer2_tok), timeout=15).json()
        assert not any(x["id"] == post_id for x in rec), "Scheduled leaked into recommended"

        # NOT in viewer2's view of newtest posts
        p_list = requests.get(f"{API}/users/{NEWTEST_ID}/posts", headers=_h(viewer2_tok), timeout=15).json()
        assert not any(x["id"] == post_id for x in p_list), "Scheduled leaked to non-owner"

        # DOES appear for owner
        p_owner = requests.get(f"{API}/users/{NEWTEST_ID}/posts", headers=_h(newtest_tok), timeout=15).json()
        mine = [x for x in p_owner if x["id"] == post_id]
        assert mine and mine[0]["visibility"] == "scheduled"

        # DOES appear in /posts/scheduled/mine
        sm = requests.get(f"{API}/posts/scheduled/mine", headers=_h(newtest_tok), timeout=15).json()
        assert any(x["id"] == post_id for x in sm)

    def test_cron_auth(self):
        # No auth → 401
        r = requests.post(f"{API}/cron/publish-scheduled", timeout=15)
        assert r.status_code == 401
        secret = None
        with open("/app/backend/.env") as f:
            for line in f:
                if line.startswith("WEBHOOK_CRON_SECRET="):
                    secret = line.split("=", 1)[1].strip()
        assert secret, "no WEBHOOK_CRON_SECRET"
        r2 = requests.post(f"{API}/cron/publish-scheduled", headers={"Authorization": f"Bearer {secret}"}, timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("accepted") is True
        pytest.cron_secret = secret

    def test_cron_publishes_due_post(self, newtest_tok):
        # Create a post scheduled ~3s in the future
        soon = (datetime.now(timezone.utc) + timedelta(seconds=3)).isoformat()
        r = requests.post(f"{API}/posts", json={"content": "TEST_scheduled_soon", "scheduled_at": soon}, headers=_h(newtest_tok), timeout=15)
        assert r.status_code == 200
        pid = r.json()["id"]
        assert r.json()["visibility"] == "scheduled"
        time.sleep(5)
        # Run cron
        r2 = requests.post(f"{API}/cron/publish-scheduled", headers={"Authorization": f"Bearer {pytest.cron_secret}"}, timeout=15)
        assert r2.status_code == 200
        time.sleep(2)
        got = requests.get(f"{API}/posts/{pid}", headers=_h(newtest_tok), timeout=15).json()
        assert got["visibility"] == "public", got

    def test_future_post_stays_scheduled_after_cron(self, newtest_tok):
        pid = pytest.sched_future_id
        got = requests.get(f"{API}/posts/{pid}", headers=_h(newtest_tok), timeout=15).json()
        assert got["visibility"] == "scheduled", got

    def test_past_scheduled_publishes_immediately(self, newtest_tok):
        past = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        r = requests.post(f"{API}/posts", json={"content": "TEST_scheduled_past", "scheduled_at": past}, headers=_h(newtest_tok), timeout=15)
        assert r.status_code == 200
        assert r.json()["visibility"] == "public", r.json()

    def test_invalid_scheduled_at_400(self, newtest_tok):
        r = requests.post(f"{API}/posts", json={"content": "TEST_bad_sched", "scheduled_at": "not-a-date"}, headers=_h(newtest_tok), timeout=15)
        assert r.status_code == 400
