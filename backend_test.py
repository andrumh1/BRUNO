#!/usr/bin/env python3
"""
BRUNO Backend API Testing Script
Tests the recent changes for Stripe integration and curriculum card type
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://social-marketplace-32.preview.emergentagent.com/api"

# Test credentials - as specified in review request
TEST_EMAIL = "testuser@bruno.com"
TEST_PASSWORD = "test123"
FALLBACK_EMAIL = "demo@bruno.com"
FALLBACK_PASSWORDS = ["string123", "demo123", "password", "123456", "demo"]

class BrunoAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_cards = []
        self.test_session_id = None
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def authenticate(self):
        """Authenticate with test user (try testuser@bruno.com first, then fallbacks)"""
        self.log("🔐 Authenticating...")
        
        # Try primary test credentials first
        login_data = {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data["access_token"]
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                self.log(f"✅ Authentication successful with {TEST_EMAIL}. User: {data['user']['name']}")
                return True
                
        except Exception as e:
            self.log(f"⚠️ Error with primary credentials: {str(e)}")
        
        # Try fallback credentials
        self.log("Trying fallback credentials...")
        for password in FALLBACK_PASSWORDS:
            login_data = {
                "email": FALLBACK_EMAIL,
                "password": password
            }
            
            try:
                response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
                
                if response.status_code == 200:
                    data = response.json()
                    self.auth_token = data["access_token"]
                    self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                    self.log(f"✅ Authentication successful with {FALLBACK_EMAIL} and password '{password}'. User: {data['user']['name']}")
                    return True
                    
            except Exception as e:
                self.log(f"⚠️ Error trying password '{password}': {str(e)}")
                continue
        
        # If all passwords failed, try to create a new test user
        self.log("👤 All credentials failed, creating new test user...")
        test_email = f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}@bruno.com"
        register_data = {
            "email": test_email,
            "password": "test123",
            "name": "Test User BRUNO",
            "role": "personal"
        }
        
        try:
            register_response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
            
            if register_response.status_code == 201:
                data = register_response.json()
                self.auth_token = data["access_token"]
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                self.log(f"✅ New test user created and authenticated: {test_email}")
                return True
            else:
                self.log(f"❌ Registration failed: {register_response.status_code} - {register_response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Authentication error: {str(e)}", "ERROR")
            return False
    
    def test_backend_startup(self):
        """Test that backend starts without errors"""
        self.log("🚀 Testing backend startup...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/health")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Backend health check passed: {data}")
                return True
            else:
                self.log(f"❌ Backend health check failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Backend startup test error: {str(e)}", "ERROR")
            return False
    
    def test_curriculum_card_type(self):
        """Test that curriculum card type doesn't break existing card creation/reading"""
        self.log("📚 Testing curriculum card type...")
        
        # Test creating a curriculum card
        curriculum_card_data = {
            "card_type": "curriculum",
            "title": "Mi Curriculum Vitae",
            "subtitle": "Desarrollador Full Stack",
            "description": "Hoja de vida profesional con experiencia en desarrollo web",
            "is_public": True,
            "show_in_feed": True,
            "is_animated": True
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/cards", json=curriculum_card_data)
            
            if response.status_code == 201:
                card = response.json()
                self.test_cards.append(card)
                self.log(f"✅ Curriculum card created successfully: {card['id']}")
                
                # Verify card type is preserved
                if card.get('card_type') == 'curriculum':
                    self.log(f"✅ Card type 'curriculum' preserved correctly")
                    
                    # Test reading the card back
                    get_response = self.session.get(f"{BACKEND_URL}/cards/{card['id']}")
                    if get_response.status_code == 200:
                        retrieved_card = get_response.json()
                        if retrieved_card.get('card_type') == 'curriculum':
                            self.log(f"✅ Curriculum card retrieved successfully with correct type")
                            return True
                        else:
                            self.log(f"❌ Card type mismatch on retrieval: expected 'curriculum', got '{retrieved_card.get('card_type')}'", "ERROR")
                            return False
                    else:
                        self.log(f"❌ Failed to retrieve curriculum card: {get_response.status_code}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Card type not preserved: expected 'curriculum', got '{card.get('card_type')}'", "ERROR")
                    return False
            else:
                self.log(f"❌ Curriculum card creation failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Curriculum card test error: {str(e)}", "ERROR")
            return False
    
    def test_stripe_checkout_endpoint(self):
        """Test POST /api/payments/checkout endpoint"""
        self.log("💳 Testing Stripe checkout endpoint...")
        
        checkout_data = {
            "package_id": "nfc_basic",
            "origin": "https://app.stage-preview.emergentagent.com"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/payments/checkout", json=checkout_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields in response (accept both 'url' and 'checkout_url')
                has_session_id = 'session_id' in data
                has_checkout_url = 'checkout_url' in data or 'url' in data
                
                if has_session_id and has_checkout_url:
                    self.test_session_id = data['session_id']
                    checkout_url = data.get('checkout_url', data.get('url'))
                    self.log(f"✅ Stripe checkout session created successfully")
                    self.log(f"   Session ID: {data['session_id']}")
                    self.log(f"   Checkout URL: {checkout_url}")
                    return True
                else:
                    missing_fields = []
                    if not has_session_id:
                        missing_fields.append('session_id')
                    if not has_checkout_url:
                        missing_fields.append('checkout_url or url')
                    self.log(f"❌ Missing required fields: {missing_fields}. Got: {list(data.keys())}", "ERROR")
                    return False
            else:
                self.log(f"❌ Stripe checkout failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Stripe checkout test error: {str(e)}", "ERROR")
            return False
    
    def test_stripe_checkout_status_endpoint(self):
        """Test GET /api/payments/checkout/status/{session_id} endpoint"""
        self.log("📊 Testing Stripe checkout status endpoint...")
        
        if not self.test_session_id:
            self.log("❌ No session ID available from checkout test", "ERROR")
            return False
        
        try:
            response = self.session.get(f"{BACKEND_URL}/payments/checkout/status/{self.test_session_id}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Stripe checkout status retrieved successfully")
                self.log(f"   Status data: {data}")
                
                # Check that it returns coherent status (should have status and payment_status fields)
                if 'status' in data and 'payment_status' in data:
                    self.log(f"✅ Status response has required fields")
                    return True
                else:
                    self.log(f"❌ Missing status fields in response. Got: {list(data.keys())}", "ERROR")
                    return False
            else:
                self.log(f"❌ Stripe checkout status failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Stripe checkout status test error: {str(e)}", "ERROR")
            return False
    
    def test_stripe_webhook_endpoint(self):
        """Test that webhook endpoint exists and doesn't throw 500 with empty body"""
        self.log("🔗 Testing Stripe webhook endpoint...")
        
        # Create a new session without auth headers for webhook test
        webhook_session = requests.Session()
        
        try:
            # Test with empty body
            response = webhook_session.post(f"{BACKEND_URL}/webhook/stripe", 
                                          json={},
                                          headers={"Content-Type": "application/json"})
            
            # Webhook should not return 500 even with empty body
            if response.status_code != 500:
                self.log(f"✅ Webhook endpoint exists and handles empty body (status: {response.status_code})")
                return True
            else:
                self.log(f"❌ Webhook endpoint returns 500 with empty body: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Webhook endpoint test error: {str(e)}", "ERROR")
            return False
    
    def cleanup_test_cards(self):
        """Clean up test cards created during testing"""
        self.log("🧹 Cleaning up test cards...")
        
        for card in self.test_cards:
            try:
                response = self.session.delete(f"{BACKEND_URL}/cards/{card['id']}")
                if response.status_code == 204:
                    self.log(f"✅ Deleted test card: {card['id']}")
                else:
                    self.log(f"⚠️ Failed to delete card {card['id']}: {response.status_code}")
            except Exception as e:
                self.log(f"⚠️ Error deleting card {card['id']}: {str(e)}")
    
    def run_tests(self):
        """Run all tests for Stripe integration and curriculum card type"""
        self.log("🚀 Starting BRUNO Backend API Tests - Stripe & Curriculum")
        self.log(f"Backend URL: {BACKEND_URL}")
        
        # Step 1: Test backend startup
        if not self.test_backend_startup():
            self.log("❌ Backend startup test failed, continuing with other tests...")
        
        # Step 2: Authenticate
        if not self.authenticate():
            self.log("❌ Authentication failed, cannot continue with authenticated tests", "ERROR")
            return False
        
        # Step 3: Run tests
        tests = [
            ("Curriculum Card Type", self.test_curriculum_card_type),
            ("Stripe Checkout Endpoint", self.test_stripe_checkout_endpoint),
            ("Stripe Checkout Status Endpoint", self.test_stripe_checkout_status_endpoint),
            ("Stripe Webhook Endpoint", self.test_stripe_webhook_endpoint),
        ]
        
        results = {}
        for test_name, test_func in tests:
            self.log(f"\n--- Running {test_name} Test ---")
            results[test_name] = test_func()
        
        # Step 4: Cleanup
        self.cleanup_test_cards()
        
        # Step 5: Summary
        self.log("\n" + "="*60)
        self.log("📊 TEST RESULTS SUMMARY - STRIPE & CURRICULUM")
        self.log("="*60)
        
        all_passed = True
        for test_name, passed in results.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            self.log(f"{status} - {test_name}")
            if not passed:
                all_passed = False
        
        self.log("="*60)
        if all_passed:
            self.log("🎉 ALL TESTS PASSED!")
        else:
            self.log("💥 SOME TESTS FAILED!")
        
        return all_passed

def main():
    tester = BrunoAPITester()
    success = tester.run_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()