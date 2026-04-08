import os
import pytest

@pytest.fixture
def api_url():
    """Get API URL from environment"""
    return os.getenv("TEST_API_URL", os.getenv("REACT_APP_BACKEND_URL", "http://localhost:8001")) + "/api"

@pytest.fixture
def test_credentials():
    """Get test user credentials from environment"""
    return {
        "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
        "password": os.getenv("TEST_USER_PASSWORD", "Test1234!"),
    }

@pytest.fixture
def auth_token(api_url, test_credentials):
    """Get a valid auth token"""
    import requests
    resp = requests.post(f"{api_url}/auth/login", json=test_credentials)
    if resp.status_code == 200:
        return resp.json().get("access_token", "")
    return ""

@pytest.fixture
def auth_headers(auth_token):
    """Get auth headers dict"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
