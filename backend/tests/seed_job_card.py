"""Seed helper: creates a TEST_ job-type card with banner + gallery photos so the
BannerCarousel dots (multi-slide) can be exercised in the UI. Prints the card id."""
import os
import sys
import requests
from dotenv import dotenv_values

env = dotenv_values("/app/frontend/.env")
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or env.get("REACT_APP_BACKEND_URL")).rstrip("/")
EMAIL = "newtest@bruno.com"
PASSWORD = "Test1234!"

s = requests.Session()
r = s.post(f"{BASE}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
print("login", r.status_code)
r.raise_for_status()
token = r.json().get("access_token") or r.json().get("token")
s.headers.update({"Authorization": f"Bearer {token}"})

if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
    cards = s.get(f"{BASE}/api/cards").json()
    for c in cards if isinstance(cards, list) else cards.get("cards", []):
        if str(c.get("title", "")).startswith("TEST_JOB"):
            d = s.delete(f"{BASE}/api/cards/{c['id']}")
            print("deleted", c["id"], d.status_code)
    sys.exit(0)

payload = {
    "card_type": "oferta_trabajo",
    "title": "TEST_JOB Carousel Card",
    "subtitle": "QA carousel",
    "description": "Seed card for BannerCarousel dots test",
    "banner_url": "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800",
    "gallery_photos": [
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800",
        "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800",
    ],
    "is_public": True,
    "show_in_feed": True,
    "custom_fields": {"urgency": "alta"},
}
r = s.post(f"{BASE}/api/cards", json=payload)
print("create", r.status_code, r.text[:400])
r.raise_for_status()
card = r.json()
print("CARD_ID", card["id"])
got = s.get(f"{BASE}/api/cards/{card['id']}").json()
assert got["card_type"] == "oferta_trabajo"
assert len(got["gallery_photos"]) == 2
print("persisted OK", got["title"], got["gallery_photos"])
