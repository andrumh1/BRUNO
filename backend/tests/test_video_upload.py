"""Backend tests for the video upload fix (embedded-null-byte bug).

Covers:
- POST /api/upload/chat-file with real >10MB mp4
- iOS simulation: application/octet-stream + .MOV filename
- 413 for >100MB
- POST /api/upload/image with video (43MB, octet-stream, .mov)
- POST /api/posts + cross-user visibility (feed / recommended / profile)
- Cloudinary derivative fetchability
"""
import os
import time
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

AUTHOR = ("newtest@bruno.com", "Test1234!")
VIEWER = ("viewer2@bruno.com", "Test1234!")

MID = "/tmp/mid.mp4"      # 43MB
SAMPLE = "/tmp/sample.mp4"  # 43MB (copy)
BIG = "/tmp/big.mp4"      # 130MB


def _login(email, pwd):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text[:200]}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def author_token():
    return _login(*AUTHOR)


@pytest.fixture(scope="session")
def viewer_token():
    return _login(*VIEWER)


@pytest.fixture(scope="session")
def author_id(author_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {author_token}"}, timeout=15)
    assert r.status_code == 200
    return r.json().get("id")


# ---------- Uploads ----------

def _upload(path, token, endpoint, filename=None, content_type="video/mp4"):
    with open(path, "rb") as f:
        files = {"file": (filename or os.path.basename(path), f, content_type)}
        return requests.post(
            f"{API}/upload/{endpoint}", files=files,
            headers={"Authorization": f"Bearer {token}"}, timeout=180,
        )


def test_chat_file_big_mp4(author_token):
    r = _upload(MID, author_token, "chat-file")
    assert r.status_code == 200, r.text[:500]
    d = r.json()
    for k in ("url", "mp4_url", "poster_url", "f_auto_url", "original_url"):
        assert d.get(k), f"missing {k}: {d}"
    assert d["type"] == "video/mp4"
    # duration may be None with eager_async=True; not required.


def test_chat_file_ios_octet_stream_mov(author_token):
    r = _upload(MID, author_token, "chat-file",
                filename="IMG_1234.MOV", content_type="application/octet-stream")
    assert r.status_code == 200, r.text[:500]
    d = r.json()
    assert d["type"] == "video/mp4"
    assert d.get("mp4_url")


def test_image_endpoint_with_video_octet_mov(author_token):
    r = _upload(MID, author_token, "image",
                filename="IMG_1234.mov", content_type="application/octet-stream")
    assert r.status_code == 200, r.text[:500]
    d = r.json()
    assert d.get("resource_type") == "video"
    assert d.get("mp4_url")


def test_chat_file_over_100mb_returns_413(author_token):
    r = _upload(BIG, author_token, "chat-file")
    assert r.status_code == 413, f"got {r.status_code}: {r.text[:300]}"
    detail = r.json().get("detail", "")
    assert "100 MB" in detail or "supera" in detail.lower()


# ---------- Post creation + cross-user visibility ----------

_CREATED = {}


def test_create_post_with_video(author_token, author_id):
    up = _upload(MID, author_token, "chat-file")
    assert up.status_code == 200
    u = up.json()
    payload = {
        "content": "TEST_video_upload iteration_77",
        "post_type": "video",
        "visibility": "public",
        "media": [{
            "type": "video",
            "url": u["url"],
            "mp4_url": u["mp4_url"],
            "poster_url": u["poster_url"],
            "f_auto_url": u["f_auto_url"],
            "original_url": u["original_url"],
        }],
    }
    r = requests.post(f"{API}/posts", json=payload,
                      headers={"Authorization": f"Bearer {author_token}"}, timeout=30)
    assert r.status_code in (200, 201), r.text[:500]
    d = r.json()
    pid = d.get("id") or d.get("_id")
    assert pid
    _CREATED["post_id"] = pid
    _CREATED["author_id"] = author_id
    _CREATED["mp4_url"] = u["mp4_url"]
    _CREATED["poster_url"] = u["poster_url"]


def test_viewer_can_fetch_post_by_id(viewer_token):
    pid = _CREATED.get("post_id")
    assert pid, "prior test must run first"
    r = requests.get(f"{API}/posts/{pid}",
                     headers={"Authorization": f"Bearer {viewer_token}"}, timeout=15)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    media = d.get("media") or []
    assert media and media[0].get("type") == "video"
    for k in ("url", "mp4_url", "poster_url"):
        assert media[0].get(k), f"missing {k} in returned media"


def _has_pid(items, pid):
    for it in items or []:
        if (it.get("id") or it.get("_id")) == pid:
            return True
    return False


def test_viewer_feeds_include_post(viewer_token):
    pid = _CREATED["post_id"]
    author_id = _CREATED["author_id"]
    h = {"Authorization": f"Bearer {viewer_token}"}
    checks = {
        "/posts?limit=40": f"{API}/posts?limit=40",
        "/feed/for-you?limit=40": f"{API}/feed/for-you?limit=40",
        "/posts/recommended-videos?limit=40": f"{API}/posts/recommended-videos?limit=40",
        f"/users/{author_id}/posts": f"{API}/users/{author_id}/posts",
    }
    missing = []
    for name, url in checks.items():
        r = requests.get(url, headers=h, timeout=20)
        if r.status_code != 200:
            missing.append(f"{name}=HTTP{r.status_code}")
            continue
        body = r.json()
        items = body if isinstance(body, list) else (body.get("items") or body.get("posts") or body.get("data") or [])
        if not _has_pid(items, pid):
            missing.append(f"{name} (not in {len(items)} items)")
    assert not missing, f"post {pid} missing from: {missing}"


def test_cloudinary_derivatives_reachable():
    """Poll mp4_url and poster_url up to 60s (eager_async transcoding)."""
    urls = [_CREATED["mp4_url"], _CREATED["poster_url"]]
    deadline = time.time() + 60
    remaining = list(urls)
    last = {}
    while time.time() < deadline and remaining:
        still = []
        for u in remaining:
            try:
                r = requests.get(u, headers={"Range": "bytes=0-1000"}, timeout=15)
                last[u] = r.status_code
                if r.status_code in (200, 206):
                    continue
            except Exception as e:
                last[u] = f"ERR {e}"
            still.append(u)
        remaining = still
        if remaining:
            time.sleep(4)
    assert not remaining, f"derivatives never became fetchable: {last}"
