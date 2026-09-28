"""Iteration 88 backend tests: pinned message, forwarded messages, read-by, audio transcription."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

GROUP_ID = "655d23d2-b133-4188-a95c-bd8a777c04f4"
AUDIO_URL = "https://res.cloudinary.com/dnov3nwy6/video/upload/v1779038353/bruno/audio/fec32669-edca-4a58-b3ea-2dbecb870078/nzkanqscqqn26zl0gg87.webm"

CREDS = {
    "admin": ("newtest@bruno.com", "Test1234!"),
    "member": ("viewer2@bruno.com", "Test1234!"),
    "outsider": ("viewer3@bruno.com", "Test1234!"),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def tokens():
    return {k: _login(*v) for k, v in CREDS.items()}


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _send(tok, chat_id, content=None, mtype="text", attachments=None, forwarded=False, forwarded_from=None):
    body = {"content": content or "", "message_type": mtype, "attachments": attachments or []}
    if forwarded:
        body["forwarded"] = True
        body["forwarded_from"] = forwarded_from or "Alguien"
    r = requests.post(f"{API}/chats/{chat_id}/messages", json=body, headers=_h(tok), timeout=20)
    assert r.status_code == 200, f"send -> {r.status_code} {r.text}"
    return r.json()


# ─── Pin / Unpin ────────────────────────────────────────────────────────────
class TestPin:
    def test_pin_by_admin_and_visible_in_chats(self, tokens):
        msg = _send(tokens["admin"], GROUP_ID, content="TEST_pin_msg iter88")
        mid = msg["id"]
        r = requests.post(f"{API}/chats/{GROUP_ID}/pin/{mid}", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200, r.text
        pinned = r.json()["pinned_message"]
        assert pinned["id"] == mid
        assert "TEST_pin_msg" in pinned["content"]
        assert pinned["sender_name"]
        assert pinned["pinned_by"]

        # visible in GET /chats
        r = requests.get(f"{API}/chats", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200
        chats = r.json()
        chat = next((c for c in chats if c["id"] == GROUP_ID), None)
        assert chat is not None
        assert chat.get("pinned_message") and chat["pinned_message"]["id"] == mid

    def test_pin_by_non_admin_forbidden(self, tokens):
        # need a message id
        msgs = requests.get(f"{API}/chats/{GROUP_ID}/messages", headers=_h(tokens["member"]), timeout=15).json()
        mid = msgs[-1]["id"]
        r = requests.post(f"{API}/chats/{GROUP_ID}/pin/{mid}", headers=_h(tokens["member"]), timeout=15)
        assert r.status_code == 403, r.text

    def test_pin_unknown_message_404(self, tokens):
        r = requests.post(f"{API}/chats/{GROUP_ID}/pin/nope-does-not-exist", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 404

    def test_unpin_by_non_admin_forbidden(self, tokens):
        r = requests.delete(f"{API}/chats/{GROUP_ID}/pin", headers=_h(tokens["member"]), timeout=15)
        assert r.status_code == 403

    def test_unpin_by_admin(self, tokens):
        r = requests.delete(f"{API}/chats/{GROUP_ID}/pin", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["pinned_message"] is None
        r2 = requests.get(f"{API}/chats", headers=_h(tokens["admin"]), timeout=15)
        chat = next(c for c in r2.json() if c["id"] == GROUP_ID)
        assert not chat.get("pinned_message")

    def test_pin_in_1to1_any_participant(self, tokens):
        # find or create 1:1 between admin and member
        # get admin's chats
        chats = requests.get(f"{API}/chats", headers=_h(tokens["admin"]), timeout=15).json()
        # extract admin id
        me = requests.get(f"{API}/auth/me", headers=_h(tokens["admin"]), timeout=15).json()
        member_me = requests.get(f"{API}/auth/me", headers=_h(tokens["member"]), timeout=15).json()
        one2one = None
        for c in chats:
            if not c.get("is_group") and set(c.get("participants", [])) == {me["id"], member_me["id"]}:
                one2one = c
                break
        if not one2one:
            r = requests.post(f"{API}/chats", json={"participant_ids": [member_me["id"]], "is_group": False},
                              headers=_h(tokens["admin"]), timeout=15)
            assert r.status_code in (200, 201), r.text
            one2one = r.json()
        cid = one2one["id"]
        m = _send(tokens["admin"], cid, content="TEST_pin_1to1 iter88")
        # member (non-admin) should still be allowed since it's not a group
        r = requests.post(f"{API}/chats/{cid}/pin/{m['id']}", headers=_h(tokens["member"]), timeout=15)
        assert r.status_code == 200, r.text
        r = requests.delete(f"{API}/chats/{cid}/pin", headers=_h(tokens["member"]), timeout=15)
        assert r.status_code == 200


# ─── Read-by ────────────────────────────────────────────────────────────────
class TestReadBy:
    def test_read_by_flow(self, tokens):
        msg = _send(tokens["admin"], GROUP_ID, content="TEST_readby iter88")
        mid = msg["id"]
        # viewer2 fetches messages -> marks read
        r = requests.get(f"{API}/chats/{GROUP_ID}/messages", headers=_h(tokens["member"]), timeout=15)
        assert r.status_code == 200
        time.sleep(0.5)
        r = requests.get(f"{API}/chats/{GROUP_ID}/messages/{mid}/read-by", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "seen" in data and "pending" in data
        assert isinstance(data["seen_count"], int)
        assert isinstance(data["total"], int)
        # total = participants - sender
        chats = requests.get(f"{API}/chats", headers=_h(tokens["admin"]), timeout=15).json()
        group = next(c for c in chats if c["id"] == GROUP_ID)
        assert data["total"] == len(group["participants"]) - 1
        member_me = requests.get(f"{API}/auth/me", headers=_h(tokens["member"]), timeout=15).json()
        seen_ids = [u["id"] for u in data["seen"]]
        assert member_me["id"] in seen_ids, f"viewer2 not in seen: {data}"

    def test_read_by_non_participant_404(self, tokens):
        # get a valid message
        msgs = requests.get(f"{API}/chats/{GROUP_ID}/messages", headers=_h(tokens["admin"]), timeout=15).json()
        mid = msgs[-1]["id"]
        r = requests.get(f"{API}/chats/{GROUP_ID}/messages/{mid}/read-by", headers=_h(tokens["outsider"]), timeout=15)
        assert r.status_code == 404


# ─── Forward ────────────────────────────────────────────────────────────────
class TestForward:
    def test_forwarded_stored_and_returned(self, tokens):
        m = _send(tokens["admin"], GROUP_ID, content="TEST_fwd iter88", forwarded=True, forwarded_from="Ana Origen")
        assert m.get("forwarded") is True
        assert m.get("forwarded_from") == "Ana Origen"
        msgs = requests.get(f"{API}/chats/{GROUP_ID}/messages", headers=_h(tokens["admin"]), timeout=15).json()
        found = next((x for x in msgs if x["id"] == m["id"]), None)
        assert found is not None
        assert found.get("forwarded") is True
        assert found.get("forwarded_from") == "Ana Origen"


# ─── Audio transcription ─────────────────────────────────────────────────────
class TestTranscription:
    def test_audio_gets_transcribed(self, tokens):
        m = _send(tokens["admin"], GROUP_ID, content="", mtype="audio",
                  attachments=[{"type": "audio/webm", "url": AUDIO_URL}])
        mid = m["id"]
        # wait up to ~25s for background transcription
        transcript_status = None
        transcript = None
        for _ in range(25):
            time.sleep(1.2)
            msgs = requests.get(f"{API}/chats/{GROUP_ID}/messages", headers=_h(tokens["admin"]), timeout=15).json()
            f = next((x for x in msgs if x["id"] == mid), None)
            if not f:
                continue
            transcript_status = f.get("transcript_status")
            transcript = f.get("transcript")
            if transcript_status == "done":
                break
        assert transcript_status == "done", f"status={transcript_status} transcript={transcript}"
        assert isinstance(transcript, str)

    def test_transcribe_endpoint_on_done(self, tokens):
        # find an audio message that is done
        msgs = requests.get(f"{API}/chats/{GROUP_ID}/messages", headers=_h(tokens["admin"]), timeout=15).json()
        done = next((x for x in reversed(msgs) if x.get("transcript_status") == "done"), None)
        assert done is not None, "no done audio msg found"
        r = requests.post(f"{API}/chats/{GROUP_ID}/messages/{done['id']}/transcribe", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "done"
        assert isinstance(data["transcript"], str)

    def test_transcribe_endpoint_on_text_no_500(self, tokens):
        m = _send(tokens["admin"], GROUP_ID, content="TEST_txt_no_audio iter88")
        time.sleep(1.0)
        r = requests.post(f"{API}/chats/{GROUP_ID}/messages/{m['id']}/transcribe", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # should not blow up; either processing (no audio to fetch → job silently returns) is OK
        assert data["status"] in ("processing", "done")
