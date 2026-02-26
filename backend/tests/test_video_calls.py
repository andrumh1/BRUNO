"""
Test Video Call API Endpoints
Tests: /api/calls/start, /api/calls/{call_id}/answer, /api/calls/{call_id}/decline, /api/calls/{call_id}/end
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-marketplace-32.preview.emergentagent.com')

# Test credentials
TEST_USER_1 = {"email": "newtest@bruno.com", "password": "Test1234!"}
TEST_USER_2 = {"email": "chattest2@bruno.com", "password": "Test1234!"}


class TestVideoCallsSetup:
    """Setup fixtures and helpers for video call tests"""
    
    @pytest.fixture(scope="class")
    def user1_token(self):
        """Login user 1 and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER_1)
        if response.status_code != 200:
            pytest.skip(f"Cannot login user1: {response.text}")
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def user2_token(self):
        """Login user 2 and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER_2)
        if response.status_code != 200:
            pytest.skip(f"Cannot login user2: {response.text}")
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def user1_data(self, user1_token):
        """Get user 1 details"""
        response = requests.get(f"{BASE_URL}/api/auth/me", 
                               headers={"Authorization": f"Bearer {user1_token}"})
        return response.json()
    
    @pytest.fixture(scope="class")
    def user2_data(self, user2_token):
        """Get user 2 details"""
        response = requests.get(f"{BASE_URL}/api/auth/me", 
                               headers={"Authorization": f"Bearer {user2_token}"})
        return response.json()
    
    @pytest.fixture(scope="class")
    def chat_between_users(self, user1_token, user2_data):
        """Create or get existing chat between users"""
        response = requests.post(
            f"{BASE_URL}/api/chats?participant_id={user2_data['id']}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        if response.status_code in [200, 201]:
            return response.json()
        pytest.skip(f"Cannot create chat: {response.text}")


class TestVideoCallStart(TestVideoCallsSetup):
    """Test POST /api/calls/start endpoint"""
    
    def test_start_video_call_success(self, user1_token, chat_between_users):
        """Test starting a video call - should return room_url, room_name, call_id"""
        response = requests.post(
            f"{BASE_URL}/api/calls/start",
            json={"chat_id": chat_between_users["id"], "call_type": "video"},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "room_url" in data, "Response should contain room_url"
        assert "room_name" in data, "Response should contain room_name"
        assert "call_id" in data, "Response should contain call_id"
        
        # Verify room URL format
        assert "bruno-call-" in data["room_name"], "Room name should contain 'bruno-call-'"
        assert data["room_url"].startswith("https://"), "Room URL should be HTTPS"
        
        # Store call_id for other tests
        TestVideoCallStart.last_call_id = data["call_id"]
        print(f"Video call started: call_id={data['call_id']}, room_url={data['room_url']}")
    
    def test_start_audio_call_success(self, user1_token, chat_between_users):
        """Test starting an audio call"""
        response = requests.post(
            f"{BASE_URL}/api/calls/start",
            json={"chat_id": chat_between_users["id"], "call_type": "audio"},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "call_id" in data
        print(f"Audio call started: call_id={data['call_id']}")
    
    def test_start_call_invalid_chat(self, user1_token):
        """Test starting call with non-existent chat - should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/calls/start",
            json={"chat_id": "non-existent-chat-id", "call_type": "video"},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_start_call_requires_auth(self, chat_between_users):
        """Test that starting a call requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/calls/start",
            json={"chat_id": chat_between_users["id"], "call_type": "video"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestVideoCallAnswer(TestVideoCallsSetup):
    """Test POST /api/calls/{call_id}/answer endpoint"""
    
    @pytest.fixture
    def active_call(self, user1_token, chat_between_users):
        """Create a fresh call for testing answer"""
        response = requests.post(
            f"{BASE_URL}/api/calls/start",
            json={"chat_id": chat_between_users["id"], "call_type": "video"},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        return response.json()
    
    def test_answer_call_success(self, user2_token, active_call):
        """Test answering a call - user 2 answers call from user 1"""
        call_id = active_call["call_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/calls/{call_id}/answer",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "answered", "Response should have status 'answered'"
        assert "room_url" in data, "Response should contain room_url"
        print(f"Call {call_id} answered successfully")
    
    def test_answer_nonexistent_call(self, user2_token):
        """Test answering non-existent call - should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/calls/fake-call-id/answer",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestVideoCallDecline(TestVideoCallsSetup):
    """Test POST /api/calls/{call_id}/decline endpoint"""
    
    @pytest.fixture
    def ringing_call(self, user1_token, chat_between_users):
        """Create a fresh call for testing decline"""
        response = requests.post(
            f"{BASE_URL}/api/calls/start",
            json={"chat_id": chat_between_users["id"], "call_type": "video"},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        return response.json()
    
    def test_decline_call_success(self, user2_token, ringing_call):
        """Test declining a call"""
        call_id = ringing_call["call_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/calls/{call_id}/decline",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "declined", "Response should have status 'declined'"
        print(f"Call {call_id} declined successfully")
    
    def test_decline_nonexistent_call(self, user2_token):
        """Test declining non-existent call - should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/calls/fake-call-id/decline",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestVideoCallEnd(TestVideoCallsSetup):
    """Test POST /api/calls/{call_id}/end endpoint"""
    
    @pytest.fixture
    def answered_call(self, user1_token, user2_token, chat_between_users):
        """Create and answer a call for testing end"""
        # Start call
        start_response = requests.post(
            f"{BASE_URL}/api/calls/start",
            json={"chat_id": chat_between_users["id"], "call_type": "video"},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        call_data = start_response.json()
        
        # Answer call
        requests.post(
            f"{BASE_URL}/api/calls/{call_data['call_id']}/answer",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        
        return call_data
    
    def test_end_call_by_caller(self, user1_token, answered_call):
        """Test ending a call by the caller"""
        call_id = answered_call["call_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/calls/{call_id}/end",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("status") == "ended", "Response should have status 'ended'"
        print(f"Call {call_id} ended by caller")
    
    def test_end_call_nonexistent(self, user1_token):
        """Test ending non-existent call - should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/calls/fake-call-id/end",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestVideoCallIntegration(TestVideoCallsSetup):
    """Integration tests for full video call flow"""
    
    def test_full_call_flow(self, user1_token, user2_token, chat_between_users):
        """Test complete flow: start -> answer -> end"""
        # 1. User 1 starts call
        start_response = requests.post(
            f"{BASE_URL}/api/calls/start",
            json={"chat_id": chat_between_users["id"], "call_type": "video"},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert start_response.status_code == 200
        call_data = start_response.json()
        call_id = call_data["call_id"]
        print(f"Step 1: Call started by user1, call_id={call_id}")
        
        # 2. User 2 answers
        answer_response = requests.post(
            f"{BASE_URL}/api/calls/{call_id}/answer",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert answer_response.status_code == 200
        print(f"Step 2: Call answered by user2")
        
        # 3. User 1 ends call
        end_response = requests.post(
            f"{BASE_URL}/api/calls/{call_id}/end",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert end_response.status_code == 200
        print(f"Step 3: Call ended by user1")
        print("Full call flow completed successfully!")
    
    def test_call_decline_flow(self, user1_token, user2_token, chat_between_users):
        """Test flow: start -> decline"""
        # 1. User 1 starts call
        start_response = requests.post(
            f"{BASE_URL}/api/calls/start",
            json={"chat_id": chat_between_users["id"], "call_type": "audio"},
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert start_response.status_code == 200
        call_id = start_response.json()["call_id"]
        print(f"Step 1: Audio call started, call_id={call_id}")
        
        # 2. User 2 declines
        decline_response = requests.post(
            f"{BASE_URL}/api/calls/{call_id}/decline",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert decline_response.status_code == 200
        print(f"Step 2: Call declined by user2")
        print("Call decline flow completed successfully!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
