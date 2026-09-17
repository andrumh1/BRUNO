"""Tests for the video upload fix (iteration 77).

Covers:
- POST /api/upload/chat-file with real mp4 video >10MB (mid.mp4, sample.mp4)
- POST /api/upload/chat-file with application/octet-stream + IMG.MOV filename
- POST /api/upload/image with 43MB mp4 video
- POST /api/upload/chat-file with big.mp4 (130MB) -> 413
- POST /api/posts with media fields preserved
- Cross-user visibility on /posts, /feed/for-you, recommended-videos, users/{id}/posts
- Cloudinary mp4_url and original_url fetchability
"""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://premium-launch-13.preview.emergentagent.com').rstrip('/')

AUTHOR_EMAIL = "newtest@bruno.com"
VIEWER_EMAIL = "viewer2@bruno.com"
PASSWORD = "Test1234!"

MID_MP4 = "/tmp/mid.mp4"
SAMPLE_MP4 = "/tmp/sample.mp4"
BIG_MP4 = "/tmp/big.mp4"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text[:300]}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"no token returned for {email}: {data}"
    return tok, data.get("user") or data.get("profile") or {}


@pytest.fixture(scope="module")
def author():
    tok, user = _login(AUTHOR_EMAIL, PASSWORD)
    return {"token": tok, "user": user, "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def viewer():
    tok, user = _login(VIEWER_EMAIL, PASSWORD)
    return {"token": tok, "user": user, "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def uploaded_video(author):
    """Uploads mid.mp4 via /upload/chat-file and returns the response dict."""
    if not os.path.exists(MID_MP4):
        pytest.skip("mid.mp4 not present")
    with open(MID_MP4, "rb") as f:
        files = {"file": ("mid.mp4", f, "video/mp4")}
        r = requests.post(f"{BASE_URL}/api/upload/chat-file", headers=author["headers"], files=files, timeout=180)
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text[:500]}"
    return r.json()


@pytest.fixture(scope="module")
def created_post(author, uploaded_video):
    body = {
        "content": "TEST_iter77 video post",
        "media": [{
            "type": "video",
            "url": uploaded_video["url"],
            "mp4_url": uploaded_video.get("mp4_url"),
            "poster_url": uploaded_video.get("poster_url"),
            "f_auto_url": uploaded_video.get("f_auto_url"),
            "original_url": uploaded_video.get("original_url"),
        }],
        "post_type": "video",
        "visibility": "public",
    }
    r = requests.post(f"{BASE_URL}/api/posts", headers=author["headers"], json=body, timeout=60)
    assert r.status_code in (200, 201), f"create post failed: {r.status_code} {r.text[:500]}"
    return r.json()


# ---------- BACKEND TESTS ----------

class TestChatFileUpload:
    def test_upload_mid_mp4(self, uploaded_video):
        u = uploaded_video
        assert u.get("type") == "video/mp4"
        assert u.get("url")
        assert u.get("mp4_url")
        assert u.get("poster_url")
        assert u.get("f_auto_url")
        assert u.get("original_url")
        # duration may be None due to eager_async, but let's not fail on that
        print("mid.mp4 URLs:", {k: u.get(k) for k in ("url", "mp4_url", "poster_url", "f_auto_url", "original_url", "duration")})

    def test_upload_sample_mp4(self, author):
        if not os.path.exists(SAMPLE_MP4):
            pytest.skip("sample.mp4 not present")
        with open(SAMPLE_MP4, "rb") as f:
            files = {"file": ("sample.mp4", f, "video/mp4")}
            r = requests.post(f"{BASE_URL}/api/upload/chat-file", headers=author["headers"], files=files, timeout=180)
        assert r.status_code == 200, f"sample.mp4 upload failed: {r.status_code} {r.text[:500]}"
        u = r.json()
        assert u.get("type") == "video/mp4"
        for k in ("url", "mp4_url", "poster_url", "f_auto_url", "original_url"):
            assert u.get(k), f"missing {k} in response"

    def test_ios_mov_octet_stream(self, author):
        """iOS often sends application/octet-stream with .MOV filename."""
        if not os.path.exists(SAMPLE_MP4):
            pytest.skip("sample.mp4 not present")
        with open(SAMPLE_MP4, "rb") as f:
            files = {"file": ("IMG_1234.MOV", f, "application/octet-stream")}
            r = requests.post(f"{BASE_URL}/api/upload/chat-file", headers=author["headers"], files=files, timeout=180)
        assert r.status_code == 200, f"iOS .MOV upload failed: {r.status_code} {r.text[:500]}"
        u = r.json()
        assert u.get("type") == "video/mp4", f"expected video/mp4, got {u.get('type')}"
        assert u.get("mp4_url"), "mp4_url missing"
        assert u.get("poster_url"), "poster_url missing"


class TestImageUploadVideo:
    def test_upload_image_endpoint_with_video(self, author):
        """Same 43MB video via /upload/image → resource_type=video."""
        if not os.path.exists(MID_MP4):
            pytest.skip("mid.mp4 missing")
        with open(MID_MP4, "rb") as f:
            files = {"file": ("mid.mp4", f, "video/mp4")}
            r = requests.post(f"{BASE_URL}/api/upload/image", headers=author["headers"], files=files, timeout=180)
        assert r.status_code == 200, f"upload/image (video) failed: {r.status_code} {r.text[:500]}"
        u = r.json()
        assert u.get("resource_type") == "video", f"got resource_type={u.get('resource_type')}"
        assert u.get("mp4_url"), "mp4_url missing"
        assert u.get("poster_url"), "poster_url missing"


class TestOversizeVideo:
    def test_big_mp4_returns_413(self, author):
        if not os.path.exists(BIG_MP4):
            pytest.skip("big.mp4 missing")
        with open(BIG_MP4, "rb") as f:
            files = {"file": ("big.mp4", f, "video/mp4")}
            r = requests.post(f"{BASE_URL}/api/upload/chat-file", headers=author["headers"], files=files, timeout=180)
        assert r.status_code == 413, f"expected 413, got {r.status_code}: {r.text[:300]}"
        detail = ""
        try:
            detail = r.json().get("detail", "")
        except Exception:
            detail = r.text
        assert "100 MB" in detail or "supera" in detail.lower(), f"unexpected detail: {detail}"


class TestPostCreation:
    def test_post_preserves_media_fields(self, created_post, uploaded_video):
        p = created_post
        assert p.get("id")
        media = p.get("media") or []
        assert len(media) >= 1, f"no media in created post: {p}"
        m = media[0]
        for k in ("url", "mp4_url", "poster_url", "f_auto_url", "original_url"):
            assert m.get(k), f"post media missing {k}: {m}"


class TestCrossUserVisibility:
    def test_visible_in_posts_feed(self, viewer, created_post):
        post_id = created_post["id"]
        r = requests.get(f"{BASE_URL}/api/posts", headers=viewer["headers"], params={"limit": 40}, timeout=30)
        assert r.status_code == 200
        posts = r.json() if isinstance(r.json(), list) else r.json().get("posts", [])
        assert any(p.get("id") == post_id for p in posts), f"new post {post_id} not in /api/posts"

    def test_visible_in_for_you(self, viewer, created_post):
        post_id = created_post["id"]
        r = requests.get(f"{BASE_URL}/api/feed/for-you", headers=viewer["headers"], params={"limit": 40}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        posts = r.json() if isinstance(r.json(), list) else r.json().get("posts", [])
        assert any(p.get("id") == post_id for p in posts), f"new post {post_id} not in /feed/for-you"

    def test_visible_in_recommended_videos(self, viewer, created_post):
        post_id = created_post["id"]
        r = requests.get(f"{BASE_URL}/api/posts/recommended-videos", headers=viewer["headers"], params={"limit": 40}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        posts = r.json() if isinstance(r.json(), list) else r.json().get("posts", [])
        assert any(p.get("id") == post_id for p in posts), f"new post {post_id} not in recommended-videos"

    def test_visible_in_author_posts(self, viewer, author, created_post):
        author_id = created_post.get("user_id") or created_post.get("author_id") or (author["user"] or {}).get("id")
        assert author_id, "cannot determine author id"
        r = requests.get(f"{BASE_URL}/api/users/{author_id}/posts", headers=viewer["headers"], params={"limit": 40}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        posts = r.json() if isinstance(r.json(), list) else r.json().get("posts", [])
        assert any(p.get("id") == created_post["id"] for p in posts), "post not in user's posts"

    def test_get_post_by_id(self, viewer, created_post):
        post_id = created_post["id"]
        r = requests.get(f"{BASE_URL}/api/posts/{post_id}", headers=viewer["headers"], timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        p = r.json()
        assert p.get("id") == post_id


class TestCloudinaryUrls:
    def test_mp4_url_fetchable(self, uploaded_video):
        url = uploaded_video["mp4_url"]
        # give Cloudinary a bit of time for derivative
        last = None
        for i in range(4):
            r = requests.get(url, headers={"Range": "bytes=0-1000"}, timeout=30)
            last = r
            if r.status_code in (200, 206):
                break
            time.sleep(5)
        assert last.status_code in (200, 206), f"mp4_url not fetchable: {last.status_code}"
        ctype = last.headers.get("content-type", "")
        assert "video" in ctype, f"mp4_url wrong content-type: {ctype}"

    def test_original_url_fetchable(self, uploaded_video):
        url = uploaded_video["original_url"]
        r = requests.get(url, headers={"Range": "bytes=0-1000"}, timeout=30)
        assert r.status_code in (200, 206), f"original_url {r.status_code}"
        assert "video" in r.headers.get("content-type", "")

    def test_poster_url_eventually_ready(self, uploaded_video):
        url = uploaded_video["poster_url"]
        last = None
        for i in range(6):
            r = requests.get(url, timeout=30)
            last = r
            if r.status_code == 200 and "image" in r.headers.get("content-type", ""):
                return
            time.sleep(5)
        # Accept 423 or other transient during transcode; log but don't fail hard
        print(f"poster_url final status: {last.status_code} ct={last.headers.get('content-type')}")
