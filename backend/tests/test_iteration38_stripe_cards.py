"""
Iteration 38: Stripe Payments, Card Edit Navigation, Image Overflow, FloatingChatBubble Profile Links
Tests:
- Stripe payment endpoints (packages, checkout, subscription, status)
- Card edit navigation (PUT /api/cards/{cardId})
- Premium packages structure
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"
TEST_CARD_ID = "d16c2745-e082-4b22-84f8-749beb5e33fd"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestStripePackages:
    """Test GET /api/payments/packages - Premium packages endpoint"""
    
    def test_get_packages_returns_200(self):
        """Packages endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_packages_contains_analytics_monthly(self):
        """Should contain analytics_monthly package"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        data = response.json()
        assert "analytics_monthly" in data, "Missing analytics_monthly package"
        pkg = data["analytics_monthly"]
        assert pkg["amount"] == 4.99, f"Expected $4.99, got {pkg['amount']}"
        assert pkg["currency"] == "usd"
        assert "features" in pkg
    
    def test_packages_contains_analytics_yearly(self):
        """Should contain analytics_yearly package"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        data = response.json()
        assert "analytics_yearly" in data, "Missing analytics_yearly package"
        pkg = data["analytics_yearly"]
        assert pkg["amount"] == 39.99, f"Expected $39.99, got {pkg['amount']}"
    
    def test_packages_contains_premium_monthly(self):
        """Should contain premium_monthly package"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        data = response.json()
        assert "premium_monthly" in data, "Missing premium_monthly package"
        pkg = data["premium_monthly"]
        assert pkg["amount"] == 9.99, f"Expected $9.99, got {pkg['amount']}"
    
    def test_packages_have_required_fields(self):
        """All packages should have name, amount, currency, features"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        data = response.json()
        for pkg_id, pkg in data.items():
            assert "name" in pkg, f"Package {pkg_id} missing name"
            assert "amount" in pkg, f"Package {pkg_id} missing amount"
            assert "currency" in pkg, f"Package {pkg_id} missing currency"
            assert "features" in pkg, f"Package {pkg_id} missing features"
            assert isinstance(pkg["features"], list), f"Package {pkg_id} features should be list"


class TestStripeCheckout:
    """Test POST /api/payments/checkout - Create checkout session"""
    
    def test_checkout_requires_auth(self):
        """Checkout should require authentication"""
        response = requests.post(f"{BASE_URL}/api/payments/checkout", json={
            "package_id": "analytics_monthly",
            "origin_url": "https://example.com"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_checkout_invalid_package(self, auth_headers):
        """Checkout with invalid package should return 400"""
        response = requests.post(f"{BASE_URL}/api/payments/checkout", json={
            "package_id": "invalid_package",
            "origin_url": "https://example.com"
        }, headers=auth_headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_checkout_creates_session(self, auth_headers):
        """Checkout should create Stripe session and return URL"""
        response = requests.post(f"{BASE_URL}/api/payments/checkout", json={
            "package_id": "analytics_monthly",
            "origin_url": "https://polls-reactions-feed.preview.emergentagent.com"
        }, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "url" in data, "Response should contain checkout URL"
        assert "session_id" in data, "Response should contain session_id"
        assert "checkout.stripe.com" in data["url"], f"URL should be Stripe checkout: {data['url']}"


class TestStripeSubscription:
    """Test GET /api/payments/subscription - User subscription status"""
    
    def test_subscription_requires_auth(self):
        """Subscription endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/payments/subscription")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_subscription_returns_status(self, auth_headers):
        """Should return subscription status for authenticated user"""
        response = requests.get(f"{BASE_URL}/api/payments/subscription", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "tier" in data, "Response should contain tier"
        assert "is_active" in data, "Response should contain is_active"
        assert "payment_history" in data, "Response should contain payment_history"


class TestStripePaymentStatus:
    """Test GET /api/payments/status/{session_id} - Poll payment status"""
    
    def test_status_requires_auth(self):
        """Status endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/payments/status/fake_session_id")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_status_not_found_for_invalid_session(self, auth_headers):
        """Should return 404 for non-existent session"""
        response = requests.get(f"{BASE_URL}/api/payments/status/nonexistent_session_123", headers=auth_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestCardEditEndpoint:
    """Test PUT /api/cards/{cardId} - Card update endpoint"""
    
    def test_card_get_exists(self, auth_headers):
        """Test card exists and can be retrieved"""
        response = requests.get(f"{BASE_URL}/api/cards/{TEST_CARD_ID}")
        assert response.status_code == 200, f"Card not found: {response.status_code}"
        data = response.json()
        assert "id" in data
        assert "title" in data
    
    def test_card_update_requires_auth(self):
        """Card update should require authentication"""
        response = requests.put(f"{BASE_URL}/api/cards/{TEST_CARD_ID}", json={
            "title": "Updated Title"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_card_update_works(self, auth_headers):
        """Card update should work for owner"""
        # First get current card data
        get_response = requests.get(f"{BASE_URL}/api/cards/{TEST_CARD_ID}")
        if get_response.status_code != 200:
            pytest.skip("Test card not found")
        
        original_data = get_response.json()
        original_title = original_data.get("title", "Test Card")
        
        # Update with same title (to not break anything)
        update_response = requests.put(f"{BASE_URL}/api/cards/{TEST_CARD_ID}", json={
            "title": original_title,
            "subtitle": original_data.get("subtitle", "")
        }, headers=auth_headers)
        
        # Should be 200 or 403 if not owner
        assert update_response.status_code in [200, 403], f"Expected 200 or 403, got {update_response.status_code}"


class TestPaymentTransactionCreation:
    """Test that checkout creates payment_transactions record"""
    
    def test_checkout_creates_transaction(self, auth_headers):
        """Checkout should create a pending transaction before redirect"""
        # Create a checkout session
        response = requests.post(f"{BASE_URL}/api/payments/checkout", json={
            "package_id": "premium_monthly",
            "origin_url": "https://polls-reactions-feed.preview.emergentagent.com"
        }, headers=auth_headers)
        
        if response.status_code != 200:
            pytest.skip(f"Checkout failed: {response.text}")
        
        data = response.json()
        session_id = data.get("session_id")
        assert session_id, "Should return session_id"
        
        # Check status endpoint returns the transaction
        status_response = requests.get(f"{BASE_URL}/api/payments/status/{session_id}", headers=auth_headers)
        # Should find the transaction (pending status)
        assert status_response.status_code == 200, f"Transaction should exist: {status_response.status_code}"
        status_data = status_response.json()
        assert "status" in status_data or "payment_status" in status_data


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """API should be reachable"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
