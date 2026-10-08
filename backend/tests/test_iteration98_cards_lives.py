"""Iteration 98 backend tests:
- Showcase cards (glamour preset) with links[] + showcase{} persistence (POST/GET/PUT)
- Legacy card d16c2745-... still returns classic design & title
- Lives recording start (409 when no participant), summary endpoint fields, recording status none,
  non-host 403 on summary/recording
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
HOST_EMAIL = "newtest@bruno.com"
VIEWER_EMAIL = "viewer2@bruno.com"
PASSWORD = "Test1234!"
LEGACY_CARD_ID = "d16c2745-e082-4b22-84f8-749beb5e33fd"


def _login(email: str) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def host_token():
    return _login(HOST_EMAIL)


@pytest.fixture(scope="module")
def viewer_token():
    return _login(VIEWER_EMAIL)


@pytest.fixture(scope="module")
def host_headers(host_token):
    return {"Authorization": f"Bearer {host_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def viewer_headers(viewer_token):
    return {"Authorization": f"Bearer {viewer_token}", "Content-Type": "application/json"}


# ────────── Cards: glamour preset with links + showcase ──────────

class TestShowcaseCard:
    created_id = None

    def test_create_card_glamour_with_links_and_showcase(self, host_headers):
        payload = {
            "title": "TEST_Glamour_Card",
            "subtitle": "@test_glamour",
            "card_type": "personal",
            "card_design": {"version": 1, "preset": "glamour", "layout": {"header": "hero"}},
            "links": [
                {"title": "Portafolio", "url": "https://example.com/porta"},
                {"title": "Reel", "url": "https://example.com/reel"},
            ],
            "showcase": {
                "specialty": "Modelo editorial",
                "city": "Madrid",
                "booking": "booking@test.com",
                "availability": "Disponible lunes a viernes",
                "agency": "TEST Agency",
                "collab": "collab@test.com",
                "press": "press@test.com",
                "featured_title": "Portada",
                "featured_url": "https://example.com/featured",
                "featured_image": "https://example.com/img.jpg",
            },
        }
        r = requests.post(f"{BASE_URL}/api/cards", json=payload, headers=host_headers, timeout=15)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["title"] == payload["title"]
        assert len(data.get("links") or []) == 2
        assert data["links"][0]["url"] == "https://example.com/porta"
        sh = data.get("showcase") or {}
        assert sh.get("specialty") == "Modelo editorial"
        assert sh.get("city") == "Madrid"
        assert sh.get("booking") == "booking@test.com"
        assert (data.get("card_design") or {}).get("preset") == "glamour"
        TestShowcaseCard.created_id = data["id"]

    def test_get_card_returns_links_and_showcase(self, host_headers):
        cid = TestShowcaseCard.created_id
        assert cid, "create test must run first"
        r = requests.get(f"{BASE_URL}/api/cards/{cid}", headers=host_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data.get("links") or []) == 2
        assert data["links"][1]["title"] == "Reel"
        assert (data.get("showcase") or {}).get("featured_title") == "Portada"
        assert (data.get("card_design") or {}).get("preset") == "glamour"

    def test_update_card_links_and_showcase(self, host_headers):
        cid = TestShowcaseCard.created_id
        payload = {
            "links": [{"title": "Nuevo", "url": "https://example.com/nuevo"}],
            "showcase": {"specialty": "Actriz", "city": "Barcelona", "booking": "b2@test.com"},
        }
        r = requests.put(f"{BASE_URL}/api/cards/{cid}", json=payload, headers=host_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["links"]) == 1
        assert data["links"][0]["title"] == "Nuevo"
        assert data["showcase"]["specialty"] == "Actriz"
        assert data["showcase"]["city"] == "Barcelona"

    def test_cleanup_delete_card(self, host_headers):
        cid = TestShowcaseCard.created_id
        if cid:
            r = requests.delete(f"{BASE_URL}/api/cards/{cid}", headers=host_headers, timeout=15)
            assert r.status_code in (200, 204)


class TestLegacyCard:
    def test_legacy_card_classic_preset_and_title(self, host_headers):
        r = requests.get(f"{BASE_URL}/api/cards/{LEGACY_CARD_ID}", headers=host_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        design = data.get("card_design") or {}
        preset = design.get("preset") or (design.get("meta") or {}).get("preset")
        assert preset == "classic", f"expected classic, got {preset}"
        assert data.get("title"), "legacy card must still have a title"


# ────────── Lives: recording + summary ──────────

class TestLivesRecording:
    live_id = None

    @classmethod
    def _ensure_no_active(cls, headers):
        r = requests.get(f"{BASE_URL}/api/lives/mine/active", headers=headers, timeout=15)
        if r.status_code == 200 and r.json():
            lid = r.json().get("id")
            if lid:
                requests.post(f"{BASE_URL}/api/lives/{lid}/end", headers=headers, timeout=15)

    def test_create_live(self, host_headers):
        TestLivesRecording._ensure_no_active(host_headers)
        r = requests.post(f"{BASE_URL}/api/lives", json={"title": "TEST_rec", "category": "general"}, headers=host_headers, timeout=20)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d.get("id")
        TestLivesRecording.live_id = d["id"]

    def test_recording_start_409_when_no_participant(self, host_headers):
        lid = TestLivesRecording.live_id
        r = requests.post(f"{BASE_URL}/api/lives/{lid}/recording/start", headers=host_headers, timeout=20)
        # No camera yet → Daily returns "hosting a call" → remapped to 409 Spanish msg
        assert r.status_code == 409, f"expected 409, got {r.status_code} body={r.text}"
        body = r.json()
        detail = body.get("detail", "").lower()
        assert "en vivo" in detail or "cámara" in detail or "camara" in detail, body

    def test_recording_status_before_start(self, host_headers):
        lid = TestLivesRecording.live_id
        r = requests.get(f"{BASE_URL}/api/lives/{lid}/recording", headers=host_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("status") in ("none", None), data

    def test_summary_fields_present(self, host_headers):
        lid = TestLivesRecording.live_id
        r = requests.get(f"{BASE_URL}/api/lives/{lid}/summary", headers=host_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["duration_seconds", "peak_viewers", "total_viewers", "comments", "hearts",
                  "gifts", "questions", "polls", "guests", "recording"]:
            assert k in d, f"missing key {k} in summary"
        assert isinstance(d["recording"], dict)
        assert "status" in d["recording"]

    def test_non_host_summary_403(self, viewer_headers):
        lid = TestLivesRecording.live_id
        r = requests.get(f"{BASE_URL}/api/lives/{lid}/summary", headers=viewer_headers, timeout=15)
        assert r.status_code == 403, r.text

    def test_non_host_recording_403(self, viewer_headers):
        lid = TestLivesRecording.live_id
        r = requests.get(f"{BASE_URL}/api/lives/{lid}/recording", headers=viewer_headers, timeout=15)
        assert r.status_code == 403, r.text

    def test_end_live(self, host_headers):
        lid = TestLivesRecording.live_id
        r = requests.post(f"{BASE_URL}/api/lives/{lid}/end", headers=host_headers, timeout=20)
        assert r.status_code in (200, 204), r.text
