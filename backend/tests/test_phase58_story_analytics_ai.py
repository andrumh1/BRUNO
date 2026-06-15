"""Phase 58 backend tests:
- Story Analytics: /answer, /insights, /public-insights
- AI router extraction smoke: /ai/history, /ai/chat, /ai/recommend, /ai/generate-card
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EMAIL = "newtest@bruno.com"
PASSWORD = "Test1234!"

# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    r = session.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def secondary_user(session):
    """Create a second account to test 403 + answer-as-other-user."""
    email = f"TEST_phase58_{int(time.time())}@bruno.com"
    password = "Test1234!"
    payload = {"email": email, "password": password, "name": "TEST Phase58"}
    r = session.post(f"{API}/auth/register", json=payload, timeout=20)
    if r.status_code not in (200, 201):
        # Try login if already exists
        r2 = session.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
        assert r2.status_code == 200, f"Could not create/login secondary: {r.status_code} {r.text}"
        return {"token": r2.json()["access_token"], "email": email}
    data = r.json()
    return {"token": data.get("access_token"), "email": email}


@pytest.fixture(scope="module")
def owned_story(session, auth_headers):
    """Create a story we own so we can test insights + answers."""
    payload = {
        "media_url": "",
        "media_type": "text",
        "caption": "TEST_phase58 analytics story",
        "visibility": "public",
    }
    r = session.post(f"{API}/stories/", json=payload, headers=auth_headers, timeout=20, allow_redirects=False)
    if r.status_code in (307, 308):
        r = session.post(r.headers["Location"], json=payload, headers=auth_headers, timeout=20)
    assert r.status_code in (200, 201), f"Story create failed: {r.status_code} {r.text}"
    data = r.json()
    sid = data.get("id") or data.get("story_id") or (data.get("story") or {}).get("id")
    assert sid, f"No story id in response: {data}"
    yield sid
    # Cleanup
    try:
        session.delete(f"{API}/stories/{sid}", headers=auth_headers, timeout=10)
    except Exception:
        pass


# ---------- Story Analytics: public-insights ----------

class TestPublicInsights:
    def test_public_insights_no_auth(self, session, owned_story):
        r = session.get(f"{API}/stories/{owned_story}/public-insights", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["story_id"] == owned_story
        assert isinstance(data["answers_count"], int)
        assert "poll" in data
        # No poll on a basic text story
        assert data["poll"] is None or isinstance(data["poll"], dict)

    def test_public_insights_404(self, session):
        r = session.get(f"{API}/stories/does-not-exist-xyz/public-insights", timeout=10)
        assert r.status_code == 404


# ---------- Story Analytics: insights (owner-only) ----------

class TestOwnerInsights:
    def test_insights_owner_ok(self, session, auth_headers, owned_story):
        r = session.get(f"{API}/stories/{owned_story}/insights", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("story_id", "views_count", "reactions_count", "reactions_by_emoji",
                  "answers_count", "answers", "poll"):
            assert k in d, f"missing {k} in insights"
        assert isinstance(d["reactions_by_emoji"], dict)
        assert isinstance(d["answers"], list)

    def test_insights_other_user_403(self, session, secondary_user, owned_story):
        h = {"Authorization": f"Bearer {secondary_user['token']}", "Content-Type": "application/json"}
        r = session.get(f"{API}/stories/{owned_story}/insights", headers=h, timeout=15)
        assert r.status_code == 403, f"Expected 403 got {r.status_code} {r.text}"

    def test_insights_404(self, session, auth_headers):
        r = session.get(f"{API}/stories/nonexistent-story-xyz/insights", headers=auth_headers, timeout=10)
        assert r.status_code == 404


# ---------- Answer endpoint ----------

class TestAnswer:
    def test_empty_answer_400(self, session, auth_headers, owned_story):
        r = session.post(
            f"{API}/stories/{owned_story}/answer",
            json={"answer": "   "},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 400

    def test_answer_404_missing_story(self, session, auth_headers):
        r = session.post(
            f"{API}/stories/missing-xyz/answer",
            json={"answer": "hola"},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 404

    def test_answer_creates_and_replaces(self, session, secondary_user, auth_headers, owned_story):
        # Secondary user answers
        h2 = {"Authorization": f"Bearer {secondary_user['token']}", "Content-Type": "application/json"}
        r1 = session.post(f"{API}/stories/{owned_story}/answer", json={"answer": "hola"}, headers=h2, timeout=15)
        assert r1.status_code == 200, r1.text
        # Owner reads insights
        ins = session.get(f"{API}/stories/{owned_story}/insights", headers=auth_headers, timeout=15).json()
        before = ins["answers_count"]
        assert before >= 1
        found = [a for a in ins["answers"] if a.get("answer") == "hola"]
        assert found, f"answer 'hola' not in answers: {ins['answers']}"

        # Same user answers again with new text → should REPLACE (no dup)
        r2 = session.post(f"{API}/stories/{owned_story}/answer", json={"answer": "hola2"}, headers=h2, timeout=15)
        assert r2.status_code == 200

        ins2 = session.get(f"{API}/stories/{owned_story}/insights", headers=auth_headers, timeout=15).json()
        # Count from this specific user must be exactly 1
        sec_email = secondary_user["email"]
        # We can't filter by email; we look by user_name. Easier: just compare counts.
        assert ins2["answers_count"] == before, f"Expected replacement, got {ins2['answers_count']} vs {before}"
        latest_for_user = [a for a in ins2["answers"] if a.get("answer") == "hola2"]
        old_for_user = [a for a in ins2["answers"] if a.get("answer") == "hola"]
        assert len(latest_for_user) == 1
        assert len(old_for_user) == 0

    def test_public_insights_reflects_answer(self, session, owned_story):
        # After the previous answer, the public-insights answers_count should be ≥1
        r = session.get(f"{API}/stories/{owned_story}/public-insights", timeout=15)
        assert r.status_code == 200
        assert r.json()["answers_count"] >= 1


# ---------- AI router extraction smoke ----------

class TestAIExtraction:
    def test_history_ok(self, session, auth_headers):
        r = session.get(f"{API}/ai/history?limit=1", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        # Body should be JSON (list or dict)
        d = r.json()
        assert isinstance(d, (list, dict))

    def test_chat_ok(self, session, auth_headers):
        r = session.post(f"{API}/ai/chat", json={"message": "hola"}, headers=auth_headers, timeout=45)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "response" in d or "message" in d
        assert "session_id" in d

    def test_recommend_ok(self, session, auth_headers):
        r = session.post(f"{API}/ai/recommend", json={"query": "restaurante"}, headers=auth_headers, timeout=45)
        assert r.status_code == 200, r.text

    def test_generate_card_ok(self, session, auth_headers):
        r = session.post(
            f"{API}/ai/generate-card",
            json={"description": "soy plomero"},
            headers=auth_headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        # card_type should be present and non-empty
        assert d.get("card_type"), f"card_type missing or empty: {d}"
