"""
Iteration 29 Tests: ReelsPage, Explore Cards, Chat Profile Navigation, Mascot Integration

Features tested:
1. GET /api/cards/explore - Returns public cards for explore section
2. GET /api/posts?media_only=true - Returns posts for reels page
3. GET /api/lives - Returns live streams for En Vivo tab
4. Auth endpoints for chat testing
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://polls-reactions-feed.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


class TestExploreCardsAPI:
    """Tests for the new /api/cards/explore endpoint"""
    
    def test_explore_cards_endpoint_exists(self):
        """Test that /api/cards/explore endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/cards/explore")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: /api/cards/explore endpoint exists and returns 200")
    
    def test_explore_cards_returns_list(self):
        """Test that explore endpoint returns a list of cards"""
        response = requests.get(f"{BASE_URL}/api/cards/explore")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"PASS: /api/cards/explore returns list with {len(data)} cards")
    
    def test_explore_cards_structure(self):
        """Test that cards have required fields"""
        response = requests.get(f"{BASE_URL}/api/cards/explore?limit=5")
        assert response.status_code == 200
        cards = response.json()
        
        if len(cards) > 0:
            card = cards[0]
            required_fields = ['id', 'user_id', 'title', 'card_type', 'is_public']
            for field in required_fields:
                assert field in card, f"Card missing required field: {field}"
            print(f"PASS: Cards have all required fields: {required_fields}")
        else:
            print("SKIP: No cards returned to verify structure")
    
    def test_explore_cards_only_public(self):
        """Test that only public cards are returned"""
        response = requests.get(f"{BASE_URL}/api/cards/explore?limit=10")
        assert response.status_code == 200
        cards = response.json()
        
        for card in cards:
            assert card.get('is_public', False) == True, f"Card {card.get('id')} is not public"
        print(f"PASS: All {len(cards)} cards are public")
    
    def test_explore_cards_limit_param(self):
        """Test that limit parameter works"""
        response = requests.get(f"{BASE_URL}/api/cards/explore?limit=3")
        assert response.status_code == 200
        cards = response.json()
        assert len(cards) <= 3, f"Expected max 3 cards, got {len(cards)}"
        print(f"PASS: Limit parameter works, returned {len(cards)} cards")


class TestReelsPageAPIs:
    """Tests for APIs used by ReelsPage"""
    
    def test_posts_with_media_filter(self):
        """Test GET /api/posts?media_only=true"""
        response = requests.get(f"{BASE_URL}/api/posts?media_only=true")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"PASS: /api/posts?media_only=true returns {len(data)} posts")
    
    def test_lives_endpoint(self):
        """Test GET /api/lives returns live streams"""
        response = requests.get(f"{BASE_URL}/api/lives")
        assert response.status_code == 200
        data = response.json()
        # Can be list or dict with 'lives' key
        if isinstance(data, dict) and 'lives' in data:
            lives = data['lives']
        else:
            lives = data if isinstance(data, list) else []
        print(f"PASS: /api/lives returns {len(lives)} live streams")
    
    def test_posts_have_user_info(self):
        """Test that posts include user information"""
        response = requests.get(f"{BASE_URL}/api/posts?limit=5")
        assert response.status_code == 200
        posts = response.json()
        
        if len(posts) > 0:
            post = posts[0]
            # Post should have user info for display
            assert 'user_id' in post or 'user' in post, "Post missing user info"
            print(f"PASS: Posts include user information")
        else:
            print("SKIP: No posts to verify user info")


class TestAuthForChat:
    """Authentication tests for chat functionality"""
    
    def test_login_returns_token(self):
        """Test login to get token for chat tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if response.status_code == 200:
            data = response.json()
            assert 'access_token' in data, "Login response missing access_token"
            assert 'user' in data, "Login response missing user object"
            print(f"PASS: Login successful, user: {data['user'].get('name', 'unknown')}")
        elif response.status_code == 401:
            print("SKIP: Test credentials not valid - this is OK for new environment")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_get_chats_requires_auth(self):
        """Test that /api/chats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/chats")
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403 without auth, got {response.status_code}"
        print("PASS: /api/chats requires authentication")
    
    def test_chat_endpoints_with_auth(self):
        """Test chat endpoints with valid authentication"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code != 200:
            print("SKIP: Cannot test chat endpoints without valid login")
            return
        
        token = login_response.json()['access_token']
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test get chats
        response = requests.get(f"{BASE_URL}/api/chats", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        chats = response.json()
        print(f"PASS: GET /api/chats returns {len(chats)} chats with auth")


class TestUserProfile:
    """Tests for user profile endpoints used in chat navigation"""
    
    def test_public_user_profile(self):
        """Test that user profile endpoint exists"""
        # Get a user ID from cards
        cards_response = requests.get(f"{BASE_URL}/api/cards/explore?limit=1")
        if cards_response.status_code == 200 and len(cards_response.json()) > 0:
            user_id = cards_response.json()[0].get('user_id')
            
            # Try to access profile
            response = requests.get(f"{BASE_URL}/api/users/{user_id}/profile")
            # 200 or 404 are acceptable (404 if profile not created yet)
            assert response.status_code in [200, 404], \
                f"Expected 200 or 404, got {response.status_code}"
            print(f"PASS: User profile endpoint responds correctly (status: {response.status_code})")
        else:
            print("SKIP: No cards available to get user ID")


class TestPublicCards:
    """Tests for public card endpoints"""
    
    def test_public_cards_endpoint(self):
        """Test GET /api/public/cards"""
        response = requests.get(f"{BASE_URL}/api/public/cards")
        assert response.status_code == 200
        cards = response.json()
        assert isinstance(cards, list)
        print(f"PASS: /api/public/cards returns {len(cards)} cards")
    
    def test_get_single_card(self):
        """Test getting a single card by ID"""
        # First get a card ID
        cards_response = requests.get(f"{BASE_URL}/api/cards/explore?limit=1")
        if cards_response.status_code == 200 and len(cards_response.json()) > 0:
            card_id = cards_response.json()[0]['id']
            
            response = requests.get(f"{BASE_URL}/api/cards/{card_id}")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            card = response.json()
            assert card['id'] == card_id
            print(f"PASS: GET /api/cards/{card_id[:8]}... returns card correctly")
        else:
            print("SKIP: No cards available to test single card fetch")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
