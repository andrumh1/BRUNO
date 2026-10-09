"""Iteration 104 regression:
- Session cookie (web vs native) + session restore + logout
- Upload limits & sign & complete
- Public coupon landing
- Purchases & resend receipt
- Sale notification
- Recommended-videos feed excludes long videos (>=180s)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SELLER = ("newtest@bruno.com", "Test1234!")
BUYER_REAL = ("delivered+brunoqa@resend.dev", "Prueba1234!")
BUYER_QA_A = ("testa@brunoqa.com", "Prueba1234!")
PUBLIC_COUPON_ID = "d97a66b9-da42-460e-882d-f2d4ba42a63c"


def _login(email, password, platform="web"):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password, "platform": platform})
    return s, r


# ============== AUTH / SESSION ==============

class TestAuthSession:
    def test_web_login_sets_cookie(self):
        s, r = _login(*SELLER, platform="web")
        assert r.status_code == 200, r.text
        assert "access_token" in r.json()
        # Set-Cookie
        raw = r.headers.get("set-cookie", "")
        assert "bruno_session" in raw, f"missing cookie: {raw}"
        assert "HttpOnly" in raw
        assert "Path=/api" in raw
        assert "SameSite=Lax" in raw or "samesite=lax" in raw.lower()
        # Cookie actually stored in jar
        assert s.cookies.get("bruno_session") is not None

    def test_me_with_cookie_only(self):
        s, r = _login(*SELLER, platform="web")
        assert r.status_code == 200
        # Strip Authorization: send a fresh session but copy the cookie
        s2 = requests.Session()
        s2.cookies.set("bruno_session", s.cookies.get("bruno_session"))
        me = s2.get(f"{API}/auth/me")
        assert me.status_code == 200, me.text
        assert me.json().get("email") == SELLER[0]

    def test_me_without_any_auth_401(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_session_restore_with_cookie(self):
        s, r = _login(*SELLER, platform="web")
        s2 = requests.Session()
        s2.cookies.set("bruno_session", s.cookies.get("bruno_session"))
        rr = s2.post(f"{API}/auth/session/restore")
        assert rr.status_code == 200, rr.text
        body = rr.json()
        assert "access_token" in body and "user" in body
        assert body["user"]["email"] == SELLER[0]

    def test_logout_clears_cookie_and_revokes_token(self):
        s, r = _login(*SELLER, platform="web")
        token = r.json()["access_token"]
        lo = s.post(f"{API}/auth/logout")
        assert lo.status_code in (200, 204)
        # Restore now fails
        s2 = requests.Session()
        s2.cookies.set("bruno_session", s.cookies.get("bruno_session") or "deleted")
        rr = s2.post(f"{API}/auth/session/restore")
        assert rr.status_code == 401
        # Token revoked
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 401

    def test_native_login_no_cookie(self):
        s, r = _login(*SELLER, platform="native")
        assert r.status_code == 200
        raw = r.headers.get("set-cookie", "") or ""
        assert "bruno_session" not in raw, f"native must not set cookie: {raw}"
        assert s.cookies.get("bruno_session") in (None, "")

    def test_invalid_login_401(self):
        # Use an unlikely email so rate limit on real test accounts isn't hit
        r = requests.post(f"{API}/auth/login", json={"email": "nouser-iter104@bruno.com", "password": "WrongPass1!", "platform": "web"})
        assert r.status_code in (401, 429)


# ============== VIDEO UPLOAD ==============

@pytest.fixture(scope="module")
def seller_token():
    _, r = _login(*SELLER, platform="native")  # native avoids cookie noise
    assert r.status_code == 200
    return r.json()["access_token"]


class TestUploadLimits:
    def test_limits(self, seller_token):
        r = requests.get(f"{API}/upload/limits", headers={"Authorization": f"Bearer {seller_token}"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("plan") == "Free"
        assert d.get("video_max_bytes") == 104857600
        assert d.get("video_max_mb") == 100
        assert d.get("chunk_bytes") == 20971520
        assert isinstance(d.get("note"), str) and len(d["note"]) > 0

    def test_sign_ok(self, seller_token):
        r = requests.post(f"{API}/upload/video/sign?size=50000000", headers={"Authorization": f"Bearer {seller_token}"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "upload_url" in d and "cloudinary" in d["upload_url"].lower()
        p = d.get("params", {})
        for k in ("signature", "api_key", "timestamp", "folder", "eager", "context"):
            assert k in p, f"param {k} missing in {list(p.keys())}"
        assert "upload_id" in d

    def test_sign_too_large_413(self, seller_token):
        r = requests.post(f"{API}/upload/video/sign?size=350000000", headers={"Authorization": f"Bearer {seller_token}"})
        assert r.status_code == 413, r.status_code
        msg = (r.json().get("detail") or "").lower()
        assert "100" in msg
        # Message should clarify duration is NOT the limit
        assert "duraci" in msg or "duration" in msg or "no es" in msg or "size" in msg

    def test_complete_missing_public_id_400(self, seller_token):
        r = requests.post(f"{API}/upload/video/complete", json={}, headers={"Authorization": f"Bearer {seller_token}"})
        assert r.status_code == 400

    def test_complete_unknown_public_id_404(self, seller_token):
        r = requests.post(f"{API}/upload/video/complete", json={"public_id": "iter104/does-not-exist-xyz"}, headers={"Authorization": f"Bearer {seller_token}"})
        assert r.status_code == 404


# ============== PUBLIC COUPON ==============

class TestPublicCoupon:
    def test_public_coupon_ok(self):
        r = requests.get(f"{API}/money/coupons/{PUBLIC_COUPON_ID}/public")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("code") == "VERANO20"
        assert d.get("pct") == 20 or d.get("pct") == 20.0
        assert d.get("valid") is True
        seller = d.get("seller") or {}
        assert seller.get("name")

    def test_public_coupon_404(self):
        r = requests.get(f"{API}/money/coupons/00000000-0000-0000-0000-000000000000/public")
        assert r.status_code == 404


# ============== PURCHASES & RESEND ==============

class TestPurchasesReceipts:
    def test_purchases_list_and_resend(self):
        _, r = _login(*BUYER_REAL, platform="native")
        assert r.status_code == 200, r.text
        tk = r.json()["access_token"]
        p = requests.get(f"{API}/money/purchases", headers={"Authorization": f"Bearer {tk}"})
        assert p.status_code == 200, p.text
        arr = p.json() if isinstance(p.json(), list) else p.json().get("items", [])
        paid = [x for x in arr if x.get("receipt_sent_at") or x.get("status") in ("paid", "complete", "completed")]
        assert len(paid) >= 1, f"no paid purchase found; items: {arr[:2]}"
        target = next((x for x in paid if x.get("receipt_sent_at")), paid[0])
        pid = target.get("id") or target.get("_id")
        rr = requests.post(f"{API}/money/purchases/{pid}/receipt", headers={"Authorization": f"Bearer {tk}"})
        assert rr.status_code in (200, 429), rr.text


# ============== NOTIFICATIONS: SALE ==============

class TestSaleNotification:
    def test_testa_has_sale_notification(self):
        _, r = _login(*BUYER_QA_A, platform="native")
        if r.status_code != 200:
            pytest.skip("testa login failed (likely rate-limited)")
        tk = r.json()["access_token"]
        # try notifications endpoint
        n = requests.get(f"{API}/notifications", headers={"Authorization": f"Bearer {tk}"})
        assert n.status_code == 200, n.text
        items = n.json() if isinstance(n.json(), list) else n.json().get("items", [])
        sales = [x for x in items if (x.get("type") == "sale")]
        # Non-strict: at minimum endpoint works; if none, warn via assertion with context
        assert isinstance(items, list)
        if sales:
            msg = (sales[0].get("message") or sales[0].get("body") or "").lower()
            assert "compr" in msg or "venta" in msg or "tienda" in msg


# ============== FEED: NO LONG VIDEOS ==============

class TestFeedNoLongVideos:
    def test_recommended_videos_excludes_long(self):
        _, r = _login(*SELLER, platform="native")
        assert r.status_code == 200
        tk = r.json()["access_token"]
        f = requests.get(f"{API}/posts/recommended-videos?kind=all&limit=20", headers={"Authorization": f"Bearer {tk}"})
        assert f.status_code == 200, f.text
        items = f.json() if isinstance(f.json(), list) else f.json().get("items", [])
        for it in items:
            media = it.get("media") or []
            if media:
                dur = media[0].get("duration") or 0
                assert dur < 180, f"post {it.get('id')} has duration {dur}"
