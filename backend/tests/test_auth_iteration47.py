"""
Backend Auth Tests - Iteration 47
Testing P0-3: Persistent login with 30-day JWT tokens
- /api/auth/login - returns token with 30-day expiry
- /api/auth/me - returns user data and optionally refreshed_token
- /api/auth/refresh - returns new access_token
"""
import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"

class TestAuthEndpoints:
    """Test authentication endpoints for persistent login feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
    
    def test_01_login_returns_token(self):
        """Test login endpoint returns access_token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response missing access_token"
        assert "token_type" in data, "Response missing token_type"
        assert "user" in data, "Response missing user"
        assert data["token_type"] == "bearer", "Token type should be bearer"
        assert len(data["access_token"]) > 50, "Token seems too short"
        
        # Verify user data
        assert data["user"]["email"] == TEST_EMAIL
        
        self.token = data["access_token"]
        print(f"Login successful, token length: {len(self.token)}")
    
    def test_02_auth_me_returns_user(self):
        """Test /auth/me returns user data with valid token"""
        # First login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Test /auth/me
        response = self.session.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        
        data = response.json()
        assert "email" in data, "Response missing email"
        assert "id" in data, "Response missing id"
        assert data["email"] == TEST_EMAIL
        
        # Check if refreshed_token is present (optional - only if token nearing expiry)
        if "refreshed_token" in data:
            print(f"Token was refreshed (nearing expiry)")
            assert len(data["refreshed_token"]) > 50
        else:
            print("Token not refreshed (not nearing expiry)")
        
        print(f"Auth/me successful, user: {data['email']}")
    
    def test_03_auth_refresh_returns_new_token(self):
        """Test /auth/refresh returns new access_token"""
        # First login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        old_token = login_response.json()["access_token"]
        
        # Test /auth/refresh
        response = self.session.post(
            f"{BASE_URL}/api/auth/refresh",
            headers={"Authorization": f"Bearer {old_token}"}
        )
        
        assert response.status_code == 200, f"Auth/refresh failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response missing access_token"
        assert "token_type" in data, "Response missing token_type"
        assert data["token_type"] == "bearer"
        
        new_token = data["access_token"]
        assert len(new_token) > 50, "New token seems too short"
        
        # Verify new token works
        verify_response = self.session.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {new_token}"}
        )
        assert verify_response.status_code == 200, "New token doesn't work"
        
        print(f"Token refresh successful, new token length: {len(new_token)}")
    
    def test_04_auth_me_without_token_fails(self):
        """Test /auth/me fails without token"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Auth/me correctly rejects unauthenticated requests")
    
    def test_05_auth_refresh_without_token_fails(self):
        """Test /auth/refresh fails without token"""
        response = self.session.post(f"{BASE_URL}/api/auth/refresh")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Auth/refresh correctly rejects unauthenticated requests")
    
    def test_06_invalid_token_rejected(self):
        """Test invalid token is rejected"""
        response = self.session.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Invalid token correctly rejected")


class TestTokenExpiry:
    """Test token expiry configuration (30 days)"""
    
    def test_token_contains_exp_claim(self):
        """Verify token has expiry claim"""
        import base64
        import json
        
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200
        token = response.json()["access_token"]
        
        # Decode JWT payload (middle part)
        parts = token.split('.')
        assert len(parts) == 3, "Token should have 3 parts (JWT format)"
        
        # Add padding if needed
        payload_b64 = parts[1]
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += '=' * padding
        
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        
        assert "exp" in payload, "Token missing exp claim"
        assert "sub" in payload, "Token missing sub claim"
        
        # Verify expiry is approximately 30 days from now
        exp_timestamp = payload["exp"]
        now = datetime.now(timezone.utc).timestamp()
        days_until_expiry = (exp_timestamp - now) / (60 * 60 * 24)
        
        # Should be between 29 and 31 days (allowing for test execution time)
        assert 29 <= days_until_expiry <= 31, f"Token expiry is {days_until_expiry:.1f} days, expected ~30"
        
        print(f"Token expires in {days_until_expiry:.1f} days (expected ~30)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
