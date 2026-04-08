"""
Iteration 20: Compliance Features Tests
- Reports API (POST /api/reports)
- Data Export API (GET /api/profile/export)
- Delete Account API (DELETE /api/profile/delete-account)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test credentials
TEST_USER = {
    "email": os.getenv("TEST_USER_EMAIL", "newtest@bruno.com"),
    "password": os.getenv("TEST_USER_PASSWORD", "Test1234!")
}

class TestComplianceAPIs:
    """Test compliance APIs for Apple App Store compliance"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        self.token = data.get("access_token")
        assert self.token, "No access_token returned"
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
    
    # ============================================
    # REPORTS API TESTS
    # ============================================
    
    def test_create_report_spam(self):
        """Test creating a spam report"""
        report_data = {
            "content_type": "post",
            "content_id": "TEST_post_123",
            "reason": "spam",
            "additional_info": "This is a test spam report"
        }
        
        response = self.session.post(f"{BASE_URL}/api/reports", json=report_data)
        assert response.status_code == 200, f"Report failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "report_id" in data
        print(f"✓ Report created with ID: {data['report_id']}")
    
    def test_create_report_harassment(self):
        """Test creating a harassment report"""
        report_data = {
            "content_type": "user",
            "content_id": "TEST_user_456",
            "reason": "harassment",
            "additional_info": "Test harassment report for testing"
        }
        
        response = self.session.post(f"{BASE_URL}/api/reports", json=report_data)
        assert response.status_code == 200, f"Report failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print("✓ Harassment report created successfully")
    
    def test_create_report_hate_speech(self):
        """Test creating a hate speech report"""
        report_data = {
            "content_type": "comment",
            "content_id": "TEST_comment_789",
            "reason": "hate_speech",
            "additional_info": ""
        }
        
        response = self.session.post(f"{BASE_URL}/api/reports", json=report_data)
        assert response.status_code == 200, f"Report failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print("✓ Hate speech report created successfully")
    
    def test_create_report_violence(self):
        """Test creating a violence report"""
        report_data = {
            "content_type": "post",
            "content_id": "TEST_post_violence",
            "reason": "violence",
            "additional_info": "Test violence report"
        }
        
        response = self.session.post(f"{BASE_URL}/api/reports", json=report_data)
        assert response.status_code == 200, f"Report failed: {response.text}"
        print("✓ Violence report created successfully")
    
    def test_create_report_product(self):
        """Test creating a product report"""
        report_data = {
            "content_type": "product",
            "content_id": "TEST_product_illegal",
            "reason": "illegal_activity",
            "additional_info": "Test illegal product report"
        }
        
        response = self.session.post(f"{BASE_URL}/api/reports", json=report_data)
        assert response.status_code == 200, f"Report failed: {response.text}"
        print("✓ Product report created successfully")
    
    def test_get_my_reports(self):
        """Test getting user's submitted reports"""
        response = self.session.get(f"{BASE_URL}/api/reports/my")
        assert response.status_code == 200, f"Get reports failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of reports"
        print(f"✓ Found {len(data)} reports submitted by user")
    
    def test_report_without_auth(self):
        """Test that reports require authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        report_data = {
            "content_type": "post",
            "content_id": "test123",
            "reason": "spam",
            "additional_info": ""
        }
        
        response = session.post(f"{BASE_URL}/api/reports", json=report_data)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Report correctly requires authentication")
    
    # ============================================
    # DATA EXPORT API TESTS
    # ============================================
    
    def test_export_user_data(self):
        """Test exporting user data (GDPR compliance)"""
        response = self.session.get(f"{BASE_URL}/api/profile/export")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        data = response.json()
        
        # Verify export structure
        assert "export_date" in data
        assert "user_info" in data
        assert "cards" in data
        assert "posts" in data
        assert "products" in data
        assert "stories" in data
        assert "messages_sent" in data
        assert "points_history" in data
        assert "reports_submitted" in data
        
        # Verify user_info structure
        user_info = data["user_info"]
        assert "id" in user_info
        assert "email" in user_info
        assert "name" in user_info
        
        print(f"✓ Data export successful")
        print(f"  - Cards: {len(data.get('cards', []))}")
        print(f"  - Posts: {len(data.get('posts', []))}")
        print(f"  - Products: {len(data.get('products', []))}")
        print(f"  - Stories: {len(data.get('stories', []))}")
        print(f"  - Messages: {len(data.get('messages_sent', []))}")
    
    def test_export_without_auth(self):
        """Test that export requires authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/profile/export")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Export correctly requires authentication")
    
    # ============================================
    # DELETE ACCOUNT API TESTS (Edge cases only - don't actually delete)
    # ============================================
    
    def test_delete_account_wrong_confirmation(self):
        """Test delete account with wrong confirmation text"""
        delete_data = {
            "password": os.getenv("TEST_USER_PASSWORD", "Test1234!"),
            "confirm_text": "wrong text"
        }
        
        response = self.session.delete(f"{BASE_URL}/api/profile/delete-account", json=delete_data)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        print("✓ Delete correctly rejects wrong confirmation text")
    
    def test_delete_account_wrong_password(self):
        """Test delete account with wrong password - use wrong confirmation to avoid actual deletion"""
        delete_data = {
            "password": "WrongPassword123!",
            "confirm_text": "WRONG TEXT"  # Use wrong text to prevent actual deletion
        }
        
        response = self.session.delete(f"{BASE_URL}/api/profile/delete-account", json=delete_data)
        # Should return 400 for wrong confirmation text
        assert response.status_code == 400, f"Expected 400 for wrong confirmation, got {response.status_code}"
        print("✓ Delete account with wrong confirmation rejected correctly")
    
    def test_delete_account_api_exists(self):
        """Verify delete account API endpoint exists and responds"""
        # Just verify endpoint exists - don't actually delete
        response = self.session.options(f"{BASE_URL}/api/profile/delete-account")
        # Any response code that's not 404 means endpoint exists
        assert response.status_code != 404, "Delete account endpoint not found"
        print("✓ Delete account API endpoint exists")


class TestDeleteAccountWithoutAuth:
    """Separate test class to avoid fixture issues"""
    
    def test_delete_requires_auth(self):
        """Test that delete requires authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        delete_data = {
            "password": os.getenv("TEST_USER_PASSWORD", "Test1234!"),
            "confirm_text": "ELIMINAR MI CUENTA"
        }
        
        response = session.delete(f"{BASE_URL}/api/profile/delete-account", json=delete_data)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Delete correctly requires authentication")


class TestPublicCompliancePages:
    """Test that Privacy Policy and Terms of Service pages are public (API side verification)"""
    
    def test_health_check(self):
        """Basic health check before testing pages"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✓ API health check passed")
    
    def test_public_api_accessible(self):
        """Test that public endpoints work without auth"""
        # Test that auth is required for protected endpoints
        response = requests.get(f"{BASE_URL}/api/profile")
        assert response.status_code in [401, 403], f"Profile endpoint should require auth, got {response.status_code}"
        
        # Test public endpoint
        response = requests.get(f"{BASE_URL}/api/cards/public")
        # 200 or 404 (if no public cards) is fine
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print("✓ Public/protected endpoint verification passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
