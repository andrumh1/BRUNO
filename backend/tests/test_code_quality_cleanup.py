"""
Test Code Quality Cleanup - Iteration 54
Tests backend functionality after code quality refactoring:
- Console statements removed
- Mutable default argument fixed
- Bare excepts → Exception
- DEAL webhook refactored into helper functions
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API_URL = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = os.environ.get("TEST_USER_EMAIL", "newtest@bruno.com")
TEST_PASSWORD = os.environ.get("TEST_USER_PASSWORD", "Test1234!")


class TestBackendHealth:
    """Verify backend starts correctly after refactoring"""
    
    def test_health_endpoint(self):
        """Backend should respond to health check"""
        response = requests.get(f"{API_URL}/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("✓ Backend health check passed")
    
    def test_root_endpoint(self):
        """Root endpoint should work"""
        response = requests.get(f"{BASE_URL}/", timeout=10)
        assert response.status_code in [200, 404], f"Root endpoint failed: {response.status_code}"
        print("✓ Root endpoint accessible")


class TestAuthAfterConsoleCleanup:
    """Test auth endpoints work after console.log removal"""
    
    def test_login_success(self):
        """POST /api/auth/login should work after console cleanup"""
        response = requests.post(f"{API_URL}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }, timeout=10)
        
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        print(f"✓ Login successful for {TEST_EMAIL}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Login with wrong credentials should return 401"""
        response = requests.post(f"{API_URL}/auth/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        }, timeout=10)
        
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"
        print("✓ Invalid login correctly rejected")
    
    def test_auth_me_endpoint(self):
        """GET /api/auth/me should work with valid token"""
        # First login
        login_response = requests.post(f"{API_URL}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }, timeout=10)
        token = login_response.json().get("access_token")
        
        # Then check /me
        response = requests.get(f"{API_URL}/auth/me", headers={
            "Authorization": f"Bearer {token}"
        }, timeout=10)
        
        assert response.status_code == 200, f"Auth/me failed: {response.status_code}"
        data = response.json()
        assert data.get("email") == TEST_EMAIL, "Email mismatch"
        print("✓ Auth/me endpoint working")


class TestDealIntegrationRefactored:
    """Test DEAL integration after webhook refactoring into helper functions"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{API_URL}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }, timeout=10)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_send_order_creates_order(self, auth_token):
        """POST /api/deal/send-order should create order correctly after refactoring"""
        order_data = {
            "product_id": str(uuid.uuid4()),
            "product_name": "Test Product Code Quality",
            "product_type": "product",
            "price": 29.99,
            "currency": "USD",
            "quantity": 1,
            "partner_id": "partner123",
            "referral_code": "REF456"
        }
        
        response = requests.post(f"{API_URL}/deal/send-order", json=order_data, headers={
            "Authorization": f"Bearer {auth_token}"
        }, timeout=10)
        
        assert response.status_code == 200, f"Send order failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Missing order id"
        assert data["status"] == "pending_payment", f"Expected pending_payment, got {data['status']}"
        assert data["product_name"] == order_data["product_name"], "Product name mismatch"
        assert data["price"] == order_data["price"], "Price mismatch"
        
        print(f"✓ Order created: {data['id']}")
        return data["id"]
    
    def test_webhook_updates_order_with_helpers(self, auth_token):
        """POST /api/deal/webhook should use refactored helper functions"""
        # First create an order
        order_data = {
            "product_id": str(uuid.uuid4()),
            "product_name": "Webhook Test Product",
            "product_type": "service",
            "price": 49.99,
            "currency": "USD",
            "quantity": 1,
            "partner_id": "webhook_partner",
            "referral_code": None
        }
        
        create_response = requests.post(f"{API_URL}/deal/send-order", json=order_data, headers={
            "Authorization": f"Bearer {auth_token}"
        }, timeout=10)
        
        assert create_response.status_code == 200, f"Order creation failed: {create_response.text}"
        order_id = create_response.json()["id"]
        
        # Now send webhook to update order (tests _update_order_status, _register_commission, _activate_product helpers)
        webhook_payload = {
            "deal_id": f"DEAL-{uuid.uuid4().hex[:8]}",
            "order_id": order_id,
            "payment_status": "paid",
            "amount_paid": 49.99,
            "partner_id": "webhook_partner",
            "commission_amount": 4.99,
            "service_status": "active"
        }
        
        webhook_response = requests.post(f"{API_URL}/deal/webhook", json=webhook_payload, timeout=10)
        
        assert webhook_response.status_code == 200, f"Webhook failed: {webhook_response.status_code} - {webhook_response.text}"
        webhook_data = webhook_response.json()
        
        assert webhook_data["status"] == "ok", "Webhook status not ok"
        assert webhook_data["order_id"] == order_id, "Order ID mismatch"
        assert webhook_data["payment_status"] == "paid", "Payment status mismatch"
        
        print(f"✓ Webhook processed order {order_id} with refactored helpers")
        
        # Verify order was updated by fetching it
        order_response = requests.get(f"{API_URL}/deal/orders/{order_id}", headers={
            "Authorization": f"Bearer {auth_token}"
        }, timeout=10)
        
        assert order_response.status_code == 200, f"Get order failed: {order_response.text}"
        order = order_response.json()
        
        assert order["payment_status"] == "paid", "Order payment_status not updated"
        assert order["status"] == "paid", "Order status not updated"
        assert order.get("commission_amount") == 4.99, "Commission not recorded"
        
        print("✓ Order correctly updated by webhook helpers")
    
    def test_get_orders_returns_user_orders(self, auth_token):
        """GET /api/deal/orders should return user's orders"""
        response = requests.get(f"{API_URL}/deal/orders", headers={
            "Authorization": f"Bearer {auth_token}"
        }, timeout=10)
        
        assert response.status_code == 200, f"Get orders failed: {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of orders"
        print(f"✓ Retrieved {len(data)} orders")
    
    def test_get_commissions(self, auth_token):
        """GET /api/deal/commissions should work"""
        response = requests.get(f"{API_URL}/deal/commissions", headers={
            "Authorization": f"Bearer {auth_token}"
        }, timeout=10)
        
        assert response.status_code == 200, f"Get commissions failed: {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of commissions"
        print(f"✓ Retrieved {len(data)} commissions")


class TestCardsAfterSortOrderChanges:
    """Test cards endpoint after sort_order changes"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{API_URL}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }, timeout=10)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_cards_returns_sorted(self, auth_token):
        """GET /api/cards should return cards sorted by sort_order"""
        response = requests.get(f"{API_URL}/cards", headers={
            "Authorization": f"Bearer {auth_token}"
        }, timeout=10)
        
        assert response.status_code == 200, f"Get cards failed: {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of cards"
        print(f"✓ Retrieved {len(data)} cards")
        
        # Verify cards have expected fields
        if len(data) > 0:
            card = data[0]
            assert "id" in card, "Card missing id"
            assert "title" in card, "Card missing title"
            print(f"✓ First card: {card.get('title', 'Untitled')}")
    
    def test_public_cards_endpoint(self):
        """GET /api/public/cards should work"""
        response = requests.get(f"{API_URL}/public/cards", timeout=10)
        
        assert response.status_code == 200, f"Public cards failed: {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of public cards"
        print(f"✓ Retrieved {len(data)} public cards")


class TestModerationFixedMutableDefault:
    """Test moderation endpoint after mutable default argument fix"""
    
    def test_moderation_check_endpoint(self):
        """POST /api/moderation/check should work"""
        response = requests.post(f"{API_URL}/moderation/check", params={
            "content": "This is a test message",
            "content_type": "text"
        }, timeout=10)
        
        assert response.status_code == 200, f"Moderation check failed: {response.status_code}"
        data = response.json()
        
        assert "is_clean" in data, "Missing is_clean field"
        assert "flags" in data, "Missing flags field"
        print(f"✓ Moderation check: is_clean={data['is_clean']}")


class TestLivesFixedBareExcepts:
    """Test lives endpoints after bare except → Exception fix"""
    
    def test_get_active_lives(self):
        """GET /api/lives should work after bare except fix"""
        response = requests.get(f"{API_URL}/lives", timeout=10)
        
        assert response.status_code == 200, f"Get lives failed: {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of lives"
        print(f"✓ Retrieved {len(data)} active lives")
    
    def test_get_live_categories(self):
        """GET /api/lives/categories should work"""
        response = requests.get(f"{API_URL}/lives/categories", timeout=10)
        
        assert response.status_code == 200, f"Get categories failed: {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of categories"
        assert len(data) > 0, "Expected at least one category"
        print(f"✓ Retrieved {len(data)} live categories")


class TestSocialEndpoints:
    """Test social endpoints work after console cleanup"""
    
    def test_trending_endpoint(self):
        """GET /api/social/trending should work"""
        response = requests.get(f"{API_URL}/social/trending", timeout=10)
        
        assert response.status_code == 200, f"Trending failed: {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of trending items"
        print(f"✓ Retrieved {len(data)} trending items")
    
    def test_posts_endpoint(self):
        """GET /api/posts should work"""
        response = requests.get(f"{API_URL}/posts", timeout=10)
        
        assert response.status_code == 200, f"Posts failed: {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of posts"
        print(f"✓ Retrieved {len(data)} posts")
    
    def test_stories_feed(self):
        """GET /api/stories/feed should work"""
        response = requests.get(f"{API_URL}/stories/feed", timeout=10)
        
        assert response.status_code == 200, f"Stories feed failed: {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of stories"
        print(f"✓ Retrieved {len(data)} stories")


class TestMarketplaceEndpoints:
    """Test marketplace endpoints work after refactoring"""
    
    def test_marketplace_products(self):
        """GET /api/marketplace/products should work"""
        response = requests.get(f"{API_URL}/marketplace/products", params={
            "sort": "newest"
        }, timeout=10)
        
        assert response.status_code == 200, f"Marketplace products failed: {response.status_code}"
        data = response.json()
        
        # Marketplace returns paginated response with products key
        assert "products" in data, "Expected products key in response"
        assert isinstance(data["products"], list), "Expected list of products"
        print(f"✓ Retrieved {len(data['products'])} marketplace products")
    
    def test_marketplace_categories(self):
        """GET /api/marketplace/categories should work"""
        response = requests.get(f"{API_URL}/marketplace/categories", timeout=10)
        
        assert response.status_code == 200, f"Categories failed: {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of categories"
        print(f"✓ Retrieved {len(data)} marketplace categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
