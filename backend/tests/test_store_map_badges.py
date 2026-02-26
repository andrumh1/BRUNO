"""
Test Store Router, Map WebSocket, and VerifiedBadge Integration
Tests for iteration 17:
- Store router (refactored from server.py)
- Store products (36 PIUP items)
- Subscription management (free, pro, business)
- Map WebSocket preparation
- User subscription_tier field
"""
import pytest
import requests
import json
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


class TestStoreProducts:
    """Store products endpoint tests"""
    
    def test_get_all_products(self):
        """GET /api/store/products returns 36 products"""
        response = requests.get(f"{BASE_URL}/api/store/products")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 36, f"Expected 36 products, got {len(data)}"
        print(f"✓ Store has {len(data)} products")
    
    def test_products_have_required_fields(self):
        """Each product has required fields"""
        response = requests.get(f"{BASE_URL}/api/store/products")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ["id", "name", "description", "category", "price"]
        
        for product in data[:5]:  # Check first 5
            for field in required_fields:
                assert field in product, f"Product missing {field}"
        
        print("✓ Products have all required fields")
    
    def test_filter_by_category(self):
        """GET /api/store/products?category=nfc_card returns filtered products"""
        response = requests.get(f"{BASE_URL}/api/store/products?category=nfc_card")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0, "Should have NFC card products"
        
        for product in data:
            assert product["category"] == "nfc_card"
        
        print(f"✓ Filtered to {len(data)} NFC card products")
    
    def test_filter_by_card_type(self):
        """GET /api/store/products?for_card_type=personal returns filtered products"""
        response = requests.get(f"{BASE_URL}/api/store/products?for_card_type=personal")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0, "Should have personal card type products"
        print(f"✓ Filtered to {len(data)} personal card type products")
    
    def test_get_single_product(self):
        """GET /api/store/products/{product_id} returns single product"""
        response = requests.get(f"{BASE_URL}/api/store/products/nfc-card-black")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == "nfc-card-black"
        assert "name" in data
        assert "price" in data
        print(f"✓ Got product: {data['name']} at ${data['price']}")
    
    def test_get_nonexistent_product(self):
        """GET /api/store/products/{invalid_id} returns 404"""
        response = requests.get(f"{BASE_URL}/api/store/products/nonexistent-product")
        assert response.status_code == 404
        print("✓ 404 for nonexistent product")


class TestSubscription:
    """Subscription management tests"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_resp.status_code == 200:
            self.token = login_resp.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_subscription_status(self):
        """GET /api/store/subscription returns user tier"""
        response = requests.get(
            f"{BASE_URL}/api/store/subscription",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "tier" in data
        assert data["tier"] in ["free", "pro", "business"]
        assert "is_verified" in data
        print(f"✓ User tier: {data['tier']}, verified: {data['is_verified']}")
    
    def test_subscribe_to_pro(self):
        """POST /api/store/subscribe/pro upgrades user"""
        response = requests.post(
            f"{BASE_URL}/api/store/subscribe/pro",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "subscribed"
        assert data["tier"] == "pro"
        assert "expires_at" in data
        print(f"✓ Subscribed to pro, expires: {data['expires_at']}")
        
        # Verify via GET
        verify = requests.get(
            f"{BASE_URL}/api/store/subscription",
            headers=self.headers
        )
        assert verify.status_code == 200
        assert verify.json()["tier"] == "pro"
        assert verify.json()["is_verified"] == True
        print("✓ Subscription persisted correctly")
    
    def test_subscribe_to_business(self):
        """POST /api/store/subscribe/business upgrades user"""
        response = requests.post(
            f"{BASE_URL}/api/store/subscribe/business",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "subscribed"
        assert data["tier"] == "business"
        print(f"✓ Subscribed to business, expires: {data['expires_at']}")
    
    def test_subscribe_invalid_tier(self):
        """POST /api/store/subscribe/invalid returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/store/subscribe/invalid",
            headers=self.headers
        )
        assert response.status_code == 400
        print("✓ Invalid tier rejected")


