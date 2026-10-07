"""
Iteration 96 — Lives (Daily.co SFU + moderation) and Reels feed endpoints.

Covers:
 - Lives: create (host rtc), join (viewer receive-only token, hidden fields),
          moderation (settings/blocked words 422, pin, mute, add_mod perms,
          kick → banned ids + 403 join/comment, spam 429, viewer end 403,
          host end + ended status), details (viewer_count/is_moderator).
 - Feed: not-interested (hide from recommended), by-username (resolve), reports,
          block toggle (removes author posts from recommended).
"""
import os
import time
import uuid
import json
import base64
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

HOST = {"email": "newtest@bruno.com", "password": "Test1234!"}
VIEWER = {"email": "viewer2@bruno.com", "password": "Test1234!"}
VIEWER_ID = "3636b29b-ae7d-49c4-8a1e-2312500d0eeb"


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:200]}"
    return r.json()["access_token"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _b64url_decode(s: str) -> bytes:
    s = s + "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s.encode())


def _jwt_payload(token: str) -> dict:
    parts = token.split(".")
    if len(parts) < 2:
        return {}
    return json.loads(_b64url_decode(parts[1]))


@pytest.fixture(scope="module")
def host_token():
    return _login(HOST)


@pytest.fixture(scope="module")
def viewer_token():
    return _login(VIEWER)


@pytest.fixture(scope="module")
def cleanup_lives(host_token):
    """End any lingering active live for host before/after tests."""
    created = []
    r = requests.get(f"{API}/lives/mine/active", headers=_h(host_token))
    if r.ok and isinstance(r.json(), dict) and r.json().get("id"):
        requests.post(f"{API}/lives/{r.json()['id']}/end", headers=_h(host_token))
    yield created
    for lid in created:
        try:
            requests.post(f"{API}/lives/{lid}/end", headers=_h(host_token))
        except Exception:
            pass


# ---------- LIVES ----------

class TestLivesFlow:
    def test_full_moderation_flow(self, host_token, viewer_token, cleanup_lives):
        # CREATE
        r = requests.post(f"{API}/lives", json={"title": "TEST_live_mod", "category": "general"}, headers=_h(host_token))
        assert r.status_code == 200, r.text
        live = r.json()
        live_id = live["id"]
        cleanup_lives.append(live_id)
        assert live.get("is_host") is True
        assert live.get("room_name"), "room_name missing on create"
        assert live.get("room_url"), "room_url missing on create"
        rtc = live.get("rtc") or {}
        assert rtc.get("token"), "host rtc.token missing"

        # mine/active returns rtc for host
        m = requests.get(f"{API}/lives/mine/active", headers=_h(host_token))
        assert m.status_code == 200
        mj = m.json()
        assert mj.get("id") == live_id and mj.get("rtc", {}).get("token")

        # VIEWER join → receive-only token, hidden private fields
        r = requests.post(f"{API}/lives/{live_id}/join", json={}, headers=_h(viewer_token))
        assert r.status_code == 200, r.text
        jr = r.json()
        v_rtc = (jr.get("rtc") or {})
        v_tok = v_rtc.get("token")
        assert v_tok, "viewer rtc.token missing"
        payload = _jwt_payload(v_tok)
        # Daily meeting token embeds permissions under "p"
        perms = payload.get("p") or {}
        assert perms.get("cs") is False, f"viewer canSend should be False, got payload={payload}"
        assert perms.get("ca") is False, f"viewer canAdmin should be False, got payload={payload}"
        live_obj = jr.get("live", {})
        for forbidden in ("banned_user_ids", "muted_user_ids", "blocked_words", "room_name"):
            assert forbidden not in live_obj, f"viewer should not see {forbidden}"

        # Moderation: viewer gets 403 for pin
        r = requests.post(f"{API}/lives/{live_id}/moderation", json={"action": "pin", "comment_id": "x"}, headers=_h(viewer_token))
        assert r.status_code == 403

        # Host settings blocked_words
        r = requests.post(f"{API}/lives/{live_id}/moderation",
                          json={"action": "settings", "blocked_words": ["tonto"], "allow_comments": True},
                          headers=_h(host_token))
        assert r.status_code == 200
        assert "tonto" in (r.json().get("blocked_words") or [])

        # Comment with blocked word -> 422
        r = requests.post(f"{API}/lives/{live_id}/comment", json={"text": "eres tonto"}, headers=_h(viewer_token))
        assert r.status_code == 422, r.text

        # Valid viewer comment -> 200 -> get comment_id
        r = requests.post(f"{API}/lives/{live_id}/comment", json={"text": "hola buena transmision"}, headers=_h(viewer_token))
        assert r.status_code == 200, r.text
        cid = r.json()["id"]

        # Host pin that comment
        r = requests.post(f"{API}/lives/{live_id}/moderation", json={"action": "pin", "comment_id": cid}, headers=_h(host_token))
        assert r.status_code == 200
        assert r.json().get("pinned_comment", {}).get("id") == cid

        # Host mute viewer -> viewer comment 403
        r = requests.post(f"{API}/lives/{live_id}/moderation", json={"action": "mute", "user_id": VIEWER_ID}, headers=_h(host_token))
        assert r.status_code == 200
        r = requests.post(f"{API}/lives/{live_id}/comment", json={"text": "intento"}, headers=_h(viewer_token))
        assert r.status_code == 403

        # Unmute restores
        r = requests.post(f"{API}/lives/{live_id}/moderation", json={"action": "unmute", "user_id": VIEWER_ID}, headers=_h(host_token))
        assert r.status_code == 200
        r = requests.post(f"{API}/lives/{live_id}/comment", json={"text": "ya puedo"}, headers=_h(viewer_token))
        assert r.status_code == 200

        # add_mod -> viewer can pin but not settings
        r = requests.post(f"{API}/lives/{live_id}/moderation", json={"action": "add_mod", "user_id": VIEWER_ID}, headers=_h(host_token))
        assert r.status_code == 200
        # viewer2 now has moderator powers → create fresh comment & pin
        rc = requests.post(f"{API}/lives/{live_id}/comment", json={"text": "soy mod ahora"}, headers=_h(viewer_token))
        assert rc.status_code == 200
        mod_cid = rc.json()["id"]
        rp = requests.post(f"{API}/lives/{live_id}/moderation", json={"action": "pin", "comment_id": mod_cid}, headers=_h(viewer_token))
        assert rp.status_code == 200, f"mod should pin, got {rp.status_code}: {rp.text}"
        rs = requests.post(f"{API}/lives/{live_id}/moderation", json={"action": "settings", "allow_comments": False}, headers=_h(viewer_token))
        assert rs.status_code == 403, "mod must not be able to change settings"
        # revert allow_comments if touched (should still be True since 403)
        # remove_mod before kick to keep role clean
        requests.post(f"{API}/lives/{live_id}/moderation", json={"action": "remove_mod", "user_id": VIEWER_ID}, headers=_h(host_token))

        # Spam: 4 comments < 5s → 429 on the 4th (host user shouldn't rate-limit itself? code applies to all)
        # Need to check with viewer. Reset: use a fresh viewer token user id.
        # 1st
        a = requests.post(f"{API}/lives/{live_id}/comment", json={"text": "m1"}, headers=_h(viewer_token))
        b = requests.post(f"{API}/lives/{live_id}/comment", json={"text": "m2"}, headers=_h(viewer_token))
        c = requests.post(f"{API}/lives/{live_id}/comment", json={"text": "m3"}, headers=_h(viewer_token))
        d = requests.post(f"{API}/lives/{live_id}/comment", json={"text": "m4"}, headers=_h(viewer_token))
        statuses = [a.status_code, b.status_code, c.status_code, d.status_code]
        assert 429 in statuses, f"expected 429 on spam, got {statuses}"

        # Kick viewer
        time.sleep(6)  # let rate limit window clear
        r = requests.post(f"{API}/lives/{live_id}/moderation", json={"action": "kick", "user_id": VIEWER_ID}, headers=_h(host_token))
        assert r.status_code == 200
        assert VIEWER_ID in (r.json().get("banned_user_ids") or [])

        # Viewer join should 403 with 'Fuiste expulsado'
        r = requests.post(f"{API}/lives/{live_id}/join", json={}, headers=_h(viewer_token))
        assert r.status_code == 403
        assert "expulsado" in r.text.lower()

        # Viewer comment should 403
        r = requests.post(f"{API}/lives/{live_id}/comment", json={"text": "regreso"}, headers=_h(viewer_token))
        assert r.status_code == 403

        # Viewer end -> 403
        r = requests.post(f"{API}/lives/{live_id}/end", headers=_h(viewer_token))
        assert r.status_code == 403

        # Details: viewer_count int + is_moderator flag
        r = requests.get(f"{API}/lives/{live_id}", headers=_h(host_token))
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("viewer_count"), int)
        assert d.get("is_moderator") is True

        # Host end -> 200 + duration
        r = requests.post(f"{API}/lives/{live_id}/end", headers=_h(host_token))
        assert r.status_code == 200
        assert "duration_seconds" in r.json()

        # GET shows status ended
        r = requests.get(f"{API}/lives/{live_id}", headers=_h(host_token))
        assert r.status_code == 200
        assert r.json().get("status") == "ended"


