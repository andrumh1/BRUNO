"""Iteration 116: Reels Feed timeline + Saved Places backend tests."""
import os
import time
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

NEWTEST = {"email": "newtest@bruno.com", "password": "Test1234!"}
VIEWER2 = {"email": "viewer2@bruno.com", "password": "Test1234!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    j = r.json()
    tok = j.get("access_token") or j.get("token")
    uid = (j.get("user") or {}).get("id") or j.get("user_id")
    assert tok
    return tok, uid


@pytest.fixture(scope="module")
def newtest_sess():
    tok, uid = _login(NEWTEST)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}"})
    s.uid = uid
    return s


@pytest.fixture(scope="module")
def viewer2_sess():
    tok, uid = _login(VIEWER2)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}"})
    s.uid = uid
    return s


# ---------------- Feed timeline ----------------

def test_timeline_requires_auth():
    r = requests.get(f"{API}/feed/timeline", timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"


def test_timeline_newtest_returns_items_sorted_desc(newtest_sess):
    r = newtest_sess.get(f"{API}/feed/timeline?limit=20", timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "items" in j and "next_cursor" in j and "source" in j and "following_count" in j
    items = j["items"]
    assert isinstance(items, list)
    # sorted desc
    ts = [it["created_at"] for it in items]
    assert ts == sorted(ts, reverse=True), "items not sorted desc by created_at"
    # No drafts/scheduled
    for it in items:
        assert it.get("is_draft") is not True
        assert it.get("visibility") not in ("scheduled", "draft")


def test_timeline_limit_capped_at_40(newtest_sess):
    r = newtest_sess.get(f"{API}/feed/timeline?limit=500", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert len(j["items"]) <= 40


def test_timeline_cursor_pagination_no_overlap(newtest_sess):
    r1 = newtest_sess.get(f"{API}/feed/timeline?limit=5", timeout=20)
    assert r1.status_code == 200
    j1 = r1.json()
    items1 = j1["items"]
    if len(items1) < 5:
        pytest.skip("not enough items for pagination test")
    # When full page returned, next_cursor equals last item's created_at
    assert j1["next_cursor"] == items1[-1]["created_at"]
    r2 = newtest_sess.get(f"{API}/feed/timeline?limit=5&before={j1['next_cursor']}", timeout=20)
    assert r2.status_code == 200
    j2 = r2.json()
    items2 = j2["items"]
    ids1 = {it["id"] for it in items1}
    ids2 = {it["id"] for it in items2}
    assert ids1.isdisjoint(ids2), "pagination overlap"
    # strictly older
    for it in items2:
        assert it["created_at"] < j1["next_cursor"]


# ---------------- Privacy: followers-only post ----------------

def test_followers_only_privacy(newtest_sess, viewer2_sess):
    """viewer2 creates a followers-only post; newtest sees it only after following viewer2."""
    # Make sure newtest is NOT following viewer2 first (unfollow if needed)
    # Check follow state via /following list or just call toggle twice idempotently: safer to inspect
    following_r = newtest_sess.get(f"{API}/users/{newtest_sess.uid}/following", timeout=15)
    is_following = False
    if following_r.status_code == 200:
        data = following_r.json()
        lst = data if isinstance(data, list) else (data.get("items") or data.get("following") or [])
        for u in (lst or []):
            if (u.get("id") or u.get("user_id") or u.get("following_id")) == viewer2_sess.uid:
                is_following = True
                break
    if is_following:
        newtest_sess.post(f"{API}/users/{viewer2_sess.uid}/follow", timeout=15)

    # viewer2 creates a followers-only post
    tag = f"TEST_followers_{uuid.uuid4().hex[:8]}"
    payload = {"content": f"privacy test {tag}", "visibility": "followers"}
    cr = viewer2_sess.post(f"{API}/posts", json=payload, timeout=20)
    assert cr.status_code in (200, 201), cr.text
    post = cr.json()
    post_id = post.get("id") or (post.get("post") or {}).get("id")
    assert post_id

    try:
        # newtest (not following) should NOT see it
        r = newtest_sess.get(f"{API}/feed/timeline?limit=40", timeout=20)
        assert r.status_code == 200
        ids_before = {it["id"] for it in r.json()["items"]}
        assert post_id not in ids_before, "non-follower saw followers-only post"

        # Now newtest follows viewer2
        fr = newtest_sess.post(f"{API}/users/{viewer2_sess.uid}/follow", timeout=15)
        assert fr.status_code == 200
        assert fr.json().get("following") is True

        # Fetch timeline again
        r2 = newtest_sess.get(f"{API}/feed/timeline?limit=40", timeout=20)
        assert r2.status_code == 200
        j2 = r2.json()
        ids_after = {it["id"] for it in j2["items"]}
        assert post_id in ids_after, "follower did not see followers-only post"
        assert j2["source"] == "following"
        assert j2["following_count"] >= 1
    finally:
        # cleanup: unfollow + delete post
        newtest_sess.post(f"{API}/users/{viewer2_sess.uid}/follow", timeout=15)
        viewer2_sess.delete(f"{API}/posts/{post_id}", timeout=15)


# ---------------- Saved Places ----------------

def _make_place(pid=None):
    return {
        "place_id": pid or f"test_osm_{uuid.uuid4().hex[:10]}",
        "name": "TEST_Place",
        "category": "cafe",
        "category_label": "Café",
        "address": "Chapinero, Bogotá",
        "lat": 4.6486,
        "lng": -74.0624,
        "provider": "openstreetmap",
    }


def test_saved_places_create_and_idempotent(newtest_sess):
    body = _make_place()
    r1 = newtest_sess.post(f"{API}/places/saved", json=body, timeout=15)
    assert r1.status_code == 201, r1.text
    created = r1.json()
    assert created["place_id"] == body["place_id"]
    saved_id = created["id"]

    # Idempotent
    r2 = newtest_sess.post(f"{API}/places/saved", json=body, timeout=15)
    assert r2.status_code == 201
    assert r2.json()["id"] == saved_id, "not idempotent on same place_id"

    # list contains it
    rl = newtest_sess.get(f"{API}/places/saved", timeout=15)
    assert rl.status_code == 200
    items = rl.json()["items"]
    assert any(it["place_id"] == body["place_id"] for it in items)

    # cleanup via DELETE by id
    rd = newtest_sess.delete(f"{API}/places/saved/{saved_id}", timeout=15)
    assert rd.status_code == 200


def test_saved_places_per_user_isolation(newtest_sess, viewer2_sess):
    body = _make_place()
    r = newtest_sess.post(f"{API}/places/saved", json=body, timeout=15)
    assert r.status_code == 201
    sid = r.json()["id"]
    try:
        rv = viewer2_sess.get(f"{API}/places/saved", timeout=15)
        assert rv.status_code == 200
        v_items = rv.json()["items"]
        assert all(it["place_id"] != body["place_id"] for it in v_items), "cross-user leak"
    finally:
        newtest_sess.delete(f"{API}/places/saved/{sid}", timeout=15)


def test_saved_places_delete_by_place_id(newtest_sess):
    body = _make_place()
    r = newtest_sess.post(f"{API}/places/saved", json=body, timeout=15)
    assert r.status_code == 201
    rd = newtest_sess.delete(f"{API}/places/saved/{body['place_id']}", timeout=15)
    assert rd.status_code == 200
    # second delete -> 404
    rd2 = newtest_sess.delete(f"{API}/places/saved/{body['place_id']}", timeout=15)
    assert rd2.status_code == 404


def test_saved_places_delete_unknown_404(newtest_sess):
    rd = newtest_sess.delete(f"{API}/places/saved/does_not_exist_xyz", timeout=15)
    assert rd.status_code == 404