class TestStoreOrders:
    """Store order endpoint tests (requires auth)"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_resp.status_code == 200:
            self.token = login_resp.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_user_orders(self):
        """GET /api/store/orders returns user's orders"""
        response = requests.get(
            f"{BASE_URL}/api/store/orders",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ User has {len(data)} orders")
    
    def test_create_order(self):
        """POST /api/store/orders creates new order"""
        order_data = {
            "items": [
                {"product_id": "nfc-card-black", "quantity": 2, "color": "black"}
            ],
            "shipping_address": {
                "full_name": "Test User",
                "phone": "+1234567890",
                "address_line1": "123 Test St",
                "city": "Test City",
                "postal_code": "12345",
                "country": "US"
            },
            "notes": "Test order"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/store/orders",
            json=order_data,
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["status"] == "pending_payment"
        assert len(data["items"]) == 1
        assert data["items"][0]["quantity"] == 2
        print(f"✓ Order created: {data['id']}, total: ${data['total']}")
        
        # Verify we can fetch it
        order_id = data["id"]
        verify = requests.get(
            f"{BASE_URL}/api/store/orders/{order_id}",
            headers=self.headers
        )
        assert verify.status_code == 200
        assert verify.json()["id"] == order_id
        print("✓ Order persisted and retrievable")
    
    def test_create_order_invalid_product(self):
        """POST /api/store/orders with invalid product returns 404"""
        order_data = {
            "items": [
                {"product_id": "nonexistent-product", "quantity": 1}
            ],
            "shipping_address": {
                "full_name": "Test User",
                "phone": "+1234567890",
                "address_line1": "123 Test St",
                "city": "Test City",
                "postal_code": "12345",
                "country": "US"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/store/orders",
            json=order_data,
            headers=self.headers
        )
        assert response.status_code == 404
        print("✓ Invalid product in order rejected")


class TestNotificationsEmailIntegration:
    """Tests for Resend email integration in notifications router"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_resp.status_code == 200:
            self.token = login_resp.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_notification_types(self):
        """GET /api/notifications/types returns all types including email"""
        response = requests.get(f"{BASE_URL}/api/notifications/types")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) >= 11, "Should have at least 11 notification types"
        print(f"✓ {len(data)} notification types available")
    
    def test_notification_preferences_email_fields(self):
        """GET /api/notifications/preferences includes email settings"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/preferences",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Check email-related fields exist
        email_fields = [
            "email_enabled", "email_messages", "email_followers",
            "email_product_activity", "email_order_updates", "email_promotions"
        ]
        for field in email_fields:
            assert field in data, f"Missing email field: {field}"
        
        print(f"✓ Email notification preferences: enabled={data['email_enabled']}")
    
    def test_update_email_preferences(self):
        """PUT /api/notifications/preferences updates email settings"""
        prefs = {
            "push_enabled": True,
            "email_enabled": True,
            "email_order_updates": True,
            "email_messages": False,
            "calls": True,
            "messages": True,
            "likes": True,
            "comments": True,
            "followers": True,
            "product_favorites": True,
            "product_cart": True,
            "stories": True,
            "mentions": True,
            "order_updates": True,
            "promotions": False,
            "email_followers": False,
            "email_product_activity": False,
            "email_promotions": False,
            "email_weekly_digest": False
        }
        
        response = requests.put(
            f"{BASE_URL}/api/notifications/preferences",
            json=prefs,
            headers=self.headers
        )
        assert response.status_code == 200
        
        # Verify
        verify = requests.get(
            f"{BASE_URL}/api/notifications/preferences",
            headers=self.headers
        )
        assert verify.status_code == 200
        data = verify.json()
        assert data["email_enabled"] == True
        assert data["email_order_updates"] == True
        print("✓ Email preferences updated successfully")


class TestUserSubscriptionTierField:
    """Tests for subscription_tier field in User model"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_resp.status_code == 200:
            self.token = login_resp.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_user_profile_has_subscription_tier(self):
        """GET /api/users/me returns subscription_tier"""
        response = requests.get(
            f"{BASE_URL}/api/users/me",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Check subscription_tier is present
        assert "subscription_tier" in data or "tier" in data
        tier = data.get("subscription_tier") or data.get("tier", "free")
        assert tier in ["free", "pro", "business"]
        print(f"✓ User has subscription_tier: {tier}")


class TestMapEndpoints:
    """Tests for Map page related endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_resp.status_code == 200:
            self.token = login_resp.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_cards_public_endpoint(self):
        """GET /api/cards/public returns cards for map"""
        response = requests.get(
            f"{BASE_URL}/api/cards/public?with_location=true",
            headers=self.headers
        )
        # May return 200 or 404 if no public cards
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Found {len(data)} public cards")
        else:
            print("✓ Public cards endpoint accessible (no cards with location)")
    
    def test_cards_endpoint(self):
        """GET /api/cards returns user's cards"""
        response = requests.get(
            f"{BASE_URL}/api/cards",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ User has {len(data)} cards")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
