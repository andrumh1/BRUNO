"""
Test Lives API - TikTok-style live streaming functionality
Tests: List lives, categories, live details, join/leave, comments, gifts
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

# Test credentials
TEST_EMAIL = os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
TEST_PASSWORD = os.getenv("TEST_USER_PASSWORD", "Test1234!")

# Known active live ID from context
ACTIVE_LIVE_ID = "6ee49485-9a06-48c4-b6c7-7c6c883a77da"


class TestLivesAPI:
    """Test Lives API endpoints"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def get_auth_token(self):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None

    # ============================================
    # PUBLIC ENDPOINTS (No Auth Required)
    # ============================================

    def test_get_active_lives(self):
        """Test GET /api/lives - List active lives (no auth required)"""
        response = self.session.get(f"{BASE_URL}/api/lives")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of lives"
        
        # Verify at least one live exists (from context)
        assert len(data) >= 1, "Expected at least 1 active live"
        
        # Verify live structure
        if len(data) > 0:
            live = data[0]
            assert "id" in live, "Live should have id"
            assert "host_id" in live, "Live should have host_id"
            assert "host_name" in live, "Live should have host_name"
            assert "title" in live, "Live should have title"
            assert "category" in live, "Live should have category"
            assert "status" in live, "Live should have status"
            assert live["status"] == "live", "Live status should be 'live'"
        
        print(f"✓ GET /api/lives - Found {len(data)} active lives")

    def test_get_lives_with_category_filter(self):
        """Test GET /api/lives with category filter"""
        response = self.session.get(f"{BASE_URL}/api/lives", params={"category": "general"})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of lives"
        
        # All lives should be in 'general' category
        for live in data:
            assert live["category"] == "general", f"Live category should be 'general', got {live['category']}"
        
        print(f"✓ GET /api/lives?category=general - Found {len(data)} lives in general category")

    def test_get_live_categories(self):
        """Test GET /api/lives/categories - Get available categories"""
        response = self.session.get(f"{BASE_URL}/api/lives/categories")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of categories"
        
        # Verify expected categories exist
        expected_categories = ["general", "music", "gaming", "talk", "cooking", "fitness", "art", "education", "business", "technology"]
        category_ids = [cat["id"] for cat in data]
        
        for cat_id in expected_categories:
            assert cat_id in category_ids, f"Expected category '{cat_id}' to exist"
        
        # Verify category structure
        for cat in data:
            assert "id" in cat, "Category should have id"
            assert "name" in cat, "Category should have name"
            assert "icon" in cat, "Category should have icon"
        
        print(f"✓ GET /api/lives/categories - Found {len(data)} categories: {category_ids}")

    def test_get_live_details(self):
        """Test GET /api/lives/{live_id} - Get specific live details"""
        response = self.session.get(f"{BASE_URL}/api/lives/{ACTIVE_LIVE_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        live = response.json()
        assert live["id"] == ACTIVE_LIVE_ID, f"Expected live ID {ACTIVE_LIVE_ID}"
        assert live["status"] == "live", "Expected status to be 'live'"
        assert "host_name" in live, "Live should have host_name"
        assert "title" in live, "Live should have title"
        assert "viewer_count" in live, "Live should have viewer_count"
        assert "allow_comments" in live, "Live should have allow_comments"
        assert "allow_gifts" in live, "Live should have allow_gifts"
        
        print(f"✓ GET /api/lives/{ACTIVE_LIVE_ID} - Live: '{live['title']}' by {live['host_name']}")

    def test_get_live_details_not_found(self):
        """Test GET /api/lives/{live_id} - 404 for non-existent live"""
        fake_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/lives/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ GET /api/lives/{fake_id} - Correctly returns 404")

    def test_get_live_comments(self):
        """Test GET /api/lives/{live_id}/comments - Get live comments (no auth required)"""
        response = self.session.get(f"{BASE_URL}/api/lives/{ACTIVE_LIVE_ID}/comments")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of comments"
        
        # Verify comment structure if any exist
        if len(data) > 0:
            comment = data[0]
            assert "id" in comment, "Comment should have id"
            assert "user_name" in comment, "Comment should have user_name"
            assert "text" in comment, "Comment should have text"
        
        print(f"✓ GET /api/lives/{ACTIVE_LIVE_ID}/comments - Found {len(data)} comments")

    # ============================================
    # AUTHENTICATED ENDPOINTS
    # ============================================

    def test_get_following_lives(self):
        """Test GET /api/lives/following - Get lives from followed users"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        response = self.session.get(
            f"{BASE_URL}/api/lives/following",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of lives"
        
        print(f"✓ GET /api/lives/following - Found {len(data)} lives from followed users")

    def test_get_following_lives_requires_auth(self):
        """Test GET /api/lives/following - Requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/lives/following")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/lives/following - Correctly requires authentication")

    def test_join_live(self):
        """Test POST /api/lives/{live_id}/join - Join a live stream"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        response = self.session.post(
            f"{BASE_URL}/api/lives/{ACTIVE_LIVE_ID}/join",
            headers={"Authorization": f"Bearer {token}"},
            json={}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=true"
        assert "live" in data, "Response should include live data"
        assert "rtc_config" in data, "Response should include rtc_config for WebRTC"
        
        print(f"✓ POST /api/lives/{ACTIVE_LIVE_ID}/join - Successfully joined live")

    def test_leave_live(self):
        """Test POST /api/lives/{live_id}/leave - Leave a live stream"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        response = self.session.post(
            f"{BASE_URL}/api/lives/{ACTIVE_LIVE_ID}/leave",
            headers={"Authorization": f"Bearer {token}"},
            json={}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=true"
        
        print(f"✓ POST /api/lives/{ACTIVE_LIVE_ID}/leave - Successfully left live")

    def test_post_comment(self):
        """Test POST /api/lives/{live_id}/comment - Post a comment"""
        token = self.get_auth_token()
        assert token, "Failed to get auth token"
        
        test_comment = f"Test comment {uuid.uuid4().hex[:8]}"
        
        response = self.session.post(
            f"{BASE_URL}/api/lives/{ACTIVE_LIVE_ID}/comment",
            headers={"Authorization": f"Bearer {token}"},
            json={"text": test_comment}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Comment should have id"
        assert data.get("text") == test_comment, f"Comment text should match"
        assert "user_name" in data, "Comment should have user_name"
        
        print(f"✓ POST /api/lives/{ACTIVE_LIVE_ID}/comment - Successfully posted comment")

    def test_post_comment_requires_auth(self):
        """Test POST /api/lives/{live_id}/comment - Requires authentication"""
        response = self.session.post(
            f"{BASE_URL}/api/lives/{ACTIVE_LIVE_ID}/comment",
            json={"text": "unauthorized comment"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/lives/{live_id}/comment - Correctly requires authentication")

    # ============================================
    # CREATE LIVE (Authenticated)
    # ============================================

    def test_create_live_requires_auth(self):
        """Test POST /api/lives - Requires authentication"""
        response = self.session.post(
            f"{BASE_URL}/api/lives",
            json={
                "title": "Test Live",
                "description": "Test",
                "category": "general"
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/lives - Correctly requires authentication")

    # ============================================
    # GIFT SENDING (Authenticated)
    # ============================================

    def test_send_gift_requires_auth(self):
        """Test POST /api/lives/{live_id}/gift - Requires authentication"""
        response = self.session.post(
            f"{BASE_URL}/api/lives/{ACTIVE_LIVE_ID}/gift",
            json={"gift_type": "rose", "amount": 1}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/lives/{live_id}/gift - Correctly requires authentication")


class TestLivesMetaTags:
    """Test anti-cache meta tags in index.html"""

    def test_anti_cache_meta_tags_present(self):
        """Verify anti-cache meta tags are in index.html"""
        # Read the index.html file directly
        with open("/app/frontend/public/index.html", "r") as f:
            content = f.read()
        
        # Check for cache control meta tags
        assert 'http-equiv="Cache-Control"' in content, "Cache-Control meta tag missing"
        assert 'content="no-cache, no-store, must-revalidate"' in content, "Cache-Control content missing"
        assert 'http-equiv="Pragma"' in content, "Pragma meta tag missing"
        assert 'content="no-cache"' in content, "Pragma no-cache missing"
        assert 'http-equiv="Expires"' in content, "Expires meta tag missing"
        assert 'content="0"' in content, "Expires 0 missing"
        
        print("✓ All anti-cache meta tags present in index.html")


class TestServiceWorker:
    """Test service worker configuration"""

    def test_service_worker_cache_busting(self):
        """Verify service worker has cache busting and proper cleanup"""
        with open("/app/frontend/public/sw.js", "r") as f:
            content = f.read()
        
        # Check for cache version
        assert "CACHE_VERSION" in content or "CACHE_NAME" in content, "Cache versioning missing"
        
        # Check for skipWaiting
        assert "skipWaiting" in content, "skipWaiting not found - SW won't update immediately"
        
        # Check for clients.claim
        assert "clients.claim" in content, "clients.claim not found - won't take over existing pages"
        
        # Check for old cache cleanup
        assert "caches.delete" in content, "Cache cleanup logic missing"
        
        # Check for network-first strategy
        assert "fetch(event.request)" in content, "Network fetch not found"
        
        print("✓ Service worker has proper cache busting and cleanup")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
