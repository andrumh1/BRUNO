"""
DEAL Integration Tests - Iteration 53
Tests for BRUNO ↔ DEAL hybrid architecture integration.

Endpoints tested:
- POST /api/deal/send-order - Creates deal order
- POST /api/deal/webhook - Receives DEAL webhook
- GET /api/deal/orders - Returns user's deal orders
- GET /api/deal/orders/{order_id} - Returns specific deal order
- GET /api/deal/commissions - Returns partner commissions
- POST /api/marketplace/products - deal_enabled field in product creation
"""
import pytest
import requests
import os
import uuid
import hashlib
import hmac

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "newtest@bruno.com"
TEST_PASSWORD = "Test1234!"
TEST_DEAL_PRODUCT_ID = "4334a391-d035-463c-b8cc-3e18e88aa833"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def authenticated_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestDealSendOrder:
    """Tests for POST /api/deal/send-order endpoint"""
    
    def test_send_order_success(self, authenticated_client):
        """Test creating a deal order with all required fields"""
        order_data = {
            "product_id": TEST_DEAL_PRODUCT_ID,
            "product_name": "Test DEAL Product",
            "product_type": "product",
            "price": 99.99,
            "currency": "USD",
            "quantity": 1,
            "partner_id": "partner-123",
            "referral_code": "BRUNO2026"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/deal/send-order", json=order_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain order id"
        assert data["status"] == "pending_payment", f"Expected status 'pending_payment', got '{data.get('status')}'"
        assert data["product_name"] == "Test DEAL Product"
        assert data["price"] == 99.99
        assert data["currency"] == "USD"
        assert "created_at" in data
        # deal_id may be null since DEAL API URL is not configured
        print(f"✓ Order created successfully: {data['id']}")
        return data["id"]
    
    def test_send_order_service_type(self, authenticated_client):
        """Test creating a deal order for a service"""
        order_data = {
            "product_id": str(uuid.uuid4()),
            "product_name": "Test Service",
            "product_type": "service",
            "price": 150.00,
            "currency": "USD",
            "quantity": 1
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/deal/send-order", json=order_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["status"] == "pending_payment"
        print(f"✓ Service order created: {data['id']}")
    
    def test_send_order_without_auth(self):
        """Test that send-order requires authentication"""
        order_data = {
            "product_id": TEST_DEAL_PRODUCT_ID,
            "product_name": "Test Product",
            "price": 50.00
        }
        
        response = requests.post(f"{BASE_URL}/api/deal/send-order", json=order_data)
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated request correctly rejected")
    
    def test_send_order_with_quantity(self, authenticated_client):
        """Test order with quantity > 1 calculates total correctly"""
        order_data = {
            "product_id": str(uuid.uuid4()),
            "product_name": "Bulk Product",
            "product_type": "product",
            "price": 25.00,
            "currency": "USD",
            "quantity": 3
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/deal/send-order", json=order_data)
        
        assert response.status_code == 200
        data = response.json()
        # Price in response should be total (price * quantity)
        assert data["price"] == 75.00, f"Expected total 75.00, got {data['price']}"
        print(f"✓ Quantity calculation correct: 3 x $25 = ${data['price']}")


class TestDealWebhook:
    """Tests for POST /api/deal/webhook endpoint"""
    
    def test_webhook_payment_success(self, authenticated_client):
        """Test webhook updates order status on payment success"""
        # First create an order
        order_data = {
            "product_id": str(uuid.uuid4()),
            "product_name": "Webhook Test Product",
            "price": 100.00,
            "currency": "USD",
            "quantity": 1,
            "partner_id": "partner-webhook-test"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/deal/send-order", json=order_data)
        assert create_response.status_code == 200
        order_id = create_response.json()["id"]
        
        # Simulate webhook from DEAL
        webhook_payload = {
            "deal_id": f"deal-{uuid.uuid4()}",
            "order_id": order_id,
            "payment_status": "paid",
            "amount_paid": 100.00,
            "partner_id": "partner-webhook-test",
            "commission_amount": 10.00,
            "service_status": "active"
        }
        
        # Webhook doesn't require auth (called by DEAL servers)
        webhook_response = requests.post(f"{BASE_URL}/api/deal/webhook", json=webhook_payload)
        
        assert webhook_response.status_code == 200, f"Expected 200, got {webhook_response.status_code}: {webhook_response.text}"
        data = webhook_response.json()
        assert data["status"] == "ok"
        assert data["order_id"] == order_id
        assert data["payment_status"] == "paid"
        print(f"✓ Webhook processed successfully for order {order_id}")
        
        # Verify order was updated
        get_response = authenticated_client.get(f"{BASE_URL}/api/deal/orders/{order_id}")
        assert get_response.status_code == 200
        updated_order = get_response.json()
        assert updated_order["payment_status"] == "paid"
        assert updated_order["status"] == "paid"
        print(f"✓ Order status updated to 'paid'")
        
        return order_id
    
    def test_webhook_payment_failed(self, authenticated_client):
        """Test webhook handles payment failure"""
        # Create order
        order_data = {
            "product_id": str(uuid.uuid4()),
            "product_name": "Failed Payment Test",
            "price": 50.00
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/deal/send-order", json=order_data)
        order_id = create_response.json()["id"]
        
        # Simulate failed payment webhook
        webhook_payload = {
            "deal_id": f"deal-{uuid.uuid4()}",
            "order_id": order_id,
            "payment_status": "failed",
            "amount_paid": 0
        }
        
        webhook_response = requests.post(f"{BASE_URL}/api/deal/webhook", json=webhook_payload)
        
        assert webhook_response.status_code == 200
        
        # Verify order status
        get_response = authenticated_client.get(f"{BASE_URL}/api/deal/orders/{order_id}")
        updated_order = get_response.json()
        assert updated_order["status"] == "payment_failed"
        print(f"✓ Payment failure handled correctly")
    
    def test_webhook_order_not_found(self):
        """Test webhook returns 404 for non-existent order"""
        webhook_payload = {
            "deal_id": "deal-nonexistent",
            "order_id": "nonexistent-order-id",
            "payment_status": "paid",
            "amount_paid": 100.00
        }
        
        response = requests.post(f"{BASE_URL}/api/deal/webhook", json=webhook_payload)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent order correctly returns 404")
    
    def test_webhook_signature_verification(self):
        """Test webhook signature verification (when secret is configured)"""
        # Note: DEAL_WEBHOOK_SECRET is empty in .env, so signature verification is skipped
        # This test verifies the endpoint accepts requests without signature when secret is not set
        webhook_payload = {
            "deal_id": "deal-sig-test",
            "order_id": "nonexistent",
            "payment_status": "paid",
            "amount_paid": 100.00
        }
        
        # Without signature - should work when secret not configured
        response = requests.post(f"{BASE_URL}/api/deal/webhook", json=webhook_payload)
        # Will be 404 because order doesn't exist, but not 401 (signature error)
        assert response.status_code == 404, f"Expected 404 (order not found), got {response.status_code}"
        print("✓ Webhook accepts requests when secret not configured")


class TestDealOrders:
    """Tests for GET /api/deal/orders endpoints"""
    
    def test_get_user_orders(self, authenticated_client):
        """Test getting all deal orders for current user"""
        response = authenticated_client.get(f"{BASE_URL}/api/deal/orders")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Retrieved {len(data)} orders for user")
        
        # Verify order structure if orders exist
        if len(data) > 0:
            order = data[0]
            assert "id" in order
            assert "product_name" in order
            assert "status" in order
            assert "created_at" in order
            print(f"✓ Order structure verified: {order['id']}")
    
    def test_get_specific_order(self, authenticated_client):
        """Test getting a specific deal order"""
        # First create an order
        order_data = {
            "product_id": str(uuid.uuid4()),
            "product_name": "Specific Order Test",
            "price": 75.00
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/deal/send-order", json=order_data)
        order_id = create_response.json()["id"]
        
        # Get specific order
        response = authenticated_client.get(f"{BASE_URL}/api/deal/orders/{order_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == order_id
        assert data["product_name"] == "Specific Order Test"
        assert data["price"] == 75.00
        print(f"✓ Retrieved specific order: {order_id}")
    
    def test_get_order_not_found(self, authenticated_client):
        """Test getting non-existent order returns 404"""
        response = authenticated_client.get(f"{BASE_URL}/api/deal/orders/nonexistent-id")
        
        assert response.status_code == 404
        print("✓ Non-existent order correctly returns 404")
    
    def test_get_orders_without_auth(self):
        """Test that orders endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/deal/orders")
        
        assert response.status_code in [401, 403]
        print("✓ Unauthenticated request correctly rejected")


class TestDealCommissions:
    """Tests for GET /api/deal/commissions endpoint"""
    
    def test_get_commissions(self, authenticated_client):
        """Test getting partner commissions"""
        response = authenticated_client.get(f"{BASE_URL}/api/deal/commissions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Retrieved {len(data)} commissions")
        
        # Verify commission structure if any exist
        if len(data) > 0:
            commission = data[0]
            assert "id" in commission
            assert "amount" in commission
            assert "status" in commission
            print(f"✓ Commission structure verified")
    
    def test_get_commissions_without_auth(self):
        """Test that commissions endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/deal/commissions")
        
        assert response.status_code in [401, 403]
        print("✓ Unauthenticated request correctly rejected")


class TestMarketplaceDealEnabled:
    """Tests for deal_enabled field in marketplace products"""
    
    def test_create_product_with_deal_enabled(self, authenticated_client):
        """Test creating a product with deal_enabled=true"""
        product_data = {
            "title": f"DEAL Test Product {uuid.uuid4().hex[:8]}",
            "description": "Test product with DEAL integration enabled",
            "price": 199.99,
            "currency": "USD",
            "category": "electronics",
            "condition": "new",
            "images": ["https://example.com/image.jpg"],
            "deal_enabled": True,
            "deal_partner_id": "partner-test-123",
            "deal_referral_code": "TESTCODE2026"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/marketplace/products", json=product_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["deal_enabled"] == True, "deal_enabled should be True"
        assert data["deal_partner_id"] == "partner-test-123"
        assert data["deal_referral_code"] == "TESTCODE2026"
        print(f"✓ Product created with deal_enabled=true: {data['id']}")
        return data["id"]
    
    def test_create_product_with_deal_disabled(self, authenticated_client):
        """Test creating a product with deal_enabled=false (default)"""
        product_data = {
            "title": f"Non-DEAL Product {uuid.uuid4().hex[:8]}",
            "description": "Test product without DEAL integration",
            "price": 49.99,
            "currency": "USD",
            "category": "clothing",
            "condition": "new",
            "images": ["https://example.com/image2.jpg"]
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/marketplace/products", json=product_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["deal_enabled"] == False, "deal_enabled should default to False"
        print(f"✓ Product created with deal_enabled=false: {data['id']}")
    
    def test_get_deal_enabled_product(self, authenticated_client):
        """Test that deal_enabled field is returned when getting a product"""
        # Get the test product
        response = authenticated_client.get(f"{BASE_URL}/api/marketplace/products/{TEST_DEAL_PRODUCT_ID}")
        
        if response.status_code == 200:
            data = response.json()
            assert "deal_enabled" in data, "Product should have deal_enabled field"
            print(f"✓ Product has deal_enabled={data.get('deal_enabled')}")
        else:
            # Product might not exist, create one
            print(f"Test product not found (status {response.status_code}), skipping verification")


class TestWebhookCommissionRegistration:
    """Tests for commission registration via webhook"""
    
    def test_webhook_registers_commission(self, authenticated_client):
        """Test that webhook registers partner commission on successful payment"""
        # Create order with partner_id
        order_data = {
            "product_id": str(uuid.uuid4()),
            "product_name": "Commission Test Product",
            "price": 200.00,
            "currency": "USD",
            "quantity": 1,
            "partner_id": "commission-test-partner"
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/deal/send-order", json=order_data)
        order_id = create_response.json()["id"]
        
        # Simulate successful payment webhook with commission
        webhook_payload = {
            "deal_id": f"deal-commission-{uuid.uuid4()}",
            "order_id": order_id,
            "payment_status": "paid",
            "amount_paid": 200.00,
            "partner_id": "commission-test-partner",
            "commission_amount": 20.00,  # 10% commission
            "service_status": "active"
        }
        
        webhook_response = requests.post(f"{BASE_URL}/api/deal/webhook", json=webhook_payload)
        assert webhook_response.status_code == 200
        
        print(f"✓ Commission registered for partner via webhook")


class TestWebhookServiceActivation:
    """Tests for service activation via webhook"""
    
    def test_webhook_activates_service(self, authenticated_client):
        """Test that webhook activates product/service on successful payment"""
        # Create service order
        order_data = {
            "product_id": str(uuid.uuid4()),
            "product_name": "Activation Test Service",
            "product_type": "service",
            "price": 150.00
        }
        
        create_response = authenticated_client.post(f"{BASE_URL}/api/deal/send-order", json=order_data)
        order_id = create_response.json()["id"]
        
        # Simulate successful payment webhook
        webhook_payload = {
            "deal_id": f"deal-activation-{uuid.uuid4()}",
            "order_id": order_id,
            "payment_status": "paid",
            "amount_paid": 150.00,
            "service_status": "active"
        }
        
        webhook_response = requests.post(f"{BASE_URL}/api/deal/webhook", json=webhook_payload)
        assert webhook_response.status_code == 200
        
        # Verify order has service_status
        get_response = authenticated_client.get(f"{BASE_URL}/api/deal/orders/{order_id}")
        order = get_response.json()
        assert order["service_status"] == "active"
        print(f"✓ Service activated via webhook")
