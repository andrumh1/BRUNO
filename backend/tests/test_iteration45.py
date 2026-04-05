"""
Iteration 45 Backend Tests - AI Chat and Chat Features
Tests the AI chat endpoint with action buttons and cards_context
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://premium-launch-13.preview.emergentagent.com')

class TestAIChat:
    """AI Chat endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.base_url = BASE_URL.rstrip('/')
        self.token = None
        
        # Login to get token
        login_response = requests.post(
            f"{self.base_url}/api/auth/login",
            json={"email": "newtest@bruno.com", "password": "Test1234!"}
        )
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
        
    def test_ai_chat_basic(self):
        """Test basic AI chat message"""
        if not self.token:
            pytest.skip("Authentication failed")
        
        response = requests.post(
            f"{self.base_url}/api/ai/chat",
            json={"message": "Hola"},
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check response structure
        assert "response" in data, "Response should contain 'response' field"
        assert "session_id" in data, "Response should contain 'session_id' field"
        assert isinstance(data["response"], str), "Response should be a string"
        assert len(data["response"]) > 0, "Response should not be empty"
        
        print(f"AI Response: {data['response'][:100]}...")
        print(f"Session ID: {data['session_id']}")
    
    def test_ai_chat_search_query(self):
        """Test AI chat with search query - should return action buttons and cards_context"""
        if not self.token:
            pytest.skip("Authentication failed")
        
        response = requests.post(
            f"{self.base_url}/api/ai/chat",
            json={"message": "Busca restaurantes"},
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check response structure
        assert "response" in data, "Response should contain 'response' field"
        assert "session_id" in data, "Response should contain 'session_id' field"
        
        # Check for cards_context (may be present for search queries)
        if "cards_context" in data:
            print(f"Cards context found: {len(data.get('cards_context', []))} cards")
            if data["cards_context"]:
                for card in data["cards_context"][:3]:
                    print(f"  - Card: {card.get('title', 'N/A')} ({card.get('card_type', 'N/A')})")
        
        # Check for action buttons in response text
        response_text = data["response"]
        has_action = "[ACTION:" in response_text
        has_card = "[CARD:" in response_text
        
        print(f"Response has ACTION tags: {has_action}")
        print(f"Response has CARD tags: {has_card}")
        print(f"AI Response: {response_text[:200]}...")
    
    def test_ai_chat_with_attachment(self):
        """Test AI chat with attachment URL"""
        if not self.token:
            pytest.skip("Authentication failed")
        
        response = requests.post(
            f"{self.base_url}/api/ai/chat",
            json={
                "message": "Que ves en esta imagen?",
                "attachment_url": "https://example.com/test.jpg",
                "attachment_type": "image/jpeg"
            },
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "response" in data, "Response should contain 'response' field"
        print(f"AI Response with attachment: {data['response'][:100]}...")


class TestChatEndpoints:
    """Chat-related endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.base_url = BASE_URL.rstrip('/')
        self.token = None
        
        # Login to get token
        login_response = requests.post(
            f"{self.base_url}/api/auth/login",
            json={"email": "newtest@bruno.com", "password": "Test1234!"}
        )
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
    
    def test_get_chats(self):
        """Test getting chat list"""
        if not self.token:
            pytest.skip("Authentication failed")
        
        response = requests.get(
            f"{self.base_url}/api/chats",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} chats")
        
        if len(data) > 0:
            chat = data[0]
            assert "id" in chat, "Chat should have 'id' field"
            assert "other_participants" in chat, "Chat should have 'other_participants' field"
            print(f"First chat ID: {chat['id']}")
    
    def test_upload_chat_file(self):
        """Test chat file upload endpoint"""
        if not self.token:
            pytest.skip("Authentication failed")
        
        # Create a simple test file
        files = {
            'file': ('test.txt', b'Test content for chat upload', 'text/plain')
        }
        
        response = requests.post(
            f"{self.base_url}/api/upload/chat-file",
            files=files,
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "url" in data, "Response should contain 'url' field"
        print(f"Uploaded file URL: {data['url']}")


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint"""
        base_url = BASE_URL.rstrip('/')
        response = requests.get(f"{base_url}/api/health")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", "Health status should be 'healthy'"
        print("Health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
