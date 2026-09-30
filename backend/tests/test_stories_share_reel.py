"""Backend tests for iteration 94: scheduled stories UTC normalization + atomic publish,
share-stats, and reel download seal query."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
EMAIL = "newtest@bruno.com"
PASSWORD = "Test1234!"
REEL_ID = "1fc7dc64-48ae-49ef-9afb-85f1619951f0"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ============ Scheduled Stories ============

def _cleanup_qa(headers):
    r = requests.get(f"{BASE_URL}/api/stories/scheduled/mine", headers=headers, timeout=15)
    if r.status_code == 200:
        for s in r.json():
            if (s.get("caption") or "").startswith("qa-sched"):
                requests.delete(f"{BASE_URL}/api/stories/scheduled/{s['id']}", headers=headers, timeout=10)


def test_create_scheduled_story_utc_normalized(headers):
    _cleanup_qa(headers)
    payload = {
        "media_url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        "media_type": "image",
        "caption": "qa-sched",
        "scheduled_at": "2030-01-01T00:00:00-05:00",
    }
    r = requests.post(f"{BASE_URL}/api/stories/", json=payload, headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("scheduled") is True
    assert data.get("scheduled_at") == "2030-01-01T05:00:00+00:00", data
    pytest.scheduled_id = data["id"]


def test_list_scheduled_mine(headers):
    r = requests.get(f"{BASE_URL}/api/stories/scheduled/mine", headers=headers, timeout=15)
    assert r.status_code == 200
    ids = [s["id"] for s in r.json()]
    assert pytest.scheduled_id in ids


def test_reschedule_future(headers):
    r = requests.patch(
        f"{BASE_URL}/api/stories/scheduled/{pytest.scheduled_id}",
        json={"scheduled_at": "2030-02-01T10:00:00Z"},
        headers=headers, timeout=15
    )
    assert r.status_code == 200, r.text
    assert r.json().get("scheduled_at", "").startswith("2030-02-01T10:00:00")


def test_reschedule_past_rejected(headers):
    r = requests.patch(
        f"{BASE_URL}/api/stories/scheduled/{pytest.scheduled_id}",
        json={"scheduled_at": "2020-01-01T00:00:00Z"},
        headers=headers, timeout=15
    )
    assert r.status_code == 400


def test_publish_now_once_then_404(headers):
    r = requests.post(
        f"{BASE_URL}/api/stories/scheduled/{pytest.scheduled_id}/publish-now",
        headers=headers, timeout=20
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert body.get("published") == 1

    # second call: story is gone
    r2 = requests.post(
        f"{BASE_URL}/api/stories/scheduled/{pytest.scheduled_id}/publish-now",
        headers=headers, timeout=20
    )
    assert r2.status_code == 404, r2.text


def test_published_story_appears_exactly_once(headers):
    r = requests.get(f"{BASE_URL}/api/stories/feed", headers=headers, timeout=20)
    assert r.status_code == 200
    matches = 0
    for grp in r.json():
        for st in grp.get("stories", []):
            if st.get("caption") == "qa-sched":
                matches += 1
    assert matches == 1, f"expected 1 story, got {matches}"


def test_delete_scheduled_story(headers):
    payload = {
        "media_url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        "media_type": "image",
        "caption": "qa-sched-del",
        "scheduled_at": "2030-06-01T00:00:00Z",
    }
    r = requests.post(f"{BASE_URL}/api/stories/", json=payload, headers=headers, timeout=15)
    assert r.status_code == 200
    sid = r.json()["id"]
    d = requests.delete(f"{BASE_URL}/api/stories/scheduled/{sid}", headers=headers, timeout=15)
    assert d.status_code == 200
    assert d.json().get("ok") is True


# ============ Share Stats ============

def test_share_stats_daily(headers):
    r = requests.get(f"{BASE_URL}/api/share-stats/daily?days=7", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "days" in data
    assert len(data["days"]) == 7
    assert "total" in data or "totals" in data


def test_share_stats_hit_instagram(headers):
    r = requests.post(
        f"{BASE_URL}/api/share-stats/hit",
        json={"ref": "qa-ref-x", "referrer": ""},
        headers={**headers, "User-Agent": "Mozilla/5.0 Instagram 300.0.0.0"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("network") == "instagram", body


# ============ Reel Download with Seal ============

def test_reel_download_with_seal(headers):
    seal = "https://res.cloudinary.com/x/image/upload/v1/bruno/logo.png"
    r = requests.get(
        f"{BASE_URL}/api/reels/{REEL_ID}/download",
        params={"seal": seal},
        headers=headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("watermarked") is False  # external video
    assert "url" in body


def teardown_module(module):
    try:
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=10)
        tok = r.json().get("access_token") or r.json().get("token")
        _cleanup_qa({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    except Exception:
        pass
