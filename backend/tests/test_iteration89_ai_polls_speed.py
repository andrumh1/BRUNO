"""Iteration 89 backend tests: AI translate, catch-up summary, group polls."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

GROUP_ID = "655d23d2-b133-4188-a95c-bd8a777c04f4"

CREDS = {
    "admin": ("newtest@bruno.com", "Test1234!"),
    "member": ("viewer2@bruno.com", "Test1234!"),
    "outsider": ("viewer3@bruno.com", "Test1234!"),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def tokens():
    return {k: _login(*v) for k, v in CREDS.items()}


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------- AI TRANSLATE ----------------
class TestTranslate:
    def test_translate_en_to_es(self, tokens):
        r = requests.post(f"{API}/ai/translate", json={"text": "Hello team, see you tomorrow", "target": "es"}, headers=H(tokens["admin"]), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("translated"), str) and len(d["translated"]) > 0
        assert d.get("detected") == "en"
        assert d.get("same_language") is False

    def test_translate_cached_second_call(self, tokens):
        payload = {"text": "Hello team, see you tomorrow", "target": "es"}
        # ensure first call has run
        requests.post(f"{API}/ai/translate", json=payload, headers=H(tokens["admin"]), timeout=30)
        r = requests.post(f"{API}/ai/translate", json=payload, headers=H(tokens["admin"]), timeout=30)
        assert r.status_code == 200
        assert r.json().get("cached") is True

    def test_translate_empty_400(self, tokens):
        r = requests.post(f"{API}/ai/translate", json={"text": "  ", "target": "es"}, headers=H(tokens["admin"]), timeout=15)
        assert r.status_code == 400

    def test_translate_same_language(self, tokens):
        r = requests.post(f"{API}/ai/translate", json={"text": "Hola equipo, nos vemos mañana", "target": "es"}, headers=H(tokens["admin"]), timeout=30)
        assert r.status_code == 200
        d = r.json()
        # Accept either same_language true OR translation equals text case-insensitively
        assert d.get("same_language") is True or d["translated"].strip().lower() == "hola equipo, nos vemos mañana".lower()


# ---------------- SUMMARY ----------------
class TestSummary:
    def test_summary_seed_and_generate(self, tokens):
        # Seed 6 messages from viewer2 (so admin newtest hasn't seen them)
        for i in range(6):
            r = requests.post(f"{API}/chats/{GROUP_ID}/messages",
                              json={"content": f"Mensaje de prueba iter89 {i}: decisión importante sobre el evento del viernes", "message_type": "text", "attachments": []},
                              headers=H(tokens["member"]), timeout=15)
            assert r.status_code in (200, 201), r.text
        # Now newtest summarizes last 6
        r = requests.post(f"{API}/chats/{GROUP_ID}/summary?count=6", headers=H(tokens["admin"]), timeout=45)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("count", 0) >= 3
        assert d.get("summary") and "•" in d["summary"]
        assert d.get("from") and d.get("to")

    def test_summary_few(self, tokens):
        r = requests.post(f"{API}/chats/{GROUP_ID}/summary?count=2", headers=H(tokens["admin"]), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d.get("summary") is None
        assert d.get("reason") == "few"

    def test_summary_non_participant_404(self, tokens):
        r = requests.post(f"{API}/chats/{GROUP_ID}/summary?count=6", headers=H(tokens["outsider"]), timeout=15)
        assert r.status_code == 404


# ---------------- POLLS ----------------
@pytest.fixture(scope="module")
def poll_ctx(tokens):
    """Create a poll and return poll_id + option ids."""
    r = requests.post(f"{API}/chats/{GROUP_ID}/polls",
                      json={"question": "¿Cuál es tu color favorito?", "options": ["Rojo", "Azul", "Verde"], "multiple": False, "anonymous": False},
                      headers=H(tokens["admin"]), timeout=15)
    assert r.status_code == 200, r.text
    msg = r.json()
    assert msg["message_type"] == "poll"
    assert msg["attachments"][0].get("poll_id")
    poll_id = msg["attachments"][0]["poll_id"]
    view = msg.get("poll")
    assert view and len(view["options"]) == 3
    return {"poll_id": poll_id, "options": [o["id"] for o in view["options"]], "message_id": msg["id"]}


class TestPolls:
    def test_create_poll_less_than_2_options(self, tokens):
        r = requests.post(f"{API}/chats/{GROUP_ID}/polls",
                          json={"question": "Bad", "options": ["one"]},
                          headers=H(tokens["admin"]), timeout=10)
        assert r.status_code == 400

    def test_get_poll_participant(self, tokens, poll_ctx):
        r = requests.get(f"{API}/polls/{poll_ctx['poll_id']}", headers=H(tokens["admin"]), timeout=10)
        assert r.status_code == 200
        v = r.json()
        assert "my_votes" in v
        assert len(v["options"]) == 3

    def test_get_poll_non_participant_404(self, tokens, poll_ctx):
        r = requests.get(f"{API}/polls/{poll_ctx['poll_id']}", headers=H(tokens["outsider"]), timeout=10)
        assert r.status_code == 404

    def test_vote_and_retract(self, tokens, poll_ctx):
        opts = poll_ctx["options"]
        # Vote for first option as admin
        r = requests.post(f"{API}/polls/{poll_ctx['poll_id']}/vote", json={"option_ids": [opts[0]]}, headers=H(tokens["admin"]), timeout=10)
        assert r.status_code == 200
        v = r.json()
        assert v["my_votes"] == [opts[0]]
        assert v["total_voters"] >= 1
        # Retract
        r = requests.post(f"{API}/polls/{poll_ctx['poll_id']}/vote", json={"option_ids": []}, headers=H(tokens["admin"]), timeout=10)
        assert r.status_code == 200
        v = r.json()
        assert v["my_votes"] == []

    def test_single_choice_keeps_first(self, tokens, poll_ctx):
        opts = poll_ctx["options"]
        r = requests.post(f"{API}/polls/{poll_ctx['poll_id']}/vote", json={"option_ids": [opts[0], opts[1]]}, headers=H(tokens["admin"]), timeout=10)
        assert r.status_code == 200
        v = r.json()
        assert v["my_votes"] == [opts[0]]

    def test_multiple_choice_keeps_both(self, tokens):
        r = requests.post(f"{API}/chats/{GROUP_ID}/polls",
                          json={"question": "Multi", "options": ["A", "B", "C"], "multiple": True, "anonymous": False},
                          headers=H(tokens["admin"]), timeout=15)
        assert r.status_code == 200
        msg = r.json()
        poll_id = msg["attachments"][0]["poll_id"]
        opts = [o["id"] for o in msg["poll"]["options"]]
        r = requests.post(f"{API}/polls/{poll_id}/vote", json={"option_ids": [opts[0], opts[1]]}, headers=H(tokens["admin"]), timeout=10)
        assert r.status_code == 200
        v = r.json()
        assert set(v["my_votes"]) == {opts[0], opts[1]}

    def test_close_permissions(self, tokens, poll_ctx):
        # viewer2 (member, non-creator, non-admin) → 403
        r = requests.post(f"{API}/polls/{poll_ctx['poll_id']}/close", headers=H(tokens["member"]), timeout=10)
        assert r.status_code == 403
        # creator (admin newtest) → 200 closed true
        r = requests.post(f"{API}/polls/{poll_ctx['poll_id']}/close", headers=H(tokens["admin"]), timeout=10)
        assert r.status_code == 200
        assert r.json()["closed"] is True
        # subsequent vote → 400
        opts = poll_ctx["options"]
        r = requests.post(f"{API}/polls/{poll_ctx['poll_id']}/vote", json={"option_ids": [opts[0]]}, headers=H(tokens["admin"]), timeout=10)
        assert r.status_code == 400

    def test_poll_message_in_messages_list(self, tokens, poll_ctx):
        r = requests.get(f"{API}/chats/{GROUP_ID}/messages?limit=100", headers=H(tokens["admin"]), timeout=15)
        assert r.status_code == 200
        msgs = r.json()
        found = any(m.get("id") == poll_ctx["message_id"] and m.get("message_type") == "poll" for m in msgs)
        assert found, "poll message not found in group messages"
