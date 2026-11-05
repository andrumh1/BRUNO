# Smart cards (event cards) module: settings, events, publish/grant, public views, invitations, album, connections, checkout, admin settings
import base64
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/smart"
ADMIN = ("testc@brunoqa.com", "Prueba1234!")
ORG = ("newtest@bruno.com", "Test1234!")
GUEST = ("viewer3@bruno.com", "Test1234!")
GUEST2 = ("viewer2@bruno.com", "Test1234!")
ORG_CARD = "d16c2745-e082-4b22-84f8-749beb5e33fd"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
STATE = {}


def _login(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    if r.status_code != 200:
        pytest.skip(f"login failed {email}: {r.status_code} {r.text[:100]}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def H():
    h = {"admin": _login(*ADMIN), "org": _login(*ORG), "guest": _login(*GUEST), "guest2": _login(*GUEST2)}
    yield h
    # cleanup: photos, invitations, ensure payments disabled
    eid = STATE.get("eid")
    for pid in STATE.get("photos", []):
        requests.delete(f"{API}/events/{eid}/photos/{pid}", headers=h["org"])
    for iid in STATE.get("invs", []):
        requests.delete(f"{API}/events/{eid}/invitations/{iid}", headers=h["org"])
    requests.put(f"{API}/admin/settings", json={"activation": {"payments_enabled": False}}, headers=h["admin"])


def _guest_card(h):
    r = requests.get(f"{BASE_URL}/api/cards", headers=h)
    cards = r.json() if r.status_code == 200 else []
    if isinstance(cards, dict):
        cards = cards.get("items") or cards.get("cards") or []
    return cards[0]["id"] if cards else None


class TestSmartCards:
    def test_01_public_settings(self):
        r = requests.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        assert d["activation"]["payments_enabled"] is False
        assert d["activation"]["prices"] == {"US": 9.99, "CO": 39900}
        assert d["storage"] == {"included_bytes": 1073741824, "max_photos": 500, "max_file_bytes": 15728640, "retention_days": 730}
        assert len(d["packs"]) == 2
        assert d["templates"]["items"] == []
        assert len(d["future_products"]) == 7 and all(not f["enabled"] for f in d["future_products"])

    def test_02_admin_settings_rbac(self, H):
        assert requests.get(f"{API}/admin/settings", headers=H["org"]).status_code == 403
        assert requests.put(f"{API}/admin/settings", json={}, headers=H["org"]).status_code == 403
        r = requests.get(f"{API}/admin/settings", headers=H["admin"])
        assert r.status_code == 200 and "history" in r.json()
        STATE["hist"] = len(r.json()["history"])
        fp = r.json()["future_products"]
        bad = [dict(f) for f in fp]; bad[0]["enabled"] = True
        r = requests.put(f"{API}/admin/settings", json={"future_products": bad}, headers=H["admin"])
        assert r.status_code == 400

    def test_03_create_event(self, H):
        assert requests.post(f"{API}/events", json={"title": "QA x"}).status_code in (401, 403)
        r = requests.post(f"{API}/events", json={"title": "QA Smart Event pytest", "market": "US", "organizer_card_id": ORG_CARD, "location": "Bogotá"}, headers=H["org"])
        assert r.status_code == 200, r.text
        e = r.json()
        assert e["status"] == "draft" and e["activation"]["status"] == "pending" and e["activation"]["price"] == 9.99
        assert e["storage"]["total_photos"] == 500 and e["storage"]["used_bytes"] == 0
        STATE["eid"] = e["id"]
        mine = requests.get(f"{API}/events/mine", headers=H["org"]).json()
        assert any(x["id"] == e["id"] for x in mine)

    def test_04_create_event_foreign_card_403(self, H):
        r = requests.post(f"{API}/events", json={"title": "QA bad", "organizer_card_id": ORG_CARD}, headers=H["guest"])
        assert r.status_code == 403

    def test_05_update_event(self, H):
        eid = STATE["eid"]
        r = requests.put(f"{API}/events/{eid}", json={"title": "QA Smart Event pytest (edit)", "organizer_card_id": ORG_CARD, "location": "Medellín"}, headers=H["org"])
        assert r.status_code == 200 and r.json()["title"].endswith("(edit)") and r.json()["location"] == "Medellín"
        assert requests.put(f"{API}/events/{eid}", json={"title": "hack"}, headers=H["guest"]).status_code == 403

    def test_06_draft_public_hidden(self, H):
        eid = STATE["eid"]
        assert requests.get(f"{API}/events/{eid}/public").status_code == 404
        assert requests.get(f"{API}/events/{eid}/public", headers=H["guest"]).status_code == 404
        r = requests.get(f"{API}/events/{eid}/public", headers=H["org"])
        assert r.status_code == 200 and r.json()["viewer"]["is_owner"] is True

    def test_07_checkout_disabled(self, H):
        r = requests.post(f"{API}/events/{STATE['eid']}/checkout", json={"kind": "activation"}, headers=H["org"])
        assert r.status_code == 503 and r.json()["detail"]["code"] == "payments_disabled"

    def test_08_publish_requires_activation(self, H):
        eid = STATE["eid"]
        r = requests.post(f"{API}/events/{eid}/publish", headers=H["org"])
        assert r.status_code == 402 and r.json()["detail"]["code"] == "activation_required"
        assert requests.post(f"{API}/admin/events/{eid}/grant", headers=H["org"]).status_code == 403
        r = requests.post(f"{API}/admin/events/{eid}/grant", headers=H["admin"])
        assert r.status_code == 200 and r.json()["status"] == "granted"
        r = requests.post(f"{API}/events/{eid}/publish", headers=H["org"])
        assert r.status_code == 200 and r.json()["status"] == "active"

    def test_09_public_anonymous(self, H):
        r = requests.get(f"{API}/events/{STATE['eid']}/public")
        assert r.status_code == 200
        d = r.json()
        for k in ("event", "photos", "going", "connections", "join_benefits"):
            assert k in d
        roles = [c["role"] for c in d["connections"]]
        assert "organizer" in roles and d["connections"][0]["id"] == ORG_CARD
        print("connections:", [(c["role"], c.get("title")) for c in d["connections"]])

    def test_10_invitations(self, H):
        eid = STATE["eid"]
        assert requests.post(f"{API}/events/{eid}/invitations", json={"guest_name": "x"}, headers=H["guest"]).status_code == 403
        r = requests.post(f"{API}/events/{eid}/invitations", json={"guest_name": "TEST_Guest", "message": "Ven!", "seats": 2}, headers=H["org"])
        assert r.status_code == 200 and r.json()["url"].endswith(f"/e/{eid}/i/{r.json()['id']}")
        iid = r.json()["id"]; STATE.setdefault("invs", []).append(iid)
        r = requests.get(f"{API}/invitations/{iid}/public")
        assert r.status_code == 200 and r.json()["viewer"]["can_respond"] is False and r.json()["invitation"]["guest_name"] == "TEST_Guest"
        assert requests.post(f"{API}/invitations/{iid}/respond", json={"rsvp": "yes"}).status_code in (401, 403)
        # foreign card -> 403
        assert requests.post(f"{API}/invitations/{iid}/respond", json={"card_id": ORG_CARD}, headers=H["guest"]).status_code == 403
        for v in ("maybe", "no", "yes"):
            r = requests.post(f"{API}/invitations/{iid}/respond", json={"rsvp": v}, headers=H["guest"])
            assert r.status_code == 200 and r.json()["rsvp"] == v
        card = _guest_card(H["guest"])
        if card:
            r = requests.post(f"{API}/invitations/{iid}/respond", json={"card_id": card, "show_card": True}, headers=H["guest"])
            assert r.status_code == 200 and r.json()["linked_card_id"] == card
        r = requests.get(f"{API}/invitations/{iid}/public", headers=H["guest"])
        assert r.json()["viewer"]["can_respond"] is True and r.json()["invitation"]["is_mine"] is True
        r = requests.post(f"{API}/invitations/{iid}/respond", json={"rsvp": "no"}, headers=H["guest2"])
        assert r.status_code == 409
        r = requests.get(f"{API}/invitations/{iid}/public", headers=H["guest2"])
        assert r.json()["viewer"]["can_respond"] is False
        assert requests.get(f"{API}/events/{eid}/public").json()["going"] >= 1

    def test_11_organizer_notified(self, H):
        r = requests.get(f"{BASE_URL}/api/notifications", headers=H["org"])
        assert r.status_code == 200
        items = r.json() if isinstance(r.json(), list) else (r.json().get("notifications") or r.json().get("items") or [])
        assert any("TEST_Guest" in str(n) for n in items[:30]), str(items[:3])[:300]

    def test_12_album(self, H):
        eid = STATE["eid"]
        f = {"file": ("t.png", PNG, "image/png")}
        assert requests.post(f"{API}/events/{eid}/photos", files=f).status_code in (401, 403)
        r = requests.post(f"{API}/events/{eid}/photos", files={"file": ("t.txt", b"hi", "text/plain")}, headers=H["guest"])
        assert r.status_code == 400
        big = b"\x89PNG" + b"0" * (15 * 1024 * 1024 + 10)
        r = requests.post(f"{API}/events/{eid}/photos", files={"file": ("b.png", big, "image/png")}, headers=H["guest"])
        assert r.status_code == 413
        r = requests.post(f"{API}/events/{eid}/photos", files={"file": ("t.png", PNG, "image/png")}, data={"caption": "TEST_pic"}, headers=H["guest"])
        assert r.status_code == 200, r.text
        ph = r.json(); STATE.setdefault("photos", []).append(ph["id"])
        assert ph["url"].startswith("https://") and ph["bytes"] > 0
        m = requests.get(f"{API}/events/{eid}/manage", headers=H["org"]).json()
        assert m["storage"]["photo_count"] == 1 and m["storage"]["used_bytes"] == ph["bytes"]
        assert any(p["id"] == ph["id"] for p in requests.get(f"{API}/events/{eid}/public").json()["photos"])
        assert requests.delete(f"{API}/events/{eid}/photos/{ph['id']}", headers=H["guest2"]).status_code == 403
        assert requests.delete(f"{API}/events/{eid}/photos/{ph['id']}", headers=H["guest"]).status_code == 200
        STATE["photos"].remove(ph["id"])
        m = requests.get(f"{API}/events/{eid}/manage", headers=H["org"]).json()
        assert m["storage"]["photo_count"] == 0 and m["storage"]["used_bytes"] == 0
        # owner deletes guest photo
        r = requests.post(f"{API}/events/{eid}/photos", files={"file": ("t.png", PNG, "image/png")}, headers=H["guest"])
        assert r.status_code == 200
        assert requests.delete(f"{API}/events/{eid}/photos/{r.json()['id']}", headers=H["org"]).status_code == 200

    def test_13_card_connections(self):
        r = requests.get(f"{API}/cards/{ORG_CARD}/connections")
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(i["type"] == "event" and i["id"] == STATE["eid"] for i in items)
        assert requests.get(f"{API}/cards/nonexistent/connections").json() == {"items": []}

    def test_14_checkout_enabled(self, H):
        r = requests.put(f"{API}/admin/settings", json={"activation": {"payments_enabled": True}}, headers=H["admin"])
        assert r.status_code == 200 and r.json()["activation"]["payments_enabled"] is True and r.json()["activation"]["prices"]["US"] == 9.99
        try:
            # US draft event (new) -> stripe url
            e = requests.post(f"{API}/events", json={"title": "QA US checkout", "market": "US"}, headers=H["org"]).json()
            r = requests.post(f"{API}/events/{e['id']}/checkout", json={"kind": "activation"}, headers=H["org"])
            assert r.status_code == 200, r.text
            assert r.json()["provider"] == "stripe" and "checkout.stripe.com" in r.json()["url"]
            r = requests.post(f"{API}/events/{e['id']}/checkout", json={"kind": "storage_pack", "pack_id": "nope"}, headers=H["org"])
            assert r.status_code == 404
            r = requests.post(f"{API}/events/{e['id']}/checkout", json={"kind": "activation"}, headers=H["guest"])
            assert r.status_code == 403
            # already granted event -> 409
            r = requests.post(f"{API}/events/{STATE['eid']}/checkout", json={"kind": "activation"}, headers=H["org"])
            assert r.status_code == 409
            co = requests.post(f"{API}/events", json={"title": "QA CO checkout", "market": "CO"}, headers=H["org"]).json()
            assert co["activation"]["currency"] == "COP" and co["activation"]["price"] == 39900
            r = requests.post(f"{API}/events/{co['id']}/checkout", json={"kind": "activation"}, headers=H["org"])
            assert r.status_code == 503 and r.json()["detail"]["code"] == "provider_unavailable"
        finally:
            r = requests.put(f"{API}/admin/settings", json={"activation": {"payments_enabled": False}}, headers=H["admin"])
            assert r.json()["activation"]["payments_enabled"] is False
        h = requests.get(f"{API}/admin/settings", headers=H["admin"]).json()["history"]
        assert len(h) >= min(50, STATE["hist"] + 2)
        assert requests.get(f"{API}/settings").json()["activation"]["payments_enabled"] is False
