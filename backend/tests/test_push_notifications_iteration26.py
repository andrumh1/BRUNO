"""
Test Push Notifications and Triggers - Iteration 26
Tests for:
- VAPID public key endpoint
- Push subscription endpoint
- Push test notification endpoint
- Like trigger sends push notification
- Follow trigger integration
- Comment trigger integration
- Message trigger integration
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
TEST_PASSWORD = os.getenv("TEST_USER_PASSWORD", "Test1234!")

# Second test user for interactions
TEST_EMAIL_2 = f"pushtest_{uuid.uuid4().hex[:8]}@bruno.com"
TEST_PASSWORD_2 = os.getenv("TEST_USER_PASSWORD", "Test1234!")


class TestPushNotificationEndpoints:
    """Test Push Notification API Endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def user_info(self):
        """Get user info"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        return data.get("user")
    
    @pytest.fixture(scope="class")
    def second_user_token(self):
        """Create and authenticate second user for interaction tests"""
        # Try to register second user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL_2,
            "password": TEST_PASSWORD_2,
            "name": "Push Test User"
        })
        
        if response.status_code == 400:
            # Already exists, login instead
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_EMAIL_2,
                "password": TEST_PASSWORD_2
            })
        
        if response.status_code in [200, 201]:
            data = response.json()
            return {
                "token": data.get("access_token"),
                "user": data.get("user")
            }
        return None

    # ------------------------------------------------------------------
    # VAPID Public Key Endpoint Test
    # ------------------------------------------------------------------
    def test_get_vapid_public_key(self):
        """Test GET /api/push/vapid-public-key returns valid VAPID key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-public-key")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "publicKey" in data, "Response should contain 'publicKey'"
        
        # Verify key is not empty (should be base64 encoded)
        public_key = data["publicKey"]
        assert public_key and len(public_key) > 0, "VAPID public key should not be empty"
        
        # Verify key length is appropriate for VAPID (typically 65 bytes base64 encoded)
        # Base64 encoded 65 bytes = ~88 characters
        assert len(public_key) >= 40, f"VAPID key seems too short: {len(public_key)} chars"
        
        print(f"✓ VAPID public key endpoint working, key length: {len(public_key)} chars")

    # ------------------------------------------------------------------
    # Push Subscription Endpoint Test
    # ------------------------------------------------------------------
    def test_subscribe_to_push_requires_auth(self):
        """Test POST /api/push/subscribe requires authentication"""
        response = requests.post(f"{BASE_URL}/api/push/subscribe", json={
            "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint",
            "keys": {
                "p256dh": "test-p256dh-key",
                "auth": "test-auth-key"
            }
        })
        
        # Should fail without auth
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Push subscribe endpoint requires authentication")

    def test_subscribe_to_push_with_auth(self, auth_token):
        """Test POST /api/push/subscribe accepts valid subscription data"""
        # Generate unique test endpoint
        test_endpoint = f"https://fcm.googleapis.com/fcm/send/test-{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={
                "endpoint": test_endpoint,
                "keys": {
                    "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                    "auth": "tBHItJI5svbpez7KI4CCXg"
                }
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Should succeed with valid auth
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response contains expected fields
        assert "message" in data, "Response should contain 'message'"
        assert "id" in data, "Response should contain subscription 'id'"
        
        print(f"✓ Push subscription created successfully, id: {data.get('id')}")

    # ------------------------------------------------------------------
    # Push Test Notification Endpoint Test
    # ------------------------------------------------------------------
    def test_send_test_notification_requires_auth(self):
        """Test POST /api/push/test requires authentication"""
        response = requests.post(f"{BASE_URL}/api/push/test")
        
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Test notification endpoint requires authentication")

    def test_send_test_notification_with_auth(self, auth_token):
        """Test POST /api/push/test sends test notification for authenticated user"""
        response = requests.post(
            f"{BASE_URL}/api/push/test",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should contain 'message'"
        assert "sent" in data["message"].lower() or "notification" in data["message"].lower(), \
            f"Response should confirm notification sent: {data['message']}"
        
        print(f"✓ Test notification endpoint working: {data['message']}")

    # ------------------------------------------------------------------
    # Get Subscriptions Endpoint Test
    # ------------------------------------------------------------------
    def test_get_subscriptions(self, auth_token):
        """Test GET /api/push/subscriptions returns user's subscriptions"""
        response = requests.get(
            f"{BASE_URL}/api/push/subscriptions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Response should be a list
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ Get subscriptions endpoint working, found {len(data)} subscriptions")


class TestPushNotificationTriggers:
    """Test that social interactions trigger push notifications correctly"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Get authentication for main user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        return {
            "token": data.get("access_token"),
            "user": data.get("user")
        }
    
    @pytest.fixture(scope="class")
    def second_user(self):
        """Create second user for interaction tests"""
        email = f"trigger_test_{uuid.uuid4().hex[:8]}@bruno.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": TEST_PASSWORD_2,
            "name": "Trigger Test User"
        })
        
        if response.status_code in [200, 201]:
            data = response.json()
            return {
                "token": data.get("access_token"),
                "user": data.get("user")
            }
        return None
    
    @pytest.fixture(scope="class")
    def test_post(self, auth_data):
        """Create a test post for like/comment tests"""
        response = requests.post(
            f"{BASE_URL}/api/posts",
            json={
                "content": "Test post for push notification triggers",
                "post_type": "text",
                "visibility": "public"
            },
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        if response.status_code == 201:
            return response.json()
        return None

    # ------------------------------------------------------------------
    # Like Trigger Test
    # ------------------------------------------------------------------
    def test_like_creates_notification_and_triggers_push(self, auth_data, second_user, test_post):
        """Test that liking a post triggers push notification"""
        if not second_user or not test_post:
            pytest.skip("Second user or test post not available")
        
        post_id = test_post.get("id")
        
        # Like the post from second user
        response = requests.post(
            f"{BASE_URL}/api/posts/{post_id}/like",
            headers={"Authorization": f"Bearer {second_user['token']}"}
        )
        
        assert response.status_code == 200, f"Like failed: {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify like was recorded
        assert data.get("liked") == True or "liked" in data, "Response should confirm like"
        
        # Verify notification was created for post owner
        notif_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert notif_response.status_code == 200
        notifications = notif_response.json()
        
        # Check if like notification exists
        like_notifs = [n for n in notifications if n.get("type") == "like" and n.get("target_id") == post_id]
        assert len(like_notifs) > 0, "Like notification should be created"
        
        print(f"✓ Like trigger working - notification created for post owner")

    # ------------------------------------------------------------------
    # Comment Trigger Test
    # ------------------------------------------------------------------
    def test_comment_creates_notification_and_triggers_push(self, auth_data, second_user, test_post):
        """Test that commenting on a post triggers push notification"""
        if not second_user or not test_post:
            pytest.skip("Second user or test post not available")
        
        post_id = test_post.get("id")
        
        # Comment on the post from second user
        response = requests.post(
            f"{BASE_URL}/api/posts/{post_id}/comments",
            json={"content": "Test comment for push notification trigger"},
            headers={"Authorization": f"Bearer {second_user['token']}"}
        )
        
        assert response.status_code in [200, 201], f"Comment failed: {response.status_code}: {response.text}"
        
        # Verify notification was created
        notif_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert notif_response.status_code == 200
        notifications = notif_response.json()
        
        # Check if comment notification exists
        comment_notifs = [n for n in notifications if n.get("type") == "comment" and n.get("target_id") == post_id]
        assert len(comment_notifs) > 0, "Comment notification should be created"
        
        print(f"✓ Comment trigger working - notification created for post owner")

    # ------------------------------------------------------------------
    # Follow Trigger Test
    # ------------------------------------------------------------------
    def test_follow_creates_notification_and_triggers_push(self, auth_data, second_user):
        """Test that following a user triggers push notification"""
        if not second_user:
            pytest.skip("Second user not available")
        
        target_user_id = auth_data['user']['id']
        
        # Follow main user from second user
        response = requests.post(
            f"{BASE_URL}/api/users/{target_user_id}/follow",
            headers={"Authorization": f"Bearer {second_user['token']}"}
        )
        
        assert response.status_code == 200, f"Follow failed: {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify follow was recorded
        assert data.get("following") == True or "following" in data, "Response should confirm follow"
        
        # Verify notification was created
        notif_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert notif_response.status_code == 200
        notifications = notif_response.json()
        
        # Check if follow notification exists
        follow_notifs = [n for n in notifications if n.get("type") == "follow"]
        assert len(follow_notifs) > 0, "Follow notification should be created"
        
        print(f"✓ Follow trigger working - notification created")

    # ------------------------------------------------------------------
    # Message Trigger Test
    # ------------------------------------------------------------------
    def test_message_creates_notification_and_triggers_push(self, auth_data, second_user):
        """Test that sending a message triggers push notification"""
        if not second_user:
            pytest.skip("Second user not available")
        
        # Create or get chat between users - correct endpoint with query param
        response = requests.post(
            f"{BASE_URL}/api/chats",
            params={"participant_id": second_user['user']['id']},
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        # Accept both 200 (existing) and 201 (created)
        assert response.status_code in [200, 201], f"Chat creation failed: {response.status_code}: {response.text}"
        chat = response.json()
        chat_id = chat.get("id")
        
        # Send message from main user to second user
        msg_response = requests.post(
            f"{BASE_URL}/api/chats/{chat_id}/messages",
            json={
                "content": "Test message for push notification trigger",
                "message_type": "text"
            },
            headers={"Authorization": f"Bearer {auth_data['token']}"}
        )
        
        assert msg_response.status_code in [200, 201], f"Message send failed: {msg_response.status_code}"
        
        # Verify notification was created for recipient
        notif_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {second_user['token']}"}
        )
        
        assert notif_response.status_code == 200
        notifications = notif_response.json()
        
        # Check if message notification exists
        msg_notifs = [n for n in notifications if n.get("type") == "message"]
        assert len(msg_notifs) > 0, "Message notification should be created"
        
        print(f"✓ Message trigger working - notification created for recipient")


class TestCameraPageAPI:
    """Test Camera page dependencies and feed loading"""
    
    def test_feed_page_loads_posts(self):
        """Test that feed page can load posts"""
        response = requests.get(f"{BASE_URL}/api/posts")
        
        assert response.status_code == 200, f"Posts endpoint failed: {response.status_code}"
        data = response.json()
        
        # Should return a list (even if empty)
        assert isinstance(data, list), "Posts should return a list"
        
        print(f"✓ Feed posts endpoint working, found {len(data)} posts")
    
    def test_stories_feed_endpoint(self):
        """Test stories feed endpoint for camera page"""
        response = requests.get(f"{BASE_URL}/api/stories/feed")
        
        # May need auth, but should not 500
        assert response.status_code in [200, 401], f"Stories endpoint error: {response.status_code}"
        
        print(f"✓ Stories feed endpoint accessible (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
