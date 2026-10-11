"""Iteration 105 — Live state machine, PIN+edad, créditos/gifts, likes, fees.

Covers:
- POST /api/lives (preparing) → /start → /heartbeat → /end
- /cancel preparing; mine/active empty
- Validation: no title (400), card ajena (400)
- Private PIN: access_code returned to host, hidden to viewer, 428 birth, 403 underage, 409 duplicate birth
- PIN brute force: 5 fails → 429 locked; by-code; rotate-code invalidates old
- Credits: /gifts (11 items, 20% fee), /wallet, /gift (sent, balance down, 402 insufficient, 403 on allow_gifts=false, 400 self-gift)
- /host-stats, /summary.money, /earnings fee_pct
- Likes: allow_likes=false → 403; allow_likes=true → hearts_count ≤30
- /money/quote credits
- /money/config → fees 15/20/5

Needs host, viewer, admin creds from /app/memory/test_credentials.md.
"""
import os
import time

import pytest
import requests
from pymongo import MongoClient

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

HOST = ("testb@brunoqa.com", "Prueba1234!")
VIEWER = ("viewer2@bruno.com", "Test1234!")
ADMIN = ("testc@brunoqa.com", "Prueba1234!")

MONGO = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB = MONGO[os.environ.get("DB_NAME", "test_database")]


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _register(email: str, password: str, name: str) -> str:
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": password, "name": name}, timeout=15)
    if r.status_code == 400:
        return _login(email, password)
    assert r.status_code in (200, 201), f"register {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def host_tok():
    return _login(*HOST)


@pytest.fixture(scope="module")
def viewer_tok():
    return _login(*VIEWER)


@pytest.fixture(scope="module")
def host_id(host_tok):
    r = requests.get(f"{API}/auth/me", headers=_h(host_tok), timeout=10)
    return r.json()["id"]


@pytest.fixture(scope="module")
def viewer_id(viewer_tok):
    r = requests.get(f"{API}/auth/me", headers=_h(viewer_tok), timeout=10)
    return r.json()["id"]


# Track lives created for cleanup
_CREATED_LIVES: list[tuple[str, str]] = []  # (live_id, host_token)


def _end_live(live_id: str, tok: str):
    try:
        requests.post(f"{API}/lives/{live_id}/end", headers=_h(tok), timeout=10)
    except Exception:
        pass


def _end_all_active_for_host(tok: str):
    try:
        r = requests.get(f"{API}/lives/mine/active", headers=_h(tok), timeout=10)
        if r.status_code == 200:
            d = r.json()
            if isinstance(d, dict) and d.get("id"):
                _end_live(d["id"], tok)
    except Exception:
        pass


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for lid, tok in _CREATED_LIVES:
        _end_live(lid, tok)


# ─────────────────────────── State machine ───────────────────────────

