"""Iteration 97: Backend tests for post_drafts, uploads (trim/cover),
scheduled lives, guests, polls, Q&A, and cron reminders.

Covers review request scope. Host: newtest@bruno.com; Viewer: viewer2@bruno.com.
"""
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

HOST_EMAIL = "newtest@bruno.com"
VIEWER_EMAIL = "viewer2@bruno.com"
PASSWORD = "Test1234!"


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def host_token():
    return _login(HOST_EMAIL, PASSWORD)


@pytest.fixture(scope="module")
def viewer_token():
    return _login(VIEWER_EMAIL, PASSWORD)


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ────────────────── DRAFTS ──────────────────
class TestPostDrafts:
    def test_crud_and_isolation(self, host_token, viewer_token):
        # unauth
        r = requests.get(f"{API}/post-drafts", timeout=15)
        assert r.status_code in (401, 403)

        # list OK
        r = requests.get(f"{API}/post-drafts", headers=_h(host_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

        # create
        payload = {
            "media_url": "https://example.com/x.mp4",
            "media_type": "video",
            "caption": "TEST_iter97 draft",
            "media_meta": {"url": "https://example.com/x.mp4"},
        }
        r = requests.post(f"{API}/post-drafts", headers=_h(host_token), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d and d["caption"] == payload["caption"]
        draft_id = d["id"]

        # viewer trying to delete host's draft → 404
        r = requests.delete(f"{API}/post-drafts/{draft_id}", headers=_h(viewer_token), timeout=15)
        assert r.status_code == 404

        # owner deletes
        r = requests.delete(f"{API}/post-drafts/{draft_id}", headers=_h(host_token), timeout=15)
        assert r.status_code == 200 and r.json().get("deleted") is True


# ────────────────── UPLOAD trim/cover ──────────────────
def _generate_small_mp4() -> bytes:
    """Try ffmpeg; else return None (test will skip)."""
    import subprocess, tempfile
    try:
        import imageio_ffmpeg
        ff = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        ff = "ffmpeg"
    try:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        tmp.close()
        subprocess.run(
            [ff, "-y", "-f", "lavfi", "-i", "color=c=blue:s=320x240:d=5",
             "-c:v", "libx264", "-pix_fmt", "yuv420p", tmp.name],
            check=True, capture_output=True, timeout=60,
        )
        with open(tmp.name, "rb") as f:
            return f.read()
    except Exception:
        return b""


class TestUploadTrim:
    def test_video_trim_cover_urls(self, host_token):
        data = _generate_small_mp4()
        if not data:
            pytest.skip("ffmpeg not available – cannot generate test video")
        files = {"file": ("test.mp4", data, "video/mp4")}
        r = requests.post(
            f"{API}/upload/image?trim_start=1&trim_end=4&cover_at=2",
            headers=_h(host_token), files=files, timeout=120,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("resource_type") == "video"
        assert "so_1.00,eo_4.00" in (j.get("mp4_url") or ""), f"mp4_url: {j.get('mp4_url')}"
        assert "so_2.00" in (j.get("poster_url") or ""), f"poster_url: {j.get('poster_url')}"

    def test_image_square_still_1080(self, host_token):
        # Make a 1x1 PNG
        import base64
        png = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        )
        files = {"file": ("x.png", png, "image/png")}
        r = requests.post(f"{API}/upload/image?aspect=1:1", headers=_h(host_token), files=files, timeout=60)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("width") == 1080 and j.get("height") == 1080


# ────────────────── SCHEDULED LIVES ──────────────────
class TestScheduledLives:
    live_id = None

    def test_schedule_past_422(self, host_token):
        past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        r = requests.post(
            f"{API}/lives/schedule",
            headers=_h(host_token),
            json={"title": "TEST_past", "category": "general", "scheduled_at": past},
            timeout=15,
        )
        assert r.status_code == 422

    def test_schedule_future(self, host_token):
        future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        r = requests.post(
            f"{API}/lives/schedule",
            headers=_h(host_token),
            json={"title": "TEST_iter97", "category": "general", "scheduled_at": future},
            timeout=15,
        )
        assert r.status_code == 200
        j = r.json()
        assert j["status"] == "scheduled"
        TestScheduledLives.live_id = j["id"]

    def test_upcoming_as_viewer(self, viewer_token):
        assert TestScheduledLives.live_id
        r = requests.get(f"{API}/lives/upcoming", headers=_h(viewer_token), timeout=15)
        assert r.status_code == 200
        items = r.json()
        found = next((x for x in items if x["id"] == TestScheduledLives.live_id), None)
        assert found, "scheduled live not in upcoming"
        assert found["is_host"] is False
        assert found["reminded"] is False

    def test_remind_toggle(self, viewer_token):
        lid = TestScheduledLives.live_id
        r1 = requests.post(f"{API}/lives/{lid}/remind", headers=_h(viewer_token), timeout=15)
        assert r1.status_code == 200 and r1.json()["reminded"] is True
        r2 = requests.post(f"{API}/lives/{lid}/remind", headers=_h(viewer_token), timeout=15)
        assert r2.status_code == 200 and r2.json()["reminded"] is False
        # Re-enable so later go-live triggers a notify path (not asserted)
        requests.post(f"{API}/lives/{lid}/remind", headers=_h(viewer_token), timeout=15)

    def test_cancel_scheduled_by_non_host_403(self, viewer_token):
        lid = TestScheduledLives.live_id
        r = requests.delete(f"{API}/lives/{lid}/scheduled", headers=_h(viewer_token), timeout=15)
        assert r.status_code == 403

    def test_cron_reminders(self, host_token):
        r = requests.post(f"{API}/cron/live-reminders", timeout=15)
        assert r.status_code == 200 and r.json().get("ok") is True

    def test_go_live_and_end(self, host_token):
        lid = TestScheduledLives.live_id
        # First make sure host doesn't already have an active live
        existing = requests.get(f"{API}/lives/mine/active", headers=_h(host_token), timeout=15)
        if existing.status_code == 200 and isinstance(existing.json(), dict) and existing.json().get("id"):
            requests.post(f"{API}/lives/{existing.json()['id']}/end", headers=_h(host_token), timeout=15)

        r = requests.post(f"{API}/lives/{lid}/go-live", headers=_h(host_token), timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "live"
        assert j.get("rtc", {}).get("token")
        # end
        e = requests.post(f"{API}/lives/{lid}/end", headers=_h(host_token), timeout=15)
        assert e.status_code == 200


# ────────────────── GUESTS, POLLS, Q&A ──────────────────
class TestGuestsPollsQA:
    live_id = None
    poll_id = None
    question_id = None

    @classmethod
    def _create_live(cls, host_token):
        r = requests.post(
            f"{API}/lives",
            headers=_h(host_token),
            json={"title": "TEST_iter97_live", "category": "general"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_setup_live(self, host_token):
        # end any existing active
        existing = requests.get(f"{API}/lives/mine/active", headers=_h(host_token), timeout=15)
        if existing.status_code == 200 and isinstance(existing.json(), dict) and existing.json().get("id"):
            requests.post(f"{API}/lives/{existing.json()['id']}/end", headers=_h(host_token), timeout=15)
        TestGuestsPollsQA.live_id = self._create_live(host_token)
        assert TestGuestsPollsQA.live_id

    def test_viewer_joins(self, viewer_token):
        lid = TestGuestsPollsQA.live_id
        r = requests.post(f"{API}/lives/{lid}/join", headers=_h(viewer_token), timeout=15)
        assert r.status_code == 200

    # ─── Guests ───
    def test_guest_request_accept_remove(self, host_token, viewer_token):
        lid = TestGuestsPollsQA.live_id
        viewer_id = "3636b29b-ae7d-49c4-8a1e-2312500d0eeb"
        r = requests.post(f"{API}/lives/{lid}/guest/request", headers=_h(viewer_token), timeout=15)
        assert r.status_code == 200 and r.json().get("requested") is True
        r = requests.post(f"{API}/lives/{lid}/guest/accept", headers=_h(host_token), json={"user_id": viewer_id}, timeout=15)
        assert r.status_code == 200 and r.json().get("accepted") is True
        r = requests.post(f"{API}/lives/{lid}/guest/remove", headers=_h(host_token), json={"user_id": viewer_id}, timeout=15)
        assert r.status_code == 200 and r.json().get("removed") is True

    def test_guest_request_reject_and_cancel(self, host_token, viewer_token):
        lid = TestGuestsPollsQA.live_id
        viewer_id = "3636b29b-ae7d-49c4-8a1e-2312500d0eeb"
        requests.post(f"{API}/lives/{lid}/guest/request", headers=_h(viewer_token), timeout=15)
        r = requests.post(f"{API}/lives/{lid}/guest/reject", headers=_h(host_token), json={"user_id": viewer_id}, timeout=15)
        assert r.status_code == 200 and r.json().get("rejected") is True
        # new request, viewer cancels
        requests.post(f"{API}/lives/{lid}/guest/request", headers=_h(viewer_token), timeout=15)
        r = requests.post(f"{API}/lives/{lid}/guest/cancel", headers=_h(viewer_token), timeout=15)
        assert r.status_code == 200 and r.json().get("ok") is True

    # ─── Polls ───
    def test_poll_perms_create_vote_close(self, host_token, viewer_token):
        lid = TestGuestsPollsQA.live_id
        # viewer cannot create
        r = requests.post(f"{API}/lives/{lid}/polls", headers=_h(viewer_token), json={"question": "Q?", "options": ["A", "B"], "duration_s": 120}, timeout=15)
        assert r.status_code == 403
        # host creates
        r = requests.post(f"{API}/lives/{lid}/polls", headers=_h(host_token), json={"question": "Q?", "options": ["A", "B"], "duration_s": 120}, timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        TestGuestsPollsQA.poll_id = p["id"]
        assert all(o["pct"] == 0 for o in p["options"])
        pid = p["id"]
        # viewer votes option 1
        r = requests.post(f"{API}/lives/{lid}/polls/{pid}/vote", headers=_h(viewer_token), json={"option_id": "1"}, timeout=15)
        assert r.status_code == 200, r.text
        v = r.json()
        assert v["total"] == 1
        pcts = {o["id"]: o["pct"] for o in v["options"]}
        assert pcts["0"] == 0 and pcts["1"] == 100
        # viewer changes to '0'
        r = requests.post(f"{API}/lives/{lid}/polls/{pid}/vote", headers=_h(viewer_token), json={"option_id": "0"}, timeout=15)
        v = r.json()
        assert v["total"] == 1
        pcts = {o["id"]: o["pct"] for o in v["options"]}
        assert pcts["0"] == 100 and pcts["1"] == 0
        # GET current
        r = requests.get(f"{API}/lives/{lid}/polls/current", headers=_h(viewer_token), timeout=15)
        assert r.status_code == 200
        assert r.json().get("my_vote") == "0"
        # close
        r = requests.post(f"{API}/lives/{lid}/polls/{pid}/close", headers=_h(host_token), timeout=15)
        assert r.status_code == 200 and r.json()["status"] == "closed"
        # vote after close → 400
        r = requests.post(f"{API}/lives/{lid}/polls/{pid}/vote", headers=_h(viewer_token), json={"option_id": "1"}, timeout=15)
        assert r.status_code == 400

    # ─── Q&A ───
    def test_qa_flow(self, host_token, viewer_token):
        lid = TestGuestsPollsQA.live_id
        viewer_id = "3636b29b-ae7d-49c4-8a1e-2312500d0eeb"
        # viewer asks
        r = requests.post(f"{API}/lives/{lid}/questions", headers=_h(viewer_token), json={"text": "TEST_question?"}, timeout=15)
        assert r.status_code == 200, r.text
        q = r.json()
        assert q["upvotes"] == 1
        qid = q["id"]
        TestGuestsPollsQA.question_id = qid
        # host upvote
        r = requests.post(f"{API}/lives/{lid}/questions/{qid}/upvote", headers=_h(host_token), timeout=15)
        assert r.status_code == 200 and r.json()["upvotes"] == 2
        # host answers
        r = requests.post(f"{API}/lives/{lid}/questions/{qid}/answer", headers=_h(host_token), timeout=15)
        assert r.status_code == 200 and r.json()["answered"] is True
        # Mute viewer via moderation
        r = requests.post(f"{API}/lives/{lid}/moderation", headers=_h(host_token), json={"action": "mute", "user_id": viewer_id}, timeout=15)
        assert r.status_code == 200
        # muted viewer → 403
        r = requests.post(f"{API}/lives/{lid}/questions", headers=_h(viewer_token), json={"text": "TEST_blocked"}, timeout=15)
        assert r.status_code == 403
        # unmute
        requests.post(f"{API}/lives/{lid}/moderation", headers=_h(host_token), json={"action": "unmute", "user_id": viewer_id}, timeout=15)
        # list sorted: unanswered first
        r = requests.get(f"{API}/lives/{lid}/questions", timeout=15)
        assert r.status_code == 200
        items = r.json()
        # ensure a stable property: for consecutive items, no answered=True appears before answered=False
        answered_seen = False
        for it in items:
            if it.get("answered"):
                answered_seen = True
            else:
                assert not answered_seen, "unanswered appears after answered in sorted list"

    def test_cleanup_end_live(self, host_token):
        lid = TestGuestsPollsQA.live_id
        if lid:
            requests.post(f"{API}/lives/{lid}/end", headers=_h(host_token), timeout=15)
