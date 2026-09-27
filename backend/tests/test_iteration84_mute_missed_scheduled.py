"""Iteration 84: chat mute, missed calls today, scheduled_published notification, group chat check."""
import os
import time
import requests
import pytest

def _read_env(key, path):
    for ln in open(path):
        if ln.startswith(key + "="):
            return ln.split("=", 1)[1].strip()
    return None

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env("REACT_APP_BACKEND_URL", "/app/frontend/.env")).rstrip("/") + "/api"
CHAT_ID = "fe8ed855-bf15-488f-bf20-5034b11b5f69"
NEWTEST_EMAIL = "newtest@bruno.com"
VIEWER2_EMAIL = "viewer2@bruno.com"
PWD = "Test1234!"
CRON = os.environ.get("WEBHOOK_CRON_SECRET") or open("/app/backend/.env").read().split("WEBHOOK_CRON_SECRET=")[1].split()[0]


def login(email):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": PWD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def tok_new():
    return login(NEWTEST_EMAIL)


@pytest.fixture(scope="module")
def tok_v2():
    return login(VIEWER2_EMAIL)


def H(t):
    return {"Authorization": f"Bearer {t}"}


# ---------------- Mute feature ----------------

def _get_chat_is_muted(tok, chat_id):
    r = requests.get(f"{BASE}/chats", headers=H(tok), timeout=30)
    assert r.status_code == 200
    for c in r.json():
        if c["id"] == chat_id:
            return c.get("is_muted")
    return None


def test_mute_unknown_chat_404(tok_v2):
    r = requests.post(f"{BASE}/chats/nonexistent-chat-xyz/mute", headers=H(tok_v2), timeout=30)
    assert r.status_code == 404


