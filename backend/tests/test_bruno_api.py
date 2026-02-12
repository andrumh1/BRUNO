"""
BRUNO Digital Cards API Tests
Tests for authentication, cards CRUD, QR generation, and NFC functionality
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@bruno.com"
TEST_PASSWORD = "demo123"
TEST_CARD_ID = "01e1d78c-a082-4de5-9590-ef3b0ed532b2"


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "BRUNO API"
        print("✓ Health check passed")
    
    def test_root_endpoint(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "BRUNO" in data["message"]
        print("✓ Root endpoint passed")


class TestAuthentication:
    """Authentication endpoint tests"""
    
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
        print(f"✓ Login successful for {TEST_EMAIL}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login rejected correctly")
    
    def test_register_duplicate_email(self):
        """Test registration with existing email"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": "testpass123",
            "name": "Test User"
        })
        assert response.status_code == 400
        print("✓ Duplicate email registration rejected")
    
    def test_register_new_user(self):
        """Test registration with new email"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@bruno.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "name": "Test User"
        })
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == unique_email
        print(f"✓ New user registered: {unique_email}")
    
    def test_get_me_authenticated(self):
        """Test /auth/me with valid token"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Get current user
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_EMAIL
        print("✓ Get current user passed")
    
    def test_get_me_unauthenticated(self):
        """Test /auth/me without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403]
        print("✓ Unauthenticated access rejected")


class TestCards:
    """Card CRUD endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_cards_authenticated(self, auth_token):
        """Test getting user's cards"""
        response = requests.get(f"{BASE_URL}/api/cards", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} cards")
    
    def test_get_cards_unauthenticated(self):
        """Test getting cards without auth"""
        response = requests.get(f"{BASE_URL}/api/cards")
        assert response.status_code in [401, 403]
        print("✓ Unauthenticated card access rejected")
    
    def test_create_card_personal(self, auth_token):
        """Test creating a personal card"""
        card_data = {
            "card_type": "personal",
            "title": "TEST_Personal Card",
            "subtitle": "Test Subtitle",
            "description": "Test description",
            "background_color": "#FF6B35",
            "text_color": "#FFFFFF",
            "is_public": True
        }
        response = requests.post(f"{BASE_URL}/api/cards", json=card_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "TEST_Personal Card"
        assert data["card_type"] == "personal"
        assert "id" in data
        print(f"✓ Personal card created: {data['id']}")
        return data["id"]
    
    def test_create_card_guardian(self, auth_token):
        """Test creating a guardian card type"""
        card_data = {
            "card_type": "guardian",
            "title": "TEST_Guardian Card",
            "subtitle": "For special needs",
            "description": "Guardian card for protection",
            "background_color": "#FF0000",
            "text_color": "#FFFFFF",
            "is_public": True
        }
        response = requests.post(f"{BASE_URL}/api/cards", json=card_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["card_type"] == "guardian"
        print(f"✓ Guardian card created: {data['id']}")
    
    def test_create_card_empresarial(self, auth_token):
        """Test creating an empresarial card"""
        card_data = {
            "card_type": "empresarial",
            "title": "TEST_Empresarial Card",
            "subtitle": "Company Name",
            "is_public": True
        }
        response = requests.post(f"{BASE_URL}/api/cards", json=card_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["card_type"] == "empresarial"
        print(f"✓ Empresarial card created: {data['id']}")
    
    def test_create_card_negocio(self, auth_token):
        """Test creating a negocio card"""
        card_data = {
            "card_type": "negocio",
            "title": "TEST_Negocio Card",
            "is_public": True
        }
        response = requests.post(f"{BASE_URL}/api/cards", json=card_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["card_type"] == "negocio"
        print(f"✓ Negocio card created: {data['id']}")
    
    def test_create_card_lugares(self, auth_token):
        """Test creating a lugares card"""
        card_data = {
            "card_type": "lugares",
            "title": "TEST_Lugares Card",
            "location": {"lat": 19.4326, "lng": -99.1332, "address": "Mexico City"},
            "is_public": True
        }
        response = requests.post(f"{BASE_URL}/api/cards", json=card_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["card_type"] == "lugares"
        print(f"✓ Lugares card created: {data['id']}")
    
    def test_get_card_by_id(self, auth_token):
        """Test getting a specific card"""
        # First create a card
        card_data = {
            "card_type": "personal",
            "title": "TEST_Get Card Test",
            "is_public": True
        }
        create_response = requests.post(f"{BASE_URL}/api/cards", json=card_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        card_id = create_response.json()["id"]
        
        # Get the card
        response = requests.get(f"{BASE_URL}/api/cards/{card_id}", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == card_id
        assert data["title"] == "TEST_Get Card Test"
        print(f"✓ Card retrieved: {card_id}")
    
    def test_update_card(self, auth_token):
        """Test updating a card"""
        # First create a card
        card_data = {
            "card_type": "personal",
            "title": "TEST_Update Card Test",
            "is_public": True
        }
        create_response = requests.post(f"{BASE_URL}/api/cards", json=card_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        card_id = create_response.json()["id"]
        
        # Update the card
        update_data = {
            "title": "TEST_Updated Title",
            "subtitle": "New Subtitle"
        }
        response = requests.put(f"{BASE_URL}/api/cards/{card_id}", json=update_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "TEST_Updated Title"
        assert data["subtitle"] == "New Subtitle"
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/cards/{card_id}", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert get_response.json()["title"] == "TEST_Updated Title"
        print(f"✓ Card updated and verified: {card_id}")
    
    def test_delete_card(self, auth_token):
        """Test deleting a card"""
        # First create a card
        card_data = {
            "card_type": "personal",
            "title": "TEST_Delete Card Test",
            "is_public": True
        }
        create_response = requests.post(f"{BASE_URL}/api/cards", json=card_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        card_id = create_response.json()["id"]
        
        # Delete the card
        response = requests.delete(f"{BASE_URL}/api/cards/{card_id}", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 204
        
        # Verify deletion - should return 404 or 403
        get_response = requests.get(f"{BASE_URL}/api/cards/{card_id}", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert get_response.status_code in [404, 403]
        print(f"✓ Card deleted: {card_id}")


class TestQRCode:
    """QR Code generation tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_qr_code(self, auth_token):
        """Test QR code generation for a card"""
        # First create a card
        card_data = {
            "card_type": "personal",
            "title": "TEST_QR Card",
            "background_color": "#FF6B35",
            "is_public": True
        }
        create_response = requests.post(f"{BASE_URL}/api/cards", json=card_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        card_id = create_response.json()["id"]
        
        # Get QR code
        response = requests.get(f"{BASE_URL}/api/cards/{card_id}/qr")
        assert response.status_code == 200
        data = response.json()
        assert "qr_code" in data
        assert data["qr_code"].startswith("data:image/png;base64,")
        assert "card_url" in data
        assert card_id in data["card_url"]
        print(f"✓ QR code generated for card: {card_id}")
    
    def test_qr_code_nonexistent_card(self):
        """Test QR code for non-existent card"""
        response = requests.get(f"{BASE_URL}/api/cards/nonexistent-card-id/qr")
        assert response.status_code == 404
        print("✓ QR code for non-existent card rejected")


class TestProfile:
    """User profile endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_profile(self, auth_token):
        """Test getting user profile"""
        response = requests.get(f"{BASE_URL}/api/profile", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        print("✓ Profile retrieved")
    
    def test_update_profile(self, auth_token):
        """Test updating user profile"""
        update_data = {
            "bio": "Test bio updated",
            "website": "https://test.com"
        }
        response = requests.put(f"{BASE_URL}/api/profile", json=update_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["bio"] == "Test bio updated"
        print("✓ Profile updated")


class TestNFC:
    """NFC endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_nfc_cards(self, auth_token):
        """Test getting user's NFC cards"""
        response = requests.get(f"{BASE_URL}/api/nfc/my-cards", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} NFC cards")
    
    def test_activate_nfc_invalid_card(self, auth_token):
        """Test NFC activation with invalid card"""
        response = requests.post(f"{BASE_URL}/api/nfc/activate", json={
            "nfc_id": "test-nfc-123",
            "card_id": "invalid-card-id"
        }, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 404
        print("✓ NFC activation with invalid card rejected")


class TestOrders:
    """Order endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_orders(self, auth_token):
        """Test getting user's orders"""
        response = requests.get(f"{BASE_URL}/api/orders", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} orders")


# Cleanup fixture
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    # Cleanup after tests
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            token = response.json()["access_token"]
            # Get all cards
            cards_response = requests.get(f"{BASE_URL}/api/cards", headers={
                "Authorization": f"Bearer {token}"
            })
            if cards_response.status_code == 200:
                for card in cards_response.json():
                    if card["title"].startswith("TEST_"):
                        requests.delete(f"{BASE_URL}/api/cards/{card['id']}", headers={
                            "Authorization": f"Bearer {token}"
                        })
                print("✓ Test data cleaned up")
    except Exception as e:
        print(f"Cleanup warning: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
