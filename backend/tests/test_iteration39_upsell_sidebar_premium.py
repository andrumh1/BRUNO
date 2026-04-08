"""
Iteration 39 Tests: Card Analytics Upsell Banner, FeedSidebar Component, Premium Page
Tests for:
1. Card Analytics upsell banner (subscription check)
2. FeedSidebar extracted component (Quick Links with Analytics/Premium)
3. Premium page with 3 pricing packages
4. Stripe payment endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
TEST_PASSWORD = os.getenv("TEST_USER_PASSWORD", "Test1234!")


class TestStripePackages:
    """Test GET /api/payments/packages - returns 3 packages with correct prices"""
    
    def test_packages_returns_three_packages(self):
        """Verify packages endpoint returns 3 packages"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert len(data) == 3, f"Expected 3 packages, got {len(data)}"
        
        # Verify package IDs
        assert "analytics_monthly" in data
        assert "analytics_yearly" in data
        assert "premium_monthly" in data
    
    def test_analytics_monthly_price(self):
        """Verify analytics_monthly is $4.99"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200
        
        data = response.json()
        pkg = data.get("analytics_monthly", {})
        assert pkg.get("amount") == 4.99, f"Expected $4.99, got ${pkg.get('amount')}"
        assert pkg.get("currency") == "usd"
        assert "name" in pkg
        assert "features" in pkg
    
    def test_analytics_yearly_price(self):
        """Verify analytics_yearly is $39.99"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200
        
        data = response.json()
        pkg = data.get("analytics_yearly", {})
        assert pkg.get("amount") == 39.99, f"Expected $39.99, got ${pkg.get('amount')}"
    
    def test_premium_monthly_price(self):
        """Verify premium_monthly is $9.99"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200
        
        data = response.json()
        pkg = data.get("premium_monthly", {})
        assert pkg.get("amount") == 9.99, f"Expected $9.99, got ${pkg.get('amount')}"


class TestSubscriptionEndpoint:
    """Test GET /api/payments/subscription - returns subscription status"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_subscription_requires_auth(self):
        """Verify subscription endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/payments/subscription")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_subscription_returns_status(self, auth_token):
        """Verify subscription endpoint returns subscription status"""
        response = requests.get(
            f"{BASE_URL}/api/payments/subscription",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify required fields
        assert "tier" in data, "Missing 'tier' field"
        assert "is_active" in data, "Missing 'is_active' field"
        assert "expires" in data or data.get("expires") is None, "Missing 'expires' field"
        assert "payment_history" in data, "Missing 'payment_history' field"
        
        # Verify is_active is boolean
        assert isinstance(data["is_active"], bool), "is_active should be boolean"


class TestCheckoutEndpoint:
    """Test POST /api/payments/checkout - creates Stripe session"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_checkout_requires_auth(self):
        """Verify checkout endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/payments/checkout", json={
            "package_id": "analytics_monthly",
            "origin_url": "https://example.com"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_checkout_invalid_package(self, auth_token):
        """Verify checkout rejects invalid package ID"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "package_id": "invalid_package",
                "origin_url": "https://example.com"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_checkout_creates_session(self, auth_token):
        """Verify checkout creates Stripe session with URL"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "package_id": "analytics_monthly",
                "origin_url": BASE_URL
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "url" in data, "Missing 'url' field"
        assert "session_id" in data, "Missing 'session_id' field"
        assert "checkout.stripe.com" in data["url"] or "stripe.com" in data["url"], \
            f"URL should be Stripe checkout URL, got {data['url']}"


class TestAnalyticsOverview:
    """Test GET /api/analytics/overview - used by CardAnalyticsPage"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_analytics_overview_requires_auth(self):
        """Verify analytics overview requires authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/overview")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_analytics_overview_returns_data(self, auth_token):
        """Verify analytics overview returns expected structure"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/overview",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify expected fields
        assert "total_views" in data, "Missing 'total_views' field"
        assert "total_unique_visitors" in data, "Missing 'total_unique_visitors' field"
        assert "cards" in data, "Missing 'cards' field"


class TestSocialEndpoints:
    """Test social endpoints used by FeedSidebar"""
    
    def test_trending_endpoint(self):
        """Verify GET /api/social/trending returns trending hashtags"""
        response = requests.get(f"{BASE_URL}/api/social/trending")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Trending should return a list"
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_suggested_endpoint(self, auth_token):
        """Verify GET /api/social/suggested returns suggested users"""
        response = requests.get(
            f"{BASE_URL}/api/social/suggested",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Suggested should return a list"


class TestFeedEndpoints:
    """Test feed endpoints used by FeedPage"""
    
    def test_posts_endpoint(self):
        """Verify GET /api/posts returns posts"""
        response = requests.get(f"{BASE_URL}/api/posts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Posts should return a list"
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_for_you_feed(self, auth_token):
        """Verify GET /api/feed/for-you returns personalized feed"""
        response = requests.get(
            f"{BASE_URL}/api/feed/for-you",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "For-you feed should return a list"


class TestCardEditNavigation:
    """Test card edit endpoint exists"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_get_card_for_edit(self, auth_token):
        """Verify GET /api/cards returns user's cards for editing"""
        response = requests.get(
            f"{BASE_URL}/api/cards",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Cards should return a list"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
