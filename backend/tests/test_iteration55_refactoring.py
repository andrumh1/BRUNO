"""
Iteration 55: Code Quality and Refactoring Testing
Tests for:
1. POST /api/auth/login - Auth works correctly
2. GET /api/auth/me - Auth me with Bearer token
3. GET /api/posts - Posts endpoint (moved to posts_feed.py router)
4. GET /api/feed/for-you - For You feed (moved to posts_feed.py router)
5. GET /api/cards - Cards endpoint
6. POST /api/deal/send-order - DEAL order creation
7. POST /api/deal/webhook - DEAL payment confirmation
8. GET /api/deal/partner/dashboard - Partner dashboard metrics
9. GET /api/deal/orders - User orders
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


class TestAuthEndpoints:
    """Test authentication endpoints after refactoring"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_login_success(self):
        """Test POST /api/auth/login works correctly"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "token_type" in data, "Missing token_type in response"
        assert "user" in data, "Missing user in response"
        assert data["token_type"] == "bearer"
        
        # Validate user data
        user = data["user"]
        assert user["email"] == TEST_EMAIL
        assert "id" in user
        assert "name" in user
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")
    
    def test_auth_me_with_token(self, auth_token):
        """Test GET /api/auth/me works with Bearer token"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        data = response.json()
        
        # Validate user data
        assert "email" in data
        assert "id" in data
        assert data["email"] == TEST_EMAIL
        print(f"✓ Auth me returned user: {data['email']}")
    
    def test_auth_me_without_token(self):
        """Test GET /api/auth/me without token returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Auth me correctly requires authentication")


class TestPostsFeedRouter:
    """Test posts/feed endpoints moved to posts_feed.py router"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_posts(self, auth_token):
        """Test GET /api/posts returns posts (endpoint moved to posts_feed.py)"""
        response = requests.get(f"{BASE_URL}/api/posts", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get posts failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Posts should be a list"
        print(f"✓ GET /api/posts returned {len(data)} posts")
    
    def test_get_for_you_feed(self, auth_token):
        """Test GET /api/feed/for-you returns personalized feed (endpoint moved to posts_feed.py)"""
        response = requests.get(f"{BASE_URL}/api/feed/for-you", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get for-you feed failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "For-you feed should be a list"
        print(f"✓ GET /api/feed/for-you returned {len(data)} items")
    
    def test_get_chats(self, auth_token):
        """Test GET /api/chats returns user chats (endpoint moved to posts_feed.py)"""
        response = requests.get(f"{BASE_URL}/api/chats", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get chats failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Chats should be a list"
        print(f"✓ GET /api/chats returned {len(data)} chats")
    
    def test_get_notifications(self, auth_token):
        """Test GET /api/notifications returns user notifications (endpoint moved to posts_feed.py)"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Notifications should be a list"
        print(f"✓ GET /api/notifications returned {len(data)} notifications")
    
    def test_get_settings_preferences(self, auth_token):
        """Test GET /api/settings/preferences returns user preferences (endpoint moved to posts_feed.py)"""
        response = requests.get(f"{BASE_URL}/api/settings/preferences", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get preferences failed: {response.text}"
        data = response.json()
        
        # Validate preferences structure
        assert "user_id" in data or "feed_mode" in data, "Preferences should have user_id or feed_mode"
        print(f"✓ GET /api/settings/preferences returned preferences")


class TestCardsEndpoint:
    """Test cards endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_cards(self, auth_token):
        """Test GET /api/cards returns user cards"""
        response = requests.get(f"{BASE_URL}/api/cards", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get cards failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Cards should be a list"
        print(f"✓ GET /api/cards returned {len(data)} cards")


class TestDealIntegration:
    """Test DEAL integration endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_deal_send_order(self, auth_token):
        """Test POST /api/deal/send-order creates order"""
        order_data = {
            "product_id": str(uuid.uuid4()),
            "product_name": "TEST_Product_Iteration55",
            "product_type": "product",
            "price": 29.99,
            "currency": "USD",
            "quantity": 1,
            "partner_id": None,
            "referral_code": None
        }
        
        response = requests.post(f"{BASE_URL}/api/deal/send-order", 
            json=order_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Send order failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "id" in data, "Missing order id"
        assert "status" in data, "Missing status"
        assert data["status"] == "pending_payment"
        assert data["product_name"] == "TEST_Product_Iteration55"
        print(f"✓ POST /api/deal/send-order created order: {data['id']}")
        
        return data["id"]
    
    def test_deal_webhook(self, auth_token):
        """Test POST /api/deal/webhook processes payment confirmation"""
        # First create an order
        order_data = {
            "product_id": str(uuid.uuid4()),
            "product_name": "TEST_Webhook_Product",
            "product_type": "product",
            "price": 19.99,
            "currency": "USD",
            "quantity": 1
        }
        
        create_response = requests.post(f"{BASE_URL}/api/deal/send-order", 
            json=order_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if create_response.status_code != 200:
            pytest.skip("Could not create order for webhook test")
        
        order_id = create_response.json()["id"]
        
        # Now test webhook
        webhook_payload = {
            "deal_id": f"DEAL_{uuid.uuid4().hex[:8]}",
            "order_id": order_id,
            "payment_status": "paid",
            "amount_paid": 19.99,
            "partner_id": None,
            "commission_amount": None,
            "service_status": "active"
        }
        
        response = requests.post(f"{BASE_URL}/api/deal/webhook", json=webhook_payload)
        
        assert response.status_code == 200, f"Webhook failed: {response.text}"
        data = response.json()
        
        assert data["status"] == "ok"
        assert data["payment_status"] == "paid"
        print(f"✓ POST /api/deal/webhook processed payment for order: {order_id}")
    
    def test_deal_partner_dashboard(self, auth_token):
        """Test GET /api/deal/partner/dashboard returns partner metrics"""
        response = requests.get(f"{BASE_URL}/api/deal/partner/dashboard", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Partner dashboard failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "summary" in data, "Missing summary in dashboard"
        assert "monthly" in data, "Missing monthly data"
        assert "top_products" in data, "Missing top_products"
        assert "recent_commissions" in data, "Missing recent_commissions"
        assert "recent_orders" in data, "Missing recent_orders"
        
        # Validate summary fields
        summary = data["summary"]
        assert "total_earned" in summary
        assert "total_orders" in summary
        assert "total_sales_volume" in summary
        assert "conversion_rate" in summary
        
        print(f"✓ GET /api/deal/partner/dashboard returned metrics: total_earned=${summary['total_earned']}")
    
    def test_deal_orders(self, auth_token):
        """Test GET /api/deal/orders returns user orders"""
        response = requests.get(f"{BASE_URL}/api/deal/orders", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get orders failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list), "Orders should be a list"
        print(f"✓ GET /api/deal/orders returned {len(data)} orders")


class TestPushNotificationsEnhanced:
    """Test enhanced push notifications with new fields"""
    
    def test_vapid_public_key(self):
        """Test GET /api/push/vapid-public-key returns VAPID key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-public-key")
        
        assert response.status_code == 200, f"Get VAPID key failed: {response.text}"
        data = response.json()
        
        assert "publicKey" in data, "Missing publicKey"
        assert len(data["publicKey"]) > 0, "VAPID key should not be empty"
        print(f"✓ GET /api/push/vapid-public-key returned key")


class TestAnalyticsRefactored:
    """Test analytics endpoint with refactored _compute_view_metrics helper"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_analytics_overview(self, auth_token):
        """Test GET /api/analytics/overview returns analytics (uses refactored helper)"""
        response = requests.get(f"{BASE_URL}/api/analytics/overview", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        # May return 403 for free users, which is expected
        if response.status_code == 403:
            print("✓ GET /api/analytics/overview correctly requires Pro/Business subscription")
            return
        
        assert response.status_code == 200, f"Analytics overview failed: {response.text}"
        data = response.json()
        
        # Analytics returns cards, daily_views, recent_activity, total_unique_visitors, total_views
        assert "cards" in data or "total_views" in data or "daily_views" in data
        print(f"✓ GET /api/analytics/overview returned analytics with {len(data.get('cards', []))} cards")


class TestSecureStorageMigration:
    """Test that auth works with encrypted token storage (frontend uses secureStorage)"""
    
    def test_token_works_after_login(self):
        """Test that token from login works for subsequent requests"""
        # Login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Use token for auth/me
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        
        assert me_response.status_code == 200
        
        # Use token for cards
        cards_response = requests.get(f"{BASE_URL}/api/cards", headers={
            "Authorization": f"Bearer {token}"
        })
        
        assert cards_response.status_code == 200
        
        # Use token for posts
        posts_response = requests.get(f"{BASE_URL}/api/posts", headers={
            "Authorization": f"Bearer {token}"
        })
        
        assert posts_response.status_code == 200
        
        print("✓ Token works correctly for all authenticated endpoints")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