# ---------- FEED ----------

class TestFeedEndpoints:
    def test_by_username_resolution(self, host_token):
        for name in ["Viewer Dos", "viewer_dos"]:
            r = requests.get(f"{API}/users/by-username/{name}", headers=_h(host_token))
            assert r.status_code == 200, f"{name}: {r.status_code} {r.text[:120]}"
            assert r.json().get("id") == VIEWER_ID, f"{name} -> {r.json()}"
        r = requests.get(f"{API}/users/by-username/__no_such_user__xyz", headers=_h(host_token))
        assert r.status_code == 404

    def test_not_interested_hides(self, host_token):
        # Fetch recommended-videos first
        r = requests.get(f"{API}/posts/recommended-videos?kind=all&limit=50", headers=_h(host_token))
        assert r.status_code == 200, r.text
        posts = r.json()
        if not posts:
            pytest.skip("no recommended posts to test with")
        target = posts[0]["id"]

        # not-interested
        r = requests.post(f"{API}/posts/{target}/not-interested", headers=_h(host_token))
        assert r.status_code == 200
        assert r.json().get("hidden") is True

        # must not appear
        r = requests.get(f"{API}/posts/recommended-videos?kind=all&limit=50", headers=_h(host_token))
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert target not in ids, "hidden post still appearing"

        # unknown -> 404
        r = requests.post(f"{API}/posts/{uuid.uuid4()}/not-interested", headers=_h(host_token))
        assert r.status_code == 404

    def test_report_post(self, host_token):
        r = requests.get(f"{API}/posts/recommended-videos?kind=all&limit=10", headers=_h(host_token))
        posts = r.json() if r.ok else []
        if not posts:
            pytest.skip("no posts to report")
        pid = posts[0]["id"]
        r = requests.post(f"{API}/reports",
                          json={"content_type": "post", "content_id": pid, "reason": "spam"},
                          headers=_h(host_token))
        assert r.status_code in (200, 201), r.text

    def test_block_hides_author_posts(self, host_token):
        # Find a post whose author != host
        me = requests.get(f"{API}/auth/me", headers=_h(host_token)).json()
        my_id = me.get("id")
        r = requests.get(f"{API}/posts/recommended-videos?kind=all&limit=50", headers=_h(host_token))
        posts = r.json() if r.ok else []
        others = [p for p in posts if p.get("user_id") and p["user_id"] != my_id]
        if not others:
            pytest.skip("no other-authored posts available")
        author_id = others[0]["user_id"]

        # block
        rb = requests.post(f"{API}/users/{author_id}/block", headers=_h(host_token))
        assert rb.status_code in (200, 201), rb.text

        # author posts should disappear
        r = requests.get(f"{API}/posts/recommended-videos?kind=all&limit=50", headers=_h(host_token))
        assert r.status_code == 200
        remaining_authors = {p.get("user_id") for p in r.json()}
        assert author_id not in remaining_authors, "blocked author posts still appear"

        # unblock to restore
        ru = requests.post(f"{API}/users/{author_id}/block", headers=_h(host_token))
        assert ru.status_code in (200, 201)
