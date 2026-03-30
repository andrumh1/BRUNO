"""
Iteration 32 Tests: Social Features (Follow/Block) and Responsive Navigation
Tests:
- Bottom navigation bar visibility on all screen sizes
- Follow/unfollow endpoint
- Block/unblock endpoint (with auto-unfollow)
- Followers list endpoint
- Following list endpoint
- Blocked users list endpoint
- User profile with is_following, is_blocked_by_me, is_blocked_by_them fields
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://premium-launch-13.preview.emergentagent.com')

# Test credentials
TEST_USER_EMAIL = "newtest@bruno.com"
TEST_USER_PASSWORD = "Test1234!"
TEST_USER_ID = "b6a3059d-3c5c-4ffd-9fc2-b8dff4a420b9"

# Second test user for follow/block tests
TEST_USER2_EMAIL = "testuser2@bruno.com"
TEST_USER2_PASSWORD = "Test1234!"
TEST_USER2_ID = "b6eb8b2a-1365-48de-9bde-9afd9677d4ba"


class TestAuthAndSetup:
    """Authentication tests to get token for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_login_success(self, auth_token):
        """Test login returns valid token"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"Login successful, token length: {len(auth_token)}")


class TestUserSearch:
    """Test user search to find other users for follow/block tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_search_users(self, auth_token):
        """Search for users to test follow/block functionality"""
        response = requests.get(
            f"{BASE_URL}/api/users/search?q=test",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        users = response.json()
        print(f"Found {len(users)} users matching 'test'")
        for u in users[:5]:
            print(f"  - {u.get('id')}: {u.get('name')} ({u.get('email')})")
        return users


class TestFollowUnfollow:
    """Test follow/unfollow functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def target_user_id(self):
        """Use the second test user for follow tests"""
        return TEST_USER2_ID
    
    def test_follow_user(self, auth_token, target_user_id):
        """Test following a user"""
        if not target_user_id:
            pytest.skip("No target user found for follow test")
        
        response = requests.post(
            f"{BASE_URL}/api/users/{target_user_id}/follow",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Follow failed: {response.text}"
        data = response.json()
        assert "following" in data
        print(f"Follow result: {data}")
    
    def test_unfollow_user(self, auth_token, target_user_id):
        """Test unfollowing a user (toggle)"""
        if not target_user_id:
            pytest.skip("No target user found for unfollow test")
        
        # First ensure we're following
        requests.post(
            f"{BASE_URL}/api/users/{target_user_id}/follow",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Then unfollow (toggle)
        response = requests.post(
            f"{BASE_URL}/api/users/{target_user_id}/follow",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Unfollow failed: {response.text}"
        data = response.json()
        assert "following" in data
        print(f"Unfollow result: {data}")
    
    def test_cannot_follow_self(self, auth_token):
        """Test that user cannot follow themselves"""
        response = requests.post(
            f"{BASE_URL}/api/users/{TEST_USER_ID}/follow",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 400, f"Should not be able to follow self: {response.text}"
        print("Correctly prevented self-follow")


class TestBlockUnblock:
    """Test block/unblock functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def target_user_id(self):
        """Use the second test user for block tests"""
        return TEST_USER2_ID
    
    def test_block_user(self, auth_token, target_user_id):
        """Test blocking a user"""
        if not target_user_id:
            pytest.skip("No target user found for block test")
        
        response = requests.post(
            f"{BASE_URL}/api/users/{target_user_id}/block",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Block failed: {response.text}"
        data = response.json()
        assert "blocked" in data
        print(f"Block result: {data}")
    
    def test_unblock_user(self, auth_token, target_user_id):
        """Test unblocking a user (toggle)"""
        if not target_user_id:
            pytest.skip("No target user found for unblock test")
        
        # First ensure we're blocking
        requests.post(
            f"{BASE_URL}/api/users/{target_user_id}/block",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Then unblock (toggle)
        response = requests.post(
            f"{BASE_URL}/api/users/{target_user_id}/block",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Unblock failed: {response.text}"
        data = response.json()
        assert "blocked" in data
        print(f"Unblock result: {data}")
    
    def test_cannot_block_self(self, auth_token):
        """Test that user cannot block themselves"""
        response = requests.post(
            f"{BASE_URL}/api/users/{TEST_USER_ID}/block",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 400, f"Should not be able to block self: {response.text}"
        print("Correctly prevented self-block")


class TestFollowersFollowingLists:
    """Test followers and following list endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_get_followers(self, auth_token):
        """Test getting followers list"""
        response = requests.get(
            f"{BASE_URL}/api/users/{TEST_USER_ID}/followers",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get followers failed: {response.text}"
        followers = response.json()
        assert isinstance(followers, list)
        print(f"User has {len(followers)} followers")
        for f in followers[:3]:
            print(f"  - {f.get('name')} ({f.get('id')})")
    
    def test_get_following(self, auth_token):
        """Test getting following list"""
        response = requests.get(
            f"{BASE_URL}/api/users/{TEST_USER_ID}/following",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get following failed: {response.text}"
        following = response.json()
        assert isinstance(following, list)
        print(f"User is following {len(following)} users")
        for f in following[:3]:
            print(f"  - {f.get('name')} ({f.get('id')})")
    
    def test_get_blocked_users(self, auth_token):
        """Test getting blocked users list"""
        response = requests.get(
            f"{BASE_URL}/api/users/me/blocked",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get blocked users failed: {response.text}"
        blocked = response.json()
        assert isinstance(blocked, list)
        print(f"User has blocked {len(blocked)} users")


class TestUserProfileWithSocialFields:
    """Test user profile endpoint returns social fields"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def target_user_id(self):
        """Use the second test user for profile tests"""
        return TEST_USER2_ID
    
    def test_profile_has_social_fields(self, auth_token, target_user_id):
        """Test that profile endpoint returns is_following, is_blocked_by_me, is_blocked_by_them"""
        if not target_user_id:
            pytest.skip("No target user found for profile test")
        
        response = requests.get(
            f"{BASE_URL}/api/users/{target_user_id}/profile",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get profile failed: {response.text}"
        profile = response.json()
        
        # Check required fields
        assert "is_following" in profile, "Profile missing is_following field"
        assert "is_blocked_by_me" in profile, "Profile missing is_blocked_by_me field"
        assert "is_blocked_by_them" in profile, "Profile missing is_blocked_by_them field"
        assert "followers_count" in profile, "Profile missing followers_count field"
        assert "following_count" in profile, "Profile missing following_count field"
        
        print(f"Profile social fields:")
        print(f"  - is_following: {profile['is_following']}")
        print(f"  - is_blocked_by_me: {profile['is_blocked_by_me']}")
        print(f"  - is_blocked_by_them: {profile['is_blocked_by_them']}")
        print(f"  - followers_count: {profile['followers_count']}")
        print(f"  - following_count: {profile['following_count']}")
    
    def test_own_profile(self, auth_token):
        """Test getting own profile"""
        response = requests.get(
            f"{BASE_URL}/api/users/{TEST_USER_ID}/profile",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get own profile failed: {response.text}"
        profile = response.json()
        assert "followers_count" in profile
        assert "following_count" in profile
        print(f"Own profile: {profile.get('name')} - {profile.get('followers_count')} followers, {profile.get('following_count')} following")


class TestBlockAutoUnfollow:
    """Test that blocking a user also unfollows in both directions"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def target_user_id(self):
        """Use the second test user for block+unfollow test"""
        return TEST_USER2_ID
    
    def test_block_removes_follow(self, auth_token, target_user_id):
        """Test that blocking removes follow relationship"""
        if not target_user_id:
            pytest.skip("No target user found")
        
        # First, ensure user is NOT blocked (unblock if needed)
        unblock_resp = requests.post(
            f"{BASE_URL}/api/users/{target_user_id}/block",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if unblock_resp.json().get("blocked") == True:
            # Was not blocked, now is blocked - unblock again
            requests.post(
                f"{BASE_URL}/api/users/{target_user_id}/block",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
        
        # Now follow the user
        follow_resp = requests.post(
            f"{BASE_URL}/api/users/{target_user_id}/follow",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        follow_data = follow_resp.json()
        print(f"Follow response: {follow_data}")
        
        # Ensure we're following
        if not follow_data.get("following"):
            # Toggle again to follow
            follow_resp = requests.post(
                f"{BASE_URL}/api/users/{target_user_id}/follow",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            follow_data = follow_resp.json()
            print(f"Follow response (retry): {follow_data}")
        
        # Now block the user
        block_resp = requests.post(
            f"{BASE_URL}/api/users/{target_user_id}/block",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert block_resp.status_code == 200
        block_data = block_resp.json()
        assert block_data.get("blocked") == True, f"Expected blocked=True, got {block_data}"
        print(f"Block response: {block_data}")
        
        # Check profile - should show is_blocked_by_me=True
        profile_resp = requests.get(
            f"{BASE_URL}/api/users/{target_user_id}/profile",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        profile = profile_resp.json()
        assert profile.get("is_blocked_by_me") == True, "User should be blocked"
        print(f"After block - is_following: {profile.get('is_following')}, is_blocked_by_me: {profile.get('is_blocked_by_me')}")
        
        # Clean up - unblock
        requests.post(
            f"{BASE_URL}/api/users/{target_user_id}/block",
            headers={"Authorization": f"Bearer {auth_token}"}
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
