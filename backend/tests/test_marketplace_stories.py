"""
Test cases for Marketplace, Stories, and AI Recommendations endpoints
Testing iteration 15: Marketplace, Stories (24h), Card Stories (catalog), AI Recommend
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")

@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


# ==================== MARKETPLACE CATEGORIES ====================
class TestMarketplaceCategories:
    """Test /api/marketplace/categories endpoint"""
    
    def test_get_categories_returns_list(self, api_client):
        """GET /api/marketplace/categories returns category list"""
        response = api_client.get(f"{BASE_URL}/api/marketplace/categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Categories should be a list"
        assert len(data) > 0, "Categories list should not be empty"
        
        # Verify category structure
        first_cat = data[0]
        assert "id" in first_cat, "Category should have 'id'"
        assert "name" in first_cat, "Category should have 'name'"
        assert "icon" in first_cat, "Category should have 'icon'"
        print(f"Categories: {[c['name'] for c in data]}")


# ==================== MARKETPLACE PRODUCTS ====================
class TestMarketplaceProducts:
    """Test /api/marketplace/products endpoints"""
    
    def test_list_products_unauthenticated(self, api_client):
        """GET /api/marketplace/products works without auth"""
        # Create new session without auth
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/marketplace/products")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "products" in data, "Response should have 'products' key"
        assert "total" in data, "Response should have 'total' key"
        assert isinstance(data["products"], list), "Products should be a list"
        print(f"Total products: {data['total']}")
    
    def test_list_products_with_filters(self, api_client):
        """GET /api/marketplace/products with query params"""
        response = api_client.get(f"{BASE_URL}/api/marketplace/products", params={
            "category": "electronics",
            "sort": "price_asc",
            "limit": 5
        })
        assert response.status_code == 200
        data = response.json()
        assert "products" in data
        print(f"Filtered products (electronics): {len(data['products'])}")
    
    def test_create_product_requires_auth(self, api_client):
        """POST /api/marketplace/products requires authentication"""
        # Remove auth header temporarily
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/marketplace/products", json={
            "title": "Test Product",
            "description": "Test description",
            "price": 99.99,
            "category": "electronics"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_create_product_authenticated(self, authenticated_client):
        """POST /api/marketplace/products creates product"""
        product_data = {
            "title": f"TEST_Product_{uuid.uuid4().hex[:8]}",
            "description": "Test product for automated testing",
            "price": 49.99,
            "currency": "USD",
            "category": "electronics",
            "condition": "new",
            "images": ["https://via.placeholder.com/400"],
            "tags": ["test", "automation"],
            "shipping_available": True,
            "shipping_cost": 5.99
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/marketplace/products", json=product_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Product should have ID"
        assert data["title"] == product_data["title"], "Title should match"
        assert data["price"] == product_data["price"], "Price should match"
        assert data["status"] == "active", "Status should be active"
        
        # Store product ID for cleanup
        TestMarketplaceProducts.created_product_id = data["id"]
        print(f"Created product: {data['id']}")
        return data
    
    def test_get_product_detail(self, api_client):
        """GET /api/marketplace/products/{id} returns product details"""
        if not hasattr(TestMarketplaceProducts, 'created_product_id'):
            pytest.skip("No product created in previous test")
        
        product_id = TestMarketplaceProducts.created_product_id
        response = api_client.get(f"{BASE_URL}/api/marketplace/products/{product_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["id"] == product_id
        assert "seller" in data or "seller_id" in data, "Should have seller info"
        print(f"Product detail: {data['title']} - ${data['price']}")
    
    def test_get_nonexistent_product(self, api_client):
        """GET /api/marketplace/products/{id} returns 404 for invalid ID"""
        response = api_client.get(f"{BASE_URL}/api/marketplace/products/nonexistent-id")
        assert response.status_code == 404
    
    def test_update_product(self, authenticated_client):
        """PUT /api/marketplace/products/{id} updates product"""
        if not hasattr(TestMarketplaceProducts, 'created_product_id'):
            pytest.skip("No product created in previous test")
        
        product_id = TestMarketplaceProducts.created_product_id
        response = authenticated_client.put(f"{BASE_URL}/api/marketplace/products/{product_id}", json={
            "price": 59.99,
            "status": "paused"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["price"] == 59.99, "Price should be updated"
        assert data["status"] == "paused", "Status should be updated"
        print("Product updated successfully")
    
    def test_get_my_products(self, authenticated_client):
        """GET /api/marketplace/my-products returns user's products"""
        response = authenticated_client.get(f"{BASE_URL}/api/marketplace/my-products")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Should return list of products"
        print(f"User has {len(data)} products")
    
    def test_delete_product(self, authenticated_client):
        """DELETE /api/marketplace/products/{id} deletes product"""
        if not hasattr(TestMarketplaceProducts, 'created_product_id'):
            pytest.skip("No product created in previous test")
        
        product_id = TestMarketplaceProducts.created_product_id
        response = authenticated_client.delete(f"{BASE_URL}/api/marketplace/products/{product_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify deletion
        verify_response = authenticated_client.get(f"{BASE_URL}/api/marketplace/products/{product_id}")
        assert verify_response.status_code == 404, "Product should not exist after deletion"
        print("Product deleted successfully")


# ==================== MARKETPLACE FAVORITES ====================
class TestMarketplaceFavorites:
    """Test /api/marketplace/products/{id}/favorite endpoint"""
    
    def test_toggle_favorite_requires_auth(self, api_client):
        """POST /api/marketplace/products/{id}/favorite requires auth"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/marketplace/products/test-id/favorite")
        assert response.status_code in [401, 403]
    
    def test_toggle_favorite(self, authenticated_client):
        """POST /api/marketplace/products/{id}/favorite toggles favorite"""
        # First create a product to favorite
        product_data = {
            "title": f"TEST_FavoriteProduct_{uuid.uuid4().hex[:8]}",
            "description": "Test for favorites",
            "price": 19.99,
            "category": "other"
        }
        create_response = authenticated_client.post(f"{BASE_URL}/api/marketplace/products", json=product_data)
        assert create_response.status_code == 200
        product_id = create_response.json()["id"]
        
        # Toggle favorite on
        response = authenticated_client.post(f"{BASE_URL}/api/marketplace/products/{product_id}/favorite")
        assert response.status_code == 200
        data = response.json()
        # Response could be either {"favorited": true} or {"favorited": false} depending on state
        assert "favorited" in data
        print(f"Favorite toggled: {data}")
        
        # Cleanup
        authenticated_client.delete(f"{BASE_URL}/api/marketplace/products/{product_id}")


# ==================== MARKETPLACE CART ====================
class TestMarketplaceCart:
    """Test /api/marketplace/cart endpoints"""
    
    def test_get_cart_requires_auth(self, api_client):
        """GET /api/marketplace/cart requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/marketplace/cart")
        assert response.status_code in [401, 403]
    
    def test_get_empty_cart(self, authenticated_client):
        """GET /api/marketplace/cart returns empty cart"""
        # First clear cart
        authenticated_client.delete(f"{BASE_URL}/api/marketplace/cart")
        
        response = authenticated_client.get(f"{BASE_URL}/api/marketplace/cart")
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "total" in data
        print(f"Cart: {len(data['items'])} items, total: {data['total']}")
    
    def test_add_to_cart_requires_auth(self, api_client):
        """POST /api/marketplace/cart/add requires auth"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/marketplace/cart/add", json={
            "product_id": "test-id",
            "quantity": 1
        })
        assert response.status_code in [401, 403]
    
    def test_clear_cart(self, authenticated_client):
        """DELETE /api/marketplace/cart clears cart"""
        response = authenticated_client.delete(f"{BASE_URL}/api/marketplace/cart")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "cleared"
        print("Cart cleared successfully")


# ==================== STORIES FEED (24h) ====================
class TestStoriesFeed:
    """Test /api/stories/feed endpoint"""
    
    def test_get_stories_feed_unauthenticated(self, api_client):
        """GET /api/stories/feed works without auth (public stories)"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/stories/feed")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Feed should be a list of user stories"
        print(f"Stories feed: {len(data)} users with stories")
    
    def test_get_stories_feed_authenticated(self, authenticated_client):
        """GET /api/stories/feed returns more stories when authenticated"""
        response = authenticated_client.get(f"{BASE_URL}/api/stories/feed")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # If there are stories, verify structure
        if len(data) > 0:
            first_user = data[0]
            assert "user_id" in first_user
            assert "stories" in first_user
            assert "has_unseen" in first_user or "user_name" in first_user
        print(f"Stories feed (auth): {len(data)} users with stories")


