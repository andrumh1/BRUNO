"""
NFC PIUP Manager Backend API Tests - Iteration 28
Tests NFC endpoints: /nfc/product-schemas, /nfc/activate, /nfc/configure-product, /nfc/lock, /nfc/resolve-product
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
TEST_PASSWORD = os.getenv("TEST_USER_PASSWORD", "Test1234!")


class TestNFCProductSchemas:
    """Test GET /api/nfc/product-schemas - Public endpoint (no auth required)"""
    
    def test_get_product_schemas_returns_200(self):
        """Test that product schemas endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/nfc/product-schemas")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/nfc/product-schemas returns 200")
    
    def test_product_schemas_returns_dict(self):
        """Test that product schemas returns a dictionary of schemas"""
        response = requests.get(f"{BASE_URL}/api/nfc/product-schemas")
        data = response.json()
        assert isinstance(data, dict), f"Expected dict, got {type(data)}"
        print(f"PASS: Product schemas returns dict with {len(data)} schemas")
    
    def test_product_schemas_has_wifi_schema(self):
        """Test that WiFi schema exists with correct fields"""
        response = requests.get(f"{BASE_URL}/api/nfc/product-schemas")
        data = response.json()
        assert "nfc-wifi-home" in data, "Missing nfc-wifi-home schema"
        wifi_schema = data["nfc-wifi-home"]
        assert "name" in wifi_schema, "WiFi schema missing name"
        assert "fields" in wifi_schema, "WiFi schema missing fields"
        # Check for SSID and password fields
        field_keys = [f["key"] for f in wifi_schema["fields"]]
        assert "ssid" in field_keys, "WiFi schema missing ssid field"
        assert "password" in field_keys, "WiFi schema missing password field"
        print("PASS: WiFi schema has correct structure with ssid and password fields")
    
    def test_product_schemas_has_emergency_schema(self):
        """Test that Emergency schema exists with blood_type and contacts"""
        response = requests.get(f"{BASE_URL}/api/nfc/product-schemas")
        data = response.json()
        assert "nfc-emergencia" in data, "Missing nfc-emergencia schema"
        emergency_schema = data["nfc-emergencia"]
        field_keys = [f["key"] for f in emergency_schema["fields"]]
        assert "blood_type" in field_keys, "Emergency schema missing blood_type field"
        assert "emergency_contact_1" in field_keys, "Emergency schema missing emergency_contact_1 field"
        print("PASS: Emergency schema has blood_type and emergency contacts")
    
    def test_product_schemas_has_pet_schema(self):
        """Test that Pet schema exists"""
        response = requests.get(f"{BASE_URL}/api/nfc/product-schemas")
        data = response.json()
        assert "nfc-pet-basico" in data, "Missing nfc-pet-basico schema"
        print("PASS: Pet schema exists")


