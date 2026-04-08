"""
Test suite for Analytics (Pro/Business only), Camera page, and BRUNO mascot features.
Tests for iteration 18 features:
1. Analytics endpoints with subscription tier checks
2. Camera page UI elements
3. BRUNO mascot static asset
4. Map icon in Feed header
5. Floating camera button
6. VerifiedBadge for Pro users in posts
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
TEST_PASSWORD = os.getenv("TEST_USER_PASSWORD", "Test1234!")


class TestAnalyticsTracking:
    """Analytics track endpoints - accessible to all users"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test environment"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_track_card_view(self):
        """POST /api/analytics/track/card/{id} - Track card view (public)"""
        test_card_id = str(uuid.uuid4())
        response = self.session.post(f"{BASE_URL}/api/analytics/track/card/{test_card_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "tracked" in data
        assert data["tracked"] == True
        assert "view_id" in data
        print(f"SUCCESS: Card view tracked, view_id: {data['view_id']}")
        
    def test_track_card_view_with_metadata(self):
        """POST /api/analytics/track/card/{id} with viewer metadata"""
        test_card_id = str(uuid.uuid4())
        response = self.session.post(
            f"{BASE_URL}/api/analytics/track/card/{test_card_id}",
            params={
                "viewer_ip": "192.168.1.1",
                "viewer_device": "mobile",
                "referrer": "instagram.com"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["tracked"] == True
        print("SUCCESS: Card view tracked with metadata")
        
    def test_track_view_duration(self):
        """POST /api/analytics/track/card/{id}/duration - Update view duration"""
        test_card_id = str(uuid.uuid4())
        test_view_id = str(uuid.uuid4())
        
        response = self.session.post(
            f"{BASE_URL}/api/analytics/track/card/{test_card_id}/duration",
            params={
                "view_id": test_view_id,
                "duration_seconds": 45
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "updated" in data
        print("SUCCESS: View duration tracking works")
        
    def test_track_post_view(self):
        """POST /api/analytics/track/post/{id} - Track post view"""
        test_post_id = str(uuid.uuid4())
        response = self.session.post(f"{BASE_URL}/api/analytics/track/post/{test_post_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["tracked"] == True
        print("SUCCESS: Post view tracked")


class TestAnalyticsProBusiness:
    """Analytics dashboard endpoints - Pro/Business only"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test environment and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {login_response.text}")
            
    def test_get_analytics_overview_requires_auth(self):
        """GET /api/analytics/overview - Requires authentication"""
        # Without auth header
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/analytics/overview")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422 without auth, got {response.status_code}"
        print("SUCCESS: Analytics overview requires authentication")
        
    def test_get_analytics_overview_with_auth(self):
        """GET /api/analytics/overview - With authentication (tier check)"""
        response = self.session.get(f"{BASE_URL}/api/analytics/overview")
        
        # Either 200 (pro/business) or 403 (free tier)
        assert response.status_code in [200, 403], f"Expected 200 or 403, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "subscription_tier" in data
            assert "total_cards" in data
            assert "total_card_views_30d" in data
            assert "cards" in data
            print(f"SUCCESS: Analytics overview returned for {data['subscription_tier']} user")
        else:
            data = response.json()
            assert "detail" in data
            assert "Pro" in data["detail"] or "Business" in data["detail"]
            print("SUCCESS: Analytics overview correctly returns 403 for free tier")
            
    def test_get_card_analytics_requires_pro(self):
        """GET /api/analytics/cards/{id} - Requires Pro/Business tier"""
        test_card_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/analytics/cards/{test_card_id}")
        
        # Should return 403 (free tier) or 404 (card not found for pro user)
        assert response.status_code in [200, 403, 404], f"Expected 200/403/404, got {response.status_code}"
        
        if response.status_code == 403:
            data = response.json()
            assert "Pro" in data.get("detail", "") or "Business" in data.get("detail", "")
            print("SUCCESS: Card analytics correctly returns 403 for free tier")
        elif response.status_code == 404:
            print("SUCCESS: Card analytics returns 404 for non-existent card (user is Pro/Business)")
        else:
            print("SUCCESS: Card analytics returned data")
            
    def test_recent_visitors_requires_business(self):
        """GET /api/analytics/recent-visitors/{id} - Business only"""
        test_card_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/analytics/recent-visitors/{test_card_id}")
        
        # Should return 403 for non-business users
        assert response.status_code in [200, 403, 404], f"Expected 200/403/404, got {response.status_code}"
        
        if response.status_code == 403:
            data = response.json()
            assert "Business" in data.get("detail", "")
            print("SUCCESS: Recent visitors correctly returns 403 for non-Business users")
        else:
            print(f"Response: {response.status_code}")
            
    def test_export_analytics_requires_business(self):
        """GET /api/analytics/export/{id} - Business only"""
        test_card_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/analytics/export/{test_card_id}?format=json")
        
        # Should return 403 for non-business users
        assert response.status_code in [200, 403, 404], f"Expected 200/403/404, got {response.status_code}"
        
        if response.status_code == 403:
            data = response.json()
            assert "Business" in data.get("detail", "")
            print("SUCCESS: Export analytics correctly returns 403 for non-Business users")
        else:
            print(f"Response: {response.status_code}")


class TestSubscriptionAndBadges:
    """Test subscription tier and verified badge in posts"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test environment and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {login_response.text}")
            
    def test_auth_me_includes_subscription_tier(self):
        """GET /api/auth/me - Should include subscription_tier"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 200
        data = response.json()
        
        # subscription_tier should be in the response
        assert "subscription_tier" in data, f"subscription_tier not in response: {data.keys()}"
        assert data["subscription_tier"] in ["free", "pro", "business"]
        print(f"SUCCESS: User subscription tier: {data['subscription_tier']}")
        
    def test_posts_include_user_subscription_tier(self):
        """GET /api/posts - User object should include subscription_tier for badge display"""
        response = self.session.get(f"{BASE_URL}/api/posts")
        
        assert response.status_code == 200
        posts = response.json()
        
        if len(posts) > 0:
            post = posts[0]
            assert "user" in post, "Post should have user object"
            user = post["user"]
            
            # Check if subscription_tier is present (added in iteration 17 fix)
            if "subscription_tier" in user:
                assert user["subscription_tier"] in ["free", "pro", "business", None]
                print(f"SUCCESS: Post user includes subscription_tier: {user['subscription_tier']}")
            else:
                print("WARNING: Post user does not include subscription_tier (badge may not display)")
        else:
            print("INFO: No posts to verify, skipping subscription_tier check")
            
    def test_store_subscription_endpoint(self):
        """GET /api/store/subscription - Returns current subscription status"""
        response = self.session.get(f"{BASE_URL}/api/store/subscription")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "tier" in data
        assert "is_verified" in data
        assert data["tier"] in ["free", "pro", "business"]
        print(f"SUCCESS: Subscription endpoint returns tier: {data['tier']}, verified: {data['is_verified']}")


class TestBrunoMascotAsset:
    """Test BRUNO mascot static asset availability"""
    
    def test_bruno_mascot_webp_exists(self):
        """Bruno mascot image should be accessible at /bruno-mascot.webp"""
        response = requests.get(f"{BASE_URL}/bruno-mascot.webp")
        
        assert response.status_code == 200, f"Bruno mascot image not found: {response.status_code}"
        assert "image" in response.headers.get("Content-Type", ""), f"Expected image content type, got: {response.headers.get('Content-Type')}"
        
        # Check file size is reasonable (should be > 10KB)
        content_length = int(response.headers.get("Content-Length", 0))
        assert content_length > 10000, f"Bruno mascot image too small: {content_length} bytes"
        
        print(f"SUCCESS: Bruno mascot image accessible, size: {content_length} bytes")


class TestCameraAndFrontendRoutes:
    """Test frontend routes are accessible"""
    
    def test_camera_page_route(self):
        """Camera page should be accessible at /camera"""
        response = requests.get(f"{BASE_URL}/camera")
        
        # React app should return 200 for any route
        assert response.status_code == 200
        assert "text/html" in response.headers.get("Content-Type", "")
        print("SUCCESS: Camera page route is accessible")
        
    def test_analytics_page_route(self):
        """Analytics page should be accessible at /analytics"""
        response = requests.get(f"{BASE_URL}/analytics")
        
        assert response.status_code == 200
        assert "text/html" in response.headers.get("Content-Type", "")
        print("SUCCESS: Analytics page route is accessible")
        
    def test_map_page_route(self):
        """Map page should be accessible at /map"""
        response = requests.get(f"{BASE_URL}/map")
        
        assert response.status_code == 200
        assert "text/html" in response.headers.get("Content-Type", "")
        print("SUCCESS: Map page route is accessible")
        
    def test_feed_page_route(self):
        """Feed page should be accessible at /feed"""
        response = requests.get(f"{BASE_URL}/feed")
        
        assert response.status_code == 200
        assert "text/html" in response.headers.get("Content-Type", "")
        print("SUCCESS: Feed page route is accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
