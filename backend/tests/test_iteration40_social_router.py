"""
Iteration 40: Social Router Refactor & Card UI Tests
Tests for:
- Social endpoints moved to routers/social.py
- Follow/unfollow, block, bookmarks, reactions, polls
- Stripe checkout flow
- Card view page full-width layout
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


class TestAuth:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Authentication failed")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get auth headers"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestSocialRouterTrending:
    """Test /api/social/trending endpoint (public)"""
    
    def test_trending_returns_list(self):
        """GET /api/social/trending returns hashtag list"""
        response = requests.get(f"{BASE_URL}/api/social/trending")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "hashtag" in data[0]
            assert "count" in data[0]


class TestSocialRouterExplore:
    """Test /api/social/explore endpoint (public)"""
    
    def test_explore_returns_posts(self):
        """GET /api/social/explore returns posts list"""
        response = requests.get(f"{BASE_URL}/api/social/explore")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "user" in data[0]
    
    def test_explore_with_category(self):
        """GET /api/social/explore?category=recent works"""
        response = requests.get(f"{BASE_URL}/api/social/explore?category=recent")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestSocialRouterSuggested:
    """Test /api/social/suggested endpoint (auth required)"""
    
    def test_suggested_requires_auth(self):
        """GET /api/social/suggested requires authentication"""
        response = requests.get(f"{BASE_URL}/api/social/suggested")
        assert response.status_code in [401, 403]
    
    def test_suggested_returns_users(self, auth_headers):
        """GET /api/social/suggested returns user suggestions"""
        response = requests.get(f"{BASE_URL}/api/social/suggested", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "name" in data[0]


class TestSocialRouterBlocked:
    """Test /api/users/me/blocked endpoint (auth required)"""
    
    def test_blocked_requires_auth(self):
        """GET /api/users/me/blocked requires authentication"""
        response = requests.get(f"{BASE_URL}/api/users/me/blocked")
        assert response.status_code in [401, 403]
    
    def test_blocked_returns_list(self, auth_headers):
        """GET /api/users/me/blocked returns blocked users list"""
        response = requests.get(f"{BASE_URL}/api/users/me/blocked", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestSocialRouterFollow:
    """Test follow/unfollow endpoints"""
    
    def test_follow_requires_auth(self):
        """POST /api/users/{id}/follow requires authentication"""
        response = requests.post(f"{BASE_URL}/api/users/test-user-id/follow")
        assert response.status_code in [401, 403]
    
    def test_follow_toggle(self, auth_headers):
        """POST /api/users/{id}/follow toggles follow status"""
        # Get a user to follow
        response = requests.get(f"{BASE_URL}/api/social/suggested", headers=auth_headers)
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No users to follow")
        
        user_id = response.json()[0]["id"]
        
        # Follow
        response = requests.post(f"{BASE_URL}/api/users/{user_id}/follow", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "following" in data
        
        # Unfollow (toggle back)
        response = requests.post(f"{BASE_URL}/api/users/{user_id}/follow", headers=auth_headers)
        assert response.status_code == 200


class TestSocialRouterBookmarks:
    """Test bookmark endpoints"""
    
    def test_bookmark_requires_auth(self):
        """POST /api/posts/{id}/bookmark requires authentication"""
        response = requests.post(f"{BASE_URL}/api/posts/test-post-id/bookmark")
        assert response.status_code in [401, 403]
    
    def test_bookmark_toggle(self, auth_headers):
        """POST /api/posts/{id}/bookmark toggles bookmark"""
        # Get a post to bookmark
        response = requests.get(f"{BASE_URL}/api/social/explore")
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No posts to bookmark")
        
        post_id = response.json()[0]["id"]
        
        # Bookmark
        response = requests.post(f"{BASE_URL}/api/posts/{post_id}/bookmark", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "bookmarked" in data
        
        # Unbookmark (toggle back)
        response = requests.post(f"{BASE_URL}/api/posts/{post_id}/bookmark", headers=auth_headers)
        assert response.status_code == 200


class TestSocialRouterReactions:
    """Test reaction endpoints"""
    
    def test_react_requires_auth(self):
        """POST /api/posts/{id}/react requires authentication"""
        response = requests.post(f"{BASE_URL}/api/posts/test-post-id/react?reaction_type=like")
        assert response.status_code in [401, 403]
    
    def test_react_to_post(self, auth_headers):
        """POST /api/posts/{id}/react?reaction_type=like works"""
        # Get a post to react to
        response = requests.get(f"{BASE_URL}/api/social/explore")
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No posts to react to")
        
        post_id = response.json()[0]["id"]
        
        # React
        response = requests.post(
            f"{BASE_URL}/api/posts/{post_id}/react?reaction_type=like",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "reacted" in data
        assert "reaction_type" in data
    
    def test_get_reactions(self):
        """GET /api/posts/{id}/reactions returns reaction summary"""
        # Get a post
        response = requests.get(f"{BASE_URL}/api/social/explore")
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No posts")
        
        post_id = response.json()[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/posts/{post_id}/reactions")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "types" in data


class TestSocialRouterPolls:
    """Test poll endpoints"""
    
    def test_create_poll_requires_auth(self):
        """POST /api/social/polls requires authentication"""
        response = requests.post(f"{BASE_URL}/api/social/polls", json={
            "question": "Test poll?",
            "options": ["Yes", "No"]
        })
        assert response.status_code in [401, 403]
    
    def test_create_and_get_poll(self, auth_headers):
        """Create poll and retrieve it"""
        # Create poll
        poll_data = {
            "question": f"TEST_Poll_{uuid.uuid4().hex[:8]}",
            "options": ["Option A", "Option B", "Option C"],
            "duration_hours": 24
        }
        response = requests.post(f"{BASE_URL}/api/social/polls", json=poll_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["question"] == poll_data["question"]
        assert len(data["options"]) == 3
        
        poll_id = data["id"]
        
        # Get poll
        response = requests.get(f"{BASE_URL}/api/social/polls/{poll_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == poll_id


class TestStripePayments:
    """Test Stripe payment endpoints"""
    
    def test_get_packages(self):
        """GET /api/payments/packages returns available packages"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200
        data = response.json()
        assert "analytics_monthly" in data
        assert "analytics_yearly" in data
        assert "premium_monthly" in data
        
        # Verify package structure
        pkg = data["analytics_monthly"]
        assert pkg["amount"] == 4.99
        assert "features" in pkg
    
    def test_subscription_requires_auth(self):
        """GET /api/payments/subscription requires authentication"""
        response = requests.get(f"{BASE_URL}/api/payments/subscription")
        assert response.status_code in [401, 403]
    
    def test_get_subscription(self, auth_headers):
        """GET /api/payments/subscription returns user subscription status"""
        response = requests.get(f"{BASE_URL}/api/payments/subscription", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "tier" in data
        assert "is_active" in data
    
    def test_checkout_requires_auth(self):
        """POST /api/payments/checkout requires authentication"""
        response = requests.post(f"{BASE_URL}/api/payments/checkout", json={
            "package_id": "analytics_monthly",
            "origin_url": "https://example.com"
        })
        assert response.status_code in [401, 403]
    
    def test_checkout_creates_session(self, auth_headers):
        """POST /api/payments/checkout creates Stripe session"""
        response = requests.post(f"{BASE_URL}/api/payments/checkout", json={
            "package_id": "analytics_monthly",
            "origin_url": "https://premium-launch-13.preview.emergentagent.com"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "session_id" in data
        # Verify URL is a Stripe checkout URL
        assert "stripe.com" in data["url"] or "checkout" in data["url"]


class TestCardEndpoints:
    """Test card-related endpoints"""
    
    def test_get_user_cards(self, auth_headers):
        """GET /api/cards returns user's cards"""
        response = requests.get(f"{BASE_URL}/api/cards", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_card_by_id(self, auth_headers):
        """GET /api/cards/{id} returns card details"""
        # First get a card ID
        response = requests.get(f"{BASE_URL}/api/cards", headers=auth_headers)
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No cards available")
        
        card_id = response.json()[0]["id"]
        
        # Get card details
        response = requests.get(f"{BASE_URL}/api/cards/{card_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == card_id
        assert "title" in data


class TestFollowersFollowing:
    """Test followers/following list endpoints"""
    
    def test_get_followers(self, auth_headers):
        """GET /api/users/{id}/followers returns followers list"""
        # Get current user ID
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        if response.status_code != 200:
            pytest.skip("Cannot get current user")
        
        user_id = response.json()["id"]
        
        response = requests.get(f"{BASE_URL}/api/users/{user_id}/followers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_following(self, auth_headers):
        """GET /api/users/{id}/following returns following list"""
        # Get current user ID
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        if response.status_code != 200:
            pytest.skip("Cannot get current user")
        
        user_id = response.json()["id"]
        
        response = requests.get(f"{BASE_URL}/api/users/{user_id}/following")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestHashtagSearch:
    """Test hashtag search endpoint"""
    
    def test_get_posts_by_hashtag(self):
        """GET /api/social/hashtag/{tag} returns posts"""
        response = requests.get(f"{BASE_URL}/api/social/hashtag/bruno")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
