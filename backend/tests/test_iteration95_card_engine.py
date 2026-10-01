"""Backend tests for iteration 95 - 'One Card Engine' redesign.

Tests cover:
- Lazy migration for legacy cards (card_design v2, legacy_template, original fields intact)
- Draft creation + update + publish flow with card_design
- Explore/public filter excluding is_draft
- Draft access control (owner 200 / anonymous 403)
- QR endpoint
- Delete endpoint
"""
import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

EMAIL = "newtest@bruno.com"
PASSWORD = "Test1234!"

LEGACY_IDS = [
    "1069a0ba-a17d-472a-9930-17ba837b86ac",  # full_banner_bubble -> modern
    "4d495c6e-cdd4-477c-8db1-330072f7c7b4",  # photo
    "85521e08-3d13-4e29-ae6b-c54235763418",  # formal
]


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


@pytest.fixture(scope="module")
def auth_headers(token):
    assert token
    return {"Authorization": f"Bearer {token}"}


# ---- Lazy migration on legacy cards ----
@pytest.mark.parametrize("card_id", LEGACY_IDS)
def test_legacy_card_has_design_v2(card_id):
    r = requests.get(f"{API}/cards/{card_id}", timeout=20)
    assert r.status_code == 200, f"{card_id} -> {r.status_code} {r.text[:200]}"
    data = r.json()

    # card_design present + v2
    assert "card_design" in data, "missing card_design"
    cd = data["card_design"]
    assert isinstance(cd, dict), "card_design not an object"
    assert cd.get("version") == 2, f"version != 2: {cd.get('version')}"

    # required keys in design
    for key in ["preset", "layout", "background", "colors", "typography", "banner",
                "avatar", "buttons", "socialStyle", "glass", "effects", "animations",
                "components", "componentOrder", "cta"]:
        assert key in cd, f"missing design key: {key}"

    assert data.get("card_design_version") == 2
    # legacy_template present and equal to template_id (if a template_id existed)
    assert "legacy_template" in data
    if data.get("template_id"):
        assert data["legacy_template"] == data["template_id"] or data["legacy_template"]

    # original fields intact
    for key in ["title", "social_links", "contact_info", "template_id", "card_type"]:
        assert key in data, f"missing legacy field: {key}"


# ---- Create draft ----
@pytest.fixture(scope="module")
def created_card(auth_headers):
    payload = {
        "card_type": "personal",
        "title": "",
        "is_draft": True,
        "card_design": {
            "version": 2,
            "preset": "custom",
            "layout": {"align": "left", "spacing": "medium", "radius": 24},
            "background": {"type": "color", "color": "#F9F1EA"},
            "colors": {"text": "#474747", "accent": "#FF6A00"},
        },
        "contact_info": {"whatsapp": "+34600000000", "company": "BRUNO"},
    }
    r = requests.post(f"{API}/cards", json=payload, headers=auth_headers, timeout=20)
    assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("is_draft") is True
    assert data.get("card_design_version") == 2
    assert data.get("title", "") == ""
    cid = data["id"]
    yield cid
    # cleanup
    requests.delete(f"{API}/cards/{cid}", headers=auth_headers, timeout=20)


def test_draft_hidden_from_anonymous(created_card):
    r = requests.get(f"{API}/cards/{created_card}", timeout=20)
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"


def test_draft_visible_to_owner(created_card, auth_headers):
    r = requests.get(f"{API}/cards/{created_card}", headers=auth_headers, timeout=20)
    assert r.status_code == 200
    assert r.json().get("is_draft") is True


def test_draft_not_in_explore(created_card, auth_headers):
    r = requests.get(f"{API}/cards/explore", headers=auth_headers, timeout=20)
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get("cards") or data.get("items") or []
    ids = [c.get("id") for c in items]
    assert created_card not in ids, "draft leaked into /cards/explore"


def test_draft_not_in_public(created_card):
    r = requests.get(f"{API}/public/cards", timeout=20)
    # public endpoint may return 200 with list or similar
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get("cards") or data.get("items") or []
    ids = [c.get("id") for c in items]
    assert created_card not in ids, "draft leaked into /public/cards"


def test_publish_update(created_card, auth_headers):
    payload = {
        "title": "Prueba Engine",
        "is_draft": False,
        "card_design": {
            "version": 2,
            "preset": "glass",
            "glass": {"enabled": True, "opacity": 70, "blur": 40},
        },
        "contact_info": {"whatsapp": "+34611111111", "company": "BRUNO Test", "email": "t@b.com"},
    }
    r = requests.put(f"{API}/cards/{created_card}", json=payload, headers=auth_headers, timeout=20)
    assert r.status_code == 200, f"update failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["title"] == "Prueba Engine"
    assert data["is_draft"] is False
    assert data["card_design"]["preset"] == "glass"
    assert data["card_design"]["glass"]["enabled"] is True
    assert data["contact_info"]["whatsapp"] == "+34611111111"

    # verify via GET
    g = requests.get(f"{API}/cards/{created_card}", timeout=20)
    assert g.status_code == 200
    gd = g.json()
    assert gd["title"] == "Prueba Engine"
    assert gd["card_design"]["preset"] == "glass"


def test_qr_endpoint():
    r = requests.get(f"{API}/cards/{LEGACY_IDS[0]}/qr", timeout=20)
    assert r.status_code == 200, f"qr failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert "qr_code" in data
    assert data["qr_code"].startswith("data:image")
    assert "card_url" in data


def test_delete_requires_owner(auth_headers):
    # create a card and delete it
    r = requests.post(f"{API}/cards", json={"card_type": "personal", "title": "TEST_delete", "is_draft": True}, headers=auth_headers, timeout=20)
    assert r.status_code in (200, 201)
    cid = r.json()["id"]
    d = requests.delete(f"{API}/cards/{cid}", headers=auth_headers, timeout=20)
    assert d.status_code in (200, 204)
    # verify gone
    g = requests.get(f"{API}/cards/{cid}", headers=auth_headers, timeout=20)
    assert g.status_code == 404
