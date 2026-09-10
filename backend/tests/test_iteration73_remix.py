"""
Iteration 73 backend tests — Dúo/Stitch Remix on video posts.

Coverage:
- POST /api/posts with remix{type,source_post_id,...} creates a remix post,
  source's remix_count increments (verified via GET /api/posts/{id}).
- Invalid remix.type -> 400.
- Unknown source_post_id -> 404.
- GET /api/posts/{source_id}/remixes returns the new remix hydrated with user
  fields and is_liked/is_bookmarked/is_following.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


def _login(email=TEST_EMAIL, password=TEST_PASSWORD):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def token():
    return _login()


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def source_video(auth_headers):
    """Pick a recommended video that is NOT itself a remix (or fall back)."""
    r = requests.get(
        f"{API}/posts/recommended-videos",
        params={"limit": 10, "mode": "for_you", "seed": 11},
        headers=auth_headers,
        timeout=20,
    )
    assert r.status_code == 200, r.text
    vids = r.json()
    assert vids, "no recommended videos to test remix against"
    # Prefer a non-remix source
    non_remix = [v for v in vids if not v.get("remix")]
    return (non_remix or vids)[0]


class TestRemixCreate:
    def test_invalid_remix_type_returns_400(self, auth_headers, source_video):
        body = {
            "content": f"TEST invalid remix type {uuid.uuid4().hex[:6]}",
            "media": [{"type": "video", "url": "https://example.com/x.mp4"}],
            "post_type": "video",
            "remix": {"type": "badtype", "source_post_id": source_video["id"], "source_start": 0, "source_end": 1},
        }
        r = requests.post(f"{API}/posts", json=body, headers=auth_headers, timeout=15)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"

    def test_unknown_source_returns_404(self, auth_headers):
        body = {
            "content": "TEST unknown source",
            "media": [{"type": "video", "url": "https://example.com/x.mp4"}],
            "post_type": "video",
            "remix": {"type": "duet", "source_post_id": f"nope-{uuid.uuid4().hex}", "source_start": 0, "source_end": 1},
        }
        r = requests.post(f"{API}/posts", json=body, headers=auth_headers, timeout=15)
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"

    def test_create_duet_increments_source_remix_count_and_persists(self, auth_headers, source_video):
        src_id = source_video["id"]
        # snapshot pre-count from single-post endpoint
        pre = requests.get(f"{API}/posts/{src_id}", headers=auth_headers, timeout=15)
        assert pre.status_code == 200, pre.text
        pre_count = pre.json().get("remix_count", 0)

        body = {
            "content": f"TEST duet remix {uuid.uuid4().hex[:6]}",
            "media": [{"type": "video", "url": "https://res.cloudinary.com/dummy/video/upload/sample.mp4"}],
            "post_type": "video",
            "remix": {
                "type": "duet",
                "source_post_id": src_id,
                "source_start": 0.0,
                "source_end": 5.0,
            },
        }
        r = requests.post(f"{API}/posts", json=body, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        created = r.json()
        rmx = created.get("remix")
        assert rmx and rmx["type"] == "duet"
        assert rmx["source_post_id"] == src_id
        assert rmx.get("source_user_id")
        assert rmx.get("source_username")
        assert rmx.get("source_start") == 0.0
        assert rmx.get("source_end") == 5.0

        # verify counter increment
        post = requests.get(f"{API}/posts/{src_id}", headers=auth_headers, timeout=15).json()
        assert post.get("remix_count", 0) == pre_count + 1, (
            f"remix_count did not increment: {pre_count} -> {post.get('remix_count')}"
        )

        # stash for the next test
        pytest.remix_id = created["id"]
        pytest.remix_source_id = src_id

    def test_get_post_remixes_lists_new_remix_hydrated(self, auth_headers):
        src_id = getattr(pytest, "remix_source_id", None)
        remix_id = getattr(pytest, "remix_id", None)
        assert src_id and remix_id, "prior test must have created a remix"
        r = requests.get(f"{API}/posts/{src_id}/remixes", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        remixes = r.json()
        assert isinstance(remixes, list) and len(remixes) >= 1
        ids = [p["id"] for p in remixes]
        assert remix_id in ids, f"newly created remix {remix_id} not in list {ids}"
        item = next(p for p in remixes if p["id"] == remix_id)
        # Hydration
        assert "user" in item and isinstance(item["user"], dict)
        for k in ("id", "name", "username", "avatar_url"):
            assert k in item["user"], f"user missing {k}: {list(item['user'].keys())}"
        for k in ("is_liked", "is_bookmarked", "is_following"):
            assert k in item, f"post missing {k}"
        # Remix metadata preserved
        assert item.get("remix", {}).get("source_post_id") == src_id
        assert item.get("remix", {}).get("type") == "duet"

    def test_get_post_remixes_anonymous_still_works(self):
        src_id = getattr(pytest, "remix_source_id", None)
        assert src_id
        r = requests.get(f"{API}/posts/{src_id}/remixes", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
