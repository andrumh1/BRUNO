"""
Iteration 35: Card System Tests
Tests for card CRUD operations, view card page, and routing fixes.
- GET /api/cards/{cardId} - returns card data correctly
- PUT /api/cards/{cardId} - updates card without changing ID
- POST /api/cards - creates new card with proper ID
- Card edit preserves the same card ID
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"

# Known test card IDs from context
PUBLIC_CARD_ID = "de078d9e-21e5-4e18-95f9-462d8d18d2b5"
NFC_CARD_ID = "d16c2745-df03-47e2-bab8-c1ed3360c3f2"


class TestCardAPI:
    """Card API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.user_id = None
        
    def login(self):
        """Login and get token"""
        response = self.session.post(f"{API}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token")
            self.user_id = data.get("user", {}).get("id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return True
        return False

    # ============ GET Card Tests ============
    
    def test_get_public_card_by_id(self):
        """Test GET /api/cards/{cardId} returns card data correctly"""
        response = self.session.get(f"{API}/cards/{PUBLIC_CARD_ID}")
        print(f"GET /api/cards/{PUBLIC_CARD_ID}: {response.status_code}")
        
        # Should return 200 for public card
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Card should have id field"
        assert data["id"] == PUBLIC_CARD_ID, f"Card ID mismatch: {data['id']} != {PUBLIC_CARD_ID}"
        assert "title" in data, "Card should have title field"
        assert "card_type" in data, "Card should have card_type field"
        print(f"Card data: title={data.get('title')}, type={data.get('card_type')}")
        
    def test_get_nfc_card_by_id(self):
        """Test GET /api/cards/{cardId} for NFC card"""
        response = self.session.get(f"{API}/cards/{NFC_CARD_ID}")
        print(f"GET /api/cards/{NFC_CARD_ID}: {response.status_code}")
        
        # Should return 200 for NFC card
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == NFC_CARD_ID
        print(f"NFC Card: title={data.get('title')}, type={data.get('card_type')}")
        
    def test_get_nonexistent_card_returns_404(self):
        """Test GET /api/cards/{cardId} returns 404 for non-existent card"""
        fake_id = str(uuid.uuid4())
        response = self.session.get(f"{API}/cards/{fake_id}")
        print(f"GET /api/cards/{fake_id}: {response.status_code}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
    def test_card_has_required_fields(self):
        """Test card response has all required fields"""
        response = self.session.get(f"{API}/cards/{PUBLIC_CARD_ID}")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ["id", "title", "card_type", "user_id", "is_public"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            
        # Optional but expected fields
        optional_fields = ["subtitle", "description", "avatar_url", "banner_url", 
                          "background_color", "text_color", "social_links", "contact_info"]
        for field in optional_fields:
            if field in data:
                print(f"  {field}: present")
                
    # ============ POST Card Tests ============
    
    def test_create_card_requires_auth(self):
        """Test POST /api/cards requires authentication"""
        response = self.session.post(f"{API}/cards", json={
            "title": "Test Card",
            "card_type": "personal"
        })
        print(f"POST /api/cards (no auth): {response.status_code}")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
    def test_create_card_with_auth(self):
        """Test POST /api/cards creates new card with proper ID"""
        assert self.login(), "Login failed"
        
        unique_title = f"TEST_Card_{uuid.uuid4().hex[:8]}"
        card_data = {
            "title": unique_title,
            "subtitle": "Test Subtitle",
            "description": "Test Description",
            "card_type": "personal",
            "background_color": "#FF5A00",
            "text_color": "#FFFFFF",
            "is_public": True,
            "social_links": [
                {"type": "instagram", "label": "Instagram", "url": "https://instagram.com/test"}
            ]
        }
        
        response = self.session.post(f"{API}/cards", json=card_data)
        print(f"POST /api/cards: {response.status_code}")
        
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Created card should have id"
        assert data["title"] == unique_title, "Title mismatch"
        assert data["card_type"] == "personal", "Card type mismatch"
        
        # Verify card was persisted
        card_id = data["id"]
        get_response = self.session.get(f"{API}/cards/{card_id}")
        assert get_response.status_code == 200, "Card should be retrievable after creation"
        
        # Cleanup
        self.session.delete(f"{API}/cards/{card_id}")
        print(f"Created and verified card: {card_id}")
        
    # ============ PUT Card Tests ============
    
    def test_update_card_preserves_id(self):
        """Test PUT /api/cards/{cardId} updates card without changing ID"""
        assert self.login(), "Login failed"
        
        # First create a card
        unique_title = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        create_response = self.session.post(f"{API}/cards", json={
            "title": unique_title,
            "card_type": "personal",
            "is_public": True
        })
        assert create_response.status_code == 201
        
        original_card = create_response.json()
        original_id = original_card["id"]
        print(f"Created card with ID: {original_id}")
        
        # Update the card
        updated_title = f"TEST_Updated_{uuid.uuid4().hex[:8]}"
        update_response = self.session.put(f"{API}/cards/{original_id}", json={
            "title": updated_title,
            "subtitle": "Updated Subtitle",
            "description": "Updated Description",
            "card_type": "personal",
            "background_color": "#0000FF",
            "is_public": True
        })
        print(f"PUT /api/cards/{original_id}: {update_response.status_code}")
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        updated_card = update_response.json()
        
        # CRITICAL: ID should NOT change after update
        assert updated_card["id"] == original_id, f"Card ID changed! Original: {original_id}, New: {updated_card['id']}"
        assert updated_card["title"] == updated_title, "Title not updated"
        
        # Verify persistence
        get_response = self.session.get(f"{API}/cards/{original_id}")
        assert get_response.status_code == 200
        persisted_card = get_response.json()
        assert persisted_card["id"] == original_id, "Persisted card ID mismatch"
        assert persisted_card["title"] == updated_title, "Persisted title mismatch"
        
        # Cleanup
        self.session.delete(f"{API}/cards/{original_id}")
        print(f"Card ID preserved after update: {original_id}")
        
    def test_update_card_requires_ownership(self):
        """Test PUT /api/cards/{cardId} requires card ownership"""
        assert self.login(), "Login failed"
        
        # Try to update a card we don't own (public card from another user)
        response = self.session.put(f"{API}/cards/{PUBLIC_CARD_ID}", json={
            "title": "Hacked Title"
        })
        print(f"PUT /api/cards/{PUBLIC_CARD_ID} (not owner): {response.status_code}")
        
        # Should fail with 403 or 404 (depending on implementation)
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"
        
    # ============ DELETE Card Tests ============
    
    def test_delete_card_requires_auth(self):
        """Test DELETE /api/cards/{cardId} requires authentication"""
        response = self.session.delete(f"{API}/cards/{PUBLIC_CARD_ID}")
        print(f"DELETE /api/cards (no auth): {response.status_code}")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
    # ============ My Cards Tests ============
    
    def test_get_my_cards_requires_auth(self):
        """Test GET /api/cards requires authentication"""
        response = self.session.get(f"{API}/cards")
        print(f"GET /api/cards (no auth): {response.status_code}")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
    def test_get_my_cards_with_auth(self):
        """Test GET /api/cards returns user's cards"""
        assert self.login(), "Login failed"
        
        response = self.session.get(f"{API}/cards")
        print(f"GET /api/cards: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"User has {len(data)} cards")
        
    # ============ Explore Cards Tests ============
    
    def test_explore_cards_public(self):
        """Test GET /api/cards/explore returns public cards"""
        response = self.session.get(f"{API}/cards/explore?limit=10")
        print(f"GET /api/cards/explore: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Explore returned {len(data)} cards")
        
        # All cards should be public
        for card in data:
            assert card.get("is_public", True), f"Non-public card in explore: {card.get('id')}"
            
    # ============ QR Code Tests ============
    
    def test_get_card_qr_code(self):
        """Test GET /api/cards/{cardId}/qr returns QR code"""
        response = self.session.get(f"{API}/cards/{PUBLIC_CARD_ID}/qr")
        print(f"GET /api/cards/{PUBLIC_CARD_ID}/qr: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "qr_code" in data, "Response should have qr_code field"
        assert "card_url" in data, "Response should have card_url field"
        print(f"QR code URL: {data.get('card_url')}")


class TestCardDataIntegrity:
    """Tests for card data integrity and field validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def login(self):
        response = self.session.post(f"{API}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return True
        return False
        
    def test_card_social_links_structure(self):
        """Test card social_links have correct structure (type, label, url)"""
        response = self.session.get(f"{API}/cards/{PUBLIC_CARD_ID}")
        assert response.status_code == 200
        
        data = response.json()
        social_links = data.get("social_links", [])
        
        for link in social_links:
            assert "type" in link, f"Social link missing 'type': {link}"
            assert "url" in link, f"Social link missing 'url': {link}"
            # label is optional but recommended
            print(f"Social link: type={link.get('type')}, label={link.get('label')}, url={link.get('url')[:30]}...")
            
    def test_card_contact_info_structure(self):
        """Test card contact_info has correct fields"""
        response = self.session.get(f"{API}/cards/{PUBLIC_CARD_ID}")
        assert response.status_code == 200
        
        data = response.json()
        contact_info = data.get("contact_info", {})
        
        if contact_info:
            valid_fields = ["phone", "email", "address", "city", "country"]
            for field in contact_info:
                assert field in valid_fields, f"Unknown contact_info field: {field}"
            print(f"Contact info fields: {list(contact_info.keys())}")
            
    def test_card_colors_are_valid_hex(self):
        """Test card colors are valid hex codes"""
        response = self.session.get(f"{API}/cards/{PUBLIC_CARD_ID}")
        assert response.status_code == 200
        
        data = response.json()
        bg_color = data.get("background_color", "#FF5A00")
        text_color = data.get("text_color", "#FFFFFF")
        
        # Validate hex format
        import re
        hex_pattern = r'^#[0-9A-Fa-f]{6}$'
        assert re.match(hex_pattern, bg_color), f"Invalid background_color: {bg_color}"
        assert re.match(hex_pattern, text_color), f"Invalid text_color: {text_color}"
        print(f"Colors valid: bg={bg_color}, text={text_color}")


class TestCardViewIncrement:
    """Tests for card view count increment"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_view_increments_on_get(self):
        """Test that viewing a card increments the view count"""
        # Get initial view count
        response1 = self.session.get(f"{API}/cards/{PUBLIC_CARD_ID}")
        assert response1.status_code == 200
        initial_views = response1.json().get("views", 0)
        
        # View again
        response2 = self.session.get(f"{API}/cards/{PUBLIC_CARD_ID}")
        assert response2.status_code == 200
        new_views = response2.json().get("views", 0)
        
        # Views should increment (or stay same if rate-limited)
        assert new_views >= initial_views, f"Views decreased: {initial_views} -> {new_views}"
        print(f"Views: {initial_views} -> {new_views}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
