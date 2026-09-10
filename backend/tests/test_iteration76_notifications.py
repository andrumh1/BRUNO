"""
Iteration 76 — Backend notifications + sound reuse tests.

Covers:
(a) like dedupe + retraction on unlike
(b) comment notification targets the comment with correct URL
(c) reply notifies parent comment author with reply URL
(d) remix notification to original creator
(e) audio.source_post_id in create_post + /api/posts/sound/{id}
(f) live_started fanout to followers, private lives do NOT notify
(g) every notification has non-empty url
"""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

HOST_EMAIL = "newtest@bruno.com"
VIEWER_EMAIL = "viewer2@bruno.com"
PASSWORD = "Test1234!"

# A known video post by newtest per review request
NEWTEST_VIDEO_POST = "5d8c719e-3e47-44fc-ad46-a7b17b2629ed"
# An image post owned by newtest for the highlight-non-video test
IMAGE_POST = "64364ec6-af71-41fd-b6e1-d3ef59820686"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    d = r.json()
    return d["access_token"], (d.get("user") or {}).get("id")


@pytest.fixture(scope="module")
def hosts():
    host_tok, host_id = _login(HOST_EMAIL, PASSWORD)
    v_tok, v_id = _login(VIEWER_EMAIL, PASSWORD)
    assert host_tok and v_tok
    return {
        "host": {"tok": host_tok, "id": host_id, "H": {"Authorization": f"Bearer {host_tok}"}},
        "viewer": {"tok": v_tok, "id": v_id, "H": {"Authorization": f"Bearer {v_tok}"}},
    }


def _find_notif(host_headers, pred, retries=6):
    """Return first notification matching pred, polling briefly to allow async writes."""
    last = None
    for _ in range(retries):
        r = requests.get(f"{API}/notifications?limit=50", headers=host_headers, timeout=20)
        r.raise_for_status()
        last = r.json()
        for n in last:
            if pred(n):
                return n, last
        time.sleep(0.6)
    return None, last


# ─── (a) LIKE dedupe + retract ──────────────────────────────────────────────

def test_like_creates_single_notif_and_unlike_removes_it(hosts):
    H_host = hosts["host"]["H"]
    H_v = hosts["viewer"]["H"]
    pid = NEWTEST_VIDEO_POST

    # Ensure starting state: viewer NOT liking
    r = requests.post(f"{API}/posts/{pid}/like", headers=H_v, timeout=20)
    assert r.status_code == 200
    if r.json().get("liked") is True:
        pass  # first toggle already liked; continue
    else:
        # was liked already → we just unliked; like again
        r = requests.post(f"{API}/posts/{pid}/like", headers=H_v, timeout=20)
        assert r.status_code == 200 and r.json().get("liked") is True

    # Now viewer is liking. Verify exactly one 'like' notification for actor+post.
    n, _ = _find_notif(H_host, lambda x: x.get("type") == "like" and x.get("target_id") == pid and (x.get("actor") or {}).get("id") == hosts["viewer"]["id"])
    assert n is not None, "Expected a like notification for the viewer on this post"
    assert (n.get("url") or "").startswith(f"/reels?id={pid}"), f"like url wrong: {n.get('url')}"
    assert "preview_url" in n

    # Count = 1 (no duplicates)
    all_r = requests.get(f"{API}/notifications?limit=100", headers=H_host, timeout=20).json()
    matches = [x for x in all_r if x.get("type") == "like" and x.get("target_id") == pid and (x.get("actor") or {}).get("id") == hosts["viewer"]["id"]]
    assert len(matches) == 1, f"expected exactly 1 like notif, got {len(matches)}"

    # Unlike → notif is removed
    r = requests.post(f"{API}/posts/{pid}/like", headers=H_v, timeout=20)
    assert r.status_code == 200 and r.json().get("liked") is False
    time.sleep(0.5)
    all_r = requests.get(f"{API}/notifications?limit=100", headers=H_host, timeout=20).json()
    matches = [x for x in all_r if x.get("type") == "like" and x.get("target_id") == pid and (x.get("actor") or {}).get("id") == hosts["viewer"]["id"]]
    assert len(matches) == 0, "like notif should be retracted on unlike"

    # Like again → exactly one notif returns
    r = requests.post(f"{API}/posts/{pid}/like", headers=H_v, timeout=20)
    assert r.status_code == 200 and r.json().get("liked") is True
    time.sleep(0.5)
    all_r = requests.get(f"{API}/notifications?limit=100", headers=H_host, timeout=20).json()
    matches = [x for x in all_r if x.get("type") == "like" and x.get("target_id") == pid and (x.get("actor") or {}).get("id") == hosts["viewer"]["id"]]
    assert len(matches) == 1, f"re-like should produce exactly 1 (dedup), got {len(matches)}"


