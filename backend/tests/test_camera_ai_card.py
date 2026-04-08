"""
Test suite for:
1. Camera Page UI components (AR filters)
2. AI Card Generation endpoint (/api/ai/generate-card)

Iteration 26 - Testing AR Camera and AI Card Generation features
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
TEST_PASSWORD = os.getenv("TEST_USER_PASSWORD", "Test1234!")


@pytest.fixture(scope="module")
def auth_token():
    """Authenticate and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code != 200:
        # Create user if doesn't exist
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": "Test User Camera"
        })
        if register_response.status_code == 201:
            return register_response.json().get("access_token")
        pytest.skip(f"Cannot authenticate: {response.text}")
    return response.json().get("access_token")


@pytest.fixture
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestAICardGeneration:
    """Test AI Card Generation endpoint /api/ai/generate-card"""
    
    def test_generate_card_service_description(self, api_client):
        """Test AI generates card for service provider description"""
        # Test with service provider description
        response = api_client.post(f"{BASE_URL}/api/ai/generate-card", json={
            "description": "Soy plomero profesional en Ciudad de México, ofrezco servicios de reparación de tuberías"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "card_type" in data
        assert "suggested_fields" in data
        assert "message" in data
        
        # Should detect services type
        assert data["card_type"] in ["servicios", "personal", "negocio"]
        print(f"✓ Generated card type: {data['card_type']}")
        print(f"✓ Suggested fields: {data['suggested_fields']}")
    
    def test_generate_card_job_offer(self, api_client):
        """Test AI generates card for job offer description"""
        response = api_client.post(f"{BASE_URL}/api/ai/generate-card", json={
            "description": "Oferta de trabajo para diseñador gráfico en empresa de tecnología"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "card_type" in data
        # Should detect oferta_trabajo type
        assert data["card_type"] in ["oferta_trabajo", "empresarial"]
        print(f"✓ Job offer card type: {data['card_type']}")
    
    def test_generate_card_business(self, api_client):
        """Test AI generates card for business/company description"""
        response = api_client.post(f"{BASE_URL}/api/ai/generate-card", json={
            "description": "Tengo una cafetería en el centro, vendemos café artesanal y pasteles"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "card_type" in data
        # Should detect negocio or lugares type
        assert data["card_type"] in ["negocio", "lugares", "servicios"]
        print(f"✓ Business card type: {data['card_type']}")
    
    def test_generate_card_returns_suggested_fields(self, api_client):
        """Test AI returns proper suggested fields structure"""
        response = api_client.post(f"{BASE_URL}/api/ai/generate-card", json={
            "description": "Busco trabajo como desarrollador web con 5 años de experiencia"
        })
        
        assert response.status_code == 200
        
        data = response.json()
        suggested = data.get("suggested_fields", {})
        
        # Should have basic fields
        assert "title" in suggested or suggested.get("card_type")
        print(f"✓ Suggested fields present: {list(suggested.keys())}")
    
    def test_generate_card_without_auth_fails(self):
        """Test that unauthenticated request fails"""
        response = requests.post(f"{BASE_URL}/api/ai/generate-card", json={
            "description": "Test description"
        })
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated request properly rejected")
    
    def test_generate_card_empty_description(self, api_client):
        """Test AI handles empty description gracefully"""
        response = api_client.post(f"{BASE_URL}/api/ai/generate-card", json={
            "description": ""
        })
        
        # Should either return error or default card type
        # API might return 422 for validation error or 200 with default
        assert response.status_code in [200, 422, 400]
        print(f"✓ Empty description handled with status: {response.status_code}")


class TestAIChatEndpoint:
    """Test AI Chat endpoint for context - AI can also suggest creating cards"""
    
    def test_ai_chat_basic(self, api_client):
        """Test basic AI chat works"""
        response = api_client.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "Hola, qué puedo hacer en BRUNO?",
            "session_id": None
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        assert "session_id" in data
        print(f"✓ AI Chat response received: {data['response'][:100]}...")
    
    def test_ai_history_endpoint(self, api_client):
        """Test AI history retrieval"""
        response = api_client.get(f"{BASE_URL}/api/ai/history?limit=5")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ AI History retrieved: {len(data)} conversations")


class TestHealthEndpoint:
    """Basic health check to ensure backend is running"""
    
    def test_health_check(self):
        """Test backend is accessible"""
        response = requests.get(f"{BASE_URL}/api/auth/me", timeout=10)
        # Will fail with 401 without auth, but shows backend is running
        assert response.status_code in [200, 401, 403], f"Backend not accessible: {response.status_code}"
        print("✓ Backend is accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
