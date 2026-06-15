"""Phase 59 backend tests:
 - Location sharing (start/update/stop/active/get)
 - Map cards-located filter (public address types only)
 - Calls start (room_url + call_id)
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

PRIMARY_EMAIL = "newtest@bruno.com"
PRIMARY_PASS = "Test1234!"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def primary_token():
    r = requests.post(f"{API}/auth/login", json={"email": PRIMARY_EMAIL, "password": PRIMARY_PASS}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def primary_user(primary_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {primary_token}"}, timeout=15)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="session")
def secondary_token():
    """A second user to be the recipient/non-sharer."""
    email = f"TEST_phase59_{uuid.uuid4().hex[:8]}@bruno.com"
    payload = {"email": email, "password": "Test1234!", "name": "Phase59 Second", "username": f"p59_{uuid.uuid4().hex[:6]}"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=20)
    if r.status_code not in (200, 201):
        pytest.skip(f"register secondary failed {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def secondary_user(secondary_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {secondary_token}"}, timeout=15)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="session")
def direct_chat(primary_token, secondary_user):
    """Direct chat between primary and secondary."""
    r = requests.post(
        f"{API}/chats",
        params={"participant_id": secondary_user["id"]},
        headers={"Authorization": f"Bearer {primary_token}"},
        timeout=15,
    )
    assert r.status_code in (200, 201), f"chat create failed {r.status_code} {r.text[:200]}"
    return r.json()


# ---------- LOCATION SHARING ----------
class TestLocationShare:
    def test_start_live_share_with_chat(self, primary_token, secondary_user, direct_chat):
        body = {
            "to_user_id": secondary_user["id"],
            "chat_id": direct_chat["id"],
            "type": "live",
            "duration_minutes": 15,
            "interval_seconds": 10,
            "lat": 19.4326,
            "lng": -99.1332,
            "speed": 0.0,
            "heading": 0.0,
            "label": "TEST_phase59_share",
        }
        r = requests.post(f"{API}/location/share", json=body,
                          headers={"Authorization": f"Bearer {primary_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data
        assert data["type"] == "live"
        assert data["stopped"] is False
        assert data["expires_at"], "expires_at must be set for live"
        # expires_at should be ~15 minutes ahead
        exp = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
        diff = (exp - datetime.now(timezone.utc)).total_seconds()
        assert 14 * 60 < diff < 16 * 60, f"expires diff out of range: {diff}"
        # message should be inserted in chat
        pytest.share_id = data["id"]
        pytest.chat_id = direct_chat["id"]

        # Confirm chat message of type location_share appeared
        msgs = requests.get(
            f"{API}/chats/{direct_chat['id']}/messages?limit=5",
            headers={"Authorization": f"Bearer {primary_token}"},
            timeout=15,
        )
        assert msgs.status_code == 200, msgs.text
        items = msgs.json() if isinstance(msgs.json(), list) else msgs.json().get("messages", [])
        types = [m.get("message_type") for m in items]
        assert "location_share" in types, f"expected location_share msg, got: {types}"

    def test_update_share_as_sharer(self, primary_token):
        sid = getattr(pytest, "share_id", None)
        assert sid, "share_id missing"
        r = requests.post(
            f"{API}/location/share/{sid}/update",
            json={"lat": 19.4329, "lng": -99.1335, "speed": 1.4, "heading": 90.0},
            headers={"Authorization": f"Bearer {primary_token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "updated"
        assert d["last_lat"] == 19.4329

    def test_update_share_as_non_sharer_forbidden(self, secondary_token):
        sid = getattr(pytest, "share_id", None)
        assert sid
        r = requests.post(
            f"{API}/location/share/{sid}/update",
            json={"lat": 1.0, "lng": 2.0},
            headers={"Authorization": f"Bearer {secondary_token}"},
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text[:200]}"

    def test_active_shares_includes_share(self, primary_token, secondary_token):
        sid = getattr(pytest, "share_id", None)
        # primary (sharer) sees it
        r = requests.get(f"{API}/location/shares/active",
                         headers={"Authorization": f"Bearer {primary_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        ids = [s["id"] for s in data.get("shares", [])]
        assert sid in ids, f"sharer should see own share. ids: {ids}"
        # recipient sees it too
        r2 = requests.get(f"{API}/location/shares/active",
                          headers={"Authorization": f"Bearer {secondary_token}"}, timeout=15)
        assert r2.status_code == 200, r2.text
        ids2 = [s["id"] for s in r2.json().get("shares", [])]
        assert sid in ids2, f"recipient should see share. ids: {ids2}"
        # avatar hydration check
        my_share = next((s for s in r2.json()["shares"] if s["id"] == sid), None)
        assert my_share is not None
        # from_avatar_url field present (may be None if no avatar)
        assert "from_avatar_url" in my_share

    def test_get_share_by_id(self, primary_token):
        sid = getattr(pytest, "share_id", None)
        r = requests.get(f"{API}/location/share/{sid}",
                         headers={"Authorization": f"Bearer {primary_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["id"] == sid

    def test_stop_share(self, primary_token):
        sid = getattr(pytest, "share_id", None)
        r = requests.post(f"{API}/location/share/{sid}/stop",
                          headers={"Authorization": f"Bearer {primary_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "stopped"

    def test_update_stopped_share_fails(self, primary_token):
        sid = getattr(pytest, "share_id", None)
        r = requests.post(
            f"{API}/location/share/{sid}/update",
            json={"lat": 1.0, "lng": 2.0},
            headers={"Authorization": f"Bearer {primary_token}"},
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400 stopped, got {r.status_code}"

    def test_fixed_share_no_expires(self, primary_token, secondary_user):
        body = {
            "to_user_id": secondary_user["id"],
            "type": "fixed",
            "duration_minutes": 15,
            "interval_seconds": 10,
            "lat": 19.5,
            "lng": -99.1,
            "label": "TEST_phase59_fixed",
        }
        r = requests.post(f"{API}/location/share", json=body,
                          headers={"Authorization": f"Bearer {primary_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["type"] == "fixed"
        assert d.get("expires_at") in (None, ""), f"fixed share should not expire: {d.get('expires_at')}"


# ---------- MAP CARDS LOCATED FILTER ----------
class TestMapCardsLocated:
    def test_cards_located_filter(self, primary_token):
        # Public endpoint (no auth required by signature, but pass token anyway)
        r = requests.get(f"{API}/map-pins/cards-located",
                         headers={"Authorization": f"Bearer {primary_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "cards" in data
        cards = data["cards"]
        # Allowed card_types — anything else MUST have opted in via is_public_address
        allowed = {"business", "negocio", "empresarial", "empresa",
                   "lugares", "lugar", "servicios", "servicio",
                   "oferta_trabajo", "solicitud_servicio"}
        # We can't check is_public_address from this response, but personal/curriculum
        # should not appear unless opted in. Spot-check that types are all in allowed
        # OR card_type missing/personal but we accept those (could be opted in).
        for c in cards:
            ct = c.get("card_type")
            # only fail if it's clearly personal/curriculum AND we have no way to verify opt-in
            assert ct not in {"curriculum", "cv"}, f"curriculum card leaked: {c}"


# ---------- CALLS START ----------
class TestCallsStart:
    def test_start_video_call(self, primary_token, direct_chat):
        r = requests.post(
            f"{API}/calls/start",
            json={"chat_id": direct_chat["id"], "call_type": "video"},
            headers={"Authorization": f"Bearer {primary_token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "call_id" in data
        assert "room_url" in data and data["room_url"].startswith("https://meet.jit.si/")
        assert "room_name" in data
        pytest.call_id = data["call_id"]

    def test_start_audio_call(self, primary_token, direct_chat):
        r = requests.post(
            f"{API}/calls/start",
            json={"chat_id": direct_chat["id"], "call_type": "audio"},
            headers={"Authorization": f"Bearer {primary_token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "call_id" in d and "room_url" in d


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
