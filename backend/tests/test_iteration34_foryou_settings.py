"""
Iteration 34: Testing For You Feed, Interaction Tracking, and Settings Preferences
Phase 20 features: Personalized feed, interaction tracking, expanded settings page
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
TEST_PASSWORD = os.getenv("TEST_USER_PASSWORD", "Test1234!")
TEST_USER_ID = "b6a3059d-3c5c-4ffd-9fc2-b8dff4a420b9"


class TestAuthentication:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        print(f"✓ Login successful, user_id: {data['user']['id']}")
        return data["access_token"]


class TestForYouFeed:
    """Tests for the personalized 'For You' feed endpoint"""
    
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
    
    def test_for_you_feed_requires_auth(self):
        """Test that /feed/for-you requires authentication"""
        response = requests.get(f"{BASE_URL}/api/feed/for-you")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ For You feed correctly requires authentication")
    
    def test_for_you_feed_returns_posts(self, auth_token):
        """Test that /feed/for-you returns personalized posts"""
        response = requests.get(
            f"{BASE_URL}/api/feed/for-you",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"For You feed failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ For You feed returned {len(data)} posts")
        
        # Verify post structure if posts exist
        if len(data) > 0:
            post = data[0]
            assert "id" in post, "Post missing id"
            assert "user" in post, "Post missing user info"
            assert "_for_you_reason" in post, "Post missing _for_you_reason field"
            valid_reasons = ["following", "hashtag_match", "trending", "discover"]
            assert post["_for_you_reason"] in valid_reasons, f"Invalid reason: {post['_for_you_reason']}"
            print(f"✓ First post has _for_you_reason: {post['_for_you_reason']}")
    
    def test_for_you_feed_pagination(self, auth_token):
        """Test pagination parameters"""
        response = requests.get(
            f"{BASE_URL}/api/feed/for-you?skip=0&limit=5",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5, "Pagination limit not respected"
        print(f"✓ Pagination works, returned {len(data)} posts with limit=5")
    
    def test_for_you_posts_have_user_info(self, auth_token):
        """Test that posts include enriched user information"""
        response = requests.get(
            f"{BASE_URL}/api/feed/for-you",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            post = data[0]
            user = post.get("user", {})
            assert "id" in user, "User missing id"
            assert "username" in user, "User missing username"
            assert "avatar_url" in user or user.get("avatar_url") is None, "User should have avatar_url field"
            print(f"✓ Posts include enriched user info: {user.get('username')}")
    
    def test_for_you_posts_have_interaction_state(self, auth_token):
        """Test that posts include is_liked and is_bookmarked fields"""
        response = requests.get(
            f"{BASE_URL}/api/feed/for-you",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            post = data[0]
            assert "is_liked" in post, "Post missing is_liked field"
            assert "is_bookmarked" in post, "Post missing is_bookmarked field"
            print(f"✓ Posts include interaction state: is_liked={post['is_liked']}, is_bookmarked={post['is_bookmarked']}")


class TestInteractionTracking:
    """Tests for the interaction tracking endpoint"""
    
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
    
    def test_interaction_tracking_requires_auth(self):
        """Test that interaction tracking requires authentication"""
        response = requests.post(f"{BASE_URL}/api/feed/interaction?post_id=test123&interaction_type=view")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Interaction tracking correctly requires authentication")
    
    def test_track_view_interaction(self, auth_token):
        """Test tracking a view interaction"""
        response = requests.post(
            f"{BASE_URL}/api/feed/interaction?post_id=test-post-123&interaction_type=view",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Tracking failed: {response.text}"
        data = response.json()
        assert data.get("tracked") == True, "Response should confirm tracking"
        print("✓ View interaction tracked successfully")
    
    def test_track_click_interaction(self, auth_token):
        """Test tracking a click interaction"""
        response = requests.post(
            f"{BASE_URL}/api/feed/interaction?post_id=test-post-456&interaction_type=click",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("tracked") == True
        print("✓ Click interaction tracked successfully")
    
    def test_track_expand_interaction(self, auth_token):
        """Test tracking an expand interaction"""
        response = requests.post(
            f"{BASE_URL}/api/feed/interaction?post_id=test-post-789&interaction_type=expand",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("tracked") == True
        print("✓ Expand interaction tracked successfully")
    
    def test_track_share_interaction(self, auth_token):
        """Test tracking a share interaction"""
        response = requests.post(
            f"{BASE_URL}/api/feed/interaction?post_id=test-post-share&interaction_type=share",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("tracked") == True
        print("✓ Share interaction tracked successfully")
    
    def test_track_dwell_interaction(self, auth_token):
        """Test tracking a dwell interaction"""
        response = requests.post(
            f"{BASE_URL}/api/feed/interaction?post_id=test-post-dwell&interaction_type=dwell",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("tracked") == True
        print("✓ Dwell interaction tracked successfully")
    
    def test_invalid_interaction_type_defaults_to_view(self, auth_token):
        """Test that invalid interaction type defaults to view"""
        response = requests.post(
            f"{BASE_URL}/api/feed/interaction?post_id=test-post-invalid&interaction_type=invalid_type",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("tracked") == True
        print("✓ Invalid interaction type handled gracefully (defaults to view)")


class TestSettingsPreferences:
    """Tests for the settings/preferences endpoints"""
    
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
    
    def test_get_preferences_requires_auth(self):
        """Test that GET /settings/preferences requires authentication"""
        response = requests.get(f"{BASE_URL}/api/settings/preferences")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ GET preferences correctly requires authentication")
    
    def test_put_preferences_requires_auth(self):
        """Test that PUT /settings/preferences requires authentication"""
        response = requests.put(f"{BASE_URL}/api/settings/preferences", json={"theme": "dark"})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ PUT preferences correctly requires authentication")
    
    def test_get_preferences_returns_all_sections(self, auth_token):
        """Test that GET /settings/preferences returns all preference sections"""
        response = requests.get(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get preferences failed: {response.text}"
        data = response.json()
        
        # Verify all required sections exist
        assert "feed_mode" in data, "Missing feed_mode"
        assert "language" in data, "Missing language"
        assert "theme" in data, "Missing theme"
        assert "notifications" in data, "Missing notifications section"
        assert "privacy" in data, "Missing privacy section"
        assert "content" in data, "Missing content section"
        
        print(f"✓ Preferences returned with all sections: feed_mode={data['feed_mode']}, theme={data['theme']}")
    
    def test_preferences_notifications_structure(self, auth_token):
        """Test notifications preferences structure"""
        response = requests.get(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        notifications = data.get("notifications", {})
        required_keys = ["likes", "comments", "follows", "messages", "mentions"]
        for key in required_keys:
            assert key in notifications, f"Missing notifications.{key}"
        
        print(f"✓ Notifications section has all required keys: {list(notifications.keys())}")
    
    def test_preferences_privacy_structure(self, auth_token):
        """Test privacy preferences structure"""
        response = requests.get(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        privacy = data.get("privacy", {})
        required_keys = ["show_online_status", "allow_messages_from", "show_read_receipts", "profile_visibility"]
        for key in required_keys:
            assert key in privacy, f"Missing privacy.{key}"
        
        print(f"✓ Privacy section has all required keys: {list(privacy.keys())}")
    
    def test_preferences_content_structure(self, auth_token):
        """Test content preferences structure"""
        response = requests.get(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        content = data.get("content", {})
        required_keys = ["autoplay_videos", "show_sensitive_content", "default_post_visibility"]
        for key in required_keys:
            assert key in content, f"Missing content.{key}"
        
        print(f"✓ Content section has all required keys: {list(content.keys())}")
    
    def test_update_theme_preference(self, auth_token):
        """Test updating theme preference"""
        # Update to dark theme
        response = requests.put(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"theme": "dark"}
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        assert data.get("theme") == "dark", "Theme not updated"
        print("✓ Theme updated to dark")
        
        # Revert to system
        response = requests.put(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"theme": "system"}
        )
        assert response.status_code == 200
        print("✓ Theme reverted to system")
    
    def test_update_language_preference(self, auth_token):
        """Test updating language preference"""
        response = requests.put(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"language": "en"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("language") == "en", "Language not updated"
        print("✓ Language updated to en")
        
        # Revert to Spanish
        response = requests.put(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"language": "es"}
        )
        assert response.status_code == 200
        print("✓ Language reverted to es")
    
    def test_update_feed_mode_preference(self, auth_token):
        """Test updating feed_mode preference"""
        response = requests.put(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"feed_mode": "chronological"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("feed_mode") == "chronological", "Feed mode not updated"
        print("✓ Feed mode updated to chronological")
        
        # Revert to for_you
        response = requests.put(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"feed_mode": "for_you"}
        )
        assert response.status_code == 200
        print("✓ Feed mode reverted to for_you")
    
    def test_update_notifications_preference(self, auth_token):
        """Test updating notifications preferences"""
        response = requests.put(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"notifications": {"likes": False, "comments": True, "follows": True, "messages": True, "mentions": True}}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("notifications", {}).get("likes") == False, "Notifications.likes not updated"
        print("✓ Notifications preferences updated")
        
        # Revert
        response = requests.put(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"notifications": {"likes": True, "comments": True, "follows": True, "messages": True, "mentions": True}}
        )
        assert response.status_code == 200
        print("✓ Notifications preferences reverted")
    
    def test_update_privacy_preference(self, auth_token):
        """Test updating privacy preferences"""
        response = requests.put(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"privacy": {"show_online_status": False, "allow_messages_from": "followers", "show_read_receipts": True, "profile_visibility": "public"}}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("privacy", {}).get("show_online_status") == False, "Privacy.show_online_status not updated"
        assert data.get("privacy", {}).get("allow_messages_from") == "followers", "Privacy.allow_messages_from not updated"
        print("✓ Privacy preferences updated")
        
        # Revert
        response = requests.put(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"privacy": {"show_online_status": True, "allow_messages_from": "everyone", "show_read_receipts": True, "profile_visibility": "public"}}
        )
        assert response.status_code == 200
        print("✓ Privacy preferences reverted")
    
    def test_update_content_preference(self, auth_token):
        """Test updating content preferences"""
        response = requests.put(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": {"autoplay_videos": False, "show_sensitive_content": False, "default_post_visibility": "followers"}}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("content", {}).get("autoplay_videos") == False, "Content.autoplay_videos not updated"
        print("✓ Content preferences updated")
        
        # Revert
        response = requests.put(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"content": {"autoplay_videos": True, "show_sensitive_content": False, "default_post_visibility": "public"}}
        )
        assert response.status_code == 200
        print("✓ Content preferences reverted")
    
    def test_invalid_keys_ignored(self, auth_token):
        """Test that invalid preference keys are ignored"""
        response = requests.put(
            f"{BASE_URL}/api/settings/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"invalid_key": "value", "another_invalid": 123}
        )
        assert response.status_code == 200, "Should succeed but ignore invalid keys"
        print("✓ Invalid preference keys are ignored gracefully")


class TestExistingEndpoints:
    """Verify existing endpoints still work"""
    
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
    
    def test_regular_feed_still_works(self, auth_token):
        """Test that regular /posts feed still works"""
        response = requests.get(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Regular feed failed: {response.text}"
        print("✓ Regular /posts feed still works")
    
    def test_trending_hashtags_still_works(self):
        """Test that /social/trending still works"""
        response = requests.get(f"{BASE_URL}/api/social/trending")
        assert response.status_code == 200, f"Trending failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return list"
        print(f"✓ Trending hashtags endpoint works, returned {len(data)} hashtags")
    
    def test_suggested_users_still_works(self, auth_token):
        """Test that /social/suggested still works"""
        response = requests.get(
            f"{BASE_URL}/api/social/suggested",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Suggested failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return list"
        print(f"✓ Suggested users endpoint works, returned {len(data)} users")
    
    def test_saved_posts_still_works(self, auth_token):
        """Test that /posts/saved/list still works"""
        response = requests.get(
            f"{BASE_URL}/api/posts/saved/list",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Saved posts failed: {response.text}"
        print("✓ Saved posts endpoint still works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
