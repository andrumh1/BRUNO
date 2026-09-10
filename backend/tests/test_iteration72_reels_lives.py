"""
Iteration 72 backend tests:
- /posts/recommended-videos (for_you / following / exclude / anon)
- /posts/history/videos + /posts/{id}/view
- Private lives: create with is_private -> access_code, join gating, rotate-code,
  by-code resolver, GET single hides code, list excludes private, heart/comment/end.
- WebSocket signaling: welcome, wrong-code close 4003, viewer_joined broadcast,
  heart broadcast, offer relay from viewer -> host.
"""
import asyncio
import json
import os
import uuid

import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


# ---------- helpers ----------
def _login(email=TEST_EMAIL, password=TEST_PASSWORD):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _register_second_user():
    """Register a fresh second user for viewer tests. Returns (email, password, token)."""
    email = f"TEST_viewer_{uuid.uuid4().hex[:8]}@bruno.com"
    password = "Test1234!"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": password, "name": "TEST Viewer"},
        timeout=15,
    )
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or _login(email, password)
    return email, password, token


def _end_any_active_live(token):
    h = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{API}/lives/mine/active", headers=h, timeout=15)
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, dict) and data.get("id"):
            requests.post(f"{API}/lives/{data['id']}/end", headers=h, timeout=15)
        elif isinstance(data, list):
            for lv in data:
                if lv.get("id"):
                    requests.post(f"{API}/lives/{lv['id']}/end", headers=h, timeout=15)


@pytest.fixture(scope="module")
def host_token():
    tok = _login()
    _end_any_active_live(tok)
    return tok


@pytest.fixture(scope="module")
def viewer_token():
    _, _, tok = _register_second_user()
    return tok


