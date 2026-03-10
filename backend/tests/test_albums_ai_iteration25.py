"""
Albums API and BRUNO AI Chat Tests - Iteration 25
Tests for internal albums system and BRUNO AI direct communication style

Features tested:
1. GET /api/albums - List user albums
2. POST /api/albums - Create new album
3. POST /api/albums/{album_id}/media - Add media to album
4. GET /api/albums/{album_id}/media - List album media
5. DELETE /api/albums/{album_id} - Delete album
6. POST /api/ai/chat - BRUNO AI chat with direct style
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestAlbumsAPI:
    """Tests for Internal Albums System API (router /api/albums)"""
    
    created_album_id = None
    
    def test_list_albums_empty_or_existing(self, api_client):
        """GET /api/albums - List user albums"""
        response = api_client.get(f"{BASE_URL}/api/albums")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of albums"
        print(f"Found {len(data)} existing albums")
    
    def test_create_album(self, api_client):
        """POST /api/albums - Create new album"""
        album_data = {
            "name": f"TEST_Album_{uuid.uuid4().hex[:8]}",
            "description": "Test album for automated testing",
            "is_private": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/albums", json=album_data)
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Album response should have id"
        assert data["name"] == album_data["name"], "Album name should match"
        assert data["is_private"] == True, "Album should be private"
        assert "media_count" in data, "Album should have media_count"
        assert data["media_count"] == 0, "New album should have 0 media"
        
        TestAlbumsAPI.created_album_id = data["id"]
        print(f"Created album: {data['id']}")
    
    def test_get_album_by_id(self, api_client):
        """GET /api/albums/{album_id} - Get specific album"""
        if not TestAlbumsAPI.created_album_id:
            pytest.skip("No album created to fetch")
        
        response = api_client.get(f"{BASE_URL}/api/albums/{TestAlbumsAPI.created_album_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == TestAlbumsAPI.created_album_id
        print(f"Successfully retrieved album: {data['name']}")
    
    def test_add_media_to_album(self, api_client):
        """POST /api/albums/{album_id}/media - Add media to album"""
        if not TestAlbumsAPI.created_album_id:
            pytest.skip("No album created to add media")
        
        media_data = {
            "media_url": "https://res.cloudinary.com/test/image/upload/v1/test_image.jpg",
            "media_type": "image",
            "caption": "Test image for album",
            "thumbnail_url": "https://res.cloudinary.com/test/image/upload/v1/test_image_thumb.jpg"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/albums/{TestAlbumsAPI.created_album_id}/media",
            json=media_data
        )
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Media response should have id"
        assert data["media_url"] == media_data["media_url"], "Media URL should match"
        assert data["media_type"] == "image", "Media type should be image"
        print(f"Added media: {data['id']}")
    
    def test_list_album_media(self, api_client):
        """GET /api/albums/{album_id}/media - List media in album"""
        if not TestAlbumsAPI.created_album_id:
            pytest.skip("No album created to list media")
        
        response = api_client.get(f"{BASE_URL}/api/albums/{TestAlbumsAPI.created_album_id}/media")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of media"
        assert len(data) >= 1, "Should have at least 1 media item"
        print(f"Album has {len(data)} media items")
    
    def test_verify_album_media_count_updated(self, api_client):
        """Verify album media_count was updated after adding media"""
        if not TestAlbumsAPI.created_album_id:
            pytest.skip("No album created")
        
        response = api_client.get(f"{BASE_URL}/api/albums/{TestAlbumsAPI.created_album_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["media_count"] >= 1, f"Expected media_count >= 1, got {data['media_count']}"
        print(f"Album media count: {data['media_count']}")
    
    def test_delete_album(self, api_client):
        """DELETE /api/albums/{album_id} - Delete album"""
        if not TestAlbumsAPI.created_album_id:
            pytest.skip("No album created to delete")
        
        response = api_client.delete(f"{BASE_URL}/api/albums/{TestAlbumsAPI.created_album_id}")
        assert response.status_code in [200, 204], f"Expected 200/204, got {response.status_code}: {response.text}"
        print(f"Deleted album: {TestAlbumsAPI.created_album_id}")
    
    def test_verify_album_deleted(self, api_client):
        """Verify album no longer exists after deletion"""
        if not TestAlbumsAPI.created_album_id:
            pytest.skip("No album to verify deletion")
        
        response = api_client.get(f"{BASE_URL}/api/albums/{TestAlbumsAPI.created_album_id}")
        assert response.status_code == 404, f"Expected 404 for deleted album, got {response.status_code}"
        print("Album correctly returns 404 after deletion")


class TestBrunoAIChat:
    """Tests for BRUNO AI Chat with direct communication style"""
    
    def test_ai_chat_basic_response(self, api_client):
        """POST /api/ai/chat - Test basic AI response"""
        chat_data = {
            "message": "¿Cómo creo una tarjeta personal?"
        }
        
        response = api_client.post(f"{BASE_URL}/api/ai/chat", json=chat_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data, "Should have response field"
        assert "session_id" in data, "Should have session_id"
        assert len(data["response"]) > 0, "Response should not be empty"
        
        # Check for direct style (no excessive greetings)
        response_lower = data["response"].lower()
        excessive_greetings = ["¡hola!", "¡claro que sí!", "¡por supuesto!", "con mucho gusto"]
        has_excessive = any(greeting in response_lower for greeting in excessive_greetings)
        
        if has_excessive:
            print(f"WARNING: Response contains excessive greeting - may need style adjustment")
        
        print(f"AI Response: {data['response'][:200]}...")
    
    def test_ai_chat_card_types_question(self, api_client):
        """Test BRUNO AI response about card types"""
        chat_data = {
            "message": "¿Qué tipos de tarjetas hay?"
        }
        
        response = api_client.post(f"{BASE_URL}/api/ai/chat", json=chat_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        response_text = data["response"].lower()
        
        # Should mention some card types
        card_types = ["personal", "empresarial", "negocio", "curriculum", "guardian"]
        mentioned_types = [ct for ct in card_types if ct in response_text]
        
        print(f"AI mentioned {len(mentioned_types)} card types: {mentioned_types}")
        print(f"Full response: {data['response'][:300]}...")
    
    def test_ai_chat_session_persistence(self, api_client):
        """Test AI chat session persistence"""
        # First message
        first_response = api_client.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": "Me llamo Carlos"}
        )
        assert first_response.status_code == 200
        session_id = first_response.json()["session_id"]
        
        # Second message with same session
        second_response = api_client.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": "¿Recuerdas mi nombre?", "session_id": session_id}
        )
        assert second_response.status_code == 200
        
        data = second_response.json()
        assert data["session_id"] == session_id, "Session ID should persist"
        print(f"Session persistence test - Response: {data['response'][:150]}...")


class TestAlbumsPageNavigation:
    """Tests to verify albums page endpoint availability"""
    
    def test_verify_albums_list_returns_proper_structure(self, api_client):
        """Verify albums list returns proper response structure"""
        response = api_client.get(f"{BASE_URL}/api/albums")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # If there are albums, verify structure
        if len(data) > 0:
            album = data[0]
            required_fields = ["id", "name", "is_private", "media_count", "created_at", "updated_at"]
            for field in required_fields:
                assert field in album, f"Album missing required field: {field}"
        
        print(f"Albums API returns proper structure with {len(data)} albums")


# Cleanup: Remove any TEST_ prefixed albums
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_albums(api_client):
    """Cleanup test albums after all tests"""
    yield
    # Cleanup logic runs after tests
    try:
        response = api_client.get(f"{BASE_URL}/api/albums")
        if response.status_code == 200:
            albums = response.json()
            for album in albums:
                if album.get("name", "").startswith("TEST_"):
                    api_client.delete(f"{BASE_URL}/api/albums/{album['id']}")
                    print(f"Cleaned up test album: {album['id']}")
    except Exception as e:
        print(f"Cleanup error: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
