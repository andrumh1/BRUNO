"""
Iteration 48 Backend Tests
Features tested:
1. Mobile platform JWT expiry (~365 days) vs Web (~30 days)
2. Pagination on /cards and /public/cards endpoints
3. Card model 'locations' array field
4. N+1 query optimization on posts feed and for-you feed (batch queries)
"""

import pytest
import requests
import os
import jwt
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
TEST_PASSWORD = os.getenv("TEST_USER_PASSWORD", "Test1234!")
TEST_CARD_ID = "d16c2745-e082-4b22-84f8-749beb5e33fd"


class TestPlatformJWTExpiry:
    """Test mobile vs web platform JWT expiry differences"""
    
    def test_web_login_returns_30_day_token(self):
        """Web platform login should return ~30 day JWT expiry"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "platform": "web"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        
        # Decode JWT and check expiry
        token = data["access_token"]
        # Decode without verification to check payload
        payload = jwt.decode(token, options={"verify_signature": False})
        
        assert "exp" in payload, "Token missing 'exp' claim"
        assert "sub" in payload, "Token missing 'sub' claim"
        
        exp_timestamp = payload["exp"]
        now = datetime.now(timezone.utc).timestamp()
        days_until_expiry = (exp_timestamp - now) / (60 * 60 * 24)
        
        # Web should be ~30 days (allow some margin)
        assert 25 <= days_until_expiry <= 35, f"Web token expiry should be ~30 days, got {days_until_expiry:.1f} days"
        print(f"Web token expires in {days_until_expiry:.1f} days - PASS")
    
    def test_mobile_login_returns_365_day_token(self):
        """Mobile platform login should return ~365 day JWT expiry"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "platform": "mobile"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        
        # Decode JWT and check expiry
        token = data["access_token"]
        payload = jwt.decode(token, options={"verify_signature": False})
        
        assert "exp" in payload, "Token missing 'exp' claim"
        
        exp_timestamp = payload["exp"]
        now = datetime.now(timezone.utc).timestamp()
        days_until_expiry = (exp_timestamp - now) / (60 * 60 * 24)
        
        # Mobile should be ~365 days (allow some margin)
        assert 360 <= days_until_expiry <= 370, f"Mobile token expiry should be ~365 days, got {days_until_expiry:.1f} days"
        print(f"Mobile token expires in {days_until_expiry:.1f} days - PASS")
    
    def test_native_login_returns_365_day_token(self):
        """Native platform login should return ~365 day JWT expiry (same as mobile)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "platform": "native"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        token = data["access_token"]
        payload = jwt.decode(token, options={"verify_signature": False})
        
        exp_timestamp = payload["exp"]
        now = datetime.now(timezone.utc).timestamp()
        days_until_expiry = (exp_timestamp - now) / (60 * 60 * 24)
        
        # Native should be ~365 days
        assert 360 <= days_until_expiry <= 370, f"Native token expiry should be ~365 days, got {days_until_expiry:.1f} days"
        print(f"Native token expires in {days_until_expiry:.1f} days - PASS")
    
    def test_jwt_contains_platform_claim(self):
        """JWT should contain 'plt' claim with platform value"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "platform": "mobile"
        })
        assert response.status_code == 200
        
        token = response.json()["access_token"]
        payload = jwt.decode(token, options={"verify_signature": False})
        
        assert "plt" in payload, "Token missing 'plt' (platform) claim"
        assert payload["plt"] == "mobile", f"Expected plt='mobile', got '{payload['plt']}'"
        print(f"JWT contains platform claim: plt={payload['plt']} - PASS")


