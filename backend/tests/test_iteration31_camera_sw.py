"""
Iteration 31: Camera Page and Service Worker Tests
Tests for:
- Camera page TikTok-style layout
- Service worker v4 with Safari cache fix
- Auth login endpoint
- Posts upload endpoint existence
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthLogin:
    """Test authentication login endpoint"""
    
    def test_login_success(self):
        """Test successful login returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
            "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["email"] == os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
        assert data["token_type"] == "bearer"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@bruno.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestServiceWorker:
    """Test service worker v4 is served correctly"""
    
    def test_sw_js_accessible(self):
        """Test /sw.js is accessible"""
        response = requests.get(f"{BASE_URL}/sw.js")
        assert response.status_code == 200, f"SW not accessible: {response.status_code}"
    
    def test_sw_version_v4(self):
        """Test service worker contains v4 version string"""
        response = requests.get(f"{BASE_URL}/sw.js")
        assert response.status_code == 200
        
        content = response.text
        assert "v4" in content, "Service worker should contain v4 version"
        assert "SW_VERSION = 'v4'" in content, "SW_VERSION should be v4"
    
    def test_sw_safari_cache_fix(self):
        """Test service worker has Safari cache fix (network-first for HTML)"""
        response = requests.get(f"{BASE_URL}/sw.js")
        assert response.status_code == 200
        
        content = response.text
        # Check for network-first strategy for HTML
        assert "navigate" in content, "SW should handle navigation requests"
        assert "no-store" in content, "SW should use no-store for HTML"
        assert "NEVER_CACHE" in content, "SW should have NEVER_CACHE patterns"
    
    def test_sw_push_notification_support(self):
        """Test service worker has push notification support"""
        response = requests.get(f"{BASE_URL}/sw.js")
        assert response.status_code == 200
        
        content = response.text
        assert "push" in content, "SW should handle push events"
        assert "showNotification" in content, "SW should show notifications"


class TestHealthEndpoint:
    """Test API health endpoint"""
    
    def test_health_check(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "BRUNO" in data["service"]


class TestPostsEndpoint:
    """Test posts endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
            "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_posts_endpoint_exists(self, auth_token):
        """Test /api/posts endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/posts", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        # Should return 200 with posts list
        assert response.status_code == 200, f"Posts endpoint failed: {response.text}"
    
    def test_posts_public_access(self):
        """Test /api/posts is accessible without auth (returns public posts)"""
        response = requests.get(f"{BASE_URL}/api/posts")
        # Posts endpoint returns public posts without auth
        assert response.status_code == 200, f"Posts endpoint should be accessible: {response.status_code}"


class TestUploadEndpoints:
    """Test upload endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
            "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_upload_image_endpoint_exists(self, auth_token):
        """Test /api/upload/image endpoint exists"""
        # Just check the endpoint exists (will fail without actual file)
        response = requests.post(f"{BASE_URL}/api/upload/image", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        # Should return 422 (validation error) not 404
        assert response.status_code in [422, 400], f"Upload endpoint should exist: {response.status_code}"
    
    def test_posts_upload_endpoint_not_exists(self, auth_token):
        """Test /api/posts/upload endpoint does NOT exist (camera uses wrong endpoint)"""
        response = requests.post(f"{BASE_URL}/api/posts/upload", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        # This endpoint doesn't exist - camera page uses wrong endpoint
        # Should return 404 or 405
        assert response.status_code in [404, 405], f"posts/upload should not exist: {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
