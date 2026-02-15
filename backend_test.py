#!/usr/bin/env python3
"""
BRUNO Backend API Testing Script
Tests the recent changes for public cards endpoint and new fields (show_in_feed, is_animated)
"""

import requests
import json
import sys
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://cardshare-app-2.preview.emergentagent.com/api"

# Test credentials
TEST_EMAIL = "demo@bruno.com"
TEST_PASSWORD = "string123"

class BrunoAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_cards = []
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def authenticate(self):
        """Authenticate with demo user"""
        self.log("🔐 Authenticating with demo@bruno.com...")
        
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
                self.log(f"✅ Authentication successful. User: {data['user']['name']}")
                return True
            else:
                self.log(f"❌ Authentication failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Authentication error: {str(e)}", "ERROR")
            return False
    
    def create_test_card(self, card_data):
        """Create a test card with specific properties"""
        self.log(f"📝 Creating card: {card_data['title']}")
        
        try:
            response = self.session.post(f"{BACKEND_URL}/cards", json=card_data)
            
            if response.status_code == 201:
                card = response.json()
                self.test_cards.append(card)
                self.log(f"✅ Card created: {card['id']} - Public: {card['is_public']}, Show in Feed: {card['show_in_feed']}, Animated: {card['is_animated']}")
                return card
            else:
                self.log(f"❌ Card creation failed: {response.status_code} - {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"❌ Card creation error: {str(e)}", "ERROR")
            return None
    
    def test_authenticated_cards_endpoint(self):
        """Test GET /api/cards (authenticated) - should return only user's cards"""
        self.log("🔍 Testing GET /api/cards (authenticated)...")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/cards")
            
            if response.status_code == 200:
                cards = response.json()
                self.log(f"✅ Authenticated cards endpoint working. Found {len(cards)} cards")
                
                # Verify all cards belong to authenticated user
                for card in cards:
                    if 'user_id' in card:
                        self.log(f"   - Card {card['id']}: Public={card.get('is_public')}, Show in Feed={card.get('show_in_feed')}, Animated={card.get('is_animated')}")
                
                return True
            else:
                self.log(f"❌ Authenticated cards endpoint failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Authenticated cards endpoint error: {str(e)}", "ERROR")
            return False
    
    def test_public_cards_endpoint(self):
        """Test GET /api/public/cards (no authentication) - should return filtered public cards"""
        self.log("🌐 Testing GET /api/public/cards (no authentication)...")
        
        # Create a new session without auth headers
        public_session = requests.Session()
        
        try:
            response = public_session.get(f"{BACKEND_URL}/public/cards")
            
            if response.status_code == 200:
                cards = response.json()
                self.log(f"✅ Public cards endpoint working. Found {len(cards)} public cards")
                
                # Verify filtering logic
                for card in cards:
                    is_public = card.get('is_public', False)
                    show_in_feed = card.get('show_in_feed', True)  # Default to True if not set
                    
                    if not is_public:
                        self.log(f"❌ Non-public card found in public endpoint: {card['id']}", "ERROR")
                        return False
                    
                    if show_in_feed is False:
                        self.log(f"❌ Card with show_in_feed=False found in public endpoint: {card['id']}", "ERROR")
                        return False
                    
                    self.log(f"   - Card {card['id']}: Public={is_public}, Show in Feed={show_in_feed}, Animated={card.get('is_animated')}")
                
                return True
            else:
                self.log(f"❌ Public cards endpoint failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Public cards endpoint error: {str(e)}", "ERROR")
            return False
    
    def test_card_field_persistence(self):
        """Test that new fields (show_in_feed, is_animated) are properly saved and retrieved"""
        self.log("💾 Testing field persistence for show_in_feed and is_animated...")
        
        if not self.test_cards:
            self.log("❌ No test cards available for field persistence test", "ERROR")
            return False
        
        success = True
        
        for card in self.test_cards:
            try:
                # Get the card details
                response = self.session.get(f"{BACKEND_URL}/cards/{card['id']}")
                
                if response.status_code == 200:
                    retrieved_card = response.json()
                    
                    # Check if fields are present and match
                    expected_show_in_feed = card.get('show_in_feed')
                    expected_is_animated = card.get('is_animated')
                    
                    actual_show_in_feed = retrieved_card.get('show_in_feed')
                    actual_is_animated = retrieved_card.get('is_animated')
                    
                    if expected_show_in_feed != actual_show_in_feed:
                        self.log(f"❌ show_in_feed mismatch for card {card['id']}: expected {expected_show_in_feed}, got {actual_show_in_feed}", "ERROR")
                        success = False
                    
                    if expected_is_animated != actual_is_animated:
                        self.log(f"❌ is_animated mismatch for card {card['id']}: expected {expected_is_animated}, got {actual_is_animated}", "ERROR")
                        success = False
                    
                    if success:
                        self.log(f"✅ Field persistence verified for card {card['id']}")
                
                else:
                    self.log(f"❌ Failed to retrieve card {card['id']}: {response.status_code}", "ERROR")
                    success = False
                    
            except Exception as e:
                self.log(f"❌ Field persistence test error for card {card['id']}: {str(e)}", "ERROR")
                success = False
        
        return success
    
    def test_card_update_with_new_fields(self):
        """Test updating cards with new fields"""
        self.log("🔄 Testing card updates with new fields...")
        
        if not self.test_cards:
            self.log("❌ No test cards available for update test", "ERROR")
            return False
        
        # Take the first test card and update it
        card_to_update = self.test_cards[0]
        
        update_data = {
            "show_in_feed": False,  # Change to False
            "is_animated": False,   # Change to False
            "title": f"{card_to_update['title']} - UPDATED"
        }
        
        try:
            response = self.session.put(f"{BACKEND_URL}/cards/{card_to_update['id']}", json=update_data)
            
            if response.status_code == 200:
                updated_card = response.json()
                
                # Verify the updates
                if (updated_card.get('show_in_feed') == False and 
                    updated_card.get('is_animated') == False and
                    "UPDATED" in updated_card.get('title', '')):
                    
                    self.log(f"✅ Card update successful: {updated_card['id']}")
                    return True
                else:
                    self.log(f"❌ Card update verification failed", "ERROR")
                    return False
            else:
                self.log(f"❌ Card update failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Card update error: {str(e)}", "ERROR")
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
        """Run all tests"""
        self.log("🚀 Starting BRUNO Backend API Tests")
        self.log(f"Backend URL: {BACKEND_URL}")
        
        # Step 1: Authenticate
        if not self.authenticate():
            return False
        
        # Step 2: Create test cards with different combinations
        test_card_configs = [
            {
                "card_type": "personal",
                "title": "Test Card 1 - Public + Feed + Animated",
                "subtitle": "Testing public visibility",
                "description": "This card should appear in public feed",
                "is_public": True,
                "show_in_feed": True,
                "is_animated": True
            },
            {
                "card_type": "personal", 
                "title": "Test Card 2 - Public + No Feed + Not Animated",
                "subtitle": "Testing feed exclusion",
                "description": "This card should NOT appear in public feed",
                "is_public": True,
                "show_in_feed": False,
                "is_animated": False
            },
            {
                "card_type": "personal",
                "title": "Test Card 3 - Private + Feed + Animated",
                "subtitle": "Testing private card",
                "description": "This card should NOT appear in public feed (private)",
                "is_public": False,
                "show_in_feed": True,
                "is_animated": True
            }
        ]
        
        self.log("📝 Creating test cards...")
        for config in test_card_configs:
            self.create_test_card(config)
        
        if not self.test_cards:
            self.log("❌ No test cards created, cannot continue tests", "ERROR")
            return False
        
        # Step 3: Run tests
        tests = [
            ("Field Persistence", self.test_card_field_persistence),
            ("Authenticated Cards Endpoint", self.test_authenticated_cards_endpoint),
            ("Public Cards Endpoint", self.test_public_cards_endpoint),
            ("Card Update with New Fields", self.test_card_update_with_new_fields),
        ]
        
        results = {}
        for test_name, test_func in tests:
            self.log(f"\n--- Running {test_name} Test ---")
            results[test_name] = test_func()
        
        # Step 4: Cleanup
        self.cleanup_test_cards()
        
        # Step 5: Summary
        self.log("\n" + "="*50)
        self.log("📊 TEST RESULTS SUMMARY")
        self.log("="*50)
        
        all_passed = True
        for test_name, passed in results.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            self.log(f"{status} - {test_name}")
            if not passed:
                all_passed = False
        
        self.log("="*50)
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