class TestNFCAuthentication:
    """Test NFC endpoints that require authentication"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture
    def user_card_id(self, auth_token):
        """Get or create a user card for testing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # Get user's cards
        response = requests.get(f"{BASE_URL}/api/cards", headers=headers)
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        
        # Create a new card if none exists
        card_data = {
            "card_type": "personal",
            "title": "Test NFC Card",
            "subtitle": "For testing NFC activation",
            "description": "This card is for NFC testing",
            "background_color": "#FF6B35",
            "text_color": "#FFFFFF"
        }
        response = requests.post(f"{BASE_URL}/api/cards", json=card_data, headers=headers)
        if response.status_code == 201:
            return response.json()["id"]
        pytest.skip(f"Failed to get/create card: {response.status_code}")
    
    def test_nfc_activate_creates_tag(self, auth_token, user_card_id):
        """Test POST /api/nfc/activate creates a new NFC tag"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        nfc_id = f"TEST-NFC-{uuid.uuid4().hex[:8].upper()}"
        
        response = requests.post(f"{BASE_URL}/api/nfc/activate", json={
            "nfc_id": nfc_id,
            "card_id": user_card_id
        }, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("nfc_id") == nfc_id, "Response should contain nfc_id"
        assert data.get("card_id") == user_card_id, "Response should contain card_id"
        print(f"PASS: NFC activate creates tag with ID {nfc_id}")
        return nfc_id
    
    def test_nfc_configure_product(self, auth_token, user_card_id):
        """Test POST /api/nfc/configure-product configures NFC with product settings"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        nfc_id = f"TEST-NFC-CFG-{uuid.uuid4().hex[:8].upper()}"
        
        # First activate the tag
        activate_response = requests.post(f"{BASE_URL}/api/nfc/activate", json={
            "nfc_id": nfc_id,
            "card_id": user_card_id
        }, headers=headers)
        assert activate_response.status_code == 200, f"Activate failed: {activate_response.text}"
        
        # Configure with WiFi product
        config_response = requests.post(f"{BASE_URL}/api/nfc/configure-product", json={
            "nfc_id": nfc_id,
            "product_id": "nfc-wifi-home",
            "config": {
                "ssid": "TestNetwork",
                "password": "TestPassword123",
                "encryption": "WPA2"
            }
        }, headers=headers)
        
        assert config_response.status_code == 200, f"Expected 200, got {config_response.status_code}: {config_response.text}"
        data = config_response.json()
        assert data.get("product_id") == "nfc-wifi-home", "Response should contain product_id"
        print(f"PASS: NFC configure-product works with WiFi config")
        return nfc_id
    
    def test_nfc_lock_toggle(self, auth_token, user_card_id):
        """Test POST /api/nfc/lock toggles lock status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        nfc_id = f"TEST-NFC-LOCK-{uuid.uuid4().hex[:8].upper()}"
        
        # Activate tag
        requests.post(f"{BASE_URL}/api/nfc/activate", json={
            "nfc_id": nfc_id,
            "card_id": user_card_id
        }, headers=headers)
        
        # Unlock the tag
        unlock_response = requests.post(f"{BASE_URL}/api/nfc/lock", json={
            "nfc_id": nfc_id,
            "is_locked": False
        }, headers=headers)
        
        assert unlock_response.status_code == 200, f"Unlock failed: {unlock_response.status_code}: {unlock_response.text}"
        assert "unlocked" in unlock_response.json().get("message", "").lower()
        
        # Lock it again
        lock_response = requests.post(f"{BASE_URL}/api/nfc/lock", json={
            "nfc_id": nfc_id,
            "is_locked": True
        }, headers=headers)
        
        assert lock_response.status_code == 200, f"Lock failed: {lock_response.status_code}: {lock_response.text}"
        assert "locked" in lock_response.json().get("message", "").lower()
        print("PASS: NFC lock toggle works correctly")
    
    def test_nfc_my_cards_returns_list(self, auth_token):
        """Test GET /api/nfc/my-cards returns user's NFC cards"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/nfc/my-cards", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"PASS: NFC my-cards returns list with {len(data)} cards")


class TestNFCResolveProduct:
    """Test GET /api/nfc/resolve-product/{nfc_id} - Public endpoint"""
    
    def test_resolve_nonexistent_tag_returns_not_found(self):
        """Test that resolving a non-existent tag returns found=False"""
        response = requests.get(f"{BASE_URL}/api/nfc/resolve-product/NONEXISTENT-NFC-ID")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("found") == False, "Expected found=False for non-existent tag"
        print("PASS: Resolve non-existent tag returns found=False")
    
    def test_resolve_existing_tag_returns_config(self):
        """Test resolving an existing tag returns product info"""
        # First login and create a tag
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        token = login_response.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get a card
        cards_response = requests.get(f"{BASE_URL}/api/cards", headers=headers)
        if cards_response.status_code != 200 or len(cards_response.json()) == 0:
            pytest.skip("No cards available")
        
        card_id = cards_response.json()[0]["id"]
        nfc_id = f"TEST-RESOLVE-{uuid.uuid4().hex[:8].upper()}"
        
        # Activate and configure
        requests.post(f"{BASE_URL}/api/nfc/activate", json={
            "nfc_id": nfc_id,
            "card_id": card_id
        }, headers=headers)
        
        requests.post(f"{BASE_URL}/api/nfc/configure-product", json={
            "nfc_id": nfc_id,
            "product_id": "nfc-emergencia",
            "config": {
                "full_name": "Test User",
                "blood_type": "O+",
                "emergency_contact_1": "John Doe",
                "emergency_phone_1": "+1234567890"
            }
        }, headers=headers)
        
        # Now resolve it (public endpoint)
        resolve_response = requests.get(f"{BASE_URL}/api/nfc/resolve-product/{nfc_id}")
        assert resolve_response.status_code == 200
        data = resolve_response.json()
        assert data.get("found") == True, "Expected found=True"
        assert data.get("product_id") == "nfc-emergencia", "Expected product_id to match"
        assert "password" not in str(data.get("config", {})), "Password should be filtered out"
        print("PASS: Resolve existing tag returns product info with config")


class TestStoreProducts:
    """Test store products endpoint for NFC products"""
    
    def test_store_products_includes_nfc(self):
        """Test GET /api/store/products includes NFC products"""
        response = requests.get(f"{BASE_URL}/api/store/products")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Check for NFC products
        nfc_products = [p for p in data if p.get("category", "").startswith("nfc") or p.get("id", "").startswith("nfc")]
        assert len(nfc_products) > 0, "Store should have NFC products"
        print(f"PASS: Store has {len(nfc_products)} NFC products")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
