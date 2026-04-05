"""
Iteration 51: Card View Modes & Long-Press Preview Tests
Tests for:
- GET /api/cards (authenticated)
- GET /api/public/cards (public)
- Card endpoints still working after UI changes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


class TestHealthAndPublicEndpoints:
    """Test health and public card endpoints"""
    
    def test_health_endpoint(self):
        """Test API health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health endpoint working")
    
    def test_public_cards_endpoint(self):
        """Test public cards endpoint returns cards"""
        response = requests.get(f"{BASE_URL}/api/public/cards")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Public cards endpoint returned {len(data)} cards")
        
        # Verify card structure if cards exist
        if len(data) > 0:
            card = data[0]
            assert "id" in card
            assert "title" in card
            assert "card_type" in card
            print(f"✓ Card structure valid: {card.get('title', 'N/A')}")


class TestAuthenticatedCardEndpoints:
    """Test authenticated card endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code}")
        return response.json().get("access_token")
    
    def test_authenticated_cards_endpoint(self, auth_token):
        """Test authenticated cards endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/cards", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Authenticated cards endpoint returned {len(data)} cards")
    
    def test_user_profile_endpoint(self, auth_token):
        """Test user profile endpoint"""
        # First get user info from token
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        user = response.json()
        user_id = user.get("id")
        
        # Get user profile
        response = requests.get(f"{BASE_URL}/api/users/{user_id}/profile", headers=headers)
        assert response.status_code == 200
        profile = response.json()
        assert "name" in profile or "email" in profile
        print(f"✓ User profile endpoint working for user: {profile.get('name', profile.get('email', 'N/A'))}")
    
    def test_my_cards_endpoint(self, auth_token):
        """Test user's own cards endpoint via /api/cards"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/cards", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ My cards endpoint returned {len(data)} cards")


class TestCardViewEndpoint:
    """Test individual card view endpoint"""
    
    def test_view_public_card(self):
        """Test viewing a public card by ID"""
        # First get a public card
        response = requests.get(f"{BASE_URL}/api/public/cards")
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No public cards available")
        
        card_id = response.json()[0].get("id")
        
        # View the card
        response = requests.get(f"{BASE_URL}/api/cards/{card_id}")
        assert response.status_code == 200
        card = response.json()
        assert card.get("id") == card_id
        print(f"✓ Card view endpoint working for card: {card.get('title', 'N/A')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
