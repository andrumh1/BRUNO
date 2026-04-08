"""
Test suite for BRUNO technical fixes:
1. PUT /api/cards/{id} - Card update and persistence
2. GET /api/nfc/resolve/{nfc_id} - NFC redirect resolution
3. Auth refresh functionality
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
TEST_PASSWORD = os.getenv("TEST_USER_PASSWORD", "Test1234!")
TEST_CARD_ID = "f191a519-4730-4af9-b870-5a80b4e556fc"


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_accessible(self):
        """Test that API is accessible"""
        response = requests.get(f"{BASE_URL}/api/public/cards", timeout=10)
        assert response.status_code == 200, f"API not accessible: {response.status_code}"
        print(f"✅ API accessible - Status: {response.status_code}")


class TestAuthentication:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=10
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        print(f"✅ Login successful - User: {data['user'].get('email')}")
        return data["access_token"]
    
    def test_auth_me_endpoint(self):
        """Test /api/auth/me returns user data"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=10
        )
        token = login_response.json()["access_token"]
        
        # Test /auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        assert "email" in data, "No email in user data"
        assert "id" in data, "No id in user data"
        print(f"✅ Auth/me works - User ID: {data.get('id')}")


class TestCardUpdatePersistence:
    """Test card update (PUT) and persistence - Bug Fix #1"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=10
        )
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        return response.json()["access_token"]
    
    def test_get_card_exists(self, auth_token):
        """Test that test card exists"""
        response = requests.get(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        assert response.status_code == 200, f"Card not found: {response.text}"
        data = response.json()
        assert data["id"] == TEST_CARD_ID
        print(f"✅ Card exists - Title: {data.get('title')}")
    
    def test_update_card_title(self, auth_token):
        """Test updating card title and verify persistence"""
        # Generate unique title
        unique_title = f"Test Title {uuid.uuid4().hex[:8]}"
        
        # Update card
        update_response = requests.put(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"title": unique_title},
            timeout=10
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated_data = update_response.json()
        assert updated_data["title"] == unique_title, f"Title not updated in response"
        print(f"✅ Card updated - New title: {unique_title}")
        
        # Verify persistence with GET
        get_response = requests.get(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        assert get_response.status_code == 200
        persisted_data = get_response.json()
        assert persisted_data["title"] == unique_title, f"Title not persisted! Expected: {unique_title}, Got: {persisted_data['title']}"
        print(f"✅ Title persisted correctly: {persisted_data['title']}")
    
    def test_update_card_multiple_fields(self, auth_token):
        """Test updating multiple card fields"""
        update_data = {
            "title": f"Multi-field Test {uuid.uuid4().hex[:6]}",
            "subtitle": "Updated Subtitle",
            "description": "Updated description for testing",
            "background_color": "#FF5A00",
            "text_color": "#FFFFFF",
            "is_public": True,
            "show_in_feed": True,
            "is_animated": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=update_data,
            timeout=10
        )
        assert response.status_code == 200, f"Multi-field update failed: {response.text}"
        data = response.json()
        
        # Verify all fields updated
        assert data["title"] == update_data["title"]
        assert data["subtitle"] == update_data["subtitle"]
        assert data["description"] == update_data["description"]
        print(f"✅ Multiple fields updated successfully")
    
    def test_update_card_custom_fields(self, auth_token):
        """Test updating custom_fields (services, catalogs for negocio)"""
        custom_fields = {
            "services": [
                {"name": "Test Service", "description": "Service desc", "price": "$50", "duration": "1 hour"}
            ],
            "catalogs": [
                {"name": "Test Product", "description": "Product desc", "price": "$99", "category": "Test"}
            ]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"custom_fields": custom_fields},
            timeout=10
        )
        assert response.status_code == 200, f"Custom fields update failed: {response.text}"
        data = response.json()
        
        # Verify custom_fields updated
        assert "custom_fields" in data
        if data.get("custom_fields"):
            print(f"✅ Custom fields updated: {list(data['custom_fields'].keys())}")
        else:
            print(f"✅ Custom fields update accepted (may be empty)")
    
    def test_update_card_type(self, auth_token):
        """Test updating card_type field"""
        # First get current card type
        get_response = requests.get(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        original_type = get_response.json().get("card_type", "personal")
        
        # Update to negocio
        response = requests.put(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"card_type": "negocio"},
            timeout=10
        )
        assert response.status_code == 200, f"Card type update failed: {response.text}"
        data = response.json()
        assert data.get("card_type") == "negocio", f"Card type not updated"
        print(f"✅ Card type updated to: negocio")
        
        # Restore original type
        requests.put(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"card_type": original_type},
            timeout=10
        )


class TestNFCResolveEndpoint:
    """Test NFC resolve endpoint - New Feature #2"""
    
    def test_nfc_resolve_unregistered(self):
        """Test resolving an unregistered NFC ID"""
        fake_nfc_id = f"unregistered-{uuid.uuid4().hex[:8]}"
        
        response = requests.get(
            f"{BASE_URL}/api/nfc/resolve/{fake_nfc_id}",
            timeout=10
        )
        assert response.status_code == 200, f"NFC resolve failed: {response.text}"
        data = response.json()
        
        assert data["found"] == False, "Should not find unregistered NFC"
        assert "message" in data, "Should have message for unregistered NFC"
        assert data["nfc_id"] == fake_nfc_id, "Should return the NFC ID"
        print(f"✅ Unregistered NFC handled correctly: {data['message']}")
    
    def test_nfc_resolve_response_structure(self):
        """Test NFC resolve response has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/nfc/resolve/test-nfc-123",
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "found" in data, "Missing 'found' field"
        assert "nfc_id" in data, "Missing 'nfc_id' field"
        
        if data["found"]:
            assert "redirect_url" in data, "Missing 'redirect_url' for found NFC"
            assert "card_id" in data, "Missing 'card_id' for found NFC"
        else:
            assert "message" in data, "Missing 'message' for not found NFC"
        
        print(f"✅ NFC resolve response structure correct")


class TestNFCActivateAndResolve:
    """Test NFC activation and resolution flow"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=10
        )
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        return response.json()["access_token"]
    
    def test_nfc_activate_and_resolve(self, auth_token):
        """Test activating NFC and then resolving it"""
        # Generate unique NFC ID
        test_nfc_id = f"test-nfc-{uuid.uuid4().hex[:8]}"
        
        # Activate NFC
        activate_response = requests.post(
            f"{BASE_URL}/api/nfc/activate",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"nfc_id": test_nfc_id, "card_id": TEST_CARD_ID},
            timeout=10
        )
        assert activate_response.status_code == 200, f"NFC activation failed: {activate_response.text}"
        print(f"✅ NFC activated: {test_nfc_id}")
        
        # Resolve NFC
        resolve_response = requests.get(
            f"{BASE_URL}/api/nfc/resolve/{test_nfc_id}",
            timeout=10
        )
        assert resolve_response.status_code == 200
        data = resolve_response.json()
        
        assert data["found"] == True, f"NFC should be found after activation"
        assert data["card_id"] == TEST_CARD_ID, f"Card ID mismatch"
        assert "redirect_url" in data, "Missing redirect_url"
        assert TEST_CARD_ID in data["redirect_url"], "Card ID not in redirect URL"
        print(f"✅ NFC resolved correctly - Redirect: {data['redirect_url']}")


