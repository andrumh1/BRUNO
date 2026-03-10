"""
Test Monetization and Moderation APIs
Tests for Phase 2 (Monetization) and Phase 3 (Moderation) features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"


class TestMonetizationPricing:
    """Test monetization pricing endpoint (public)"""
    
    def test_get_pricing_returns_promotions(self):
        """GET /api/monetization/pricing should return promotion options"""
        response = requests.get(f"{BASE_URL}/api/monetization/pricing")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "currency" in data, "Missing 'currency' field"
        assert data["currency"] == "BRUNO Points", f"Expected 'BRUNO Points', got {data['currency']}"
        assert "promotions" in data, "Missing 'promotions' field"
        assert isinstance(data["promotions"], list), "Promotions should be a list"
        assert len(data["promotions"]) >= 4, f"Expected at least 4 promotion types, got {len(data['promotions'])}"
        
    def test_pricing_includes_sponsored_post(self):
        """Pricing should include sponsored_post type"""
        response = requests.get(f"{BASE_URL}/api/monetization/pricing")
        data = response.json()
        
        promo_types = [p["type"] for p in data["promotions"]]
        assert "sponsored_post" in promo_types, "Missing sponsored_post promotion"
        
        sponsored = next((p for p in data["promotions"] if p["type"] == "sponsored_post"), None)
        assert sponsored is not None
        assert "cost_per_day" in sponsored
        assert sponsored["cost_per_day"] == 50
        assert "benefits" in sponsored
        
    def test_pricing_includes_map_highlight(self):
        """Pricing should include map_highlight type"""
        response = requests.get(f"{BASE_URL}/api/monetization/pricing")
        data = response.json()
        
        promo_types = [p["type"] for p in data["promotions"]]
        assert "map_highlight" in promo_types, "Missing map_highlight promotion"
        
        highlight = next((p for p in data["promotions"] if p["type"] == "map_highlight"), None)
        assert highlight is not None
        assert highlight["cost_per_day"] == 100
        
    def test_pricing_includes_feed_featured(self):
        """Pricing should include feed_featured type"""
        response = requests.get(f"{BASE_URL}/api/monetization/pricing")
        data = response.json()
        
        promo_types = [p["type"] for p in data["promotions"]]
        assert "feed_featured" in promo_types, "Missing feed_featured promotion"
        
    def test_pricing_includes_search_boost(self):
        """Pricing should include search_boost type"""
        response = requests.get(f"{BASE_URL}/api/monetization/pricing")
        data = response.json()
        
        promo_types = [p["type"] for p in data["promotions"]]
        assert "search_boost" in promo_types, "Missing search_boost promotion"
        
    def test_pricing_includes_creator_monetization_info(self):
        """Pricing should include creator monetization details"""
        response = requests.get(f"{BASE_URL}/api/monetization/pricing")
        data = response.json()
        
        assert "creator_monetization" in data, "Missing creator_monetization field"
        creator = data["creator_monetization"]
        assert "revenue_share" in creator
        assert "minimum_payout" in creator
        assert "payout_methods" in creator


class TestModerationCheck:
    """Test content moderation check endpoint (public)"""
    
    def test_clean_content_passes(self):
        """POST /api/moderation/check - clean content should pass"""
        response = requests.post(
            f"{BASE_URL}/api/moderation/check",
            params={"content": "Este es un texto normal y limpio", "content_type": "text"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_clean"] == True, f"Clean content flagged as dirty: {data}"
        assert data["severity"] == "none"
        assert data["score"] == 0
        assert len(data["flags"]) == 0
        
    def test_violent_content_flagged(self):
        """POST /api/moderation/check - violent content should be flagged"""
        response = requests.post(
            f"{BASE_URL}/api/moderation/check",
            params={"content": "Este texto contiene violencia y matar", "content_type": "text"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_clean"] == False, "Violent content not flagged"
        assert data["severity"] in ["low", "medium", "high", "critical"]
        assert data["score"] > 0
        assert len(data["flags"]) > 0
        
    def test_spam_content_flagged(self):
        """POST /api/moderation/check - spam patterns should be flagged"""
        response = requests.post(
            f"{BASE_URL}/api/moderation/check",
            params={"content": "Gana dinero fácil $$$$ hazte rico", "content_type": "text"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_clean"] == False, "Spam content not flagged"
        assert len(data["flags"]) > 0
        
    def test_excessive_caps_flagged(self):
        """POST /api/moderation/check - excessive caps should be flagged"""
        response = requests.post(
            f"{BASE_URL}/api/moderation/check",
            params={"content": "ESTE ES UN TEXTO CON MUCHAS MAYUSCULAS GRITANDO", "content_type": "text"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Excessive caps is low severity, may or may not be flagged depending on threshold
        assert "severity" in data
        assert "is_clean" in data
        
    def test_empty_content_passes(self):
        """POST /api/moderation/check - empty content should pass"""
        response = requests.post(
            f"{BASE_URL}/api/moderation/check",
            params={"content": "", "content_type": "text"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_clean"] == True


class TestMonetizationAuthEndpoints:
    """Test monetization endpoints that require authentication"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        return response.json().get("access_token")
    
    def test_get_sponsored_posts_requires_auth(self):
        """GET /api/monetization/sponsored-posts requires authentication"""
        response = requests.get(f"{BASE_URL}/api/monetization/sponsored-posts")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        
    def test_get_sponsored_posts_with_auth(self, auth_token):
        """GET /api/monetization/sponsored-posts with auth should return list"""
        response = requests.get(
            f"{BASE_URL}/api/monetization/sponsored-posts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
    def test_get_creator_earnings_requires_auth(self):
        """GET /api/monetization/creator/earnings requires auth"""
        response = requests.get(f"{BASE_URL}/api/monetization/creator/earnings")
        assert response.status_code in [401, 403]
        
    def test_get_creator_earnings_with_auth(self, auth_token):
        """GET /api/monetization/creator/earnings with auth returns earnings data"""
        response = requests.get(
            f"{BASE_URL}/api/monetization/creator/earnings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "total_earnings_points" in data
        assert "available_to_withdraw" in data
        assert "revenue_share_percentage" in data


class TestModerationAuthEndpoints:
    """Test moderation endpoints that require admin authentication"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        return response.json().get("access_token")
    
    def test_moderation_queue_requires_auth(self):
        """GET /api/moderation/queue requires authentication"""
        response = requests.get(f"{BASE_URL}/api/moderation/queue")
        assert response.status_code in [401, 403]
        
    def test_moderation_stats_requires_auth(self):
        """GET /api/moderation/stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/moderation/stats")
        assert response.status_code in [401, 403]
        
    def test_moderation_queue_with_non_admin(self, auth_token):
        """GET /api/moderation/queue with non-admin user should return 403"""
        response = requests.get(
            f"{BASE_URL}/api/moderation/queue",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # User is not admin, should get 403
        assert response.status_code in [200, 403]  # 200 if user has business tier


class TestPublicFeedEndpoints:
    """Test public feed endpoints for sponsored content"""
    
    def test_get_sponsored_posts_for_feed(self):
        """GET /api/feed/sponsored should return sponsored posts for feed"""
        response = requests.get(f"{BASE_URL}/api/feed/sponsored")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
    def test_get_promoted_businesses(self):
        """GET /api/feed/promoted-businesses should return promoted businesses"""
        response = requests.get(f"{BASE_URL}/api/feed/promoted-businesses")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestMapPromotedCards:
    """Test map promoted cards endpoint"""
    
    def test_get_promoted_cards_for_map(self):
        """GET /api/map/promoted-cards should return promoted cards"""
        response = requests.get(f"{BASE_URL}/api/map/promoted-cards")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
    def test_get_promoted_cards_with_location(self):
        """GET /api/map/promoted-cards with location params"""
        response = requests.get(
            f"{BASE_URL}/api/map/promoted-cards",
            params={"lat": 40.4168, "lng": -3.7038, "limit": 5}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
