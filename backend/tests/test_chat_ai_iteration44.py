"""
Backend API Tests for Iteration 44 - Chat and AI Features
Tests: upload/chat-file endpoint, AI chat endpoint, chat page APIs
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://premium-launch-13.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


class TestAuthentication:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{API_URL}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{API_URL}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✓ Login successful, user: {data['user'].get('email')}")


class TestChatFileUpload:
    """Tests for /api/upload/chat-file endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{API_URL}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_upload_chat_file_image(self, auth_token):
        """Test uploading an image file to chat"""
        # Create a simple test image (1x1 pixel PNG)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            'file': ('test_image.png', io.BytesIO(png_data), 'image/png')
        }
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(f"{API_URL}/upload/chat-file", files=files, headers=headers)
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "url" in data, "Response missing 'url' field"
        assert "filename" in data, "Response missing 'filename' field"
        assert "type" in data, "Response missing 'type' field"
        
        # Verify values
        assert data["url"].startswith("http"), f"Invalid URL: {data['url']}"
        assert data["filename"] == "test_image.png"
        assert "image" in data["type"]
        
        print(f"✓ Chat file upload successful: {data['url'][:50]}...")
    
    def test_upload_chat_file_document(self, auth_token):
        """Test uploading a document file to chat"""
        # Create a simple text file
        text_content = b"This is a test document for BRUNO chat."
        
        files = {
            'file': ('test_doc.txt', io.BytesIO(text_content), 'text/plain')
        }
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(f"{API_URL}/upload/chat-file", files=files, headers=headers)
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        assert "url" in data
        assert "filename" in data
        print(f"✓ Document upload successful: {data['filename']}")
    
    def test_upload_chat_file_unauthorized(self):
        """Test upload without authentication"""
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            'file': ('test.png', io.BytesIO(png_data), 'image/png')
        }
        
        response = requests.post(f"{API_URL}/upload/chat-file", files=files)
        
        # Should fail without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthorized upload correctly rejected")


class TestAIChat:
    """Tests for /api/ai/chat endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{API_URL}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_ai_chat_basic_message(self, auth_token):
        """Test sending a basic message to AI chat"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        payload = {"message": "Hola"}
        
        response = requests.post(f"{API_URL}/ai/chat", json=payload, headers=headers)
        
        assert response.status_code == 200, f"AI chat failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "response" in data, "Response missing 'response' field"
        assert "session_id" in data, "Response missing 'session_id' field"
        
        # Verify values
        assert isinstance(data["response"], str), "Response should be a string"
        assert len(data["response"]) > 0, "Response should not be empty"
        assert isinstance(data["session_id"], str), "session_id should be a string"
        
        print(f"✓ AI chat response received: {data['response'][:100]}...")
        print(f"✓ Session ID: {data['session_id']}")
    
    def test_ai_chat_with_session(self, auth_token):
        """Test AI chat with session continuity"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First message
        payload1 = {"message": "Hola, soy un usuario de prueba"}
        response1 = requests.post(f"{API_URL}/ai/chat", json=payload1, headers=headers)
        assert response1.status_code == 200
        session_id = response1.json().get("session_id")
        
        # Second message with same session
        payload2 = {"message": "Que puedo hacer en BRUNO?", "session_id": session_id}
        response2 = requests.post(f"{API_URL}/ai/chat", json=payload2, headers=headers)
        
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["session_id"] == session_id, "Session ID should be preserved"
        
        print(f"✓ Session continuity works, session: {session_id}")
    
    def test_ai_chat_unauthorized(self):
        """Test AI chat without authentication"""
        payload = {"message": "Hola"}
        
        response = requests.post(f"{API_URL}/ai/chat", json=payload)
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthorized AI chat correctly rejected")


class TestChatEndpoints:
    """Tests for chat-related endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{API_URL}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_chats_list(self, auth_token):
        """Test getting list of chats"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{API_URL}/chats", headers=headers)
        
        assert response.status_code == 200, f"Get chats failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Got {len(data)} chats")
        
        # If there are chats, verify structure
        if len(data) > 0:
            chat = data[0]
            assert "id" in chat, "Chat missing 'id' field"
            print(f"✓ First chat ID: {chat['id']}")
    
    def test_get_ai_history(self, auth_token):
        """Test getting AI conversation history"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{API_URL}/ai/history?limit=10", headers=headers)
        
        assert response.status_code == 200, f"Get AI history failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Got {len(data)} AI conversation records")


class TestHealthAndBasics:
    """Basic health and connectivity tests"""
    
    def test_api_health(self):
        """Test API is reachable"""
        response = requests.get(f"{API_URL}/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("✓ API health check passed")
    
    def test_frontend_reachable(self):
        """Test frontend is reachable"""
        response = requests.get(BASE_URL, timeout=10)
        assert response.status_code == 200, f"Frontend not reachable: {response.status_code}"
        print("✓ Frontend is reachable")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