# ─── (b) COMMENT + (c) REPLY ────────────────────────────────────────────────

@pytest.fixture(scope="module")
def _comment_and_reply(hosts):
    """viewer2 comments on newtest's video, newtest replies. Returns ids."""
    H_v = hosts["viewer"]["H"]
    H_h = hosts["host"]["H"]
    pid = NEWTEST_VIDEO_POST
    text = f"TEST comment {int(time.time())}"

    r = requests.post(f"{API}/posts/{pid}/comments", headers=H_v, json={"content": text}, timeout=20)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]

    reply_text = f"TEST reply {int(time.time())}"
    r2 = requests.post(f"{API}/posts/{pid}/comments", headers=H_h, json={"content": reply_text, "parent_id": cid}, timeout=20)
    assert r2.status_code == 200, r2.text
    rid = r2.json()["id"]

    return {"post_id": pid, "comment_id": cid, "comment_text": text, "reply_id": rid, "reply_text": reply_text}


def test_comment_notif_targets_comment_with_deep_link(hosts, _comment_and_reply):
    d = _comment_and_reply
    H_host = hosts["host"]["H"]
    n, all_ = _find_notif(H_host, lambda x: x.get("type") == "comment" and x.get("target_id") == d["comment_id"])
    assert n is not None, "no comment notif found"
    assert n.get("target_type") == "comment"
    assert d["comment_text"][:20] in (n.get("message") or ""), f"message missing text: {n.get('message')!r}"
    url = n.get("url") or ""
    assert f"/reels?id={d['post_id']}" in url and "comments=1" in url and f"comment={d['comment_id']}" in url, f"bad url: {url}"


def test_reply_notif_to_parent_comment_author(hosts, _comment_and_reply):
    d = _comment_and_reply
    # newtest replied, so viewer2 (parent comment author) should get a 'reply' notif
    H_v = hosts["viewer"]["H"]
    n, _ = _find_notif(H_v, lambda x: x.get("type") == "reply" and x.get("target_id") == d["reply_id"])
    assert n is not None, "no reply notif for viewer2"
    assert (n.get("url") or "").find(f"comment={d['reply_id']}") >= 0, f"reply url missing reply id: {n.get('url')}"


# ─── (e) AUDIO reuse + sound endpoint ───────────────────────────────────────

@pytest.fixture(scope="module")
def _remix_and_audio(hosts):
    """viewer2 creates a remix (duet) of newtest's video, and a new video post that reuses newtest's sound."""
    H_v = hosts["viewer"]["H"]
    pid = NEWTEST_VIDEO_POST

    # Duet remix
    remix_body = {
        "content": "TEST remix",
        "media": [{"type": "video", "url": "https://example.com/x.mp4"}],
        "post_type": "video",
        "visibility": "public",
        "remix": {"type": "duet", "source_post_id": pid},
    }
    r = requests.post(f"{API}/posts", headers=H_v, json=remix_body, timeout=30)
    assert r.status_code == 200, r.text
    remix_id = r.json()["id"]

    # Sound reuse
    audio_body = {
        "content": "TEST sound reuse",
        "media": [{"type": "video", "url": "https://example.com/y.mp4"}],
        "post_type": "video",
        "visibility": "public",
        "audio": {"source_post_id": pid},
    }
    r = requests.post(f"{API}/posts", headers=H_v, json=audio_body, timeout=30)
    assert r.status_code == 200, r.text
    audio_post = r.json()

    return {"remix_id": remix_id, "audio_post": audio_post, "source_id": pid}


def test_remix_notification(hosts, _remix_and_audio):
    H_host = hosts["host"]["H"]
    remix_id = _remix_and_audio["remix_id"]
    n, _ = _find_notif(H_host, lambda x: x.get("type") == "remix" and x.get("target_id") == remix_id)
    assert n is not None, "remix notification missing for original creator"
    assert (n.get("url") or "") == f"/reels?id={remix_id}", f"remix url wrong: {n.get('url')}"


