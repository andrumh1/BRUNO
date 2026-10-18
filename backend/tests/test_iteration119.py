"""Iteration 119 — Series flow + Posts place."""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
NEWTEST = ("newtest@bruno.com", "Test1234!")
VIEWER2 = ("viewer2@bruno.com", "Test1234!")


def _login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def tok_newtest():
    return _login(*NEWTEST)


@pytest.fixture(scope="module")
def tok_viewer2():
    return _login(*VIEWER2)


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ───────────────── Series ─────────────────

def test_series_full_flow(tok_newtest, tok_viewer2):
    # candidates
    r = requests.get(f"{BASE}/series/candidates", headers=_h(tok_newtest), timeout=20)
    assert r.status_code == 200
    cands = r.json()
    assert isinstance(cands, list) and len(cands) >= 2, f"need >=2 video candidates, got {len(cands)}"
    # ensure includes short videos too (any video regardless of 3+ min)
    print(f"candidates={len(cands)} sample_durations={[c.get('duration') for c in cands[:5]]}")
    id_a, id_b = cands[0]["id"], cands[1]["id"]

    # create private series
    r = requests.post(f"{BASE}/series", headers=_h(tok_newtest), json={
        "title": "TEST_QA Serie 119", "description": "t", "visibility": "private", "video_ids": [id_a, id_b]
    }, timeout=20)
    assert r.status_code == 200, r.text
    s = r.json()
    sid = s["id"]
    assert s["visibility"] == "private"
    assert [v["id"] for v in s["videos"]] == [id_a, id_b]

    try:
        # not in public list
        r = requests.get(f"{BASE}/series/public", headers=_h(tok_newtest), timeout=20)
        assert r.status_code == 200
        assert sid not in {x["id"] for x in r.json()}, "private series must NOT appear in /series/public"

        # viewer2 cannot GET private
        r = requests.get(f"{BASE}/series/{sid}", headers=_h(tok_viewer2), timeout=20)
        assert r.status_code == 404

        # reverse and set public
        r = requests.put(f"{BASE}/series/{sid}", headers=_h(tok_newtest), json={
            "title": "TEST_QA Serie 119", "visibility": "public", "video_ids": [id_b, id_a]
        }, timeout=20)
        assert r.status_code == 200
        updated = r.json()
        assert updated["visibility"] == "public"
        assert [v["id"] for v in updated["videos"]] == [id_b, id_a]

        # GET as viewer2 OK
        r = requests.get(f"{BASE}/series/{sid}", headers=_h(tok_viewer2), timeout=20)
        assert r.status_code == 200
        assert [v["id"] for v in r.json()["videos"]] == [id_b, id_a]

        # /series/public contains it
        r = requests.get(f"{BASE}/series/public", headers=_h(tok_viewer2), timeout=20)
        assert sid in {x["id"] for x in r.json()}

        # play ordered
        r = requests.get(f"{BASE}/series/{sid}/play", headers=_h(tok_viewer2), timeout=20)
        assert r.status_code == 200
        play = r.json()
        assert [p["id"] for p in play] == [id_b, id_a]
        assert all(p.get("series", {}).get("id") == sid for p in play)
    finally:
        r = requests.delete(f"{BASE}/series/{sid}", headers=_h(tok_newtest), timeout=20)
        assert r.status_code == 200


# ───────────────── Posts place ─────────────────

def test_post_place_create_and_read(tok_newtest):
    place = {"lat": 4.6486, "lng": -74.0628, "name": "TEST_Café QA Chapinero", "address": "Calle 63", "place_id": "osm-qa-cafe"}
    r = requests.post(f"{BASE}/posts", headers=_h(tok_newtest), json={
        "content": "TEST_place_119 post", "visibility": "public", "place": place
    }, timeout=20)
    assert r.status_code == 200, r.text
    post = r.json()
    pid = post["id"]
    try:
        assert post.get("place"), f"place missing in create response: {post}"
        assert post["place"]["name"] == place["name"]
        assert abs(post["place"]["lat"] - place["lat"]) < 1e-6
        # timeline
        r = requests.get(f"{BASE}/feed/timeline", headers=_h(tok_newtest), timeout=20)
        assert r.status_code == 200
        raw = r.json()
        items = raw if isinstance(raw, list) else (raw.get("items") or raw.get("posts") or raw.get("results") or [])
        first = next((p for p in items if isinstance(p, dict) and p.get("id") == pid), None)
        assert first is not None, "created post not in timeline"
        assert first.get("place", {}).get("name") == place["name"]
    finally:
        r = requests.delete(f"{BASE}/posts/{pid}", headers=_h(tok_newtest), timeout=20)
        assert r.status_code in (200, 204)