# ==================== CREATE/VIEW STORY ====================
class TestStoryOperations:
    """Test story create and view operations"""
    
    def test_create_story_requires_auth(self, api_client):
        """POST /api/stories/ requires authentication"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/stories/", json={
            "media_url": "https://via.placeholder.com/400",
            "media_type": "image"
        })
        assert response.status_code in [401, 403]
    
    def test_create_story_authenticated(self, authenticated_client):
        """POST /api/stories/ creates a new story"""
        story_data = {
            "media_url": "https://via.placeholder.com/600",
            "media_type": "image",
            "caption": "Test story from automated testing",
            "visibility": "public",
            "duration": 5
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/stories/", json=story_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Story should have ID"
        assert "expires_at" in data, "Story should have expiration time"
        
        TestStoryOperations.created_story_id = data["id"]
        print(f"Created story: {data['id']}, expires: {data['expires_at']}")
    
    def test_view_story(self, authenticated_client):
        """POST /api/stories/{id}/view marks story as viewed"""
        if not hasattr(TestStoryOperations, 'created_story_id'):
            pytest.skip("No story created in previous test")
        
        story_id = TestStoryOperations.created_story_id
        response = authenticated_client.post(f"{BASE_URL}/api/stories/{story_id}/view")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "viewed"
        print("Story viewed successfully")
    
    def test_view_nonexistent_story(self, authenticated_client):
        """POST /api/stories/{id}/view returns 404 for invalid ID"""
        response = authenticated_client.post(f"{BASE_URL}/api/stories/nonexistent-id/view")
        assert response.status_code == 404
    
    def test_delete_story(self, authenticated_client):
        """DELETE /api/stories/{id} deletes story"""
        if not hasattr(TestStoryOperations, 'created_story_id'):
            pytest.skip("No story created in previous test")
        
        story_id = TestStoryOperations.created_story_id
        response = authenticated_client.delete(f"{BASE_URL}/api/stories/{story_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "deleted"
        print("Story deleted successfully")


# ==================== CARD STORIES (CATALOG) ====================
class TestCardStories:
    """Test /api/stories/card endpoints"""
    
    def test_get_card_stories_for_nonexistent_card(self, api_client):
        """GET /api/stories/card/{card_id} returns empty for invalid card"""
        response = api_client.get(f"{BASE_URL}/api/stories/card/nonexistent-card-id")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # Should be empty list for non-existent card
        print(f"Card stories: {len(data)}")
    
    def test_create_card_story_requires_auth(self, api_client):
        """POST /api/stories/card requires authentication"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/stories/card", json={
            "card_id": "test-card-id",
            "media_url": "https://via.placeholder.com/400"
        })
        assert response.status_code in [401, 403]


