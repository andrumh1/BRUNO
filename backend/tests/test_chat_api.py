"""
Test Chat API endpoints for BRUNO
- User search API (/api/users/search)
- Create/get chat API (/api/chats POST)
- Get chats API (/api/chats GET)
- Get messages API (/api/chats/{chat_id}/messages GET)
- Send message API (/api/chats/{chat_id}/messages POST)
- Send message with image attachment
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_1 = {
    "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
    "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
}

TEST_USER_2 = {
    "email": "chattest2@bruno.com",
    "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
}


class TestChatAPIs:
    """Test suite for Chat/Messaging APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def _login(self, email, password):
        """Helper to login and get token"""
        response = self.session.post(f"{self.base_url}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return data["access_token"], data["user"]
        return None, None
    
    def _get_auth_headers(self, token):
        """Helper to get auth headers"""
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # ==================== HEALTH CHECK ====================
    def test_health_check(self):
        """Test API is reachable"""
        response = self.session.get(f"{self.base_url}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✓ Health check passed")
    
    # ==================== AUTHENTICATION ====================
    def test_login_user1(self):
        """Test login for test user 1"""
        token, user = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        assert token is not None, "Login failed for user 1"
        assert user["email"] == TEST_USER_1["email"]
        print(f"✓ User 1 logged in: {user['name']} ({user['id']})")
        
    def test_login_user2(self):
        """Test login for test user 2"""
        token, user = self._login(TEST_USER_2["email"], TEST_USER_2["password"])
        assert token is not None, "Login failed for user 2"
        assert user["email"] == TEST_USER_2["email"]
        print(f"✓ User 2 logged in: {user['name']} ({user['id']})")
    
    # ==================== USER SEARCH API ====================
    def test_user_search_by_name(self):
        """Test searching users by name"""
        token, user = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        assert token is not None
        
        # Search for user 2 by name
        response = self.session.get(
            f"{self.base_url}/api/users/search?q=Chat Test",
            headers=self._get_auth_headers(token)
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        
        results = response.json()
        assert isinstance(results, list), "Results should be a list"
        
        # Should find user 2
        found = any(u.get("email") == TEST_USER_2["email"] for u in results)
        assert found, f"User 2 not found in search results: {results}"
        print(f"✓ User search by name found {len(results)} user(s)")
        
    def test_user_search_by_email(self):
        """Test searching users by email"""
        token, _ = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        assert token is not None
        
        # Search by email prefix
        response = self.session.get(
            f"{self.base_url}/api/users/search?q=chattest2",
            headers=self._get_auth_headers(token)
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        
        results = response.json()
        assert isinstance(results, list)
        
        # Should find user 2
        found = any(u.get("email") == TEST_USER_2["email"] for u in results)
        assert found, f"User 2 not found in email search: {results}"
        print(f"✓ User search by email found {len(results)} user(s)")
        
    def test_user_search_excludes_self(self):
        """Test that search excludes the current user"""
        token, user = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        assert token is not None
        
        # Search for own name
        response = self.session.get(
            f"{self.base_url}/api/users/search?q=New Test",
            headers=self._get_auth_headers(token)
        )
        assert response.status_code == 200
        
        results = response.json()
        # Should not find self
        found_self = any(u.get("id") == user["id"] for u in results)
        assert not found_self, "Search should exclude current user"
        print("✓ User search correctly excludes self")
        
    def test_user_search_minimum_chars(self):
        """Test that search requires minimum 2 characters"""
        token, _ = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        assert token is not None
        
        # Search with single character
        response = self.session.get(
            f"{self.base_url}/api/users/search?q=a",
            headers=self._get_auth_headers(token)
        )
        assert response.status_code == 200
        
        results = response.json()
        assert results == [], "Single char search should return empty"
        print("✓ User search requires minimum 2 characters")
        
    def test_user_search_unauthorized(self):
        """Test that search requires authentication"""
        response = self.session.get(f"{self.base_url}/api/users/search?q=test")
        assert response.status_code in [401, 403], "Search should require auth"
        print("✓ User search requires authentication")
    
    # ==================== CREATE/GET CHAT API ====================
    def test_create_chat(self):
        """Test creating a new chat between two users"""
        token1, user1 = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        token2, user2 = self._login(TEST_USER_2["email"], TEST_USER_2["password"])
        assert token1 and token2
        
        # User 1 creates chat with User 2
        response = self.session.post(
            f"{self.base_url}/api/chats?participant_id={user2['id']}",
            headers=self._get_auth_headers(token1)
        )
        assert response.status_code in [200, 201], f"Create chat failed: {response.text}"
        
        chat = response.json()
        assert "id" in chat, "Chat should have id"
        assert chat["type"] == "direct", "Chat type should be 'direct'"
        assert user1["id"] in chat["participants"], "User 1 should be participant"
        assert user2["id"] in chat["participants"], "User 2 should be participant"
        print(f"✓ Chat created: {chat['id']}")
        
        # Store for other tests
        self.__class__.chat_id = chat["id"]
        self.__class__.user1_id = user1["id"]
        self.__class__.user2_id = user2["id"]
        self.__class__.token1 = token1
        self.__class__.token2 = token2
        
    def test_get_existing_chat(self):
        """Test that creating chat with same user returns existing chat"""
        token1, user1 = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        token2, user2 = self._login(TEST_USER_2["email"], TEST_USER_2["password"])
        
        # Create/get chat first time
        response1 = self.session.post(
            f"{self.base_url}/api/chats?participant_id={user2['id']}",
            headers=self._get_auth_headers(token1)
        )
        chat1 = response1.json()
        
        # Create/get chat second time - should return same chat
        response2 = self.session.post(
            f"{self.base_url}/api/chats?participant_id={user2['id']}",
            headers=self._get_auth_headers(token1)
        )
        chat2 = response2.json()
        
        assert chat1["id"] == chat2["id"], "Should return same chat"
        print("✓ Get existing chat returns same chat ID")
        
    def test_cannot_chat_with_self(self):
        """Test that user cannot create chat with themselves"""
        token, user = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        
        response = self.session.post(
            f"{self.base_url}/api/chats?participant_id={user['id']}",
            headers=self._get_auth_headers(token)
        )
        assert response.status_code == 400, "Should not allow self-chat"
        print("✓ Cannot create chat with self")
        
    def test_create_chat_unauthorized(self):
        """Test chat creation requires authentication"""
        response = self.session.post(
            f"{self.base_url}/api/chats?participant_id=some-id"
        )
        assert response.status_code in [401, 403], "Create chat should require auth"
        print("✓ Create chat requires authentication")
    
    # ==================== GET CHATS LIST API ====================
    def test_get_chats_list(self):
        """Test getting list of user's chats"""
        token, user = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        
        response = self.session.get(
            f"{self.base_url}/api/chats",
            headers=self._get_auth_headers(token)
        )
        assert response.status_code == 200, f"Get chats failed: {response.text}"
        
        chats = response.json()
        assert isinstance(chats, list), "Chats should be a list"
        print(f"✓ Got {len(chats)} chat(s)")
        
        # Check chat structure
        if chats:
            chat = chats[0]
            assert "id" in chat
            assert "participants" in chat
            assert "other_participants" in chat, "Should include other_participants"
            print(f"✓ Chat structure verified: has other_participants enrichment")
            
    def test_get_chats_list_from_user2(self):
        """Test that user 2 can also see the chat"""
        token, _ = self._login(TEST_USER_2["email"], TEST_USER_2["password"])
        
        response = self.session.get(
            f"{self.base_url}/api/chats",
            headers=self._get_auth_headers(token)
        )
        assert response.status_code == 200
        
        chats = response.json()
        # User 2 should see at least one chat (with User 1)
        assert len(chats) > 0, "User 2 should have at least one chat"
        print(f"✓ User 2 can see {len(chats)} chat(s)")
        
    def test_get_chats_unauthorized(self):
        """Test getting chats requires authentication"""
        response = self.session.get(f"{self.base_url}/api/chats")
        assert response.status_code in [401, 403]
        print("✓ Get chats requires authentication")
    
    # ==================== SEND MESSAGE API ====================
    def test_send_text_message(self):
        """Test sending a text message"""
        token1, user1 = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        token2, user2 = self._login(TEST_USER_2["email"], TEST_USER_2["password"])
        
        # Create/get chat
        chat_response = self.session.post(
            f"{self.base_url}/api/chats?participant_id={user2['id']}",
            headers=self._get_auth_headers(token1)
        )
        chat = chat_response.json()
        chat_id = chat["id"]
        
        # Send message
        message_data = {
            "content": "TEST_Hello from User 1!",
            "message_type": "text",
            "attachments": []
        }
        
        response = self.session.post(
            f"{self.base_url}/api/chats/{chat_id}/messages",
            json=message_data,
            headers=self._get_auth_headers(token1)
        )
        assert response.status_code in [200, 201], f"Send message failed: {response.text}"
        
        message = response.json()
        assert message["content"] == "TEST_Hello from User 1!"
        assert message["sender_id"] == user1["id"]
        assert message["chat_id"] == chat_id
        assert "sender" in message, "Should include sender info"
        print(f"✓ Text message sent: {message['id']}")
        
        self.__class__.test_message_id = message["id"]
        self.__class__.test_chat_id = chat_id
        
    def test_send_message_with_attachment(self):
        """Test sending message with image attachment"""
        token1, user1 = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        token2, user2 = self._login(TEST_USER_2["email"], TEST_USER_2["password"])
        
        # Get chat
        chat_response = self.session.post(
            f"{self.base_url}/api/chats?participant_id={user2['id']}",
            headers=self._get_auth_headers(token1)
        )
        chat = chat_response.json()
        chat_id = chat["id"]
        
        # Send message with attachment (using a placeholder URL)
        message_data = {
            "content": "TEST_Check out this image!",
            "message_type": "image",
            "attachments": [{
                "type": "image",
                "url": "https://res.cloudinary.com/test/image/upload/sample.jpg",
                "filename": "test_image.jpg"
            }]
        }
        
        response = self.session.post(
            f"{self.base_url}/api/chats/{chat_id}/messages",
            json=message_data,
            headers=self._get_auth_headers(token1)
        )
        assert response.status_code in [200, 201], f"Send message with attachment failed: {response.text}"
        
        message = response.json()
        assert len(message["attachments"]) > 0, "Message should have attachment"
        assert message["attachments"][0]["type"] == "image"
        print("✓ Message with attachment sent successfully")
        
    def test_send_message_to_nonexistent_chat(self):
        """Test sending message to non-existent chat fails"""
        token, _ = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        
        response = self.session.post(
            f"{self.base_url}/api/chats/nonexistent-chat-id/messages",
            json={"content": "Test", "message_type": "text", "attachments": []},
            headers=self._get_auth_headers(token)
        )
        assert response.status_code == 404, "Should return 404 for non-existent chat"
        print("✓ Send to non-existent chat returns 404")
        
    def test_send_message_unauthorized(self):
        """Test sending message requires authentication"""
        response = self.session.post(
            f"{self.base_url}/api/chats/some-chat-id/messages",
            json={"content": "Test", "message_type": "text", "attachments": []}
        )
        assert response.status_code in [401, 403]
        print("✓ Send message requires authentication")
    
    # ==================== GET MESSAGES API ====================
    def test_get_messages(self):
        """Test getting messages from a chat"""
        token1, user1 = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        token2, user2 = self._login(TEST_USER_2["email"], TEST_USER_2["password"])
        
        # Get chat
        chat_response = self.session.post(
            f"{self.base_url}/api/chats?participant_id={user2['id']}",
            headers=self._get_auth_headers(token1)
        )
        chat = chat_response.json()
        chat_id = chat["id"]
        
        # Get messages
        response = self.session.get(
            f"{self.base_url}/api/chats/{chat_id}/messages",
            headers=self._get_auth_headers(token1)
        )
        assert response.status_code == 200, f"Get messages failed: {response.text}"
        
        messages = response.json()
        assert isinstance(messages, list), "Messages should be a list"
        print(f"✓ Got {len(messages)} message(s)")
        
        # Check message structure
        if messages:
            msg = messages[-1]  # Last message
            assert "id" in msg
            assert "content" in msg
            assert "sender_id" in msg
            assert "sender" in msg, "Message should include sender info"
            print("✓ Message structure verified: has sender enrichment")
            
    def test_get_messages_as_receiver(self):
        """Test that receiver can get messages from same chat"""
        token2, user2 = self._login(TEST_USER_2["email"], TEST_USER_2["password"])
        token1, user1 = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        
        # Get chat from user 2's perspective
        chat_response = self.session.post(
            f"{self.base_url}/api/chats?participant_id={user1['id']}",
            headers=self._get_auth_headers(token2)
        )
        chat = chat_response.json()
        chat_id = chat["id"]
        
        # Get messages as user 2
        response = self.session.get(
            f"{self.base_url}/api/chats/{chat_id}/messages",
            headers=self._get_auth_headers(token2)
        )
        assert response.status_code == 200
        
        messages = response.json()
        # Should see messages from User 1
        user1_messages = [m for m in messages if m["sender_id"] == user1["id"]]
        assert len(user1_messages) > 0, "User 2 should see User 1's messages"
        print(f"✓ User 2 can see {len(user1_messages)} message(s) from User 1")
        
    def test_get_messages_from_nonexistent_chat(self):
        """Test getting messages from non-existent chat fails"""
        token, _ = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        
        response = self.session.get(
            f"{self.base_url}/api/chats/nonexistent-chat-id/messages",
            headers=self._get_auth_headers(token)
        )
        assert response.status_code == 404
        print("✓ Get messages from non-existent chat returns 404")
        
    def test_get_messages_unauthorized(self):
        """Test getting messages requires authentication"""
        response = self.session.get(f"{self.base_url}/api/chats/some-id/messages")
        assert response.status_code in [401, 403]
        print("✓ Get messages requires authentication")
    
    # ==================== REPLY/CONVERSATION FLOW ====================
    def test_conversation_flow(self):
        """Test a full conversation between two users"""
        token1, user1 = self._login(TEST_USER_1["email"], TEST_USER_1["password"])
        token2, user2 = self._login(TEST_USER_2["email"], TEST_USER_2["password"])
        
        # Get/create chat
        chat_response = self.session.post(
            f"{self.base_url}/api/chats?participant_id={user2['id']}",
            headers=self._get_auth_headers(token1)
        )
        chat = chat_response.json()
        chat_id = chat["id"]
        
        # User 1 sends message
        msg1 = self.session.post(
            f"{self.base_url}/api/chats/{chat_id}/messages",
            json={"content": "TEST_Hey User 2!", "message_type": "text", "attachments": []},
            headers=self._get_auth_headers(token1)
        )
        assert msg1.status_code in [200, 201]
        print("✓ User 1 sent message")
        
        # User 2 replies
        msg2 = self.session.post(
            f"{self.base_url}/api/chats/{chat_id}/messages",
            json={"content": "TEST_Hi User 1, how are you?", "message_type": "text", "attachments": []},
            headers=self._get_auth_headers(token2)
        )
        assert msg2.status_code in [200, 201]
        print("✓ User 2 replied")
        
        # User 1 replies back
        msg3 = self.session.post(
            f"{self.base_url}/api/chats/{chat_id}/messages",
            json={"content": "TEST_I'm good, thanks!", "message_type": "text", "attachments": []},
            headers=self._get_auth_headers(token1)
        )
        assert msg3.status_code in [200, 201]
        print("✓ User 1 replied back")
        
        # Verify all messages in chat
        get_response = self.session.get(
            f"{self.base_url}/api/chats/{chat_id}/messages",
            headers=self._get_auth_headers(token1)
        )
        messages = get_response.json()
        
        # Filter test messages
        test_messages = [m for m in messages if m["content"].startswith("TEST_")]
        assert len(test_messages) >= 3, f"Should have at least 3 test messages, got {len(test_messages)}"
        print(f"✓ Conversation flow verified: {len(test_messages)} test messages in chat")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
