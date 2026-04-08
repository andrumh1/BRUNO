"""
Iteration 37: Card Analytics and Chat Modernization Tests
Tests for:
- Card Analytics: POST /api/analytics/cards/{card_id}/view (track view)
- Card Analytics: GET /api/analytics/cards/{card_id}?days=30 (card detail analytics)
- Card Analytics: GET /api/analytics/overview (overview of all cards)
- Chat: Verify chat endpoints work for profile linking
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from main agent
TEST_EMAIL = os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
TEST_PASSWORD = os.getenv("TEST_USER_PASSWORD", "Test1234!")
TEST_CARD_ID = "d16c2745-e082-4b22-84f8-749beb5e33fd"


class TestAuth:
    """Authentication tests to get token for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    def test_login_success(self, auth_token):
        """Verify login works and returns token"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"✓ Login successful, token obtained")


class TestCardAnalyticsTrackView:
    """Test POST /api/analytics/cards/{card_id}/view - Track card view"""
    
    def test_track_view_without_auth(self):
        """Track view without authentication (public cards)"""
        response = requests.post(f"{BASE_URL}/api/analytics/cards/{TEST_CARD_ID}/view")
        assert response.status_code == 200, f"Track view failed: {response.text}"
        data = response.json()
        assert data.get("status") == "tracked", f"Expected status 'tracked', got: {data}"
        print(f"✓ Track view without auth: {data}")
    
    def test_track_view_with_auth(self):
        """Track view with authentication"""
        # First login
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        
        response = requests.post(
            f"{BASE_URL}/api/analytics/cards/{TEST_CARD_ID}/view",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Track view with auth failed: {response.text}"
        data = response.json()
        assert data.get("status") == "tracked"
        print(f"✓ Track view with auth: {data}")
    
    def test_track_view_with_source_url(self):
        """Track view with source_url parameter"""
        response = requests.post(
            f"{BASE_URL}/api/analytics/cards/{TEST_CARD_ID}/view",
            params={"source_url": "https://google.com"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "tracked"
        print(f"✓ Track view with source_url: {data}")
    
    def test_track_view_nonexistent_card(self):
        """Track view for non-existent card returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.post(f"{BASE_URL}/api/analytics/cards/{fake_id}/view")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Track view nonexistent card returns 404")


class TestCardAnalyticsDetail:
    """Test GET /api/analytics/cards/{card_id}?days=30 - Card detail analytics"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_card_analytics_requires_auth(self):
        """Get card analytics without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/analytics/cards/{TEST_CARD_ID}")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Card analytics requires auth (status {response.status_code})")
    
    def test_get_card_analytics_with_auth(self, auth_token):
        """Get card analytics with authentication"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/cards/{TEST_CARD_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Could be 200 (owner) or 403 (not owner)
        if response.status_code == 200:
            data = response.json()
            assert "card_id" in data
            assert "total_views" in data
            assert "unique_viewers" in data
            assert "daily_views" in data
            assert "device_breakdown" in data
            assert "source_breakdown" in data
            assert "recent_viewers" in data
            print(f"✓ Card analytics retrieved: total_views={data.get('total_views')}, unique={data.get('unique_viewers')}")
        elif response.status_code == 403:
            print(f"✓ Card analytics returns 403 for non-owner (expected)")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_get_card_analytics_with_days_param(self, auth_token):
        """Get card analytics with custom days parameter"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/cards/{TEST_CARD_ID}?days=7",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code == 200:
            data = response.json()
            assert data.get("period_days") == 7
            print(f"✓ Card analytics with days=7: period_days={data.get('period_days')}")
        elif response.status_code == 403:
            print(f"✓ Card analytics returns 403 for non-owner")
    
    def test_get_card_analytics_nonexistent_card(self, auth_token):
        """Get analytics for non-existent card returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/analytics/cards/{fake_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404
        print(f"✓ Card analytics nonexistent card returns 404")


class TestCardAnalyticsOverview:
    """Test GET /api/analytics/overview - Overview of all user's cards"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_overview_requires_auth(self):
        """Overview endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/overview")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Overview requires auth (status {response.status_code})")
    
    def test_overview_with_auth(self, auth_token):
        """Get analytics overview with authentication"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/overview",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Overview failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total_views" in data
        assert "total_unique_visitors" in data
        assert "cards" in data
        assert "daily_views" in data
        assert isinstance(data["cards"], list)
        assert isinstance(data["daily_views"], list)
        
        print(f"✓ Overview retrieved: total_views={data.get('total_views')}, cards_count={len(data.get('cards', []))}")
        
        # Verify card structure if cards exist
        if data["cards"]:
            card = data["cards"][0]
            assert "id" in card
            assert "title" in card
            assert "views_30d" in card
            print(f"  First card: {card.get('title')} - {card.get('views_30d')} views (30d)")


class TestChatEndpoints:
    """Test chat endpoints for profile linking verification"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_chats_list(self, auth_token):
        """Get list of chats"""
        response = requests.get(
            f"{BASE_URL}/api/chats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get chats failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Chats list retrieved: {len(data)} chats")
        
        # Verify chat structure if chats exist
        if data:
            chat = data[0]
            assert "id" in chat
            assert "other_participants" in chat
            if chat["other_participants"]:
                participant = chat["other_participants"][0]
                assert "id" in participant, "Participant should have id for profile linking"
                print(f"  First chat participant has id: {participant.get('id')}")
    
    def test_user_search_for_chat(self, auth_token):
        """Search users for starting new chat"""
        response = requests.get(
            f"{BASE_URL}/api/users/search?q=test",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"User search failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ User search returned {len(data)} results")
        
        # Verify user structure for profile linking
        if data:
            user = data[0]
            assert "id" in user, "User should have id for profile linking"
            print(f"  First user has id: {user.get('id')}")


class TestHashtagAndMentionLinks:
    """Test hashtag and mention endpoints for PostCard links"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_hashtag_posts_endpoint(self, auth_token):
        """Get posts by hashtag"""
        response = requests.get(
            f"{BASE_URL}/api/social/hashtag/test",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Could be 200 or 404 if no posts with that hashtag
        assert response.status_code in [200, 404], f"Hashtag endpoint failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            print(f"✓ Hashtag posts endpoint works: {len(data)} posts")
        else:
            print(f"✓ Hashtag posts endpoint returns 404 (no posts with #test)")
    
    def test_trending_hashtags(self, auth_token):
        """Get trending hashtags"""
        response = requests.get(f"{BASE_URL}/api/social/trending")
        assert response.status_code == 200, f"Trending failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Trending hashtags: {len(data)} hashtags")
    
    def test_user_profile_endpoint(self, auth_token):
        """Get user profile by ID"""
        # First get current user to get a valid user ID
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert me_response.status_code == 200
        user_id = me_response.json().get("id")
        
        # Now get profile
        response = requests.get(f"{BASE_URL}/api/users/{user_id}/profile")
        assert response.status_code == 200, f"Profile endpoint failed: {response.text}"
        data = response.json()
        assert "id" in data or "user_id" in data
        print(f"✓ User profile endpoint works")


class TestSuggestedUsers:
    """Test suggested users endpoint for FeedPage sidebar"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_suggested_users(self, auth_token):
        """Get suggested users"""
        response = requests.get(
            f"{BASE_URL}/api/social/suggested",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Suggested users failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Suggested users: {len(data)} users")
        
        # Verify user structure for profile linking
        if data:
            user = data[0]
            assert "id" in user, "Suggested user should have id for profile linking"
            print(f"  First suggested user has id: {user.get('id')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