class TestCardsPagination:
    """Test pagination on /cards and /public/cards endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_cards_with_pagination(self, auth_token):
        """GET /cards should support skip and limit params"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get first 2 cards
        response = requests.get(f"{BASE_URL}/api/cards?skip=0&limit=2", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        cards = response.json()
        assert isinstance(cards, list), "Response should be a list"
        assert len(cards) <= 2, f"Expected max 2 cards, got {len(cards)}"
        print(f"GET /cards?skip=0&limit=2 returned {len(cards)} cards - PASS")
    
    def test_get_cards_pagination_skip(self, auth_token):
        """GET /cards with skip should offset results"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get all cards first
        all_response = requests.get(f"{BASE_URL}/api/cards?skip=0&limit=50", headers=headers)
        all_cards = all_response.json()
        
        if len(all_cards) < 2:
            pytest.skip("Not enough cards to test pagination skip")
        
        # Get with skip=1
        skip_response = requests.get(f"{BASE_URL}/api/cards?skip=1&limit=50", headers=headers)
        skip_cards = skip_response.json()
        
        # Skipped result should have one less card
        assert len(skip_cards) == len(all_cards) - 1, "Skip should offset results"
        print(f"Pagination skip works: all={len(all_cards)}, skip=1 gives {len(skip_cards)} - PASS")
    
    def test_get_public_cards_with_pagination(self):
        """GET /public/cards should support skip and limit params"""
        response = requests.get(f"{BASE_URL}/api/public/cards?skip=0&limit=2")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        cards = response.json()
        assert isinstance(cards, list), "Response should be a list"
        assert len(cards) <= 2, f"Expected max 2 cards, got {len(cards)}"
        print(f"GET /public/cards?skip=0&limit=2 returned {len(cards)} cards - PASS")
    
    def test_public_cards_pagination_skip(self):
        """GET /public/cards with skip should offset results"""
        # Get first batch
        first_response = requests.get(f"{BASE_URL}/api/public/cards?skip=0&limit=3")
        first_cards = first_response.json()
        
        if len(first_cards) < 3:
            pytest.skip("Not enough public cards to test pagination")
        
        # Get with skip=1
        skip_response = requests.get(f"{BASE_URL}/api/public/cards?skip=1&limit=3")
        skip_cards = skip_response.json()
        
        # First card of skip=1 should be second card of skip=0
        if len(first_cards) >= 2 and len(skip_cards) >= 1:
            assert first_cards[1]["id"] == skip_cards[0]["id"], "Skip should offset results correctly"
            print("Public cards pagination skip verified - PASS")


class TestCardLocationsField:
    """Test Card model 'locations' array field"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_card_has_locations_field(self, auth_token):
        """Card should have 'locations' array field"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/cards/{TEST_CARD_ID}", headers=headers)
        
        if response.status_code == 404:
            pytest.skip(f"Test card {TEST_CARD_ID} not found")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        
        card = response.json()
        # locations field should exist (may be empty array)
        assert "locations" in card, "Card should have 'locations' field"
        assert isinstance(card["locations"], list), "'locations' should be a list"
        print(f"Card has 'locations' field (count: {len(card['locations'])}) - PASS")
    
    def test_create_card_with_locations(self, auth_token):
        """Creating a card with multiple locations should work"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        card_data = {
            "card_type": "personal",
            "title": "TEST_MultiLocation Card",
            "subtitle": "Testing multiple locations",
            "description": "Card with multiple locations for testing",
            "is_public": False,
            "show_in_feed": False,
            "location": {"lat": 40.7128, "lng": -74.0060, "address": "New York, NY", "place_name": "Main Office"},
            "locations": [
                {"lat": 34.0522, "lng": -118.2437, "address": "Los Angeles, CA", "label": "West Coast Office"},
                {"lat": 41.8781, "lng": -87.6298, "address": "Chicago, IL", "label": "Midwest Office"}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/cards", json=card_data, headers=headers)
        assert response.status_code in [200, 201], f"Failed to create card: {response.text}"
        
        created_card = response.json()
        assert "locations" in created_card, "Created card should have 'locations' field"
        assert len(created_card["locations"]) == 2, f"Expected 2 locations, got {len(created_card['locations'])}"
        
        # Verify location data
        assert created_card["locations"][0]["label"] == "West Coast Office"
        assert created_card["locations"][1]["label"] == "Midwest Office"
        
        print(f"Created card with {len(created_card['locations'])} locations - PASS")
        
        # Cleanup - delete test card
        card_id = created_card["id"]
        requests.delete(f"{BASE_URL}/api/cards/{card_id}", headers=headers)


class TestPostsFeedOptimization:
    """Test N+1 query optimization on posts feed"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_posts_feed_returns_enriched_data(self, auth_token):
        """Posts feed should return posts with user info (batch enriched)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/posts?limit=5", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        posts = response.json()
        if len(posts) == 0:
            pytest.skip("No posts available to test")
        
        # Check that posts have enriched user data
        for post in posts[:3]:  # Check first 3
            assert "user" in post, "Post should have 'user' field"
            user = post["user"]
            assert "id" in user, "User should have 'id'"
            assert "username" in user, "User should have 'username'"
            assert "avatar_url" in user, "User should have 'avatar_url'"
            assert "display_name" in user, "User should have 'display_name'"
            
            # Check like/bookmark status fields
            assert "is_liked" in post, "Post should have 'is_liked' field"
            assert "is_bookmarked" in post, "Post should have 'is_bookmarked' field"
        
        print(f"Posts feed returns {len(posts)} posts with enriched user data - PASS")
    
    def test_posts_feed_unauthenticated(self):
        """Posts feed should work without auth (is_liked/is_bookmarked = false)"""
        response = requests.get(f"{BASE_URL}/api/posts?limit=5")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        posts = response.json()
        if len(posts) > 0:
            # Without auth, is_liked and is_bookmarked should be false
            assert posts[0].get("is_liked") == False, "Unauthenticated should have is_liked=false"
            assert posts[0].get("is_bookmarked") == False, "Unauthenticated should have is_bookmarked=false"
        
        print("Posts feed works unauthenticated - PASS")


class TestForYouFeedOptimization:
    """Test N+1 query optimization on for-you feed"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_for_you_feed_returns_enriched_data(self, auth_token):
        """For-you feed should return posts with user info (batch enriched)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/feed/for-you?limit=5", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        posts = response.json()
        if len(posts) == 0:
            pytest.skip("No posts in for-you feed")
        
        # Check that posts have enriched user data
        for post in posts[:3]:
            assert "user" in post, "Post should have 'user' field"
            user = post["user"]
            assert "id" in user, "User should have 'id'"
            assert "username" in user, "User should have 'username'"
            
            # Check like/bookmark status fields
            assert "is_liked" in post, "Post should have 'is_liked' field"
            assert "is_bookmarked" in post, "Post should have 'is_bookmarked' field"
            
            # For-you feed should have reason
            assert "_for_you_reason" in post, "Post should have '_for_you_reason' field"
        
        print(f"For-you feed returns {len(posts)} posts with enriched data - PASS")
    
    def test_for_you_feed_requires_auth(self):
        """For-you feed should require authentication"""
        response = requests.get(f"{BASE_URL}/api/feed/for-you?limit=5")
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print("For-you feed requires auth - PASS")


class TestHealthAndBasicEndpoints:
    """Basic health and endpoint tests"""
    
    def test_health_endpoint(self):
        """Health endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("Health endpoint OK - PASS")
    
    def test_login_endpoint(self):
        """Login should work with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print("Login endpoint OK - PASS")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
