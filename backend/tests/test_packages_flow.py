# Packages «perfil completo + 3 tarjetas»: ownership, revoke/regenerate links, US Stripe checkout, permissions
import os
import re
import pytest
import requests

def _base():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if not v:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL="):
                v = line.split("=", 1)[1].strip()
    return v.rstrip("/")

BASE_URL = _base()
CREATED = []


def login(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def H():
    return {
        "adv": login("viewer3@bruno.com", "Test1234!"),
        "admin": login("testc@brunoqa.com", "Prueba1234!"),
        "cli": login("newtest@bruno.com", "Test1234!"),
        "other": login("viewer2@bruno.com", "Test1234!"),
    }


def make_pkg(H, market="CO", method="cash"):
    p = requests.post(f"{BASE_URL}/api/packages", headers=H["adv"]).json()
    CREATED.append(p["id"])
    requests.patch(f"{BASE_URL}/api/packages/{p['id']}", headers=H["adv"], json={"client": {"name": "TEST_Cliente Pytest", "bio": "TEST bio"}})
    for i, cid in enumerate(p["card_ids"]):
        r = requests.put(f"{BASE_URL}/api/cards/{cid}", headers=H["adv"], json={"title": f"TEST card {i}"})
        assert r.status_code == 200, r.text
    handle = requests.get(f"{BASE_URL}/api/packages/me/access", headers=H["adv"]).json()["handle"]
    f = requests.post(f"{BASE_URL}/api/packages/{p['id']}/finalize", headers=H["adv"], json={"advisor_handle": "@" + handle, "market": market, "payment_method": method})
    assert f.status_code == 200, f.text
    return p, f.json()


def tok(url):
    return url.rstrip("/").split("/")[-1]


# Full cash flow: card ownership verified by ids
def test_cash_flow_cards_owned_by_client(H):
    p, f = make_pkg(H)
    t = tok(f["claim_url"])
    acc = requests.get(f"{BASE_URL}/api/packages/claim/{t}", headers=H["cli"]).json()
    r = requests.post(f"{BASE_URL}/api/packages/claim/{t}/accept", headers=H["cli"], json={"profile_fields": ["bio"], "confirm_handle": "@" + acc["account"]["handle"]})
    assert r.status_code == 200 and r.json()["payment_status"] == "pending"
    c = requests.post(f"{BASE_URL}/api/packages/{p['id']}/cash-confirm", headers=H["adv"], json={"amount_received": 30000, "currency": "COP", "receipt_ref": "R-PYT"})
    assert c.status_code == 200 and c.json()["delivery_status"] == "activated"
    cli_ids = {x["id"] for x in requests.get(f"{BASE_URL}/api/cards", headers=H["cli"]).json()}
    adv_ids = {x["id"] for x in requests.get(f"{BASE_URL}/api/cards", headers=H["adv"]).json()}
    assert set(p["card_ids"]) <= cli_ids
    assert not (set(p["card_ids"]) & adv_ids)
    # reuse link after activation
    assert requests.get(f"{BASE_URL}/api/packages/claim/{t}", headers=H["cli"]).json()["state"] == "review"
    assert requests.get(f"{BASE_URL}/api/packages/claim/{t}", headers=H["cli"]).json()["delivery_status"] == "activated"
    assert requests.get(f"{BASE_URL}/api/packages/claim/{t}", headers=H["other"]).json()["state"] == "claimed_by_other"
    # cards hidden from advisor before activation are not in advisor list (checked above)


# Hidden cards not listed for the advisor while draft
def test_hidden_cards_not_in_advisor_list(H):
    p = requests.post(f"{BASE_URL}/api/packages", headers=H["adv"]).json()
    CREATED.append(p["id"])
    adv_ids = {x["id"] for x in requests.get(f"{BASE_URL}/api/cards", headers=H["adv"]).json()}
    assert not (set(p["card_ids"]) & adv_ids)


# Revoke / regenerate
def test_revoke_and_regenerate(H):
    p, f = make_pkg(H)
    old = tok(f["claim_url"])
    assert requests.get(f"{BASE_URL}/api/packages/claim/{old}").status_code == 200
    r = requests.post(f"{BASE_URL}/api/packages/{p['id']}/claim-link?revoke_only=true", headers=H["adv"])
    assert r.status_code == 200 and r.json()["claim_url"] is None
    g = requests.get(f"{BASE_URL}/api/packages/claim/{old}")
    print("revoked:", g.status_code, g.text)
    assert g.status_code == 410 and g.json()["detail"]["state"] == "revoked"
    r = requests.post(f"{BASE_URL}/api/packages/{p['id']}/claim-link", headers=H["adv"])
    assert r.status_code == 200 and "/paquete/" in r.json()["claim_url"]
    new = tok(r.json()["claim_url"])
    assert new != old
    assert requests.get(f"{BASE_URL}/api/packages/claim/{new}").status_code == 200
    g = requests.get(f"{BASE_URL}/api/packages/claim/{old}")
    print("old after regenerate:", g.status_code, g.text)
    assert g.status_code == 410, f"old link after regenerate returned {g.status_code} {g.text}"


# US Stripe checkout (no real payment)
def test_us_virtual_stripe(H):
    p, f = make_pkg(H, market="US", method="virtual")
    assert f["currency"] == "USD" and f["amount"] == 30
    t = tok(f["claim_url"])
    acc = requests.get(f"{BASE_URL}/api/packages/claim/{t}", headers=H["cli"]).json()
    assert acc["provider_ready"] is True
    r = requests.post(f"{BASE_URL}/api/packages/claim/{t}/accept", headers=H["cli"], json={"profile_fields": [], "confirm_handle": "@" + acc["account"]["handle"]})
    assert r.status_code == 200
    c = requests.post(f"{BASE_URL}/api/packages/{p['id']}/checkout", headers={**H["cli"], "Origin": BASE_URL})
    assert c.status_code == 200, c.text
    d = c.json()
    assert d["provider"] == "stripe" and "checkout.stripe.com" in d["url"]
    m = re.search(r"(cs_test_[A-Za-z0-9]+)", d["url"])
    assert m
    s = requests.get(f"{BASE_URL}/api/packages/{p['id']}/payment-status", params={"session_id": m.group(1)}, headers=H["cli"]).json()
    assert s["payment_status"] == "processing" and s["card_ids"] == []
    s = requests.get(f"{BASE_URL}/api/packages/{p['id']}/payment-status", params={"cancel": 1}, headers=H["cli"]).json()
    assert s["payment_status"] == "pending"
    # other user cannot query
    assert requests.get(f"{BASE_URL}/api/packages/{p['id']}/payment-status", headers=H["other"]).status_code == 403
    # bad origin
    assert requests.post(f"{BASE_URL}/api/packages/{p['id']}/checkout", headers={**H["cli"], "Origin": "https://evil.example.com"}).status_code == 403


# Permissions
def test_permissions(H):
    assert requests.post(f"{BASE_URL}/api/packages/staff", headers=H["adv"], json={"email": "viewer2@bruno.com", "role": "asesor"}).status_code == 403
    assert requests.post(f"{BASE_URL}/api/packages", headers=H["cli"]).status_code == 403
    p = requests.post(f"{BASE_URL}/api/packages", headers=H["adv"]).json()
    CREATED.append(p["id"])
    assert requests.post(f"{BASE_URL}/api/packages/{p['id']}/reassign", headers=H["adv"], json={"advisor_email": "viewer3@bruno.com", "reason": "QA"}).status_code == 403
    r = requests.post(f"{BASE_URL}/api/packages/{p['id']}/reassign", headers=H["admin"], json={"advisor_email": "viewer3@bruno.com", "reason": "QA"})
    assert r.status_code == 200
    hist = [h["action"] for h in requests.get(f"{BASE_URL}/api/packages/{p['id']}", headers=H["admin"]).json()["history"]]
    assert "reassigned" in hist
    # other advisor/cash collector (non-owner) cannot cash-confirm; client cannot
    assert requests.post(f"{BASE_URL}/api/packages/{p['id']}/cash-confirm", headers=H["cli"], json={"amount_received": 30000, "currency": "COP", "receipt_ref": "R-1"}).status_code == 403


def test_zz_print_created():
    print("CREATED PACKAGES:", CREATED)