# ==================== AI RECOMMENDATIONS ====================
class TestAIRecommendations:
    """Test /api/ai/recommend endpoint"""
    
    def test_ai_recommend_cards(self, api_client):
        """POST /api/ai/recommend returns card recommendations"""
        response = api_client.post(f"{BASE_URL}/api/ai/recommend", json={
            "query": "personal",
            "type": "cards"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "cards" in data, "Response should have 'cards' key"
        assert "query" in data, "Response should have 'query' key"
        assert "message" in data, "Response should have 'message' key"
        print(f"AI Recommend (cards): {len(data['cards'])} results, message: {data['message'][:50]}...")
    
    def test_ai_recommend_posts(self, api_client):
        """POST /api/ai/recommend returns post recommendations"""
        response = api_client.post(f"{BASE_URL}/api/ai/recommend", json={
            "query": "test",
            "type": "posts"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "posts" in data
        print(f"AI Recommend (posts): {len(data['posts'])} results")
    
    def test_ai_recommend_all(self, api_client):
        """POST /api/ai/recommend returns all types"""
        response = api_client.post(f"{BASE_URL}/api/ai/recommend", json={
            "query": "bruno",
            "type": "all"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "cards" in data
        assert "posts" in data
        total = len(data.get("cards", [])) + len(data.get("posts", []))
        print(f"AI Recommend (all): {total} total results")
    
    def test_ai_recommend_empty_query(self, api_client):
        """POST /api/ai/recommend with empty query"""
        response = api_client.post(f"{BASE_URL}/api/ai/recommend", json={
            "query": "",
            "type": "all"
        })
        # Should still return 200 but with no results
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"AI Recommend (empty): message: {data['message'][:50]}...")


# ==================== CLEANUP ====================
@pytest.fixture(scope="module", autouse=True)
def cleanup(request, api_client, auth_token):
    """Cleanup test data after all tests"""
    yield
    
    if auth_token:
        headers = {"Authorization": f"Bearer {auth_token}"}
        # Delete any remaining test products
        try:
            response = api_client.get(f"{BASE_URL}/api/marketplace/my-products", headers=headers)
            if response.status_code == 200:
                products = response.json()
                for product in products:
                    if product.get("title", "").startswith("TEST_"):
                        api_client.delete(f"{BASE_URL}/api/marketplace/products/{product['id']}", headers=headers)
                        print(f"Cleaned up test product: {product['id']}")
        except Exception as e:
            print(f"Cleanup error: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
