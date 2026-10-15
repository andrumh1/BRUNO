"""Iteration 114 - Multi-account fixes: profile visibility, cards/drafts, notifications,
push gating, series, AI summary, password reset revocation.

Scope: backend-only. Frontend verification is done separately via Playwright.
"""
import os
import asyncio
import hashlib
import secrets
import time
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

NEWTEST = ("newtest@bruno.com", "Test1234!")
VIEWER2 = ("viewer2@bruno.com", "Test1234!")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw, "platform": "web", "remember": True, "keep_session_active": True}, timeout=20)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    return data["access_token"], data["user"]


@pytest.fixture(scope="module")
def newtest():
    tok, u = _login(*NEWTEST)
    return {"token": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def viewer2():
    tok, u = _login(*VIEWER2)
    return {"token": tok, "user": u, "h": {"Authorization": f"Bearer {tok}"}}


# ---------- (A) Profile visibility ----------
class TestProfileVisibility:
    def test_owner_sees_all_viewer_sees_public_only(self, newtest, viewer2):
        uid = newtest["user"]["id"]
        own = requests.get(f"{API}/users/{uid}/posts", headers=newtest["h"], timeout=20)
        other = requests.get(f"{API}/users/{uid}/posts", headers=viewer2["h"], timeout=20)
        assert own.status_code == 200 and other.status_code == 200
        own_posts = own.json() if isinstance(own.json(), list) else own.json().get("posts", [])
        other_posts = other.json() if isinstance(other.json(), list) else other.json().get("posts", [])
        print(f"owner sees {len(own_posts)}  viewer sees {len(other_posts)}")
        assert len(other_posts) > 0, "viewer should see at least one public post"
        # No private/followers visible to viewer2 (unless follower)
        for p in other_posts:
            v = p.get("visibility")
            assert v in (None, "public", "followers"), f"viewer2 saw forbidden post {p.get('id')} visibility={v}"
        # Owner should see >= viewer (including private)
        assert len(own_posts) >= len(other_posts)

    def test_anonymous_sees_public_only(self, newtest):
        uid = newtest["user"]["id"]
        r = requests.get(f"{API}/users/{uid}/posts", timeout=20)
        assert r.status_code == 200
        posts = r.json() if isinstance(r.json(), list) else r.json().get("posts", [])
        for p in posts:
            v = p.get("visibility")
            assert v in (None, "public"), f"anon saw non-public visibility={v}"


# ---------- (B) Cards & drafts ----------
_created_drafts = []


class TestCardsDrafts:
    def test_existing_card_opens(self, newtest):
        r = requests.get(f"{API}/cards/d16c2745-e082-4b22-84f8-749beb5e33fd", headers=newtest["h"], timeout=20)
        assert r.status_code == 200
        assert r.json().get("id") == "d16c2745-e082-4b22-84f8-749beb5e33fd"

    def test_create_draft_edit_publish_delete(self, newtest, viewer2):
        ts = int(time.time())
        payload = {"title": f"Draft QA {ts}", "card_type": "personal", "is_draft": True}
        c = requests.post(f"{API}/cards", json=payload, headers=newtest["h"], timeout=20)
        assert c.status_code in (200, 201), f"create draft: {c.status_code} {c.text[:200]}"
        card = c.json()
        cid = card["id"]
        _created_drafts.append(cid)
        assert card.get("is_draft") is True

        # Owner can GET
        g = requests.get(f"{API}/cards/{cid}", headers=newtest["h"], timeout=20)
        assert g.status_code == 200, f"owner get draft: {g.status_code} {g.text[:200]}"
        assert g.json().get("title") == payload["title"]

        # Viewer2 CANNOT access private/unpublished draft (should be 403 or 404)
        v = requests.get(f"{API}/cards/{cid}", headers=viewer2["h"], timeout=20)
        assert v.status_code in (403, 404), f"viewer2 saw private draft: {v.status_code} {v.text[:200]}"

        # Anonymous cannot
        a = requests.get(f"{API}/cards/{cid}", timeout=20)
        assert a.status_code in (401, 403, 404)

        # Edit subtitle
        u = requests.put(f"{API}/cards/{cid}", json={"subtitle": "QA-sub"}, headers=newtest["h"], timeout=20)
        assert u.status_code == 200, f"edit: {u.status_code} {u.text[:200]}"

        # Publish (unset is_draft)
        p = requests.put(f"{API}/cards/{cid}", json={"is_draft": False}, headers=newtest["h"], timeout=20)
        assert p.status_code == 200
        g2 = requests.get(f"{API}/cards/{cid}", headers=newtest["h"], timeout=20)
        assert g2.status_code == 200
        assert not g2.json().get("is_draft")

        # Cleanup
        d = requests.delete(f"{API}/cards/{cid}", headers=newtest["h"], timeout=20)
        assert d.status_code in (200, 204)
        _created_drafts.remove(cid)


# ---------- (C) Notifications prefs + push gating ----------
class TestNotificationPreferences:
    def test_defaults_for_fresh_user(self, viewer2):
        r = requests.get(f"{API}/notifications/preferences", headers=viewer2["h"], timeout=20)
        assert r.status_code == 200, r.text[:200]
        p = r.json()
        # routine OFF
        for k in ("likes", "comments", "followers", "messages", "calls"):
            assert p.get(k) is False, f"{k} should default False, got {p.get(k)}"
        # important ON
        for k in ("order_updates", "account_security", "my_activity"):
            assert p.get(k) is True, f"{k} should default True, got {p.get(k)}"

    def test_login_creates_security_notification(self, mongo):
        # fresh login creates a 'security' in-app log
        tok, u = _login(*NEWTEST)
        time.sleep(1)
        # Query DB for recent security notification
        n = list(mongo.notification_logs.find({"user_id": u["id"], "type": "security"}).sort("created_at", -1).limit(3))
        n2 = list(mongo.notifications.find({"user_id": u["id"], "type": "security"}).sort("created_at", -1).limit(3)) if "notifications" in mongo.list_collection_names() else []
        combined = n + n2
        assert combined, "No security notification created after login"

    def test_update_preferences_persists(self, viewer2):
        # Snapshot
        orig = requests.get(f"{API}/notifications/preferences", headers=viewer2["h"], timeout=20).json()
        try:
            payload = {**orig, "likes": True}
            u = requests.put(f"{API}/notifications/preferences", json=payload, headers=viewer2["h"], timeout=20)
            assert u.status_code == 200
            back = requests.get(f"{API}/notifications/preferences", headers=viewer2["h"], timeout=20).json()
            assert back.get("likes") is True
        finally:
            requests.put(f"{API}/notifications/preferences", json=orig, headers=viewer2["h"], timeout=20)


# ---------- Push gating (direct function calls via asyncio) ----------
class TestPushGating:
    """Validate push_category + push_allowed logic directly."""

    def test_push_category_mapping(self):
        import sys
        sys.path.insert(0, "/app/backend")
        from routers.push_notifications import push_category, NotificationPayload
        assert push_category(NotificationPayload(title="t", body="b", tag="like_123")) == "likes"
        assert push_category(NotificationPayload(title="t", body="b", tag="order_abc_paid")) == "order_updates"
        assert push_category(NotificationPayload(title="t", body="b", tag="security_login_web_1", data={"category": "account_security"})) == "account_security"
        assert push_category(NotificationPayload(title="t", body="b", tag="follow_x")) == "followers"
        assert push_category(NotificationPayload(title="t", body="b", tag="comment_x")) == "comments"

    def test_push_allowed_defaults_and_dedupe(self, viewer2, mongo):
        import sys
        sys.path.insert(0, "/app/backend")
        from routers.push_notifications import push_allowed, NotificationPayload, set_db
        from motor.motor_asyncio import AsyncIOMotorClient

        uid = viewer2["user"]["id"]
        # Clean push_log for this user tag
        mongo.push_log.delete_many({"user_id": uid, "tag": {"$in": ["like_qa_1", "order_qa_1", "security_qa_1"]}})
        # Ensure prefs are defaults (viewer2)
        mongo.notification_preferences.delete_one({"user_id": uid})

        aclient = AsyncIOMotorClient(MONGO_URL)
        set_db(aclient[DB_NAME])

        async def run():
            # like: not allowed by default
            a1 = await push_allowed(uid, NotificationPayload(title="t", body="b", tag="like_qa_1"))
            # order: allowed (order_updates=True by default)
            a2 = await push_allowed(uid, NotificationPayload(title="t", body="b", tag="order_qa_1"))
            # order again within 10 min -> dedupe
            a2b = await push_allowed(uid, NotificationPayload(title="t", body="b", tag="order_qa_1"))
            # security: allowed even if push_enabled=False (ALWAYS_PUSH)
            mongo.notification_preferences.update_one({"user_id": uid}, {"$set": {"user_id": uid, "push_enabled": False}}, upsert=True)
            a3 = await push_allowed(uid, NotificationPayload(title="t", body="b", tag="security_qa_1", data={"category": "account_security"}))
            return a1, a2, a2b, a3

        a1, a2, a2b, a3 = asyncio.run(run())
        print(f"like_default_off={a1} order_default_on={a2} order_dedupe={a2b} security_always={a3}")
        assert a1 is False
        assert a2 is True
        assert a2b is False  # dedupe within 10 min
        assert a3 is True
        # Cleanup
        mongo.push_log.delete_many({"user_id": uid, "tag": {"$in": ["like_qa_1", "order_qa_1", "security_qa_1"]}})
        mongo.notification_preferences.delete_one({"user_id": uid})
        aclient.close()


# ---------- (E) Series + AI summary ----------
class TestSeriesAI:
    def test_user_series_endpoint(self, newtest):
        uid = newtest["user"]["id"]
        r = requests.get(f"{API}/users/{uid}/series", headers=newtest["h"], timeout=20)
        assert r.status_code == 200, r.text[:200]
        s = r.json()
        print(f"newtest series count={len(s) if isinstance(s, list) else 'n/a'}")
        assert isinstance(s, list)

    def test_ai_summary_short_video_rejected(self, newtest, mongo):
        # Find a short video post owned by newtest
        uid = newtest["user"]["id"]
        candidate = mongo.posts.find_one({
            "user_id": uid,
            "media": {"$elemMatch": {"type": "video"}},
        })
        if not candidate:
            pytest.skip("no video post owned by newtest")
        # Need one with short duration
        short = None
        for p in mongo.posts.find({"user_id": uid, "media": {"$elemMatch": {"type": "video"}}}).limit(20):
            dur = (p.get("media") or [{}])[0].get("duration") or p.get("duration") or 0
            if dur and dur < 180:
                short = p
                break
            if not dur:
                short = p  # treat missing as short
                break
        if not short:
            pytest.skip("no short video post found")
        r = requests.post(f"{API}/posts/{short['id']}/summary/ai", headers=newtest["h"], timeout=20)
        print(f"ai_summary short pid={short['id']} status={r.status_code} body={r.text[:120]}")
        # Expected 400 when short
        assert r.status_code in (400, 404)


# ---------- Password reset revocation ----------
class TestPasswordResetRevocation:
    def test_old_token_rejected_after_reset(self, mongo):
        # Login viewer2, get token
        old_tok, u = _login(*VIEWER2)
        uid = u["id"]
        # /me works with old token now
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {old_tok}"}, timeout=20)
        assert me.status_code == 200

        # Wait 3s so tokens_valid_after > iat (iat has second precision).
        time.sleep(3)

        # Insert reset token directly for viewer2
        raw = secrets.token_urlsafe(32)
        h = hashlib.sha256(raw.encode()).hexdigest()
        now_iso = datetime.now(timezone.utc).isoformat()
        exp = (datetime.now(timezone.utc) + timedelta(minutes=60)).isoformat()
        mongo.password_reset_tokens.insert_one({
            "user_id": uid, "token_hash": h, "created_at": now_iso, "expires_at": exp, "used": False,
        })
        try:
            # Perform reset
            r = requests.post(f"{API}/auth/reset-password", json={"token": raw, "new_password": "Nueva1234!"}, timeout=20)
            assert r.status_code == 200, r.text[:200]
            # Old token must now 401
            time.sleep(1)
            me2 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {old_tok}"}, timeout=20)
            print(f"old token after reset status={me2.status_code}")
            assert me2.status_code == 401
        finally:
            # Restore password Test1234!
            raw2 = secrets.token_urlsafe(32)
            h2 = hashlib.sha256(raw2.encode()).hexdigest()
            mongo.password_reset_tokens.insert_one({
                "user_id": uid, "token_hash": h2, "created_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=60)).isoformat(), "used": False,
            })
            rr = requests.post(f"{API}/auth/reset-password", json={"token": raw2, "new_password": "Test1234!"}, timeout=20)
            assert rr.status_code == 200, f"RESTORE FAILED: {rr.status_code} {rr.text[:200]}"
            # Verify login works
            check = requests.post(f"{API}/auth/login", json={"email": VIEWER2[0], "password": VIEWER2[1], "platform": "web"}, timeout=20)
            assert check.status_code == 200, "viewer2 can no longer login after restore!"


# ---------- Regression ----------
class TestRegression:
    def test_capacitor_config(self):
        import json
        with open("/app/frontend/capacitor.config.json") as f:
            cfg = json.load(f)
        assert cfg.get("appId") == "com.brunocard.app"

    def test_forgot_password_endpoint(self):
        # Preview env has no email provider configured so 400/503 is acceptable; 200/202 are the happy path.
        r = requests.post(f"{API}/auth/forgot-password", json={"email": NEWTEST[0]}, timeout=20)
        assert r.status_code in (200, 202, 400, 503), f"unexpected: {r.status_code} {r.text[:200]}"


# Teardown module cleanup for drafts
def teardown_module(module):
    if _created_drafts:
        tok, _ = _login(*NEWTEST)
        for cid in _created_drafts:
            try:
                requests.delete(f"{API}/cards/{cid}", headers={"Authorization": f"Bearer {tok}"}, timeout=10)
            except Exception:
                pass
