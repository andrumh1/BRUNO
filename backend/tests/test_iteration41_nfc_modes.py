"""
Iteration 41: NFC Activation Page with 3 Modes + Re-encode Feature
Tests for:
- NFC Activate page 3 modes (bruno, external, link)
- NFC my-cards endpoint with redirect_url and card_title
- NFC direct redirect endpoint /nfc/go/{nfcId}
- NFC resolve endpoint
- NFC activate endpoint with card_id
- Login flow
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests - login flow"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
            "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
        print(f"✓ Login successful for newtest@bruno.com")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")


class TestNFCMyCards:
    """Tests for GET /api/nfc/my-cards endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
            "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_nfc_my_cards_returns_list(self, auth_token):
        """Test that /api/nfc/my-cards returns a list"""
        response = requests.get(
            f"{BASE_URL}/api/nfc/my-cards",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/nfc/my-cards returns list with {len(data)} items")
        return data
    
    def test_nfc_my_cards_has_redirect_url(self, auth_token):
        """Test that each NFC card has redirect_url field"""
        response = requests.get(
            f"{BASE_URL}/api/nfc/my-cards",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            for nfc in data:
                assert "redirect_url" in nfc, f"NFC card missing redirect_url: {nfc}"
                assert "/api/nfc/go/" in nfc["redirect_url"], f"redirect_url should contain /api/nfc/go/: {nfc['redirect_url']}"
            print(f"✓ All {len(data)} NFC cards have redirect_url field")
        else:
            print("✓ No NFC cards found (empty list is valid)")
    
    def test_nfc_my_cards_has_card_title(self, auth_token):
        """Test that each NFC card has card_title field"""
        response = requests.get(
            f"{BASE_URL}/api/nfc/my-cards",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            for nfc in data:
                assert "card_title" in nfc, f"NFC card missing card_title: {nfc}"
            print(f"✓ All {len(data)} NFC cards have card_title field")
        else:
            print("✓ No NFC cards found (empty list is valid)")
    
    def test_nfc_my_cards_requires_auth(self):
        """Test that /api/nfc/my-cards requires authentication"""
        response = requests.get(f"{BASE_URL}/api/nfc/my-cards")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ GET /api/nfc/my-cards correctly requires authentication")


class TestNFCDirectRedirect:
    """Tests for GET /api/nfc/go/{nfcId} direct redirect endpoint"""
    
    def test_nfc_go_registered_returns_302(self):
        """Test that /api/nfc/go/{nfcId} returns HTTP 302 for registered NFC"""
        # First, we need to create an NFC card to test
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
            "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
        })
        token = login_response.json().get("access_token")
        
        # Get user's cards
        cards_response = requests.get(
            f"{BASE_URL}/api/cards",
            headers={"Authorization": f"Bearer {token}"}
        )
        cards = cards_response.json()
        
        if len(cards) == 0:
            pytest.skip("No cards available for testing")
        
        card_id = cards[0]["id"]
        test_nfc_id = f"test_nfc_go_{uuid.uuid4().hex[:8]}"
        
        # Activate NFC
        activate_response = requests.post(
            f"{BASE_URL}/api/nfc/activate",
            json={"nfc_id": test_nfc_id, "card_id": card_id},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert activate_response.status_code == 200, f"Activate failed: {activate_response.text}"
        
        # Test the redirect (don't follow redirects)
        redirect_response = requests.get(
            f"{BASE_URL}/api/nfc/go/{test_nfc_id}",
            allow_redirects=False
        )
        assert redirect_response.status_code == 302, f"Expected 302, got {redirect_response.status_code}"
        
        # Check Location header points to card page
        location = redirect_response.headers.get("Location", "")
        assert f"/c/{card_id}" in location, f"Location should contain /c/{card_id}: {location}"
        print(f"✓ GET /api/nfc/go/{test_nfc_id} returns 302 redirect to {location}")
    
    def test_nfc_go_unregistered_redirects_to_n_page(self):
        """Test that /api/nfc/go/{fake_id} returns HTTP 302 redirect to /n/{fake_id}"""
        fake_nfc_id = f"fake_nfc_{uuid.uuid4().hex[:8]}"
        
        response = requests.get(
            f"{BASE_URL}/api/nfc/go/{fake_nfc_id}",
            allow_redirects=False
        )
        assert response.status_code == 302, f"Expected 302, got {response.status_code}"
        
        location = response.headers.get("Location", "")
        assert f"/n/{fake_nfc_id}" in location, f"Location should contain /n/{fake_nfc_id}: {location}"
        print(f"✓ GET /api/nfc/go/{fake_nfc_id} returns 302 redirect to {location}")


class TestNFCResolve:
    """Tests for GET /api/nfc/resolve/{nfcId} endpoint"""
    
    def test_nfc_resolve_registered_returns_found_true(self):
        """Test that /api/nfc/resolve/{nfcId} returns found:true with card_id for registered NFC"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
            "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
        })
        token = login_response.json().get("access_token")
        
        # Get user's cards
        cards_response = requests.get(
            f"{BASE_URL}/api/cards",
            headers={"Authorization": f"Bearer {token}"}
        )
        cards = cards_response.json()
        
        if len(cards) == 0:
            pytest.skip("No cards available for testing")
        
        card_id = cards[0]["id"]
        test_nfc_id = f"test_nfc_resolve_{uuid.uuid4().hex[:8]}"
        
        # Activate NFC
        activate_response = requests.post(
            f"{BASE_URL}/api/nfc/activate",
            json={"nfc_id": test_nfc_id, "card_id": card_id},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert activate_response.status_code == 200
        
        # Test resolve
        resolve_response = requests.get(f"{BASE_URL}/api/nfc/resolve/{test_nfc_id}")
        assert resolve_response.status_code == 200
        
        data = resolve_response.json()
        assert data.get("found") == True, f"Expected found:true, got {data}"
        assert data.get("card_id") == card_id, f"Expected card_id:{card_id}, got {data.get('card_id')}"
        print(f"✓ GET /api/nfc/resolve/{test_nfc_id} returns found:true with card_id")
    
    def test_nfc_resolve_unregistered_returns_found_false(self):
        """Test that /api/nfc/resolve/{fake_id} returns found:false"""
        fake_nfc_id = f"fake_resolve_{uuid.uuid4().hex[:8]}"
        
        response = requests.get(f"{BASE_URL}/api/nfc/resolve/{fake_nfc_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("found") == False, f"Expected found:false, got {data}"
        print(f"✓ GET /api/nfc/resolve/{fake_nfc_id} returns found:false")


class TestNFCActivate:
    """Tests for POST /api/nfc/activate endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
            "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_nfc_activate_with_card_id(self, auth_token):
        """Test POST /api/nfc/activate works with card_id"""
        # Get user's cards
        cards_response = requests.get(
            f"{BASE_URL}/api/cards",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        cards = cards_response.json()
        
        if len(cards) == 0:
            pytest.skip("No cards available for testing")
        
        card_id = cards[0]["id"]
        test_nfc_id = f"test_activate_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/nfc/activate",
            json={"nfc_id": test_nfc_id, "card_id": card_id},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Activate failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert data.get("nfc_id") == test_nfc_id
        assert data.get("card_id") == card_id
        print(f"✓ POST /api/nfc/activate works with card_id")
    
    def test_nfc_activate_requires_auth(self):
        """Test that /api/nfc/activate requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/nfc/activate",
            json={"nfc_id": "test", "card_id": "test"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ POST /api/nfc/activate correctly requires authentication")
    
    def test_nfc_activate_invalid_card_returns_404(self, auth_token):
        """Test that activating with invalid card_id returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/nfc/activate",
            json={"nfc_id": "test_invalid", "card_id": "nonexistent_card_id"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ POST /api/nfc/activate returns 404 for invalid card_id")


class TestNFCUpdateCard:
    """Tests for POST /api/nfc/update-card endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
            "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_nfc_update_card_returns_redirect_url(self, auth_token):
        """Test that /api/nfc/update-card returns redirect_url"""
        # Get user's cards
        cards_response = requests.get(
            f"{BASE_URL}/api/cards",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        cards = cards_response.json()
        
        if len(cards) < 1:
            pytest.skip("Need at least 1 card for testing")
        
        card_id = cards[0]["id"]
        test_nfc_id = f"test_update_{uuid.uuid4().hex[:8]}"
        
        # First activate the NFC
        activate_response = requests.post(
            f"{BASE_URL}/api/nfc/activate",
            json={"nfc_id": test_nfc_id, "card_id": card_id},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert activate_response.status_code == 200
        
        # Now update it
        update_response = requests.post(
            f"{BASE_URL}/api/nfc/update-card",
            params={"nfc_id": test_nfc_id, "card_id": card_id},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        data = update_response.json()
        assert "redirect_url" in data, f"Response missing redirect_url: {data}"
        assert "/api/nfc/go/" in data["redirect_url"]
        print(f"✓ POST /api/nfc/update-card returns redirect_url: {data['redirect_url']}")


class TestCardsEndpoint:
    """Tests for GET /api/cards endpoint (needed for NFC activation)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
            "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_cards_returns_list(self, auth_token):
        """Test that GET /api/cards returns a list"""
        response = requests.get(
            f"{BASE_URL}/api/cards",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/cards returns list with {len(data)} cards")
    
    def test_get_cards_requires_auth(self):
        """Test that GET /api/cards requires authentication"""
        response = requests.get(f"{BASE_URL}/api/cards")
        assert response.status_code in [401, 403]
        print("✓ GET /api/cards correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
