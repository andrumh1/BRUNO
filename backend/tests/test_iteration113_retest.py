"""Iteration 113 retest: continue-watching endpoint now returns reels (media[].type=='video')."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
EMAIL = "newtest@bruno.com"
PASSWORD = "Test1234!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


def _find_reel_id(headers):
    # Try /api/posts/reels or feed to get a video reel id
    for url in [f"{BASE_URL}/api/posts/reels?limit=10", f"{BASE_URL}/api/posts?limit=20"]:
        try:
            r = requests.get(url, headers=headers, timeout=30)
            if r.status_code == 200:
                data = r.json() if isinstance(r.json(), list) else r.json().get("posts", [])
                for p in data:
                    has_media_video = any((m or {}).get("type") == "video" for m in (p.get("media") or []))
                    if p.get("video_url") or has_media_video:
                        return p["id"]
        except Exception:
            continue
    return None


def test_progress_then_continue_watching(headers):
    reel_id = _find_reel_id(headers)
    assert reel_id, "No reel found in feed"

    # Post progress
    r = requests.post(f"{BASE_URL}/api/posts/{reel_id}/progress",
                      json={"position": 6, "duration": 60}, headers=headers, timeout=30)
    assert r.status_code in (200, 201), r.text

    # GET continue-watching should include it
    r = requests.get(f"{BASE_URL}/api/posts/continue-watching", headers=headers, timeout=30)
    assert r.status_code == 200
    items = r.json()
    ids = [i.get("id") for i in items]
    assert reel_id in ids, f"Reel {reel_id} not in continue-watching: {ids}"
    item = next(i for i in items if i["id"] == reel_id)
    assert item.get("resume_position") == 6
    assert item.get("resume_pct") == 10.0


def test_delete_progress_removes(headers):
    reel_id = _find_reel_id(headers)
    # ensure present
    requests.post(f"{BASE_URL}/api/posts/{reel_id}/progress", json={"position": 6, "duration": 60}, headers=headers)
    r = requests.delete(f"{BASE_URL}/api/posts/{reel_id}/progress", headers=headers, timeout=30)
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/api/posts/continue-watching", headers=headers, timeout=30)
    assert r.status_code == 200
    ids = [i.get("id") for i in r.json()]
    assert reel_id not in ids
