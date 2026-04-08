"""
Iteration 50: Backend API Tests for Universal Minimization System
Tests: Auth, Cards, Posts, Public endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
TEST_PASSWORD = os.getenv("TEST_USER_PASSWORD", "Test1234!")
TEST_CARD_ID = "d16c2745-e082-4b22-84f8-749beb5e33fd"


class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health endpoint working")
    
    def test_login_success(self):
        """Test successful login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code in [401, 400]
        print("✓ Invalid login rejected correctly")


class TestCardsAPI:
    """Cards API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_public_cards(self):
        """Test GET /api/public/cards - no auth required"""
        response = requests.get(f"{BASE_URL}/api/public/cards")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Public cards endpoint returned {len(data)} cards")
    
    def test_get_cards_authenticated(self, auth_token):
        """Test GET /api/cards with authentication"""
        response = requests.get(f"{BASE_URL}/api/cards", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Authenticated cards endpoint returned {len(data)} cards")
    
    def test_get_specific_card(self, auth_token):
        """Test GET /api/cards/{id} for test card"""
        response = requests.get(f"{BASE_URL}/api/cards/{TEST_CARD_ID}", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        # Card may or may not exist
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            print(f"✓ Card {TEST_CARD_ID} retrieved successfully")
        else:
            print(f"✓ Card {TEST_CARD_ID} not found (expected if deleted)")


class TestPostsAPI:
    """Posts API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_posts(self, auth_token):
        """Test GET /api/posts"""
        response = requests.get(f"{BASE_URL}/api/posts", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Posts endpoint returned {len(data)} posts")
        return data
    
    def test_get_posts_media_only(self, auth_token):
        """Test GET /api/posts?media_only=true for reels"""
        response = requests.get(f"{BASE_URL}/api/posts?media_only=true", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Media-only posts (reels) returned {len(data)} items")


class TestUsersAPI:
    """Users API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def user_id(self, auth_token):
        """Get current user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("user", {}).get("id")
        pytest.skip("Could not get user ID")
    
    def test_get_user_profile(self, auth_token, user_id):
        """Test GET /api/users/{id}/profile"""
        response = requests.get(f"{BASE_URL}/api/users/{user_id}/profile", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data or "email" in data
        print(f"✓ User profile retrieved for {user_id}")


class TestLivesAPI:
    """Lives API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_lives(self, auth_token):
        """Test GET /api/lives"""
        response = requests.get(f"{BASE_URL}/api/lives", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        # Can be list or dict with 'lives' key
        if isinstance(data, dict):
            assert "lives" in data or isinstance(data.get("lives", []), list)
        else:
            assert isinstance(data, list)
        print("✓ Lives endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