class TestLiveStateMachine:
    def test_create_without_title_400(self, host_tok):
        r = requests.post(f"{API}/lives", json={"title": ""}, headers=_h(host_tok), timeout=15)
        assert r.status_code == 400, r.text

    def test_create_with_foreign_card_400(self, host_tok):
        r = requests.post(f"{API}/lives", json={"title": "QA", "card_id": "ajena-no-existe"}, headers=_h(host_tok), timeout=15)
        assert r.status_code == 400, r.text

    def test_full_lifecycle(self, host_tok):
        # Create
        r = requests.post(f"{API}/lives", json={"title": "QA iter105"}, headers=_h(host_tok), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        live_id = d["id"]
        _CREATED_LIVES.append((live_id, host_tok))
        assert d["status"] == "preparing", d
        assert d.get("rtc", {}).get("url"), "rtc.url missing"
        assert d.get("rtc", {}).get("token"), "rtc.token missing"

        # NOT listed while preparing
        r = requests.get(f"{API}/lives", timeout=10)
        assert r.status_code == 200
        ids = {x["id"] for x in r.json()}
        assert live_id not in ids, "preparing live should NOT be listed"

        # Start → live
        r = requests.post(f"{API}/lives/{live_id}/start", headers=_h(host_tok), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "live"
        assert r.json().get("started_at")

        # Now listed
        r = requests.get(f"{API}/lives", timeout=10)
        ids = {x["id"] for x in r.json()}
        assert live_id in ids, "live should appear after start"

        # Heartbeat
        r = requests.post(f"{API}/lives/{live_id}/heartbeat", headers=_h(host_tok), timeout=10)
        assert r.status_code == 200 and r.json() == {"alive": True}, r.text

        # End
        r = requests.post(f"{API}/lives/{live_id}/end", headers=_h(host_tok), timeout=15)
        assert r.status_code == 200 and r.json().get("success") is True, r.text

    def test_cancel_preparing(self, host_tok):
        r = requests.post(f"{API}/lives", json={"title": "QA cancel"}, headers=_h(host_tok), timeout=20)
        assert r.status_code == 200, r.text
        live_id = r.json()["id"]
        _CREATED_LIVES.append((live_id, host_tok))
        r = requests.post(f"{API}/lives/{live_id}/cancel", headers=_h(host_tok), timeout=10)
        assert r.status_code == 200 and r.json().get("cancelled") is True, r.text
        r = requests.get(f"{API}/lives/mine/active", headers=_h(host_tok), timeout=10)
        assert r.status_code == 200
        # endpoint returns {} or empty object/null when none
        body = r.json()
        assert body in ({}, None) or body.get("id") is None, f"mine/active not empty: {body}"


# ─────────────────────────── PIN + edad ───────────────────────────

class TestPrivatePinAndAge:
    @pytest.fixture(scope="class")
    def private_live(self, host_tok):
        r = requests.post(f"{API}/lives", json={"title": "P", "is_private": True}, headers=_h(host_tok), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        live_id = d["id"]
        pin = d.get("access_code")
        assert pin and len(pin) == 6, f"PIN missing or wrong length: {pin!r}"
        assert "access_code_hash" not in d, "hash should never leak"
        _CREATED_LIVES.append((live_id, host_tok))
        # start
        r = requests.post(f"{API}/lives/{live_id}/start", headers=_h(host_tok), timeout=15)
        assert r.status_code == 200
        return {"id": live_id, "pin": pin, "host_tok": host_tok}

    def test_viewer_sees_no_access_code(self, private_live, viewer_tok):
        r = requests.get(f"{API}/lives/{private_live['id']}", headers=_h(viewer_tok), timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("requires_code") is True
        assert d.get("adults_only") is True
        assert "access_code" not in d
        assert "access_code_hash" not in d

    def test_new_user_birth_date_flow(self, private_live):
        email = f"minor+{int(time.time())}@brunoqa.com"
        tok = _register(email, "Prueba1234!", "Minor QA")
        # No birth_date → 428
        r = requests.post(f"{API}/lives/{private_live['id']}/join", json={"access_code": private_live["pin"]}, headers=_h(tok), timeout=10)
        assert r.status_code == 428, f"expected 428, got {r.status_code} {r.text}"
        det = r.json().get("detail")
        assert isinstance(det, dict) and det.get("code") == "birth_date_required", det
        # Set minor DOB
        r = requests.post(f"{API}/users/me/birth-date", json={"birth_date": "2012-01-01"}, headers=_h(tok), timeout=10)
        assert r.status_code == 200 and r.json().get("is_adult") is False, r.text
        # Join → 403 underage
        r = requests.post(f"{API}/lives/{private_live['id']}/join", json={"access_code": private_live["pin"]}, headers=_h(tok), timeout=10)
        assert r.status_code == 403, r.text
        det = r.json().get("detail")
        assert isinstance(det, dict) and det.get("code") == "underage", det
        # Try changing DOB → 409
        r = requests.post(f"{API}/users/me/birth-date", json={"birth_date": "1990-05-05"}, headers=_h(tok), timeout=10)
        assert r.status_code == 409, r.text

    def test_pin_bruteforce_lock(self, private_live, viewer_tok, viewer_id):
        lid = private_live["id"]
        # cleanup previous attempts for a clean count
        DB.pin_attempts.delete_many({"live_id": lid, "user_id": viewer_id})
        DB.live_access.delete_many({"live_id": lid, "user_id": viewer_id})
        for i in range(5):
            r = requests.post(f"{API}/lives/{lid}/join", json={"access_code": "WRONG0"}, headers=_h(viewer_tok), timeout=10)
            assert r.status_code == 403, f"attempt {i}: {r.status_code} {r.text}"
            det = r.json().get("detail")
            assert isinstance(det, dict) and det.get("code") == "pin_invalid", det
        # 6th → locked
        r = requests.post(f"{API}/lives/{lid}/join", json={"access_code": "WRONG0"}, headers=_h(viewer_tok), timeout=10)
        assert r.status_code == 429, f"expected 429 lock, got {r.status_code} {r.text}"
        det = r.json().get("detail")
        assert isinstance(det, dict) and det.get("code") == "pin_locked", det
        # Reset lock and use correct PIN
        DB.pin_attempts.delete_many({"live_id": lid, "user_id": viewer_id})
        r = requests.post(f"{API}/lives/{lid}/join", json={"access_code": private_live["pin"]}, headers=_h(viewer_tok), timeout=10)
        assert r.status_code == 200, r.text
        assert r.json().get("rtc", {}).get("url"), "rtc missing after correct PIN"
        # Second join without PIN → persistent access
        r = requests.post(f"{API}/lives/{lid}/join", json={}, headers=_h(viewer_tok), timeout=10)
        assert r.status_code == 200, f"persistent access failed: {r.text}"

    def test_by_code_and_rotate(self, private_live):
        pin = private_live["pin"]
        r = requests.get(f"{API}/lives/by-code/{pin}", timeout=10)
        assert r.status_code == 200 and r.json().get("id") == private_live["id"], r.text
        # rotate
        r = requests.post(f"{API}/lives/{private_live['id']}/rotate-code", headers=_h(private_live["host_tok"]), timeout=10)
        assert r.status_code == 200, r.text
        new_pin = r.json().get("access_code")
        assert new_pin and new_pin != pin
        # old pin → 404
        r = requests.get(f"{API}/lives/by-code/{pin}", timeout=10)
        assert r.status_code == 404, r.text
        # new pin → 200
        r = requests.get(f"{API}/lives/by-code/{new_pin}", timeout=10)
        assert r.status_code == 200, r.text


# ─────────────────────────── Credits / gifts ───────────────────────────

class TestCreditsAndGifts:
    def test_gift_catalog(self):
        r = requests.get(f"{API}/credits/gifts", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d.get("gifts", [])) == 11, f"expected 11 gifts, got {len(d.get('gifts', []))}"
        assert float(d.get("bruno_fee_pct", 0)) == 20.0, d.get("bruno_fee_pct")

    def test_wallet(self, viewer_tok):
        r = requests.get(f"{API}/credits/wallet", headers=_h(viewer_tok), timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "balance_minor" in d
        assert d.get("currency") == "usd"

    @pytest.fixture(scope="class")
    def active_live(self, host_tok):
        _end_all_active_for_host(host_tok)
        r = requests.post(f"{API}/lives", json={"title": "GiftsQA"}, headers=_h(host_tok), timeout=20)
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        _CREATED_LIVES.append((lid, host_tok))
        requests.post(f"{API}/lives/{lid}/start", headers=_h(host_tok), timeout=15)
        return {"id": lid, "host_tok": host_tok}

    def test_self_gift_rejected(self, active_live):
        r = requests.post(f"{API}/credits/gift", json={"live_id": active_live["id"], "gift_id": "heart", "quantity": 1},
                          headers=_h(active_live["host_tok"]), timeout=10)
        assert r.status_code == 400, r.text

    def test_send_heart_gift_and_insufficient(self, active_live, viewer_tok, viewer_id, host_id):
        lid = active_live["id"]
        # Ensure viewer has access to private? This live is public so no gate.
        # First get wallet
        w0 = requests.get(f"{API}/credits/wallet", headers=_h(viewer_tok), timeout=10).json()
        bal0 = int(w0["balance_minor"])
        if bal0 < 100:
            # Top up directly via DB for testing
            DB.credit_wallets.update_one({"user_id": viewer_id}, {"$set": {"balance_minor": 60000}}, upsert=True)
            bal0 = 60000
        r = requests.post(f"{API}/credits/gift", json={"live_id": lid, "gift_id": "heart", "quantity": 2},
                          headers=_h(viewer_tok), timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("sent") is True
        assert d.get("total_minor") == 100, d  # heart = 50, qty 2 = 100
        w1 = requests.get(f"{API}/credits/wallet", headers=_h(viewer_tok), timeout=10).json()
        assert int(w1["balance_minor"]) == bal0 - 100, (bal0, w1["balance_minor"])

        # Insufficient: set balance low, try rocket (5000)
        DB.credit_wallets.update_one({"user_id": viewer_id}, {"$set": {"balance_minor": 100}})
        r = requests.post(f"{API}/credits/gift", json={"live_id": lid, "gift_id": "rocket", "quantity": 1},
                          headers=_h(viewer_tok), timeout=10)
        assert r.status_code == 402, r.text
        det = r.json().get("detail")
        assert isinstance(det, dict) and det.get("code") == "credits_required", det
        assert "balance_minor" in det and "needed_minor" in det
        # restore balance a bit
        DB.credit_wallets.update_one({"user_id": viewer_id}, {"$set": {"balance_minor": 60000}})

    def test_gift_disabled_live_403(self, host_tok, viewer_tok, viewer_id):
        _end_all_active_for_host(host_tok)
        r = requests.post(f"{API}/lives", json={"title": "NoGifts", "allow_gifts": False}, headers=_h(host_tok), timeout=20)
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        _CREATED_LIVES.append((lid, host_tok))
        requests.post(f"{API}/lives/{lid}/start", headers=_h(host_tok), timeout=15)
        DB.credit_wallets.update_one({"user_id": viewer_id}, {"$set": {"balance_minor": 60000}}, upsert=True)
        r = requests.post(f"{API}/credits/gift", json={"live_id": lid, "gift_id": "heart", "quantity": 1},
                          headers=_h(viewer_tok), timeout=10)
        assert r.status_code == 403, r.text
        requests.post(f"{API}/lives/{lid}/end", headers=_h(host_tok), timeout=10)

    def test_host_stats_access(self, active_live, viewer_tok):
        lid = active_live["id"]
        # viewer forbidden
        r = requests.get(f"{API}/lives/{lid}/host-stats", headers=_h(viewer_tok), timeout=10)
        assert r.status_code == 403, r.text
        # host OK
        r = requests.get(f"{API}/lives/{lid}/host-stats", headers=_h(active_live["host_tok"]), timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "gifts" in d and set(["gross", "fee", "net"]).issubset(d["gifts"].keys()), d
        assert "estimated_pending_minor" in d

    def test_summary_money_and_earnings(self, active_live):
        lid = active_live["id"]
        r = requests.get(f"{API}/lives/{lid}/summary", headers=_h(active_live["host_tok"]), timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "money" in d and "gifts_minor" in d["money"], d.get("money")
        # earnings endpoint
        r = requests.get(f"{API}/money/earnings", headers=_h(active_live["host_tok"]), timeout=10)
        assert r.status_code == 200, r.text
        rows = r.json().get("rows") or []
        gift_rows = [x for x in rows if x.get("kind") == "gift" and x.get("ref_id") == lid]
        assert gift_rows, "no gift row in earnings for host"
        assert float(gift_rows[0].get("fee_pct")) == 20.0, gift_rows[0]

    def test_admin_gifts_forbidden_to_viewer(self, viewer_tok):
        r = requests.get(f"{API}/credits/admin/gifts", headers=_h(viewer_tok), timeout=10)
        assert r.status_code == 403, r.text

    def test_money_quote_credits(self, viewer_tok):
        r = requests.post(f"{API}/money/quote", json={"kind": "credits", "ref_id": "none", "option": "c10", "origin_url": f"{BASE}"},
                          headers=_h(viewer_tok), timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert float(d.get("total", 0)) == 10.0, d
        assert d.get("is_platform_sale") is True, d


# ─────────────────────────── Likes ───────────────────────────

class TestLikes:
    def test_likes_disabled_403(self, host_tok, viewer_tok):
        _end_all_active_for_host(host_tok)
        r = requests.post(f"{API}/lives", json={"title": "NoLikes", "allow_likes": False}, headers=_h(host_tok), timeout=20)
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        _CREATED_LIVES.append((lid, host_tok))
        requests.post(f"{API}/lives/{lid}/start", headers=_h(host_tok), timeout=15)
        r = requests.post(f"{API}/lives/{lid}/heart?count=50", headers=_h(viewer_tok), timeout=10)
        assert r.status_code == 403, r.text
        requests.post(f"{API}/lives/{lid}/end", headers=_h(host_tok), timeout=10)

    def test_likes_enabled_cap_30(self, host_tok, viewer_tok):
        _end_all_active_for_host(host_tok)
        r = requests.post(f"{API}/lives", json={"title": "YesLikes"}, headers=_h(host_tok), timeout=20)
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        _CREATED_LIVES.append((lid, host_tok))
        requests.post(f"{API}/lives/{lid}/start", headers=_h(host_tok), timeout=15)
        r = requests.post(f"{API}/lives/{lid}/heart?count=50", headers=_h(viewer_tok), timeout=10)
        assert r.status_code == 200, r.text
        # Verify counter went up by ≤30
        doc = DB.lives.find_one({"id": lid}, {"hearts_count": 1})
        assert 0 < int(doc.get("hearts_count", 0)) <= 30, doc
        requests.post(f"{API}/lives/{lid}/end", headers=_h(host_tok), timeout=10)


# ─────────────────────────── Fees ───────────────────────────

class TestFees:
    def test_config_fees(self):
        # /money/config is public (no auth check in prelude)
        r = requests.get(f"{API}/money/config", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        fees = d.get("fees") or d
        assert float(fees.get("live_ticket_pct")) == 15.0, fees
        assert float(fees.get("gift_pct")) == 20.0, fees
        assert float(fees.get("marketplace_pct")) == 5.0, fees
