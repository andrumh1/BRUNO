"""Iteration 108: Series CRUD, search integration, AI chapters."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

NEWTEST_ID = "b6a3059d-3c5c-4ffd-9fc2-b8dff4a420b9"
LONG_V1 = "12b28791-edff-4be8-875d-f23742f6b758"
LONG_V2 = "bdce489a-6f05-46b3-93c4-a0e70360bd64"
NON_LONG = "not-a-long-video-id"
EXISTING_SERIES_ID = "6ff8761f-215b-423d-a934-d0bd9a017824"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, headers={"X-Platform": "native"}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def owner_token():
    return _login("newtest@bruno.com", "Test1234!")


@pytest.fixture(scope="module")
def viewer_token():
    return _login("viewer2@bruno.com", "Test1234!")


@pytest.fixture(scope="module")
def owner_h(owner_token):
    return {"Authorization": f"Bearer {owner_token}"}


@pytest.fixture(scope="module")
def viewer_h(viewer_token):
    return {"Authorization": f"Bearer {viewer_token}"}


# ───── Series CRUD ─────
class TestSeriesCRUD:
    created_id = None

    def test_create_series(self, owner_h):
        r = requests.post(f"{API}/series", headers=owner_h, json={
            "title": "QA Serie",
            "description": "d",
            "video_ids": [LONG_V1, LONG_V2, NON_LONG],
        }, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["count"] == 2, f"expected count 2, got {data['count']}"
        assert data["total_duration"] == 1020, f"total_duration got {data['total_duration']}"
        assert data["is_owner"] is True
        assert data["owner"]["id"] == NEWTEST_ID
        TestSeriesCRUD.created_id = data["id"]

    def test_mine_includes(self, owner_h):
        r = requests.get(f"{API}/series/mine", headers=owner_h, timeout=15)
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert TestSeriesCRUD.created_id in ids

    def test_candidates(self, owner_h):
        r = requests.get(f"{API}/series/candidates", headers=owner_h, timeout=15)
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert LONG_V1 in ids and LONG_V2 in ids

    def test_update_reorder_private(self, owner_h):
        r = requests.put(f"{API}/series/{TestSeriesCRUD.created_id}", headers=owner_h, json={
            "title": "QA Serie 2",
            "video_ids": [LONG_V2, LONG_V1],
            "visibility": "private",
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["title"] == "QA Serie 2"
        assert data["visibility"] == "private"
        assert data["videos"][0]["id"] == LONG_V2
        assert data["videos"][1]["id"] == LONG_V1

    def test_get_private_as_viewer_404(self, viewer_h):
        r = requests.get(f"{API}/series/{TestSeriesCRUD.created_id}", headers=viewer_h, timeout=15)
        assert r.status_code == 404

    def test_set_back_public(self, owner_h, viewer_h):
        r = requests.put(f"{API}/series/{TestSeriesCRUD.created_id}", headers=owner_h, json={
            "title": "QA Serie 2", "visibility": "public"
        }, timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/series/{TestSeriesCRUD.created_id}", headers=viewer_h, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["is_owner"] is False

    def test_play_returns_ordered(self, owner_h):
        r = requests.get(f"{API}/series/{TestSeriesCRUD.created_id}/play", headers=owner_h, timeout=15)
        assert r.status_code == 200
        posts = r.json()
        assert len(posts) == 2
        for i, p in enumerate(posts):
            assert "series" in p
            assert p["series"]["index"] == i
            assert p["series"]["count"] == 2
            assert p["series"]["id"] == TestSeriesCRUD.created_id
            assert "author" in p

    def test_users_series_as_viewer(self, viewer_h):
        r = requests.get(f"{API}/users/{NEWTEST_ID}/series", headers=viewer_h, timeout=15)
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert TestSeriesCRUD.created_id in ids
        assert EXISTING_SERIES_ID in ids

    def test_update_as_viewer_404(self, viewer_h):
        r = requests.put(f"{API}/series/{TestSeriesCRUD.created_id}", headers=viewer_h, json={"title": "hack"}, timeout=15)
        assert r.status_code == 404

    def test_delete_as_viewer_404(self, viewer_h):
        r = requests.delete(f"{API}/series/{TestSeriesCRUD.created_id}", headers=viewer_h, timeout=15)
        assert r.status_code == 404

    def test_title_validation(self, owner_h):
        r = requests.post(f"{API}/series", headers=owner_h, json={"title": "a"}, timeout=15)
        assert r.status_code == 400

    def test_delete_as_owner(self, owner_h):
        r = requests.delete(f"{API}/series/{TestSeriesCRUD.created_id}", headers=owner_h, timeout=15)
        assert r.status_code == 200
        assert r.json().get("deleted") is True


# ───── Search integration ─────
class TestSearchSeries:
    def test_existing_series_in_search(self):
        r = requests.get(f"{API}/search", params={"q": "curso bruno", "type": "videos"}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        if isinstance(items, dict):
            items = items.get("items") or items.get("results") or []
        found = any(it.get("kind") == "series" and f"/series/{EXISTING_SERIES_ID}" in (it.get("url") or "") for it in items)
        assert found, f"existing series not found. items={items}"

    def test_create_and_search_reindex(self, owner_h):
        unique_title = f"QASeries{int(time.time())}unique"
        r = requests.post(f"{API}/series", headers=owner_h, json={"title": unique_title, "video_ids": [LONG_V1]}, timeout=15)
        assert r.status_code == 200
        sid = r.json()["id"]
        time.sleep(1)
        try:
            r2 = requests.get(f"{API}/search", params={"q": unique_title, "type": "videos"}, timeout=15)
            items = r2.json()
            if isinstance(items, dict):
                items = items.get("items") or items.get("results") or []
            found = any(it.get("kind") == "series" and f"/series/{sid}" in (it.get("url") or "") for it in items)
            assert found, f"newly created series not indexed: items={items}"
        finally:
            # cleanup
            dr = requests.delete(f"{API}/series/{sid}", headers=owner_h, timeout=15)
            assert dr.status_code == 200
        time.sleep(1)
        r3 = requests.get(f"{API}/search", params={"q": unique_title, "type": "videos"}, timeout=15)
        items3 = r3.json()
        if isinstance(items3, dict):
            items3 = items3.get("items") or items3.get("results") or []
        gone = not any(it.get("kind") == "series" and f"/series/{sid}" in (it.get("url") or "") for it in items3)
        assert gone, "series still appears in search after delete"


# ───── AI chapters ─────
class TestAIChapters:
    def test_ai_as_owner(self, owner_h):
        r = requests.post(f"{API}/posts/{LONG_V1}/chapters/ai", headers=owner_h, timeout=120)
        # 200 OR 422 (no speech) both acceptable
        assert r.status_code in (200, 422), f"unexpected status {r.status_code}: {r.text}"
        if r.status_code == 200:
            assert "chapters" in r.json()
        else:
            # 422 should mention voice
            assert "voz" in r.text.lower() or "speech" in r.text.lower()

    def test_ai_as_viewer_404(self, viewer_h):
        r = requests.post(f"{API}/posts/{LONG_V1}/chapters/ai", headers=viewer_h, timeout=30)
        assert r.status_code == 404

    def test_ai_on_short_post(self, owner_h):
        # find any short post owned by newtest
        r = requests.get(f"{API}/posts/feed", headers=owner_h, timeout=15)
        if r.status_code != 200:
            pytest.skip("feed not available")
        posts = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        short_id = None
        for p in posts:
            if p.get("user_id") != NEWTEST_ID:
                continue
            m = (p.get("media") or [{}])[0]
            if m.get("type") == "video" and (m.get("duration") or 0) < 180:
                short_id = p["id"]; break
        if not short_id:
            # try user posts endpoint
            r2 = requests.get(f"{API}/users/{NEWTEST_ID}/posts", headers=owner_h, timeout=15)
            if r2.status_code == 200:
                arr = r2.json() if isinstance(r2.json(), list) else r2.json().get("items", [])
                for p in arr:
                    m = (p.get("media") or [{}])[0]
                    if m.get("type") == "video" and 0 < (m.get("duration") or 0) < 180:
                        short_id = p["id"]; break
        if not short_id:
            pytest.skip("no short video post found to test 400 case")
        r3 = requests.post(f"{API}/posts/{short_id}/chapters/ai", headers=owner_h, timeout=30)
        assert r3.status_code == 400
