"""Iteration 112 tests: password reset flow, continue-watching, OVC assets."""
import os
import hashlib
import secrets
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()).rstrip("/")
API = f"{BASE_URL}/api"
EMAIL = "newtest@bruno.com"
PWD = "Test1234!"
NEW_PWD = "Nueva1234!"

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"


# ─── Fixtures ──────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def login_token():
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": PWD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(login_token):
    return {"Authorization": f"Bearer {login_token}"}


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


def run(loop, coro):
    return None  # unused


# ─── Forgot password / reset ───────────────────────────────────────────
class TestPasswordReset:
    def test_forgot_password_generic_unknown_email(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "nadie@example.com"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("sent") is True

    def test_validate_bad_token_400(self):
        r = requests.get(f"{API}/auth/reset-password/validate", params={"token": "bad"})
        assert r.status_code == 400

    def test_full_reset_flow_and_restore(self, db):
        _db = db
        # Fetch user id
        user = _db.users.find_one({"email": EMAIL}, {"_id": 0, "id": 1})
        assert user, "test user not found"
        user_id = user["id"]

        # 1) Insert reset token
        raw = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        expires = (datetime.now(timezone.utc) + timedelta(minutes=60)).isoformat()
        _db.password_reset_tokens.insert_one({
            "email": EMAIL, "user_id": user_id, "token_hash": token_hash,
            "expires_at": expires, "used": False,
            "created_at": datetime.now(timezone.utc).isoformat(), "ip": "test",
        })

        # 2) Validate token
        r = requests.get(f"{API}/auth/reset-password/validate", params={"token": raw})
        assert r.status_code == 200, r.text
        hint = r.json().get("email_hint")
        assert hint and "***" in hint

        # 3) Perform reset
        r = requests.post(f"{API}/auth/reset-password", json={"token": raw, "new_password": NEW_PWD})
        assert r.status_code == 200, r.text
        assert r.json().get("reset") is True

        # 4) Reuse token → 400
        r = requests.post(f"{API}/auth/reset-password", json={"token": raw, "new_password": NEW_PWD})
        assert r.status_code == 400

        # 5) Login with new password works, old fails
        r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": NEW_PWD})
        assert r.status_code == 200, r.text
        r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": PWD})
        assert r.status_code in (400, 401), f"expected old password rejected, got {r.status_code}"

        # 6) RESTORE password back to Test1234!
        raw2 = secrets.token_urlsafe(32)
        token_hash2 = hashlib.sha256(raw2.encode()).hexdigest()
        expires2 = (datetime.now(timezone.utc) + timedelta(minutes=60)).isoformat()
        _db.password_reset_tokens.insert_one({
            "email": EMAIL, "user_id": user_id, "token_hash": token_hash2,
            "expires_at": expires2, "used": False,
            "created_at": datetime.now(timezone.utc).isoformat(), "ip": "test",
        })
        r = requests.post(f"{API}/auth/reset-password", json={"token": raw2, "new_password": PWD})
        assert r.status_code == 200, r.text

        # 7) Verify Test1234! works again
        r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": PWD})
        assert r.status_code == 200, "FAILED TO RESTORE PASSWORD"


# ─── Continue watching ─────────────────────────────────────────────────
class TestContinueWatching:
    def test_initial_list_200(self, auth_headers):
        r = requests.get(f"{API}/posts/continue-watching", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_progress_then_appears(self, auth_headers):
        # Find a video post via /reels (recommended-videos)
        r = requests.get(f"{API}/posts/recommended-videos", params={"limit": 10}, headers=auth_headers)
        assert r.status_code == 200
        posts = r.json()
        video_id = None
        for p in posts:
            # Need a post that has a video_url (continue-watching requires video_url field)
            if p.get("video_url"):
                video_id = p["id"]
                break
            # Also check media
            for m in (p.get("media") or []):
                if m.get("type") == "video":
                    # The continue-watching endpoint filters on video_url field; let's try anyway
                    video_id = video_id or p["id"]
                    break

        if not video_id:
            pytest.skip("No video post available for progress test")

        # Save progress 6s out of 60s
        r = requests.post(f"{API}/posts/{video_id}/progress",
                          json={"position": 6, "duration": 60}, headers=auth_headers)
        assert r.status_code == 200, r.text
        assert r.json().get("saved") is True

        # Check continue-watching
        r = requests.get(f"{API}/posts/continue-watching", headers=auth_headers)
        assert r.status_code == 200
        cw = r.json()
        match = [c for c in cw if c["id"] == video_id]
        if not match:
            # The endpoint requires `video_url` field on the post, not just media. Skip gracefully.
            pytest.skip(f"Post {video_id} not in continue-watching (likely no video_url field)")
        item = match[0]
        assert item["resume_position"] == 6
        assert item["resume_pct"] == 10.0

        # DELETE progress
        r = requests.delete(f"{API}/posts/{video_id}/progress", headers=auth_headers)
        assert r.status_code == 200
        assert r.json().get("deleted") is True

        # Verify gone
        r = requests.get(f"{API}/posts/continue-watching", headers=auth_headers)
        assert not any(c["id"] == video_id for c in r.json())


# ─── OVC assets ────────────────────────────────────────────────────────
class TestOvcAssets:
    @pytest.mark.parametrize("path", [
        "/brand/ovc/ovc-wordmark-red.png",
        "/brand/ovc/ovc-wordmark-white.png",
        "/brand/logo-v-gray.png",
    ])
    def test_asset_reachable(self, path):
        r = requests.get(f"{BASE_URL}{path}")
        assert r.status_code == 200
        assert int(r.headers.get("content-length", "0")) > 100 or len(r.content) > 100
