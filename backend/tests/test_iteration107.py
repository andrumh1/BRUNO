"""
Iteration 107 backend tests:
- recommended-videos long filter
- long video progress + chapters update
- coupon stats (clicks increment via public landing)
- search is_long flag
"""
import os
import time
import pytest
import requests

def _get_base():
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not url:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return url.rstrip("/")


BASE_URL = _get_base()
API = f"{BASE_URL}/api"

LONG_ID_1 = "12b28791-edff-4be8-875d-f23742f6b758"
LONG_ID_2 = "bdce489a-6f05-46b3-93c4-a0e70360bd64"

OWNER = {"email": "newtest@bruno.com", "password": "Test1234!"}
VIEWER = {"email": "viewer2@bruno.com", "password": "Test1234!"}


def _login(creds):
    r = requests.post(
        f"{API}/auth/login",
        json=creds,
        headers={"X-Platform": "native", "Content-Type": "application/json"},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def owner_token():
    return _login(OWNER)


@pytest.fixture(scope="module")
def viewer_token():
    return _login(VIEWER)


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ----- recommended-videos long filter -----
def test_recommended_videos_long_only(owner_token):
    r = requests.get(
        f"{API}/posts/recommended-videos?kind=video&long=1&limit=20",
        headers=_auth(owner_token),
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", data.get("posts", []))
    ids = [p.get("id") for p in items]
    assert LONG_ID_1 in ids, f"expected {LONG_ID_1} in long items; got {ids}"
    assert LONG_ID_2 in ids, f"expected {LONG_ID_2} in long items; got {ids}"
    for p in items:
        media = p.get("media") or []
        if media:
            dur = media[0].get("duration") or 0
            assert dur >= 180, f"post {p.get('id')} duration {dur} < 180"


def test_recommended_videos_without_long_excludes(owner_token):
    r = requests.get(
        f"{API}/posts/recommended-videos?kind=video&limit=50",
        headers=_auth(owner_token),
        timeout=30,
    )
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", data.get("posts", []))
    ids = [p.get("id") for p in items]
    assert LONG_ID_1 not in ids
    assert LONG_ID_2 not in ids


# ----- Progress -----
def test_progress_save_and_reset(owner_token):
    r = requests.post(
        f"{API}/posts/{LONG_ID_1}/progress",
        json={"position": 95, "duration": 420},
        headers=_auth(owner_token),
        timeout=30,
    )
    assert r.status_code in (200, 201), r.text

    g = requests.get(f"{API}/posts/{LONG_ID_1}/progress", headers=_auth(owner_token), timeout=30)
    assert g.status_code == 200
    assert g.json().get("position") == 95

    r2 = requests.post(
        f"{API}/posts/{LONG_ID_1}/progress",
        json={"position": 415, "duration": 420},
        headers=_auth(owner_token),
        timeout=30,
    )
    assert r2.status_code in (200, 201)
    g2 = requests.get(f"{API}/posts/{LONG_ID_1}/progress", headers=_auth(owner_token), timeout=30)
    assert g2.status_code == 200
    assert g2.json().get("position") == 0


# ----- Chapters update auth -----
def test_chapters_update_owner_and_non_owner(owner_token, viewer_token):
    original = [
        {"time": 0, "title": "Introducción"},
        {"time": 90, "title": "Primeros pasos"},
        {"time": 180, "title": "Caso práctico"},
        {"time": 300, "title": "Preguntas"},
    ]
    # Non-owner cannot edit
    r_bad = requests.put(
        f"{API}/posts/{LONG_ID_1}",
        json={"chapters": [{"time": 0, "title": "X"}]},
        headers=_auth(viewer_token),
        timeout=30,
    )
    assert r_bad.status_code in (401, 403, 404), f"expected forbidden, got {r_bad.status_code}"

    # Owner can edit (unsorted → should sort)
    r_ok = requests.put(
        f"{API}/posts/{LONG_ID_1}",
        json={"chapters": [{"time": 90, "title": "Paso 1"}, {"time": 0, "title": "Intro"}]},
        headers=_auth(owner_token),
        timeout=30,
    )
    assert r_ok.status_code in (200, 201), r_ok.text
    body = r_ok.json()
    chapters = body.get("chapters") or []
    assert len(chapters) == 2
    assert chapters[0]["time"] <= chapters[1]["time"], "chapters not sorted"

    # restore original
    rr = requests.put(
        f"{API}/posts/{LONG_ID_1}",
        json={"chapters": original},
        headers=_auth(owner_token),
        timeout=30,
    )
    assert rr.status_code in (200, 201)


# ----- Coupon stats -----
def test_coupon_stats_and_clicks_increment(owner_token):
    s0 = requests.get(f"{API}/money/coupons/stats", headers=_auth(owner_token), timeout=30)
    assert s0.status_code == 200, s0.text
    data0 = s0.json()
    assert "items" in data0 and "totals" in data0
    items0 = data0["items"]
    assert any(it.get("code") == "VERANO20" for it in items0)
    for it in items0:
        for k in ("id", "code", "clicks", "redemptions", "revenue", "discount_given", "conversion_pct"):
            assert k in it, f"missing {k} in coupon stats item"

    # Find VERANO20 id
    cl = requests.get(f"{API}/money/coupons", headers=_auth(owner_token), timeout=30)
    assert cl.status_code == 200
    coupons = cl.json() if isinstance(cl.json(), list) else cl.json().get("items", [])
    v = next((c for c in coupons if c.get("code") == "VERANO20"), None)
    assert v, "VERANO20 not found"
    v_id = v["id"]

    before = next((it for it in items0 if it.get("code") == "VERANO20"), {}).get("clicks", 0)

    # hit public endpoint twice (no auth)
    for _ in range(2):
        r = requests.get(f"{API}/money/coupons/{v_id}/public", timeout=30)
        assert r.status_code == 200, r.text

    time.sleep(1)
    s1 = requests.get(f"{API}/money/coupons/stats", headers=_auth(owner_token), timeout=30)
    assert s1.status_code == 200
    after = next((it for it in s1.json()["items"] if it.get("code") == "VERANO20"), {}).get("clicks", 0)
    assert after - before >= 2, f"clicks did not increment by 2 (before={before}, after={after})"


# ----- Search is_long -----
def test_search_videos_is_long(owner_token):
    r = requests.get(
        f"{API}/search?q=masterclass&type=videos",
        headers=_auth(owner_token),
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # possible shapes
    items = body.get("items") or body.get("videos") or body.get("results") or []
    if isinstance(body, dict) and "groups" in body:
        for g in body["groups"]:
            if g.get("type") == "videos":
                items = g.get("items", [])
                break
    assert items, f"no items for masterclass: {body}"
    long_item = next((i for i in items if i.get("is_long")), None)
    assert long_item, f"no is_long item in results: {items}"
    assert str(long_item.get("url", "")).startswith("/video/"), f"url not /video/: {long_item.get('url')}"
