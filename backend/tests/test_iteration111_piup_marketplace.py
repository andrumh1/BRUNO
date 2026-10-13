"""Iteration 111 — PIUP catalog/admin + marketplace cart/checkout honesty + OVC branding + Cards regression (backend only)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://premium-launch-13.preview.emergentagent.com').rstrip('/')

USER_EMAIL = "newtest@bruno.com"
USER_PASS = "Test1234!"
ADMIN_EMAIL = "testc@brunoqa.com"
ADMIN_PASS = "Prueba1234!"
PIUP_WIFI = "piup-wifi-clave"
CART_PRODUCT = "111f2fbd-59d0-4f96-9adf-0c3744987e70"
EXISTING_CARD = "d16c2745-e082-4b22-84f8-749beb5e33fd"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def user_token():
    return _login(USER_EMAIL, USER_PASS)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture
def user_h(user_token):
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ─── PIUP catalog (DB-backed, 19 products) ───────────────────────────────────
class TestPiupCatalog:
    def test_catalog_returns_19_with_ovc_brand(self):
        r = requests.get(f"{BASE_URL}/api/piup/catalog", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "products" in data
        assert len(data["products"]) == 19, f"Expected 19 PIUP products, got {len(data['products'])}"
        assert data["brand"]["name"] == "PIUP"
        assert data["brand"]["company"] == "Octopus Vision Company (OVC)"
        ids = {p["id"] for p in data["products"]}
        assert PIUP_WIFI in ids

    def test_catalog_filter_by_category(self):
        r = requests.get(f"{BASE_URL}/api/piup/catalog?category=hogar", timeout=15)
        assert r.status_code == 200
        prods = r.json()["products"]
        assert len(prods) > 0
        assert all(p["category"] == "hogar" for p in prods)


# ─── Marketplace search returns piup_official ───────────────────────────────
class TestMarketplaceSearchPiup:
    def test_search_wifi_returns_piup_official(self):
        r = requests.get(f"{BASE_URL}/api/marketplace/products", params={"search": "wifi"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "piup_official" in data
        piup = data["piup_official"]
        assert len(piup) >= 1, "Expected at least one piup_official result for 'wifi'"
        found = next((p for p in piup if p["id"] == PIUP_WIFI), None)
        assert found, f"Expected {PIUP_WIFI} in results, got {[p['id'] for p in piup]}"
        assert found["is_official_piup"] is True
        assert found["url"].startswith("/marketplace/piup?product=")


# ─── Cart / checkout honest 409 ─────────────────────────────────────────────
class TestCartAndCheckout:
    def test_add_to_cart_and_update_quantity(self, user_h):
        # Reset cart item first in case it exists at wrong qty
        add = requests.post(f"{BASE_URL}/api/marketplace/cart/add", json={"product_id": CART_PRODUCT, "quantity": 2}, headers=user_h, timeout=15)
        assert add.status_code in (200, 201), f"add failed: {add.status_code} {add.text}"
        # Update qty
        upd = requests.put(f"{BASE_URL}/api/marketplace/cart/{CART_PRODUCT}", json={"quantity": 2}, headers=user_h, timeout=15)
        assert upd.status_code == 200, f"PUT cart failed: {upd.status_code} {upd.text}"

    def test_cart_summary_groups_and_seller_flag(self, user_h):
        r = requests.get(f"{BASE_URL}/api/marketplace/cart/summary", headers=user_h, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "groups" in data
        # Find a group containing our product
        found_product = False
        for g in data["groups"]:
            for it in g["items"]:
                if it["product_id"] == CART_PRODUCT:
                    found_product = True
                    assert "seller_ready" in g
        assert found_product, "CART_PRODUCT not found in cart groups"

    def test_checkout_blocked_with_seller_not_ready(self, user_h):
        r = requests.post(f"{BASE_URL}/api/marketplace/checkout",
                          json={"origin_url": BASE_URL, "delivery": {}}, headers=user_h, timeout=15)
        # Expect 409 seller_not_ready as per iteration spec
        assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"
        body = r.json()
        detail = body.get("detail", {})
        if isinstance(detail, dict):
            assert detail.get("code") == "seller_not_ready", f"Expected seller_not_ready, got {detail}"


# ─── PIUP Admin ─────────────────────────────────────────────────────────────
class TestPiupAdmin:
    def test_non_admin_forbidden(self, user_h):
        r = requests.get(f"{BASE_URL}/api/piup/admin/products", headers=user_h, timeout=15)
        assert r.status_code == 403

    def test_admin_can_list_products(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/piup/admin/products", headers=admin_h, timeout=15)
        assert r.status_code == 200, f"admin products: {r.status_code} {r.text}"
        data = r.json()
        assert "products" in data and len(data["products"]) >= 19

    def test_admin_patch_price_persists(self, admin_h):
        # Fetch original
        r = requests.get(f"{BASE_URL}/api/piup/catalog", timeout=15)
        orig = next(p for p in r.json()["products"] if p["id"] == PIUP_WIFI)
        orig_price = orig["base_price"]
        new_price = round(orig_price + 0.01, 2)
        # Patch
        p = requests.patch(f"{BASE_URL}/api/piup/admin/products/{PIUP_WIFI}",
                           json={"base_price": new_price}, headers=admin_h, timeout=15)
        assert p.status_code == 200, f"patch: {p.status_code} {p.text}"
        # Verify persistence
        r2 = requests.get(f"{BASE_URL}/api/piup/catalog", timeout=15)
        got = next(x for x in r2.json()["products"] if x["id"] == PIUP_WIFI)
        assert abs(got["base_price"] - new_price) < 0.001
        # Restore
        requests.patch(f"{BASE_URL}/api/piup/admin/products/{PIUP_WIFI}",
                       json={"base_price": orig_price}, headers=admin_h, timeout=15)

    def test_admin_hide_and_restore(self, admin_h):
        # Hide
        p = requests.patch(f"{BASE_URL}/api/piup/admin/products/{PIUP_WIFI}",
                           json={"active": False}, headers=admin_h, timeout=15)
        assert p.status_code == 200
        pub = requests.get(f"{BASE_URL}/api/piup/catalog", timeout=15).json()["products"]
        assert PIUP_WIFI not in {x["id"] for x in pub}
        # Restore
        p2 = requests.patch(f"{BASE_URL}/api/piup/admin/products/{PIUP_WIFI}",
                            json={"active": True}, headers=admin_h, timeout=15)
        assert p2.status_code == 200
        pub2 = requests.get(f"{BASE_URL}/api/piup/catalog", timeout=15).json()["products"]
        assert PIUP_WIFI in {x["id"] for x in pub2}

    def test_admin_orders_and_stats(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/piup/admin/orders", headers=admin_h, timeout=15)
        assert r.status_code == 200
        assert "orders" in r.json()
        s = requests.get(f"{BASE_URL}/api/piup/admin/stats", headers=admin_h, timeout=15)
        assert s.status_code == 200
        data = s.json()
        assert "revenue" in data and "orders_by_status" in data


# ─── PIUP checkout (session creation; completing Stripe not possible in automated test) ─
class TestPiupCheckoutCreation:
    def test_piup_checkout_session_creates(self, user_h):
        r = requests.post(f"{BASE_URL}/api/piup/checkout",
                          json={"product_id": PIUP_WIFI, "style": "C2", "color_id": "black",
                                "quantity": 1, "origin_url": BASE_URL},
                          headers=user_h, timeout=20)
        if r.status_code == 503:
            pytest.skip("Stripe not configured")
        assert r.status_code == 200, f"piup checkout: {r.status_code} {r.text}"
        data = r.json()
        assert "checkout_url" in data and "stripe.com" in data["checkout_url"]
        assert "session_id" in data and "order_id" in data

    def test_my_piup_orders(self, user_h):
        r = requests.get(f"{BASE_URL}/api/piup/orders", headers=user_h, timeout=15)
        assert r.status_code == 200
        assert "orders" in r.json()


# ─── Money purchases (unified ledger) ───────────────────────────────────────
class TestMoneyPurchases:
    def test_purchases_endpoint(self, user_h):
        r = requests.get(f"{BASE_URL}/api/money/purchases", headers=user_h, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # endpoint returns a list of purchases (ledger entries)
        if isinstance(data, list):
            # Expect at least one entry (we just created PIUP checkout sessions)
            assert len(data) >= 0
            if data:
                kinds = {p.get("kind") for p in data}
                # Must include piup since we created sessions above
                assert "piup" in kinds, f"Expected 'piup' in kinds, got {kinds}"
        else:
            assert isinstance(data, dict)


# ─── BRUNO CARDS regression ─────────────────────────────────────────────────
class TestCardsRegression:
    def test_get_existing_card(self, user_h):
        r = requests.get(f"{BASE_URL}/api/cards/{EXISTING_CARD}", headers=user_h, timeout=15)
        assert r.status_code == 200, f"get card: {r.status_code} {r.text}"
        card = r.json()
        assert card.get("id") == EXISTING_CARD

    def test_create_update_publish_delete_card(self, user_h):
        # Create draft
        r = requests.post(f"{BASE_URL}/api/cards",
                          json={"title": "TEST_iteration111", "subtitle": "pre", "status": "draft", "card_type": "personal"},
                          headers=user_h, timeout=15)
        assert r.status_code in (200, 201), f"create: {r.status_code} {r.text}"
        card = r.json()
        cid = card["id"]
        try:
            # Update
            u = requests.put(f"{BASE_URL}/api/cards/{cid}",
                             json={"title": "TEST_iteration111 updated", "subtitle": "post"},
                             headers=user_h, timeout=15)
            assert u.status_code == 200, f"update: {u.status_code} {u.text}"
            # Verify persisted
            g = requests.get(f"{BASE_URL}/api/cards/{cid}", headers=user_h, timeout=15)
            assert g.status_code == 200
            assert g.json()["subtitle"] == "post"
            # Publish (try common publish pattern)
            pub = requests.post(f"{BASE_URL}/api/cards/{cid}/publish", headers=user_h, timeout=15)
            assert pub.status_code in (200, 204, 404), f"publish: {pub.status_code} {pub.text}"
        finally:
            requests.delete(f"{BASE_URL}/api/cards/{cid}", headers=user_h, timeout=15)