def test_mute_flow_viewer2(tok_new, tok_v2):
    # 1. Mute
    r = requests.post(f"{BASE}/chats/{CHAT_ID}/mute", headers=H(tok_v2), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json().get("muted") is True
    assert _get_chat_is_muted(tok_v2, CHAT_ID) is True

    # 2. Baseline: viewer2 notifications count
    r0 = requests.get(f"{BASE}/notifications", headers=H(tok_v2), timeout=30)
    assert r0.status_code == 200
    n0 = r0.json()
    n0_list = n0 if isinstance(n0, list) else n0.get("notifications", [])
    msg_before = sum(1 for x in n0_list if x.get("type") == "message")

    # 3. newtest sends a message
    r = requests.post(f"{BASE}/chats/{CHAT_ID}/messages",
                      headers=H(tok_new), json={"content": "TEST_iter84 muted ping"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    time.sleep(1)

    r1 = requests.get(f"{BASE}/notifications", headers=H(tok_v2), timeout=30)
    n1_list = r1.json() if isinstance(r1.json(), list) else r1.json().get("notifications", [])
    msg_after = sum(1 for x in n1_list if x.get("type") == "message")
    assert msg_after == msg_before, f"muted viewer2 got a 'message' notification. before={msg_before} after={msg_after}"

    # 4. newtest starts a call → dnd/muted path → room_url empty, call registers as missed
    r = requests.post(f"{BASE}/calls/start",
                      headers=H(tok_new), json={"chat_id": CHAT_ID, "call_type": "audio"}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("dnd") is True
    assert body.get("room_url") in ("", None)

    # 5. Unmute
    r = requests.post(f"{BASE}/chats/{CHAT_ID}/mute", headers=H(tok_v2), timeout=30)
    assert r.status_code == 200
    assert r.json().get("muted") is False
    assert _get_chat_is_muted(tok_v2, CHAT_ID) is False

    # 6. Sending a message again → viewer2 should get message notification
    r = requests.post(f"{BASE}/chats/{CHAT_ID}/messages",
                      headers=H(tok_new), json={"content": "TEST_iter84 unmuted ping"}, timeout=30)
    assert r.status_code in (200, 201)
    time.sleep(1)
    r2 = requests.get(f"{BASE}/notifications", headers=H(tok_v2), timeout=30)
    n2_list = r2.json() if isinstance(r2.json(), list) else r2.json().get("notifications", [])
    msg_after2 = sum(1 for x in n2_list if x.get("type") == "message")
    assert msg_after2 > msg_after, "unmuted: viewer2 should receive message notification"

    # 7. Call after unmute → real daily url with token
    r = requests.post(f"{BASE}/calls/start",
                      headers=H(tok_new), json={"chat_id": CHAT_ID, "call_type": "audio"}, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body.get("dnd") is False
    assert "daily.co" in (body.get("room_url") or ""), body
    # End it politely
    call_id = body.get("call_id")
    if call_id:
        requests.post(f"{BASE}/calls/{call_id}/end", headers=H(tok_new), timeout=30)


# ---------------- Missed calls today ----------------

def test_missed_calls_today_viewer2(tok_v2, tok_new):
    r = requests.get(f"{BASE}/calls/missed/today", headers=H(tok_v2), timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body.get("calls"), list)
    assert body.get("total") == len(body["calls"])
    assert body["total"] >= 1, "expected at least the DND-missed call from mute test"
    for c in body["calls"]:
        for k in ("id", "chat_id", "call_type", "status", "created_at", "caller"):
            assert k in c, f"missing key {k} in {c}"
        assert c["status"] in ("missed", "declined")
        assert "id" in c["caller"] and "name" in c["caller"]
        assert c["caller"]["id"] != "3636b29b-ae7d-49c4-8a1e-2312500d0eeb"  # not viewer2 himself


def test_missed_calls_today_caller_excluded(tok_new):
    # newtest placed missed calls but was the caller — should NOT be listed
    r = requests.get(f"{BASE}/calls/missed/today", headers=H(tok_new), timeout=30)
    assert r.status_code == 200
    for c in r.json()["calls"]:
        assert c["caller"]["id"] != "b6a3059d-3c5c-4ffd-9fc2-b8dff4a420b9"


# ---------------- Scheduled published reminder ----------------

def test_scheduled_published_notification(tok_new):
    from datetime import datetime, timedelta, timezone
    sched = (datetime.now(timezone.utc) + timedelta(seconds=3)).isoformat()
    payload = {"content": "TEST_iter84 scheduled reminder", "post_type": "text", "scheduled_at": sched, "visibility": "public"}
    r = requests.post(f"{BASE}/posts", headers=H(tok_new), json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text
    post = r.json()
    pid = post.get("id") or post.get("post_id")
    assert pid, post

    time.sleep(6)
    r = requests.post(f"{BASE}/cron/publish-scheduled",
                      headers={"Authorization": f"Bearer {CRON}"}, timeout=30)
    assert r.status_code == 200, r.text
    time.sleep(4)

    r = requests.get(f"{BASE}/notifications", headers=H(tok_new), timeout=30)
    assert r.status_code == 200
    n = r.json()
    n = n if isinstance(n, list) else n.get("notifications", [])
    matches = [x for x in n if x.get("type") == "scheduled_published" and x.get("target_id") == pid]
    assert matches, f"no scheduled_published notification for post {pid}. sample={n[:3]}"
    assert matches[0].get("target_type") == "post"

    # Verify post is now public
    r = requests.get(f"{BASE}/posts/{pid}", headers=H(tok_new), timeout=30)
    if r.status_code == 200:
        assert r.json().get("visibility") == "public"


# ---------------- Group chat creation support ----------------

def test_group_chat_creation_support(tok_new):
    """Reports whether group chat creation via /api/chats is supported."""
    # The endpoint accepts a query param `participant_id` only (see create_or_get_chat)
    r = requests.post(f"{BASE}/chats", headers=H(tok_new),
                      json={"participant_ids": ["3636b29b-ae7d-49c4-8a1e-2312500d0eeb"], "is_group": True},
                      timeout=30)
    # We expect it to fail (422 missing param or 400) since only 1:1 supported
    if r.status_code in (200, 201) and r.json().get("type") == "group":
        pytest.skip("Group chat unexpectedly created — investigate")
    else:
        pytest.skip(f"Group chat creation NOT supported by API (status={r.status_code}) — spec says report and skip")