# ============================================================
# 1) Reels feed
# ============================================================
class TestRecommendedVideos:
    def test_for_you_anonymous(self):
        r = requests.get(
            f"{API}/posts/recommended-videos",
            params={"limit": 12, "mode": "for_you", "seed": 123},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # Structure check when items exist
        if data:
            p = data[0]
            assert "id" in p and "user" in p
            u = p["user"]
            for k in ("id", "name", "username", "avatar_url", "followers_count"):
                assert k in u, f"user missing {k}: {list(u.keys())}"
            for k in ("is_liked", "is_bookmarked", "is_following"):
                assert k in p, f"post missing {k}"

    def test_for_you_authenticated_and_exclude(self, host_token):
        h = {"Authorization": f"Bearer {host_token}"}
        r = requests.get(
            f"{API}/posts/recommended-videos",
            params={"limit": 6, "mode": "for_you", "seed": 42},
            headers=h,
            timeout=20,
        )
        assert r.status_code == 200
        first = r.json()
        if len(first) < 2:
            pytest.skip("not enough videos to test exclude")
        exclude_ids = ",".join([p["id"] for p in first[:2]])
        r2 = requests.get(
            f"{API}/posts/recommended-videos",
            params={"limit": 6, "mode": "for_you", "seed": 42, "exclude": exclude_ids},
            headers=h,
            timeout=20,
        )
        assert r2.status_code == 200
        excluded = set(exclude_ids.split(","))
        assert not any(p["id"] in excluded for p in r2.json()), "exclude param not honored"

    def test_following_empty_when_no_follows(self, viewer_token):
        # Fresh user follows nobody
        h = {"Authorization": f"Bearer {viewer_token}"}
        r = requests.get(
            f"{API}/posts/recommended-videos",
            params={"limit": 12, "mode": "following"},
            headers=h,
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json() == [], "following mode should be [] for user with no follows"


class TestVideoHistory:
    def test_view_then_history(self, host_token):
        h = {"Authorization": f"Bearer {host_token}"}
        # Pick a real video from recommendations
        r = requests.get(
            f"{API}/posts/recommended-videos",
            params={"limit": 5, "mode": "for_you", "seed": 7},
            headers=h,
            timeout=20,
        )
        assert r.status_code == 200
        vids = r.json()
        if not vids:
            pytest.skip("no videos available to record view")
        vid_id = vids[0]["id"]
        rv = requests.post(f"{API}/posts/{vid_id}/view", headers=h, timeout=15)
        assert rv.status_code == 200, rv.text
        rh = requests.get(f"{API}/posts/history/videos", headers=h, timeout=15)
        assert rh.status_code == 200
        hist = rh.json()
        assert isinstance(hist, list)
        # Newest should be our viewed id
        assert hist[0]["id"] == vid_id, f"expected {vid_id} first, got {hist[0]['id']}"
        assert "watched_at" in hist[0]
        assert hist[0].get("watch_count", 0) >= 1

    def test_history_requires_auth(self):
        r = requests.get(f"{API}/posts/history/videos", timeout=10)
        assert r.status_code in (401, 403), r.status_code


# ============================================================
# 2) Private Lives
# ============================================================
class TestPrivateLives:
    @pytest.fixture(scope="class")
    def private_live(self, host_token):
        _end_any_active_live(host_token)
        h = {"Authorization": f"Bearer {host_token}"}
        payload = {"title": "TEST private live", "category": "general", "is_private": True, "anti_capture": True}
        r = requests.post(f"{API}/lives", json=payload, headers=h, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("is_private") is True
        assert data.get("anti_capture") is True
        assert isinstance(data.get("access_code"), str) and len(data["access_code"]) == 6
        yield data
        # teardown
        requests.post(f"{API}/lives/{data['id']}/end", headers=h, timeout=15)

    def test_get_single_hides_code_for_others(self, private_live, viewer_token):
        h = {"Authorization": f"Bearer {viewer_token}"}
        r = requests.get(f"{API}/lives/{private_live['id']}", headers=h, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "access_code" not in data or data.get("access_code") is None
        assert data.get("requires_code") is True

    def test_list_excludes_private(self, private_live):
        r = requests.get(f"{API}/lives", timeout=15)
        assert r.status_code == 200
        ids = [lv["id"] for lv in r.json()]
        assert private_live["id"] not in ids
        for lv in r.json():
            assert "access_code" not in lv or lv.get("access_code") is None

    def test_join_wrong_code(self, private_live, viewer_token):
        h = {"Authorization": f"Bearer {viewer_token}"}
        r = requests.post(
            f"{API}/lives/{private_live['id']}/join",
            json={"access_code": "WRONG1"},
            headers=h,
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_join_correct_code(self, private_live, viewer_token):
        h = {"Authorization": f"Bearer {viewer_token}"}
        r = requests.post(
            f"{API}/lives/{private_live['id']}/join",
            json={"access_code": private_live["access_code"]},
            headers=h,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert "live" in data

    def test_by_code_resolver(self, private_live):
        r = requests.get(f"{API}/lives/by-code/{private_live['access_code']}", timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("id") == private_live["id"]

    def test_rotate_code_forbidden_for_others(self, private_live, viewer_token):
        h = {"Authorization": f"Bearer {viewer_token}"}
        r = requests.post(f"{API}/lives/{private_live['id']}/rotate-code", headers=h, timeout=15)
        assert r.status_code == 403

    def test_rotate_code_by_host_invalidates_old(self, private_live, host_token, viewer_token):
        old_code = private_live["access_code"]
        hh = {"Authorization": f"Bearer {host_token}"}
        r = requests.post(f"{API}/lives/{private_live['id']}/rotate-code", headers=hh, timeout=15)
        assert r.status_code == 200, r.text
        new_code = r.json().get("access_code")
        assert isinstance(new_code, str) and len(new_code) == 6
        assert new_code != old_code
        # Old code must not work
        hv = {"Authorization": f"Bearer {viewer_token}"}
        r2 = requests.post(
            f"{API}/lives/{private_live['id']}/join",
            json={"access_code": old_code},
            headers=hv,
            timeout=15,
        )
        assert r2.status_code == 403
        # New code works
        r3 = requests.post(
            f"{API}/lives/{private_live['id']}/join",
            json={"access_code": new_code},
            headers=hv,
            timeout=15,
        )
        assert r3.status_code == 200
        # store for later tests
        private_live["access_code"] = new_code

    def test_mine_active(self, private_live, host_token):
        h = {"Authorization": f"Bearer {host_token}"}
        r = requests.get(f"{API}/lives/mine/active", headers=h, timeout=15)
        assert r.status_code == 200
        data = r.json()
        if isinstance(data, list):
            assert any(lv.get("id") == private_live["id"] for lv in data)
        else:
            assert data.get("id") == private_live["id"]

    def test_heart_and_comment(self, private_live, host_token):
        h = {"Authorization": f"Bearer {host_token}"}
        before = requests.get(f"{API}/lives/{private_live['id']}", headers=h, timeout=15).json().get("hearts_count", 0)
        r = requests.post(f"{API}/lives/{private_live['id']}/heart", headers=h, timeout=15)
        assert r.status_code == 200
        after = requests.get(f"{API}/lives/{private_live['id']}", headers=h, timeout=15).json().get("hearts_count", 0)
        assert after == before + 1

        rc = requests.post(
            f"{API}/lives/{private_live['id']}/comment",
            json={"text": f"TEST comment {uuid.uuid4().hex[:6]}"},
            headers=h,
            timeout=15,
        )
        assert rc.status_code == 200

    def test_end_forbidden_for_others(self, private_live, viewer_token):
        h = {"Authorization": f"Bearer {viewer_token}"}
        r = requests.post(f"{API}/lives/{private_live['id']}/end", headers=h, timeout=15)
        assert r.status_code == 403


# ============================================================
# 3) WebSocket signaling
# ============================================================
class TestLiveWebSocket:
    @pytest.fixture(scope="class")
    def ws_live(self, host_token):
        _end_any_active_live(host_token)
        h = {"Authorization": f"Bearer {host_token}"}
        r = requests.post(
            f"{API}/lives",
            json={"title": "TEST ws live", "category": "general", "is_private": True, "anti_capture": True},
            headers=h,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        yield data
        requests.post(f"{API}/lives/{data['id']}/end", headers=h, timeout=15)

    @pytest.mark.asyncio
    async def test_ws_welcome_wrong_code_and_relay(self, ws_live, host_token, viewer_token):
        live_id = ws_live["id"]
        code = ws_live["access_code"]

        # Wrong code -> close 4003
        wrong_url = f"{WS_BASE}/api/lives/{live_id}/ws?token={viewer_token}&code=WRONG1"
        with pytest.raises(Exception) as ei:
            async with websockets.connect(wrong_url, open_timeout=10) as ws:
                await ws.recv()
        # websockets raises ConnectionClosedError with .code
        # Server rejects the WS upgrade for private-live wrong-code. Depending on
        # whether close() is called pre/post accept, the client sees either a
        # WS close 4003 or an HTTP 403 during handshake — both are valid.
        err_str = str(ei.value)
        code_val = getattr(ei.value, "code", None)
        assert (
            "4003" in err_str
            or "403" in err_str
            or code_val == 4003
            or "Bad access code" in err_str
        ), f"expected 4003/403 rejection, got {ei.value!r}"

        # Host connects
        host_url = f"{WS_BASE}/api/lives/{live_id}/ws?token={host_token}"
        viewer_url = f"{WS_BASE}/api/lives/{live_id}/ws?token={viewer_token}&code={code}"

        async with websockets.connect(host_url, open_timeout=10) as host_ws:
            welcome_host = json.loads(await asyncio.wait_for(host_ws.recv(), timeout=5))
            assert welcome_host["type"] == "welcome"
            assert welcome_host["is_host"] is True
            assert "rtc_config" in welcome_host
            host_id = welcome_host["self_id"]

            async with websockets.connect(viewer_url, open_timeout=10) as viewer_ws:
                welcome_viewer = json.loads(await asyncio.wait_for(viewer_ws.recv(), timeout=5))
                assert welcome_viewer["type"] == "welcome"
                assert welcome_viewer["is_host"] is False
                viewer_id = welcome_viewer["self_id"]
                assert welcome_viewer["host_id"] == host_id

                # Host should receive viewer_joined
                got_viewer_joined = False
                got_heart = False
                got_offer = False
                # Send heart from viewer, and offer to host
                await viewer_ws.send(json.dumps({"type": "heart"}))
                await viewer_ws.send(json.dumps({"type": "offer", "to": host_id, "sdp": {"type": "offer", "sdp": "v=0..."}}))

                # Drain up to 8 messages from host or 3s
                deadline = asyncio.get_event_loop().time() + 5
                while asyncio.get_event_loop().time() < deadline and not (got_viewer_joined and got_heart and got_offer):
                    try:
                        msg = json.loads(await asyncio.wait_for(host_ws.recv(), timeout=1.5))
                    except asyncio.TimeoutError:
                        break
                    t = msg.get("type")
                    if t == "viewer_joined":
                        got_viewer_joined = True
                    elif t == "heart":
                        got_heart = True
                    elif t == "offer":
                        got_offer = True
                        assert msg.get("from") == viewer_id, f"offer.from should be viewer id, got {msg.get('from')}"
                        assert msg.get("sdp", {}).get("type") == "offer"

                assert got_viewer_joined, "host did not receive viewer_joined"
                assert got_heart, "host did not receive heart broadcast"
                assert got_offer, "host did not receive relayed offer"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
