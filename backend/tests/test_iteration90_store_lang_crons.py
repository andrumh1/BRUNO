"""Iteration 90: Store PIUP catalog + plans, translate language preference, poll reminders cron, daily digest cron."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for tests run from backend dir
    from dotenv import dotenv_values
    v = dotenv_values("/app/frontend/.env")
    BASE_URL = (v.get("REACT_APP_BACKEND_URL") or "").rstrip("/")

# Read cron secret from backend .env
from dotenv import dotenv_values as _dv
_be = _dv("/app/backend/.env")
CRON_SECRET = _be.get("WEBHOOK_CRON_SECRET") or os.environ.get("WEBHOOK_CRON_SECRET")

NEWTEST = {"email": "newtest@bruno.com", "password": "Test1234!"}
VIEWER2 = {"email": "viewer2@bruno.com", "password": "Test1234!"}
GROUP_ID = "655d23d2-b133-4188-a95c-bd8a777c04f4"


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def tok_newtest():
    return _login(NEWTEST)


@pytest.fixture(scope="module")
def tok_viewer2():
    return _login(VIEWER2)


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ── STORE / PIUP catalog ────────────────────────────────────────────────────
class TestStore:
    def test_products_catalog(self):
        r = requests.get(f"{BASE_URL}/api/store/products", timeout=15)
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list)
        assert len(products) == 19, f"expected 19 got {len(products)}"
        groups = {}
        for p in products:
            groups.setdefault(p["group"], 0)
            groups[p["group"]] += 1
            assert "sizes" in p and isinstance(p["sizes"], list) and len(p["sizes"]) > 0
            assert "size_options" in p and len(p["size_options"]) == len(p["sizes"])
            for so in p["size_options"]:
                assert "code" in so and "shape" in so and "dims" in so and "price" in so
            assert p["options_count"] == len(p["sizes"])
        assert groups.get("hogar") == 5, groups
        assert groups.get("comercios") == 3, groups
        assert groups.get("oficinas") == 10, groups
        assert groups.get("mascotas") == 1, groups

    def test_specific_products_sizes(self):
        r = requests.get(f"{BASE_URL}/api/store/products", timeout=15).json()
        by_id = {p["id"]: p for p in r}
        assert by_id["piup-wifi"]["sizes"] == ["C1", "C2", "U1", "U2", "R7"]
        assert by_id["piup-tarjetas"]["sizes"] == ["R7"]

    def test_products_group_filter(self):
        # backend endpoint filters by 'category' not 'group', but request says ?group=hogar
        r = requests.get(f"{BASE_URL}/api/store/products", params={"group": "hogar"}, timeout=15)
        assert r.status_code == 200
        products = r.json()
        # If filter works, all should be hogar. If ignored, will be 19.
        hogar_products = [p for p in products if p["group"] == "hogar"]
        assert len(hogar_products) == 5
        # Check whether filter actually filtered
        if len(products) != 5:
            pytest.fail(f"?group=hogar did not filter; returned {len(products)} products (expected 5)")

    def test_single_product(self):
        r = requests.get(f"{BASE_URL}/api/store/products/piup-menu", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == "piup-menu"

    def test_sizes(self):
        r = requests.get(f"{BASE_URL}/api/store/sizes", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data["sizes"]) == 11
        assert len(data["groups"]) == 4

    def test_plans(self):
        r = requests.get(f"{BASE_URL}/api/store/plans", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 2
        brands = {b["brand"]: b for b in data}
        assert "MEOW" in brands and "DEAL" in brands
        meow = {p["name"]: p for p in brands["MEOW"]["plans"]}
        assert meow["Starter"]["monthly"] == 15 and meow["Starter"]["yearly"] == 150
        assert meow["Growth"]["monthly"] == 29 and meow["Growth"]["yearly"] == 290
        assert meow["Pro"]["monthly"] == 49 and meow["Pro"]["yearly"] == 490
        assert meow["Business"]["monthly"] == 79 and meow["Business"]["yearly"] == 790
        deal = {p["name"]: p for p in brands["DEAL"]["plans"]}
        assert deal["Starter"]["monthly"] == 39 and deal["Starter"]["yearly"] == 390
        assert deal["Professional"]["monthly"] == 79 and deal["Professional"]["yearly"] == 790
        assert deal["Business"]["monthly"] == 149 and deal["Business"]["yearly"] == 1490
        assert deal["Enterprise"]["monthly"] == 249 and deal["Enterprise"]["yearly"] == 2490


# ── Language preference ─────────────────────────────────────────────────────
class TestLanguagePreference:
    def test_put_and_get_language(self, tok_newtest):
        r = requests.put(f"{BASE_URL}/api/settings/preferences", json={"language": "en"}, headers=H(tok_newtest), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("language") == "en"

        r2 = requests.get(f"{BASE_URL}/api/settings/preferences", headers=H(tok_newtest), timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("language") == "en"

        # Reset to auto
        r3 = requests.put(f"{BASE_URL}/api/settings/preferences", json={"language": "auto"}, headers=H(tok_newtest), timeout=15)
        assert r3.status_code == 200
        assert r3.json().get("language") == "auto"


# ── Poll cron reminders & auto-close ────────────────────────────────────────
class TestPollCron:
    def test_cron_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/cron/poll-reminders", timeout=15)
        assert r.status_code == 401

    def test_poll_reminder_flow(self, tok_newtest, tok_viewer2):
        # Create poll with duration_hours=1
        r = requests.post(
            f"{BASE_URL}/api/chats/{GROUP_ID}/polls",
            json={"question": "TEST_iter90 reminder poll", "options": ["A", "B"], "duration_hours": 1},
            headers=H(tok_newtest),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        msg = r.json()
        poll_id = msg["poll"]["id"]
        closes_at = msg["poll"].get("closes_at")
        assert closes_at, "closes_at missing"

        # Trigger cron
        cron = requests.post(
            f"{BASE_URL}/api/cron/poll-reminders",
            headers={"Authorization": f"Bearer {CRON_SECRET}"},
            timeout=15,
        )
        assert cron.status_code in (200, 202)
        assert cron.json().get("accepted") is True
        time.sleep(6)

        # Viewer2 should have a poll_reminder notification
        n = requests.get(f"{BASE_URL}/api/notifications", params={"group": "false"}, headers=H(tok_viewer2), timeout=15)
        assert n.status_code == 200
        notifs = n.json() if isinstance(n.json(), list) else n.json().get("notifications", [])
        types = [x.get("type") for x in notifs]
        assert "poll_reminder" in types, f"poll_reminder not in {types[:10]}"

        # Second run should not duplicate (poll.reminded=True)
        cron2 = requests.post(
            f"{BASE_URL}/api/cron/poll-reminders",
            headers={"Authorization": f"Bearer {CRON_SECRET}"},
            timeout=15,
        )
        assert cron2.status_code in (200, 202)
        time.sleep(3)
        n2 = requests.get(f"{BASE_URL}/api/notifications", params={"group": "false"}, headers=H(tok_viewer2), timeout=15)
        notifs2 = n2.json() if isinstance(n2.json(), list) else n2.json().get("notifications", [])
        # count reminders for this specific poll's chat
        count_before = sum(1 for x in notifs if x.get("type") == "poll_reminder" and x.get("target_id") == GROUP_ID)
        count_after = sum(1 for x in notifs2 if x.get("type") == "poll_reminder" and x.get("target_id") == GROUP_ID)
        assert count_after == count_before, f"duplicate reminder created: {count_before} -> {count_after}"

    def test_poll_auto_close(self, tok_newtest):
        # Very short duration -> should auto-close via cron
        r = requests.post(
            f"{BASE_URL}/api/chats/{GROUP_ID}/polls",
            json={"question": "TEST_iter90 auto-close", "options": ["A", "B"], "duration_hours": 0.0001},
            headers=H(tok_newtest),
            timeout=15,
        )
        assert r.status_code == 200
        poll_id = r.json()["poll"]["id"]
        time.sleep(2)

        cron = requests.post(
            f"{BASE_URL}/api/cron/poll-reminders",
            headers={"Authorization": f"Bearer {CRON_SECRET}"},
            timeout=15,
        )
        assert cron.status_code in (200, 202)
        time.sleep(4)

        p = requests.get(f"{BASE_URL}/api/polls/{poll_id}", headers=H(tok_newtest), timeout=15)
        assert p.status_code == 200
        assert p.json().get("closed") is True, f"poll not closed: {p.json()}"


# ── Daily digest cron ───────────────────────────────────────────────────────
class TestDailyDigest:
    def test_cron_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/cron/daily-digest", timeout=15)
        assert r.status_code == 401

    def test_daily_digest_flow(self, tok_newtest):
        cron = requests.post(
            f"{BASE_URL}/api/cron/daily-digest",
            headers={"Authorization": f"Bearer {CRON_SECRET}"},
            timeout=15,
        )
        assert cron.status_code in (200, 202)
        assert cron.json().get("accepted") is True
        # AI summarization takes time
        deadline = time.time() + 30
        got = None
        while time.time() < deadline:
            time.sleep(3)
            r = requests.get(f"{BASE_URL}/api/digest/latest", headers=H(tok_newtest), timeout=15)
            if r.status_code == 200 and r.json().get("content"):
                got = r.json()
                break
        assert got, "no digest generated"
        # notification exists
        n = requests.get(f"{BASE_URL}/api/notifications", params={"group": "false"}, headers=H(tok_newtest), timeout=15)
        notifs = n.json() if isinstance(n.json(), list) else n.json().get("notifications", [])
        types = [x.get("type") for x in notifs]
        assert "daily_digest" in types, f"daily_digest missing in {types[:10]}"
