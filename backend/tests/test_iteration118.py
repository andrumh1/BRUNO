"""Iteration 118 — stories with location (place) + saved places setup."""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
EMAIL = "newtest@bruno.com"
PASSWORD = "Test1234!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}"}


def test_create_story_with_location_then_located(h):
    payload = {
        "media_url": "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        "media_type": "image",
        "visibility": "public",
        "duration": 5,
        "location": {
            "lat": 4.6486,
            "lng": -74.0628,
            "name": "Café QA",
            "address": "Calle 63",
            "place_id": "osm-qa",
        },
    }
    r = requests.post(f"{BASE}/api/stories/", json=payload, headers=h)
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    assert sid

    try:
        g = requests.get(f"{BASE}/api/stories/located", headers=h)
        assert g.status_code == 200, g.text
        items = g.json()["stories"]
        hit = next((x for x in items if x["id"] == sid), None)
        assert hit, f"located missing story {sid}"
        assert hit["place_name"] == "Café QA"
        assert hit["lat"] == 4.6486
        assert hit["lng"] == -74.0628
    finally:
        d = requests.delete(f"{BASE}/api/stories/{sid}", headers=h)
        assert d.status_code == 200, d.text


def test_saved_place_setup_for_frontend(h):
    """Ensure the saved place exists; this is used by the FE camera flow."""
    body = {
        "place_id": "osm-qa-cafe",
        "name": "Café QA Chapinero",
        "category": "cafe",
        "category_label": "Cafetería",
        "address": "Calle 63, Chapinero",
        "lat": 4.6486,
        "lng": -74.0628,
    }
    r = requests.post(f"{BASE}/api/places/saved", json=body, headers=h)
    assert r.status_code in (200, 201, 409), r.text
    g = requests.get(f"{BASE}/api/places/saved", headers=h)
    assert g.status_code == 200, g.text
    ids = [x.get("place_id") for x in g.json().get("items", [])]
    assert "osm-qa-cafe" in ids