def test_audio_reuse_post_carries_metadata(_remix_and_audio):
    p = _remix_and_audio["audio_post"]
    src = _remix_and_audio["source_id"]
    assert p.get("audio"), "returned post missing audio"
    a = p["audio"]
    assert a.get("source_post_id") == src
    assert (a.get("name") or "").startswith("Sonido original · @"), f"name wrong: {a.get('name')}"
    assert a.get("url"), "audio.url should be non-null (mp4 from source)"


def test_sound_endpoint_returns_uses_and_posts(_remix_and_audio):
    src = _remix_and_audio["source_id"]
    new_post_id = _remix_and_audio["audio_post"]["id"]
    r = requests.get(f"{API}/posts/sound/{src}", timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "sound" in d and "posts" in d
    s = d["sound"]
    assert s.get("name") and s.get("url") is not None
    assert s.get("uses", 0) >= 1
    ids = [p.get("id") for p in d["posts"]]
    assert ids and ids[0] == src, f"original should be first, got {ids[:2]}"
    assert new_post_id in ids


# ─── (f) LIVE_STARTED fanout to followers ───────────────────────────────────

def _ensure_following(follower_tok, target_id, current_state_headers):
    """Ensure follower is following target_id. current_state_headers used to GET current state."""
    # There is no clean "is following" check without a profile call; toggle-based endpoint returns state.
    # We toggle once and inspect; if false, toggle again.
    r = requests.post(f"{API}/users/{target_id}/follow", headers={"Authorization": f"Bearer {follower_tok}"}, timeout=20)
    assert r.status_code == 200, r.text
    state = r.json().get("following")
    if state is False:
        r2 = requests.post(f"{API}/users/{target_id}/follow", headers={"Authorization": f"Bearer {follower_tok}"}, timeout=20)
        assert r2.status_code == 200 and r2.json().get("following") is True


def _end_active_live(host_tok):
    H = {"Authorization": f"Bearer {host_tok}"}
    r = requests.get(f"{API}/lives/mine/active", headers=H, timeout=20)
    if r.status_code == 200:
        d = r.json() or {}
        lid = (d or {}).get("id")
        if lid:
            requests.post(f"{API}/lives/{lid}/end", headers=H, timeout=20)


def test_live_started_notifies_followers_public_only(hosts):
    host_tok = hosts["host"]["tok"]
    v_tok = hosts["viewer"]["tok"]
    host_id = hosts["host"]["id"]
    H_v = hosts["viewer"]["H"]
    H_h = hosts["host"]["H"]

    # Ensure viewer follows newtest
    _ensure_following(v_tok, host_id, H_v)

    # Public live
    _end_active_live(host_tok)
    r = requests.post(f"{API}/lives", headers=H_h, json={"title": "TEST public live", "is_private": False}, timeout=30)
    assert r.status_code == 200, r.text
    live_id = r.json()["id"]

    try:
        n, _ = _find_notif(H_v, lambda x: x.get("type") == "live_started" and x.get("target_id") == live_id, retries=8)
        assert n is not None, "viewer did not receive live_started notif for public live"
        assert (n.get("url") or "") == f"/lives/{live_id}", f"live_started url wrong: {n.get('url')}"
    finally:
        requests.post(f"{API}/lives/{live_id}/end", headers=H_h, timeout=20)

    # Private live → NO notification
    _end_active_live(host_tok)
    r = requests.post(f"{API}/lives", headers=H_h, json={"title": "TEST private live", "is_private": True}, timeout=30)
    assert r.status_code == 200, r.text
    priv_id = r.json()["id"]
    try:
        time.sleep(1.2)
        all_r = requests.get(f"{API}/notifications?limit=100", headers=H_v, timeout=20).json()
        matches = [x for x in all_r if x.get("type") == "live_started" and x.get("target_id") == priv_id]
        assert len(matches) == 0, f"private live should not notify followers, but got {len(matches)}"
    finally:
        requests.post(f"{API}/lives/{priv_id}/end", headers=H_h, timeout=20)


# ─── (g) All notifications have non-empty url ───────────────────────────────

def test_all_notifications_have_url(hosts):
    for who in ("host", "viewer"):
        H = hosts[who]["H"]
        r = requests.get(f"{API}/notifications?limit=100", headers=H, timeout=20)
        assert r.status_code == 200
        for n in r.json():
            assert n.get("url"), f"{who} notif missing url: type={n.get('type')} target={n.get('target_id')}"
