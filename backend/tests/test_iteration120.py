"""Iteration 120: series follow/featured/notify, places/popular."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
SERIES_ID = "6ff8761f-215b-423d-a934-d0bd9a017824"


def _login(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    return j.get("access_token") or j["token"]


@pytest.fixture(scope="module")
def owner_tok():
    return _login("newtest@bruno.com", "Test1234!")


@pytest.fixture(scope="module")
def viewer_tok():
    return _login("viewer2@bruno.com", "Test1234!")


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


class TestSeriesPublicShape:
    def test_public_series_has_new_fields(self, viewer_tok):
        r = requests.get(f"{BASE_URL}/api/series/public", headers=_auth(viewer_tok), timeout=20)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list) and items
        target = next((s for s in items if s["id"] == SERIES_ID), None)
        assert target is not None, "seed series not in public list"
        for k in ("featured", "watched_count", "resume", "followers_count", "is_following"):
            assert k in target, f"missing {k}"
        assert isinstance(target["videos"], list) and target["videos"]
        for v in target["videos"]:
            p = v.get("progress")
            assert p and {"position", "duration", "pct", "completed"} <= set(p.keys())


class TestSeriesFollow:
    def test_follow_toggle_and_following_list(self, viewer_tok, owner_tok):
        # Ensure a known initial state: ensure following = True after test
        r = requests.post(f"{BASE_URL}/api/series/{SERIES_ID}/follow", headers=_auth(viewer_tok), timeout=20)
        assert r.status_code == 200, r.text
        data1 = r.json()
        assert "following" in data1 and "followers_count" in data1
        # Toggle again -> opposite
        r2 = requests.post(f"{BASE_URL}/api/series/{SERIES_ID}/follow", headers=_auth(viewer_tok), timeout=20)
        assert r2.status_code == 200
        data2 = r2.json()
        assert data2["following"] != data1["following"]
        # Leave viewer2 FOLLOWING for the rest of tests (and persistent state)
        if not data2["following"]:
            r3 = requests.post(f"{BASE_URL}/api/series/{SERIES_ID}/follow", headers=_auth(viewer_tok), timeout=20)
            assert r3.status_code == 200 and r3.json()["following"] is True
        # Owner cannot follow own series
        rb = requests.post(f"{BASE_URL}/api/series/{SERIES_ID}/follow", headers=_auth(owner_tok), timeout=20)
        assert rb.status_code == 400
        # Following list contains it
        rf = requests.get(f"{BASE_URL}/api/series/following", headers=_auth(viewer_tok), timeout=20)
        assert rf.status_code == 200
        assert any(s["id"] == SERIES_ID for s in rf.json())


class TestFeaturedAndNotification:
    def test_featured_and_notification_on_new_chapter(self, owner_tok, viewer_tok):
        # Fetch current series state
        r0 = requests.get(f"{BASE_URL}/api/series/{SERIES_ID}", headers=_auth(owner_tok), timeout=20)
        assert r0.status_code == 200
        orig = r0.json()
        orig_video_ids = [v["id"] for v in orig["videos"]]
        assert len(orig_video_ids) == 2, f"seed series must have 2 chapters, got {orig_video_ids}"

        # Set featured to the 2nd video
        feat_id = orig_video_ids[1]
        rp = requests.put(f"{BASE_URL}/api/series/{SERIES_ID}", headers=_auth(owner_tok),
                          json={"title": orig["title"], "featured_video_id": feat_id}, timeout=20)
        assert rp.status_code == 200, rp.text
        assert rp.json()["featured"]["id"] == feat_id

        # Find another public long video owned by newtest to use as a new chapter
        rc = requests.get(f"{BASE_URL}/api/series/candidates", headers=_auth(owner_tok), timeout=20)
        assert rc.status_code == 200
        cands = [v for v in rc.json() if v["id"] not in orig_video_ids and v.get("visibility") == "public"]
        assert cands, "no candidate video available"
        new_vid = cands[0]["id"]

        # Mark time cutoff for notification check
        rn_before = requests.get(f"{BASE_URL}/api/notifications", headers=_auth(viewer_tok), timeout=20)
        assert rn_before.status_code == 200
        before_ids = {n["id"] for n in (rn_before.json() if isinstance(rn_before.json(), list) else rn_before.json().get("items", []))}

        # Add new chapter (viewer2 is a follower → should trigger notification type 'series_episode')
        new_list = orig_video_ids + [new_vid]
        rp2 = requests.put(f"{BASE_URL}/api/series/{SERIES_ID}", headers=_auth(owner_tok),
                           json={"title": orig["title"], "video_ids": new_list}, timeout=20)
        assert rp2.status_code == 200
        assert len(rp2.json()["videos"]) == 3

        # Poll notifications
        import time
        found = None
        for _ in range(10):
            time.sleep(1)
            rn = requests.get(f"{BASE_URL}/api/notifications", headers=_auth(viewer_tok), timeout=20)
            data = rn.json() if isinstance(rn.json(), list) else rn.json().get("items", [])
            found = next((n for n in data if n["id"] not in before_ids and n.get("type") == "series_episode"), None)
            if found:
                break

        try:
            assert found is not None, "expected series_episode notification"
            assert SERIES_ID in (found.get("url") or "")
            assert found.get("target_id") == SERIES_ID
        finally:
            # REVERT - restore original 2 chapters and no featured
            rr = requests.put(f"{BASE_URL}/api/series/{SERIES_ID}", headers=_auth(owner_tok),
                              json={"title": orig["title"], "video_ids": orig_video_ids, "featured_video_id": None}, timeout=20)
            assert rr.status_code == 200
            assert len(rr.json()["videos"]) == 2


class TestCoverUpdate:
    def test_cover_set_and_clear(self, owner_tok):
        r0 = requests.get(f"{BASE_URL}/api/series/{SERIES_ID}", headers=_auth(owner_tok), timeout=20)
        orig = r0.json()
        new_cover = "https://res.cloudinary.com/demo/image/upload/sample.jpg"
        rp = requests.put(f"{BASE_URL}/api/series/{SERIES_ID}", headers=_auth(owner_tok),
                          json={"title": orig["title"], "cover_url": new_cover}, timeout=20)
        assert rp.status_code == 200
        assert rp.json()["cover_url"] == new_cover
        # clear
        rp2 = requests.put(f"{BASE_URL}/api/series/{SERIES_ID}", headers=_auth(owner_tok),
                           json={"title": orig["title"], "cover_url": ""}, timeout=20)
        assert rp2.status_code == 200
        # cover_url when empty falls back to video thumbnail — check raw field via mongo? not available; just ensure no 500


class TestPopularPlaces:
    def test_popular_counts_new_post(self, owner_tok):
        for days in (7, 30):
            r = requests.get(f"{BASE_URL}/api/places/popular?days={days}", headers=_auth(owner_tok), timeout=20)
            assert r.status_code == 200
            data = r.json()
            assert {"items", "count", "since"} <= set(data.keys())

        unique_name = "TEST_QA Popular Place 120"
        payload = {
            "content": "TEST_popular_place iteration 120",
            "post_type": "text",
            "visibility": "public",
            "place": {"lat": 4.6501, "lng": -74.0601, "name": unique_name,
                      "address": "Carrera 7 #70, Bogotá", "place_id": "test_pop_120"},
        }
        rp = requests.post(f"{BASE_URL}/api/posts", headers=_auth(owner_tok), json=payload, timeout=20)
        assert rp.status_code in (200, 201), rp.text
        post_id = rp.json()["id"]
        try:
            r2 = requests.get(f"{BASE_URL}/api/places/popular?days=7", headers=_auth(owner_tok), timeout=20)
            assert r2.status_code == 200
            items = r2.json()["items"]
            match = next((it for it in items if it["name"] == unique_name), None)
            assert match is not None, f"test place not in popular items"
            assert match["posts"] >= 1
        finally:
            rd = requests.delete(f"{BASE_URL}/api/posts/{post_id}", headers=_auth(owner_tok), timeout=20)
            assert rd.status_code in (200, 204)
