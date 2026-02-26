"""
Iteration 19 - Backend API Tests
Testing: Login, Map, Analytics (Pro), Product Form, Card Creation, Profile Edit, Chat

Test Categories:
1. Authentication - Login flow
2. Map - Leaflet map data endpoints
3. Analytics - Pro/Business tier access
4. Marketplace - Product creation
5. Cards - Card CRUD operations
6. Profile - User profile updates
7. Chat - Chat functionality
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


def get_auth_token():
    """Helper to get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    data = response.json()
    # Token is returned as 'access_token' not 'token'
    return data.get("access_token") or data.get("token")


class TestAuthentication:
    """Test login functionality"""
    
    def test_login_success(self):
        """Test successful login returns token and user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        # Token can be 'access_token' or 'token'
        token = data.get("access_token") or data.get("token")
        assert token, f"No token in response: {data.keys()}"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == TEST_EMAIL
        print(f"SUCCESS: Login returned token and user")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print(f"SUCCESS: Invalid credentials rejected with {response.status_code}")
    
    def test_auth_me_endpoint(self):
        """Test /api/auth/me returns user data with token"""
        token = get_auth_token()
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        
        data = response.json()
        assert "email" in data
        assert "subscription_tier" in data
        print(f"SUCCESS: Auth/me returned user with subscription_tier: {data.get('subscription_tier')}")


class TestMapEndpoints:
    """Test map-related endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        return get_auth_token()
    
    def test_cards_endpoint(self, auth_token):
        """Test cards endpoint returns user's cards"""
        response = requests.get(f"{BASE_URL}/api/cards", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Cards fetch failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Cards endpoint returned {len(data)} cards")
    
    def test_cards_public_with_location(self, auth_token):
        """Test public cards endpoint (for map markers)"""
        response = requests.get(f"{BASE_URL}/api/cards/public?with_location=true", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        # May return 404 if no public cards with location
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"SUCCESS: Cards/public endpoint returned status {response.status_code}")


class TestAnalyticsEndpoints:
    """Test analytics endpoints (Pro/Business tier required)"""
    
    @pytest.fixture
    def auth_token(self):
        return get_auth_token()
    
    def test_subscription_status(self, auth_token):
        """Test getting subscription status"""
        response = requests.get(f"{BASE_URL}/api/store/subscription", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Subscription check failed: {response.text}"
        
        data = response.json()
        assert "tier" in data
        assert "is_verified" in data
        print(f"SUCCESS: Subscription tier is {data.get('tier')}")
        return data.get("tier")
    
    def test_analytics_overview(self, auth_token):
        """Test analytics overview endpoint"""
        # First check subscription tier
        sub_res = requests.get(f"{BASE_URL}/api/store/subscription", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        tier = sub_res.json().get("tier")
        
        response = requests.get(f"{BASE_URL}/api/analytics/overview", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        if tier == "free":
            assert response.status_code == 403, f"Free tier should be blocked, got {response.status_code}"
            print("SUCCESS: Free tier blocked from analytics (403)")
        else:
            assert response.status_code == 200, f"Pro/Business should have access: {response.text}"
            data = response.json()
            assert "total_cards" in data
            print(f"SUCCESS: Analytics overview accessible for {tier} tier")
    
    def test_analytics_track_card(self, auth_token):
        """Test tracking card view (public endpoint)"""
        # Get a card ID first
        cards_res = requests.get(f"{BASE_URL}/api/cards", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        cards = cards_res.json()
        
        if cards and len(cards) > 0:
            card_id = cards[0]["id"]
            response = requests.post(f"{BASE_URL}/api/analytics/track/card/{card_id}", 
                headers={"Authorization": f"Bearer {auth_token}"},
                json={"referrer": "test", "user_agent": "pytest"}
            )
            assert response.status_code == 200, f"Track failed: {response.text}"
            data = response.json()
            assert data.get("tracked") == True
            print(f"SUCCESS: Card view tracked for card {card_id}")
        else:
            pytest.skip("No cards available to track")


class TestMarketplaceEndpoints:
    """Test marketplace/product endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        return get_auth_token()
    
    def test_marketplace_products_list(self, auth_token):
        """Test fetching marketplace products"""
        response = requests.get(f"{BASE_URL}/api/marketplace/products", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Products fetch failed: {response.text}"
        
        data = response.json()
        # Response can be a list or object with 'products' key
        if isinstance(data, dict):
            assert "products" in data
            products = data["products"]
        else:
            products = data
        assert isinstance(products, list)
        print(f"SUCCESS: Marketplace has {len(products)} products")
    
    def test_marketplace_categories(self, auth_token):
        """Test product categories filter works"""
        response = requests.get(f"{BASE_URL}/api/marketplace/products?category=electronics", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        print("SUCCESS: Category filter works")
    
    def test_create_product(self, auth_token):
        """Test creating a new product"""
        product_data = {
            "title": f"TEST_Product_{int(time.time())}",
            "description": "Automated test product from pytest",
            "price": 49.99,
            "currency": "USD",
            "category": "electronics",
            "condition": "new",
            "images": ["https://via.placeholder.com/300"],
            "tags": ["test", "automated"]
        }
        
        response = requests.post(f"{BASE_URL}/api/marketplace/products", 
            headers={"Authorization": f"Bearer {auth_token}"},
            json=product_data
        )
        assert response.status_code in [200, 201], f"Product creation failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["title"] == product_data["title"]
        print(f"SUCCESS: Created product with ID {data['id']}")


class TestCardEndpoints:
    """Test card CRUD operations"""
    
    @pytest.fixture
    def auth_token(self):
        return get_auth_token()
    
    def test_get_user_cards(self, auth_token):
        """Test fetching user's cards"""
        response = requests.get(f"{BASE_URL}/api/cards", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        cards = response.json()
        print(f"SUCCESS: User has {len(cards)} cards")
    
    def test_create_card(self, auth_token):
        """Test creating a new card"""
        card_data = {
            "title": f"TEST_Card_{int(time.time())}",
            "subtitle": "Test Subtitle",
            "description": "Test description from pytest",
            "card_type": "personal",  # Use card_type instead of type
            "template": "classic"
        }
        
        response = requests.post(f"{BASE_URL}/api/cards", 
            headers={"Authorization": f"Bearer {auth_token}"},
            json=card_data
        )
        assert response.status_code in [200, 201], f"Card creation failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        print(f"SUCCESS: Created card with ID {data['id']}")
        return data["id"]


class TestProfileEndpoints:
    """Test user profile endpoints"""
    
    @pytest.fixture
    def auth_token_and_user_id(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        data = response.json()
        token = data.get("access_token") or data.get("token")
        return token, data.get("user", {}).get("id")
    
    def test_get_profile(self, auth_token_and_user_id):
        """Test fetching user profile"""
        token, user_id = auth_token_and_user_id
        
        response = requests.get(f"{BASE_URL}/api/users/{user_id}/profile", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Profile fetch failed: {response.text}"
        
        data = response.json()
        assert "name" in data or "email" in data
        print(f"SUCCESS: Profile fetched for user {user_id}")
    
    def test_get_my_profile(self, auth_token_and_user_id):
        """Test fetching current user's profile via /api/profile"""
        token, user_id = auth_token_and_user_id
        
        response = requests.get(f"{BASE_URL}/api/profile", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"My profile fetch failed: {response.text}"
        print(f"SUCCESS: Current user profile fetched")
    
    def test_update_profile(self, auth_token_and_user_id):
        """Test updating user profile via PUT /api/profile"""
        token, user_id = auth_token_and_user_id
        
        update_data = {
            "display_name": "New Test User",
            "bio": f"Updated bio at {int(time.time())}",
            "location": "Test City"
        }
        
        # Profile update endpoint is at /api/profile with PUT
        response = requests.put(f"{BASE_URL}/api/profile", 
            headers={"Authorization": f"Bearer {token}"},
            json=update_data
        )
        
        assert response.status_code == 200, f"Profile update failed: {response.text}"
        
        # Verify update
        data = response.json()
        assert data.get("bio") == update_data["bio"]
        print(f"SUCCESS: Profile updated successfully")


class TestChatEndpoints:
    """Test chat functionality"""
    
    @pytest.fixture
    def auth_token(self):
        return get_auth_token()
    
    def test_get_chats(self, auth_token):
        """Test fetching user's chats"""
        response = requests.get(f"{BASE_URL}/api/chats", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Chats fetch failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: User has {len(data)} chats")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
