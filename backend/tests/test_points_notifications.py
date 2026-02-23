"""
Test file for Points/Gamification System and Push Notifications APIs
Testing: GET /api/points/me, POST /api/points/daily-check-in, GET /api/points/leaderboard
Testing: POST /api/notifications/subscribe, GET /api/notifications/status, preferences endpoints
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_USER_EMAIL = "newtest@bruno.com"
TEST_USER_PASSWORD = "Test1234!"

class TestPointsSystem:
    """Points/Gamification system API tests"""

    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("access_token")

    def test_get_my_points(self, auth_token):
        """GET /api/points/me - returns user points and level"""
        response = requests.get(f"{BASE_URL}/api/points/me", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get points failed: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "total_points" in data, "Missing total_points in response"
        assert "level" in data, "Missing level in response"
        assert "next_level" in data, "Missing next_level in response"
        assert "points_to_next_level" in data, "Missing points_to_next_level"
        assert "streak_days" in data, "Missing streak_days"
        assert "recent_earnings" in data, "Missing recent_earnings"
        
        # Validate level structure
        level = data["level"]
        assert "level" in level, "Level object missing level number"
        assert "name" in level, "Level object missing name"
        assert "badge" in level, "Level object missing badge"
        assert "min_points" in level, "Level object missing min_points"
        
        # Validate data types
        assert isinstance(data["total_points"], int), "total_points should be int"
        assert isinstance(data["streak_days"], int), "streak_days should be int"
        assert isinstance(data["recent_earnings"], list), "recent_earnings should be list"
        
        print(f"Points API response: total_points={data['total_points']}, level={level['name']}, streak={data['streak_days']}")

    def test_get_points_requires_auth(self):
        """GET /api/points/me - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/points/me")
        assert response.status_code == 401 or response.status_code == 403, "Should require authentication"

    def test_daily_check_in(self, auth_token):
        """POST /api/points/daily-check-in - awards daily points"""
        response = requests.post(f"{BASE_URL}/api/points/daily-check-in", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Daily check-in failed: {response.text}"
        
        data = response.json()
        # Response should contain check-in result
        assert "streak_days" in data, "Missing streak_days in response"
        assert "points_earned" in data or "already_checked_in" in data, "Missing points_earned or already_checked_in"
        
        if data.get("already_checked_in"):
            print(f"Already checked in today. Streak: {data['streak_days']} days")
        else:
            print(f"Check-in successful! Earned: {data.get('points_earned', 0)} pts, Streak: {data['streak_days']} days")
            if data.get("bonus_message"):
                print(f"Bonus: {data['bonus_message']}")

    def test_daily_check_in_idempotent(self, auth_token):
        """POST /api/points/daily-check-in - second check-in should indicate already done"""
        # First check-in
        requests.post(f"{BASE_URL}/api/points/daily-check-in", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        # Second check-in same day
        response = requests.post(f"{BASE_URL}/api/points/daily-check-in", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Second check-in failed: {response.text}"
        data = response.json()
        
        # Should indicate already checked in (points_earned = 0 or already_checked_in = True)
        assert data.get("already_checked_in") == True or data.get("points_earned") == 0, \
            "Second check-in should not award points"
        print("Idempotent check-in verified - no double points awarded")

    def test_get_leaderboard(self, auth_token):
        """GET /api/points/leaderboard - returns ranking"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get leaderboard failed: {response.text}"
        
        data = response.json()
        assert "leaderboard" in data, "Missing leaderboard in response"
        assert "my_rank" in data, "Missing my_rank in response"
        
        leaderboard = data["leaderboard"]
        assert isinstance(leaderboard, list), "leaderboard should be a list"
        
        if len(leaderboard) > 0:
            entry = leaderboard[0]
            # Validate leaderboard entry structure
            assert "rank" in entry, "Leaderboard entry missing rank"
            assert "user_id" in entry, "Leaderboard entry missing user_id"
            assert "username" in entry, "Leaderboard entry missing username"
            assert "total_points" in entry, "Leaderboard entry missing total_points"
            assert "level" in entry, "Leaderboard entry missing level"
            assert "streak_days" in entry, "Leaderboard entry missing streak_days"
            
            print(f"Leaderboard top entry: #{entry['rank']} {entry['username']} with {entry['total_points']} pts")
        
        print(f"Current user rank: #{data['my_rank']}")

    def test_leaderboard_with_limit(self, auth_token):
        """GET /api/points/leaderboard?limit=5 - respects limit param"""
        response = requests.get(f"{BASE_URL}/api/points/leaderboard?limit=5", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get leaderboard with limit failed: {response.text}"
        
        data = response.json()
        leaderboard = data["leaderboard"]
        assert len(leaderboard) <= 5, f"Leaderboard should have at most 5 entries, got {len(leaderboard)}"
        print(f"Leaderboard limit test: got {len(leaderboard)} entries with limit=5")

    def test_points_history(self, auth_token):
        """GET /api/points/history - get transaction history"""
        response = requests.get(f"{BASE_URL}/api/points/history", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get history failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "History should be a list"
        
        if len(data) > 0:
            tx = data[0]
            # Validate transaction structure
            assert "action" in tx or "description" in tx, "Transaction missing action/description"
            assert "points" in tx, "Transaction missing points"
            assert "created_at" in tx, "Transaction missing created_at"
            print(f"Latest transaction: {tx.get('description', tx.get('action'))} - {tx['points']} pts")
        else:
            print("No transaction history yet")


class TestNotificationsSystem:
    """Push notifications API tests"""

    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("access_token")

    def test_notification_status(self, auth_token):
        """GET /api/notifications/status - get subscription status"""
        response = requests.get(f"{BASE_URL}/api/notifications/status", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get notification status failed: {response.text}"
        
        data = response.json()
        assert "subscribed" in data, "Missing subscribed field in response"
        assert isinstance(data["subscribed"], bool), "subscribed should be boolean"
        
        print(f"Notification status: subscribed={data['subscribed']}")

    def test_notification_subscribe(self, auth_token):
        """POST /api/notifications/subscribe - subscribe to push notifications"""
        # Mock subscription data (simulating browser push subscription)
        subscription_data = {
            "subscription": {
                "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint-12345",
                "keys": {
                    "p256dh": "BPV3test-public-key-xyz",
                    "auth": "auth-secret-test"
                },
                "expirationTime": None
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/notifications/subscribe", 
            headers={"Authorization": f"Bearer {auth_token}"},
            json=subscription_data
        )
        
        assert response.status_code == 200, f"Subscribe failed: {response.text}"
        
        data = response.json()
        assert "status" in data, "Missing status in response"
        assert data["status"] == "subscribed", f"Expected status=subscribed, got {data['status']}"
        
        print("Push notification subscription successful")

    def test_notification_status_after_subscribe(self, auth_token):
        """GET /api/notifications/status - verify subscription persisted"""
        # First subscribe
        subscription_data = {
            "subscription": {
                "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint-check",
                "keys": {"p256dh": "test-key", "auth": "test-auth"}
            }
        }
        requests.post(f"{BASE_URL}/api/notifications/subscribe",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=subscription_data
        )
        
        # Then check status
        response = requests.get(f"{BASE_URL}/api/notifications/status", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["subscribed"] == True, "Should be subscribed after subscribe call"
        print("Subscription persistence verified")

    def test_notification_preferences_get(self, auth_token):
        """GET /api/notifications/preferences - get notification preferences"""
        response = requests.get(f"{BASE_URL}/api/notifications/preferences", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get preferences failed: {response.text}"
        
        data = response.json()
        # Check for default preference fields
        expected_fields = ["calls", "messages", "likes", "comments", "followers"]
        for field in expected_fields:
            assert field in data, f"Missing preference field: {field}"
            assert isinstance(data[field], bool), f"{field} should be boolean"
        
        print(f"Notification preferences: {data}")

    def test_notification_preferences_update(self, auth_token):
        """PUT /api/notifications/preferences - update preferences"""
        update_data = {
            "calls": True,
            "messages": True,
            "likes": False,
            "comments": True,
            "followers": True,
            "promotions": False
        }
        
        response = requests.put(f"{BASE_URL}/api/notifications/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=update_data
        )
        
        assert response.status_code == 200, f"Update preferences failed: {response.text}"
        
        data = response.json()
        assert "status" in data, "Missing status in response"
        assert data["status"] == "updated", f"Expected status=updated, got {data['status']}"
        
        # Verify update by fetching preferences again
        verify_response = requests.get(f"{BASE_URL}/api/notifications/preferences", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        verify_data = verify_response.json()
        assert verify_data["likes"] == False, "likes preference should be False after update"
        
        print("Notification preferences updated and verified")

    def test_notification_unsubscribe(self, auth_token):
        """DELETE /api/notifications/unsubscribe - unsubscribe from push"""
        response = requests.delete(f"{BASE_URL}/api/notifications/unsubscribe", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Unsubscribe failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "unsubscribed", f"Expected unsubscribed status"
        
        # Verify unsubscribed
        status_response = requests.get(f"{BASE_URL}/api/notifications/status", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        status_data = status_response.json()
        assert status_data["subscribed"] == False, "Should be unsubscribed after DELETE"
        
        print("Unsubscribe successful and verified")

    def test_get_recent_notifications(self, auth_token):
        """GET /api/notifications/recent - get in-app notifications"""
        response = requests.get(f"{BASE_URL}/api/notifications/recent", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Get recent notifications failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Recent notifications should be a list"
        print(f"Recent notifications count: {len(data)}")

    def test_notification_requires_auth(self):
        """Notification endpoints require authentication"""
        # Status without auth
        response = requests.get(f"{BASE_URL}/api/notifications/status")
        assert response.status_code in [401, 403], "Status should require auth"
        
        # Subscribe without auth
        response = requests.post(f"{BASE_URL}/api/notifications/subscribe", json={})
        assert response.status_code in [401, 403], "Subscribe should require auth"
        
        print("Authentication requirement verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
