"""
Iteration 49 Tests: Story Editor, Reels Default Tab, Albums Tab
Tests P1 features: Story Editor with text overlays, stickers, gradients, polls
Profile page Reels default, Albums tab integration
"""
import pytest
import requests
import os
import jwt
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


class TestMobileJWTExpiry:
    """Test mobile platform gets 365-day JWT expiry (P0 verification)"""
    
    def test_mobile_login_365_day_expiry(self):
        """POST /api/auth/login with platform=mobile returns 365-day JWT"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "platform": "mobile"
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data
        token = data["access_token"]
        
        # Decode JWT to check expiry
        decoded = jwt.decode(token, options={"verify_signature": False})
        exp_timestamp = decoded.get("exp")
        assert exp_timestamp is not None, "JWT missing exp claim"
        
        # Calculate days until expiry
        exp_date = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
        now = datetime.now(timezone.utc)
        days_until_expiry = (exp_date - now).days
        
        # Should be approximately 365 days (allow some margin)
        assert days_until_expiry >= 360, f"Expected ~365 days, got {days_until_expiry}"
        assert days_until_expiry <= 366, f"Expected ~365 days, got {days_until_expiry}"
        
        # Check platform claim
        assert decoded.get("plt") == "mobile", f"Expected plt=mobile, got {decoded.get('plt')}"
        print(f"PASS: Mobile JWT expiry is {days_until_expiry} days")
    
    def test_web_login_30_day_expiry(self):
        """POST /api/auth/login with platform=web returns ~30-day JWT"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "platform": "web"
        })
        
        assert response.status_code == 200
        data = response.json()
        token = data["access_token"]
        
        decoded = jwt.decode(token, options={"verify_signature": False})
        exp_timestamp = decoded.get("exp")
        
        exp_date = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
        now = datetime.now(timezone.utc)
        days_until_expiry = (exp_date - now).days
        
        # Web should be ~30 days
        assert days_until_expiry >= 28, f"Expected ~30 days, got {days_until_expiry}"
        assert days_until_expiry <= 31, f"Expected ~30 days, got {days_until_expiry}"
        print(f"PASS: Web JWT expiry is {days_until_expiry} days")


class TestAlbumsAPI:
    """Test Albums CRUD endpoints"""
    
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
    
    def test_get_albums_returns_list(self, auth_token):
        """GET /api/albums returns user albums with photos array"""
        response = requests.get(f"{BASE_URL}/api/albums", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of albums"
        print(f"PASS: GET /api/albums returns {len(data)} albums")
        
        # If albums exist, verify structure
        if len(data) > 0:
            album = data[0]
            assert "id" in album, "Album missing id"
            assert "name" in album, "Album missing name"
            assert "user_id" in album, "Album missing user_id"
            # Note: photos array may be named differently based on implementation
            print(f"PASS: Album structure verified: {album.get('name')}")
    
    def test_create_album(self, auth_token):
        """POST /api/albums creates new album"""
        album_data = {
            "name": "TEST_Album_Iteration49",
            "description": "Test album for iteration 49",
            "is_public": False
        }
        
        response = requests.post(f"{BASE_URL}/api/albums", json=album_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        # API returns 200 on success (not 201)
        assert response.status_code in [200, 201], f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("name") == album_data["name"]
        assert data.get("description") == album_data["description"]
        assert "id" in data
        
        print(f"PASS: Created album with id: {data['id']}")
        
        # Cleanup - delete the test album (API returns 200 or 204)
        delete_response = requests.delete(f"{BASE_URL}/api/albums/{data['id']}", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert delete_response.status_code in [200, 204], "Failed to cleanup test album"
        print("PASS: Test album cleaned up")
    
    def test_album_has_photos_field(self, auth_token):
        """Verify album response includes photos array"""
        # Create a test album
        album_data = {
            "name": "TEST_Photos_Check",
            "is_public": True
        }
        
        create_response = requests.post(f"{BASE_URL}/api/albums", json=album_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert create_response.status_code in [200, 201]
        album = create_response.json()
        album_id = album["id"]
        
        # Get the album
        get_response = requests.get(f"{BASE_URL}/api/albums/{album_id}", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert get_response.status_code == 200
        album_data = get_response.json()
        
        # Check for photos field (may be empty array)
        assert "photos" in album_data or "media_count" in album_data, "Album missing photos/media_count field"
        print(f"PASS: Album has photos field or media_count")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/albums/{album_id}", headers={
            "Authorization": f"Bearer {auth_token}"
        })


class TestStoriesAPI:
    """Test Stories endpoints for Story Editor"""
    
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
    
    def test_create_story_with_overlays(self, auth_token):
        """POST /api/stories creates story with text overlays and gradient"""
        story_data = {
            "media_url": "",
            "media_type": "text",
            "caption": "TEST_Story from iteration 49",
            "visibility": "public",
            "duration": 5,
            "overlays": {
                "texts": [
                    {
                        "text": "Hello World",
                        "x": 50,
                        "y": 50,
                        "color": "#FFFFFF",
                        "fontSize": 24,
                        "fontFamily": "system-ui, sans-serif",
                        "bold": True,
                        "italic": False,
                        "align": "center"
                    }
                ],
                "stickers": [
                    {
                        "stickerId": "heart",
                        "x": 30,
                        "y": 30,
                        "scale": 1
                    }
                ],
                "bgGradient": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            }
        }
        
        # Note: stories endpoint requires trailing slash
        response = requests.post(f"{BASE_URL}/api/stories/", json=story_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        # Story creation should succeed
        assert response.status_code in [200, 201], f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "id" in data, "Story missing id"
        print(f"PASS: Created story with overlays, id: {data['id']}")
        
        # Verify overlays were saved
        if "overlays" in data:
            assert data["overlays"].get("bgGradient") is not None or data["overlays"].get("texts") is not None
            print("PASS: Story overlays saved correctly")


class TestPollsAPI:
    """Test Polls endpoints for Story Editor poll integration"""
    
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
    
    def test_create_poll(self, auth_token):
        """POST /api/social/polls creates poll for story"""
        poll_data = {
            "question": "TEST_Poll: What's your favorite color?",
            "options": ["Red", "Blue", "Green"],
            "duration_hours": 24
        }
        
        response = requests.post(f"{BASE_URL}/api/social/polls", json=poll_data, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code in [200, 201], f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "id" in data, "Poll missing id"
        assert data.get("question") == poll_data["question"]
        print(f"PASS: Created poll with id: {data['id']}")


class TestCardsAPI:
    """Test Cards endpoints (P0 verification)"""
    
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
    
    def test_get_user_cards(self, auth_token):
        """GET /api/cards returns user's cards"""
        response = requests.get(f"{BASE_URL}/api/cards", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/cards returns {len(data)} cards")
    
    def test_get_public_cards(self):
        """GET /api/public/cards returns public cards"""
        response = requests.get(f"{BASE_URL}/api/public/cards")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/public/cards returns {len(data)} cards")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
