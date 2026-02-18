"""
Backend API Tests for BRUNO Store (PIUP) and Related Features
Tests: Store products, Plans, User saved-data, Auth
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://nfc-connect-3.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


class TestHealthAndPublicEndpoints:
    """Test public endpoints that don't require authentication"""
    
    def test_store_products_endpoint(self):
        """GET /api/store/products - Should return list of products"""
        response = requests.get(f"{BASE_URL}/api/store/products")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one product"
        
        # Verify product structure
        product = data[0]
        assert "id" in product, "Product should have id"
        assert "name" in product, "Product should have name"
        assert "price" in product, "Product should have price"
        assert "category" in product, "Product should have category"
        print(f"✅ Found {len(data)} products")
    
    def test_store_products_categories(self):
        """Verify products have correct categories"""
        response = requests.get(f"{BASE_URL}/api/store/products")
        assert response.status_code == 200
        
        data = response.json()
        categories = set(p["category"] for p in data)
        
        # Expected categories based on requirements
        expected_categories = {"nfc_card", "nfc_bracelet", "nfc_pet_tag", "service"}
        
        for cat in expected_categories:
            assert cat in categories, f"Missing category: {cat}"
        print(f"✅ All expected categories present: {categories}")
    
    def test_subscription_plans_endpoint(self):
        """GET /api/plans - Should return subscription plans"""
        response = requests.get(f"{BASE_URL}/api/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 3, "Should have at least 3 plans (Free, Pro, Business)"
        
        # Verify plan structure
        plan_ids = [p["id"] for p in data]
        assert "free" in plan_ids, "Should have free plan"
        assert "pro" in plan_ids, "Should have pro plan"
        assert "business" in plan_ids, "Should have business plan"
        
        # Verify plan has required fields
        for plan in data:
            assert "name" in plan, "Plan should have name"
            assert "price_monthly" in plan, "Plan should have price_monthly"
            assert "features" in plan, "Plan should have features"
            assert "limits" in plan, "Plan should have limits"
        
        print(f"✅ Found {len(data)} subscription plans: {plan_ids}")
    
    def test_public_cards_endpoint(self):
        """GET /api/public/cards - Should return public cards"""
        response = requests.get(f"{BASE_URL}/api/public/cards")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ Found {len(data)} public cards")


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """POST /api/auth/login - Should return token for valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "access_token" in data, "Response should have access_token"
        assert "user" in data, "Response should have user"
        assert data["user"]["email"] == TEST_EMAIL, "User email should match"
        print(f"✅ Login successful for {TEST_EMAIL}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login - Should return 401 for invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid credentials correctly rejected")
    
    def test_auth_me_with_token(self):
        """GET /api/auth/me - Should return user data with valid token"""
        # First login to get token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = login_response.json()["access_token"]
        
        # Test /auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["email"] == TEST_EMAIL, "Email should match"
        print(f"✅ Auth/me returned user: {data['name']}")
    
    def test_auth_me_without_token(self):
        """GET /api/auth/me - Should return 401/403 without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Unauthenticated request correctly rejected")


class TestUserSavedData:
    """Test user saved data endpoints (requires auth)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Authentication failed")
    
    def test_get_user_saved_data(self, auth_token):
        """GET /api/user/saved-data - Should return user's saved data"""
        response = requests.get(
            f"{BASE_URL}/api/user/saved-data",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "user_id" in data, "Response should have user_id"
        assert "addresses" in data, "Response should have addresses"
        assert "social_links" in data, "Response should have social_links"
        print(f"✅ User saved data retrieved for user_id: {data['user_id']}")
    
    def test_get_user_saved_data_without_auth(self):
        """GET /api/user/saved-data - Should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/user/saved-data")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Unauthenticated request correctly rejected")


class TestStoreProductDetails:
    """Test store product details and filtering"""
    
    def test_nfc_card_products(self):
        """Verify NFC card products exist with correct structure"""
        response = requests.get(f"{BASE_URL}/api/store/products")
        assert response.status_code == 200
        
        data = response.json()
        nfc_cards = [p for p in data if p["category"] == "nfc_card"]
        
        assert len(nfc_cards) > 0, "Should have NFC card products"
        
        # Verify NFC card has colors
        for card in nfc_cards:
            assert "colors" in card, "NFC card should have colors"
            assert len(card["colors"]) > 0, "NFC card should have at least one color"
        
        print(f"✅ Found {len(nfc_cards)} NFC card products")
    
    def test_guardian_bracelet_products(self):
        """Verify Guardian bracelet products exist"""
        response = requests.get(f"{BASE_URL}/api/store/products")
        assert response.status_code == 200
        
        data = response.json()
        bracelets = [p for p in data if p["category"] == "nfc_bracelet"]
        
        assert len(bracelets) > 0, "Should have Guardian bracelet products"
        print(f"✅ Found {len(bracelets)} Guardian bracelet products")
    
    def test_pet_tag_products(self):
        """Verify pet tag products exist with GPS features"""
        response = requests.get(f"{BASE_URL}/api/store/products")
        assert response.status_code == 200
        
        data = response.json()
        pet_tags = [p for p in data if p["category"] == "nfc_pet_tag"]
        
        assert len(pet_tags) > 0, "Should have pet tag products"
        
        # Check for GPS feature in at least one product
        has_gps = any("GPS" in str(p.get("features", [])) for p in pet_tags)
        assert has_gps, "At least one pet tag should have GPS feature"
        
        print(f"✅ Found {len(pet_tags)} pet tag products with GPS features")


class TestSubscriptionPlanDetails:
    """Test subscription plan details"""
    
    def test_free_plan_features(self):
        """Verify free plan has correct limits"""
        response = requests.get(f"{BASE_URL}/api/plans")
        assert response.status_code == 200
        
        data = response.json()
        free_plan = next((p for p in data if p["id"] == "free"), None)
        
        assert free_plan is not None, "Free plan should exist"
        assert free_plan["price_monthly"] == 0, "Free plan should be $0"
        assert free_plan["limits"]["max_cards"] == 1, "Free plan should have 1 card limit"
        
        print(f"✅ Free plan verified: {free_plan['name']}")
    
    def test_pro_plan_features(self):
        """Verify pro plan has correct features"""
        response = requests.get(f"{BASE_URL}/api/plans")
        assert response.status_code == 200
        
        data = response.json()
        pro_plan = next((p for p in data if p["id"] == "pro"), None)
        
        assert pro_plan is not None, "Pro plan should exist"
        assert pro_plan["price_monthly"] > 0, "Pro plan should have a price"
        assert pro_plan["limits"]["max_cards"] > 1, "Pro plan should have more than 1 card"
        assert pro_plan["limits"]["nfc_support"] == True, "Pro plan should have NFC support"
        
        print(f"✅ Pro plan verified: {pro_plan['name']} - ${pro_plan['price_monthly']}/month")
    
    def test_business_plan_features(self):
        """Verify business plan has correct features"""
        response = requests.get(f"{BASE_URL}/api/plans")
        assert response.status_code == 200
        
        data = response.json()
        business_plan = next((p for p in data if p["id"] == "business"), None)
        
        assert business_plan is not None, "Business plan should exist"
        assert business_plan["price_monthly"] > 0, "Business plan should have a price"
        assert business_plan["limits"]["max_cards"] == -1, "Business plan should have unlimited cards"
        assert business_plan["limits"]["custom_domain"] == True, "Business plan should have custom domain"
        
        print(f"✅ Business plan verified: {business_plan['name']} - ${business_plan['price_monthly']}/month")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
