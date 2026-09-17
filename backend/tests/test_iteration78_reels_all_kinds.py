"""Iteration 78: Reels feed supports kind=all (text+image+video) and default kind=video."""
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
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _assert_item_shape(item):
    assert isinstance(item, dict)
    assert "id" in item
    assert "user" in item and isinstance(item["user"], dict), f"missing user in {item.get('id')}"
    assert "is_liked" in item
    assert "is_bookmarked" in item
    assert "is_following" in item


def _has_video(item):
    media = item.get("media") or []
    for m in media:
        if (m.get("type") or m.get("media_type") or "").lower() == "video":
            return True
        url = (m.get("url") or "") if isinstance(m, dict) else ""
        if any(url.lower().endswith(ext) for ext in [".mp4", ".mov", ".webm"]):
            return True
    if item.get("video_url"):
        return True
    return False


def _has_image(item):
    media = item.get("media") or []
    for m in media:
        if (m.get("type") or m.get("media_type") or "").lower() == "image":
            return True
    return False


def _is_text_only(item):
    media = item.get("media") or []
    return len(media) == 0 and not item.get("video_url")


def test_recommended_videos_default_only_videos(headers):
    r = requests.get(f"{BASE_URL}/api/posts/recommended-videos?limit=20", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("items") or data.get("posts") or []
    assert len(items) > 0, "expected some videos"
    for it in items:
        _assert_item_shape(it)
        assert _has_video(it), f"default feed should be videos only, got id={it.get('id')} media={it.get('media')}"


def test_recommended_videos_kind_all_mixed(headers):
    r = requests.get(f"{BASE_URL}/api/posts/recommended-videos?kind=all&limit=40", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("items") or data.get("posts") or []
    assert len(items) > 0
    kinds = {"video": 0, "image": 0, "text": 0}
    for it in items:
        _assert_item_shape(it)
        if _has_video(it):
            kinds["video"] += 1
        elif _has_image(it):
            kinds["image"] += 1
        elif _is_text_only(it):
            kinds["text"] += 1
    print("kind counts:", kinds)
    # Expect at least text and (video or image) present
    assert kinds["text"] >= 1, f"expected text-only posts in kind=all, got {kinds}"
    assert (kinds["video"] + kinds["image"]) >= 1, f"expected media posts in kind=all, got {kinds}"


def test_specific_text_post_present(headers):
    """The known text-only post id from the review request should be reachable via posts API."""
    pid = "37ebead0-f5ca-4307-959c-df21f30276d9"
    r = requests.get(f"{BASE_URL}/api/posts/{pid}", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p.get("id") == pid
    assert _is_text_only(p), f"expected text-only post: {p}"


def test_specific_image_post_present(headers):
    pid = "74b0484b-cc9f-41b0-95cb-acf124d8f2db"
    r = requests.get(f"{BASE_URL}/api/posts/{pid}", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p.get("id") == pid
    assert _has_image(p), f"expected image post: media={p.get('media')}"
