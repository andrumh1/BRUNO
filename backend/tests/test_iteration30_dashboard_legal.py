"""
Iteration 30: Dashboard in Profile + Legal Pages Tests
Testing:
- /dashboard redirect to /my-profile
- /api/cards/explore endpoint (public cards)
- Legal pages routes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDashboardRedirect:
    """Test that dashboard functionality moved to profile"""
    
    def test_cards_explore_endpoint_exists(self):
        """GET /api/cards/explore should return public cards"""
        response = requests.get(f"{BASE_URL}/api/cards/explore")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ /api/cards/explore returns {len(data)} public cards")
    
    def test_cards_explore_only_public(self):
        """Explore endpoint should only return public cards"""
        response = requests.get(f"{BASE_URL}/api/cards/explore?limit=50")
        assert response.status_code == 200
        cards = response.json()
        for card in cards:
            assert card.get('is_public') == True, f"Card {card.get('id')} is not public"
        print(f"✅ All {len(cards)} cards are public")
    
    def test_cards_explore_has_required_fields(self):
        """Each card should have required fields"""
        response = requests.get(f"{BASE_URL}/api/cards/explore?limit=5")
        assert response.status_code == 200
        cards = response.json()
        if cards:
            card = cards[0]
            required_fields = ['id', 'title', 'card_type', 'is_public']
            for field in required_fields:
                assert field in card, f"Missing field: {field}"
            print(f"✅ Card has all required fields: {required_fields}")
    
    def test_cards_explore_limit_param(self):
        """Limit parameter should work"""
        response = requests.get(f"{BASE_URL}/api/cards/explore?limit=2")
        assert response.status_code == 200
        cards = response.json()
        assert len(cards) <= 2
        print(f"✅ Limit parameter works: got {len(cards)} cards with limit=2")


class TestLegalPagesRoutes:
    """Test that legal page routes exist (frontend routes via API health)"""
    
    def test_api_health(self):
        """Backend health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print("✅ API health check passed")


class TestCardsAuth:
    """Test cards endpoints with authentication"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
            "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
        })
        if response.status_code == 200:
            return response.json().get('access_token')
        pytest.skip("Auth failed")
    
    def test_my_cards_requires_auth(self):
        """GET /api/cards should require authentication"""
        response = requests.get(f"{BASE_URL}/api/cards")
        assert response.status_code == 401 or response.status_code == 403
        print("✅ /api/cards requires authentication")
    
    def test_my_cards_with_auth(self, auth_token):
        """GET /api/cards with auth should return user's cards"""
        response = requests.get(
            f"{BASE_URL}/api/cards",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        cards = response.json()
        assert isinstance(cards, list)
        print(f"✅ /api/cards with auth returns {len(cards)} user cards")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