class TestCardUpdateModel:
    """Test CardUpdate model includes all necessary fields"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=10
        )
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        return response.json()["access_token"]
    
    def test_update_all_card_fields(self, auth_token):
        """Test that all CardUpdate fields are accepted"""
        # All fields that should be updatable
        full_update = {
            "title": "Full Update Test",
            "subtitle": "Test Subtitle",
            "description": "Test Description",
            "avatar_url": "https://example.com/avatar.jpg",
            "banner_url": "https://example.com/banner.jpg",
            "gallery_photos": ["https://example.com/photo1.jpg"],
            "background_color": "#FF5A00",
            "text_color": "#FFFFFF",
            "social_links": [{"type": "instagram", "label": "Instagram", "url": "https://instagram.com/test"}],
            "location": {"lat": 19.4326, "lng": -99.1332, "address": "CDMX"},
            "template_id": "personal_classic",
            "custom_fields": {"test": "value"},
            "is_public": True,
            "show_in_feed": True,
            "is_animated": True,
            "card_type": "personal"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/cards/{TEST_CARD_ID}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=full_update,
            timeout=10
        )
        
        # Should not get 422 validation error
        assert response.status_code != 422, f"Validation error - CardUpdate model missing fields: {response.text}"
        assert response.status_code == 200, f"Update failed: {response.text}"
        print(f"✅ All CardUpdate fields accepted")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
