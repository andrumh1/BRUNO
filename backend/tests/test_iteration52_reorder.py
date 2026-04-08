"""
Iteration 52: Card Drag-to-Reorder Testing
Tests:
- PUT /api/cards/reorder endpoint accepts {card_ids: [...]} and returns {status: 'ok', count: N}
- GET /api/cards returns cards sorted by sort_order after reorder
- Login flow works correctly
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


class TestCardReorder:
    """Card reorder endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
        
        login_data = login_response.json()
        self.token = login_data.get("access_token")
        self.user = login_data.get("user")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        
        # Cleanup: No specific cleanup needed
    
    def test_login_success(self):
        """Test login works with test credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == TEST_EMAIL
        print(f"Login successful for {TEST_EMAIL}")
    
    def test_get_cards_returns_list(self):
        """Test GET /api/cards returns user's cards"""
        response = self.session.get(f"{BASE_URL}/api/cards")
        
        assert response.status_code == 200, f"GET /api/cards failed: {response.text}"
        cards = response.json()
        assert isinstance(cards, list), "Response should be a list"
        print(f"Found {len(cards)} cards for user")
        
        # Store card IDs for reorder test
        self.card_ids = [card["id"] for card in cards]
        return cards
    
    def test_reorder_cards_endpoint(self):
        """Test PUT /api/cards/reorder accepts card_ids array and returns status"""
        # First get current cards
        get_response = self.session.get(f"{BASE_URL}/api/cards")
        assert get_response.status_code == 200
        cards = get_response.json()
        
        if len(cards) < 2:
            pytest.skip("Need at least 2 cards to test reorder")
        
        # Get card IDs and reverse order
        original_ids = [card["id"] for card in cards]
        reversed_ids = list(reversed(original_ids))
        
        print(f"Original order: {original_ids[:3]}...")
        print(f"New order: {reversed_ids[:3]}...")
        
        # Call reorder endpoint
        reorder_response = self.session.put(
            f"{BASE_URL}/api/cards/reorder",
            json={"card_ids": reversed_ids}
        )
        
        assert reorder_response.status_code == 200, f"Reorder failed: {reorder_response.text}"
        reorder_data = reorder_response.json()
        
        # Verify response structure
        assert "status" in reorder_data, "Response should have 'status' field"
        assert reorder_data["status"] == "ok", f"Status should be 'ok', got: {reorder_data['status']}"
        assert "count" in reorder_data, "Response should have 'count' field"
        assert reorder_data["count"] == len(reversed_ids), f"Count should be {len(reversed_ids)}, got: {reorder_data['count']}"
        
        print(f"Reorder successful: {reorder_data}")
    
    def test_cards_sorted_after_reorder(self):
        """Test GET /api/cards returns cards in new sort_order after reorder"""
        # First get current cards
        get_response = self.session.get(f"{BASE_URL}/api/cards")
        assert get_response.status_code == 200
        cards = get_response.json()
        
        if len(cards) < 2:
            pytest.skip("Need at least 2 cards to test reorder")
        
        # Get card IDs and reverse order
        original_ids = [card["id"] for card in cards]
        reversed_ids = list(reversed(original_ids))
        
        # Reorder cards
        reorder_response = self.session.put(
            f"{BASE_URL}/api/cards/reorder",
            json={"card_ids": reversed_ids}
        )
        assert reorder_response.status_code == 200
        
        # Get cards again and verify order
        get_response2 = self.session.get(f"{BASE_URL}/api/cards")
        assert get_response2.status_code == 200
        cards_after = get_response2.json()
        
        new_ids = [card["id"] for card in cards_after]
        
        # Verify the order matches what we set
        assert new_ids == reversed_ids, f"Cards not in expected order. Expected: {reversed_ids[:3]}..., Got: {new_ids[:3]}..."
        
        print(f"Cards correctly sorted after reorder")
        print(f"First card ID: {new_ids[0]}")
        print(f"Last card ID: {new_ids[-1]}")
    
    def test_reorder_with_empty_array(self):
        """Test reorder with empty array returns count 0"""
        reorder_response = self.session.put(
            f"{BASE_URL}/api/cards/reorder",
            json={"card_ids": []}
        )
        
        assert reorder_response.status_code == 200, f"Reorder with empty array failed: {reorder_response.text}"
        data = reorder_response.json()
        assert data["status"] == "ok"
        assert data["count"] == 0
        print("Reorder with empty array works correctly")
    
    def test_reorder_with_single_card(self):
        """Test reorder with single card works"""
        # Get cards
        get_response = self.session.get(f"{BASE_URL}/api/cards")
        assert get_response.status_code == 200
        cards = get_response.json()
        
        if len(cards) < 1:
            pytest.skip("Need at least 1 card to test")
        
        single_id = [cards[0]["id"]]
        
        reorder_response = self.session.put(
            f"{BASE_URL}/api/cards/reorder",
            json={"card_ids": single_id}
        )
        
        assert reorder_response.status_code == 200
        data = reorder_response.json()
        assert data["status"] == "ok"
        assert data["count"] == 1
        print("Reorder with single card works correctly")
    
    def test_reorder_requires_auth(self):
        """Test reorder endpoint requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        reorder_response = no_auth_session.put(
            f"{BASE_URL}/api/cards/reorder",
            json={"card_ids": ["test-id"]}
        )
        
        # Should return 401 or 403
        assert reorder_response.status_code in [401, 403], f"Expected 401/403, got: {reorder_response.status_code}"
        print("Reorder correctly requires authentication")


class TestProfileEndpoints:
    """Test profile-related endpoints needed for profile page"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code}")
        
        login_data = login_response.json()
        self.token = login_data.get("access_token")
        self.user = login_data.get("user")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_user_profile(self):
        """Test GET /api/users/{user_id}/profile returns profile data"""
        user_id = self.user["id"]
        response = self.session.get(f"{BASE_URL}/api/users/{user_id}/profile")
        
        assert response.status_code == 200, f"Get profile failed: {response.text}"
        profile = response.json()
        assert "name" in profile or "user_id" in profile, "Profile should have name or user_id"
        print(f"Profile loaded for user {user_id}")
    
    def test_get_auth_me(self):
        """Test GET /api/auth/me returns current user"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 200, f"Get /auth/me failed: {response.text}"
        user = response.json()
        assert user["email"] == TEST_EMAIL
        print(f"Auth/me returned user: {user['email']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
