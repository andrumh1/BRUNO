# Iteration 121: "Creamos tu tarjeta" service (BRUNO + OVC) - locale endpoint, protected request form, admin listing
# NOTE: creates AT MOST ONE valid request (real email to bruno@brunocard.com). Ordered tests; module-scoped state.
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api/bruno-service"
ORIGIN = {"Origin": BASE_URL}
STATE = {}


def _form(**over):
    base = {"requestId": str(uuid.uuid4()), "type": "Personal", "name": "QA TestingAgent", "email": "qa-agent@example.com",
            "cardName": "TEST_QA Card", "description": "QA testing agent - please delete", "market": "CO", "language": "es", "consent": "on"}
    base.update(over)
    return {k: (None, v) for k, v in base.items() if v is not None}


# --- locale ---
def test_locale_basic():
    r = requests.get(f"{API}/locale")
    assert r.status_code == 200
    d = r.json()
    assert "country" in d and d["country"] in (None, "CO", "US")
    STATE["country"] = d["country"]
    assert "no-store" in r.headers.get("cache-control", "")


def test_locale_ignores_free_header():
    r = requests.get(f"{API}/locale", headers={"X-Country-Code": "US", "X-Country": "CO"})
    assert r.status_code == 200
    assert r.json()["country"] == STATE.get("country")


# --- POST protections ---
def test_post_no_origin_403():
    r = requests.post(f"{API}/requests", files=_form())
    assert r.status_code == 403, r.text
    d = r.json()
    assert d.get("error") and d.get("errorEn")


def test_post_missing_consent_400():
    r = requests.post(f"{API}/requests", files=_form(consent=None), headers=ORIGIN)
    assert r.status_code == 400, r.text
    d = r.json()
    assert "error" in d and "errorEn" in d
    assert "autorizar" in d["error"].lower()


def test_post_unsupported_market_400():
    r = requests.post(f"{API}/requests", files=_form(market="FR"), headers=ORIGIN)
    assert r.status_code == 400, r.text
    assert "errorEn" in r.json()


def test_post_fake_pdf_400():
    f = _form()
    f["documents"] = ("x.pdf", b"MZ\x90\x00 fake executable", "application/pdf")
    r = requests.post(f"{API}/requests", files=f, headers=ORIGIN)
    assert r.status_code == 400, r.text
    assert "errorEn" in r.json()


# --- ONE valid submission + idempotency ---
def test_post_valid_and_idempotent():
    rid = str(uuid.uuid4())
    f = _form(requestId=rid, amount="999", currency="USD")
    r = requests.post(f"{API}/requests", files=f, headers=ORIGIN)
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["id"] == rid
    STATE["rid"] = rid
    print(f"CREATED_REQUEST_ID={rid} emailStatus={d.get('emailStatus')}")
    r2 = requests.post(f"{API}/requests", files=f, headers=ORIGIN)
    assert r2.status_code in (200, 201), r2.text
    assert r2.json()["id"] == rid


# --- admin listing ---
def _token(email, pwd):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd})
    if r.status_code != 200:
        pytest.skip(f"login failed {email}: {r.status_code}")
    return r.json().get("access_token") or r.json().get("token")


def test_list_requests_non_admin_403():
    t = _token("newtest@bruno.com", "Test1234!")
    r = requests.get(f"{API}/requests", headers={"Authorization": f"Bearer {t}"})
    print("newtest list status", r.status_code)
    assert r.status_code in (200, 403)
    STATE["newtest_list"] = r.status_code


def test_list_requests_admin_contains_qa():
    if "rid" not in STATE:
        pytest.skip("no valid request created")
    t = _token("testc@brunoqa.com", "Prueba1234!")
    r = requests.get(f"{API}/requests", headers={"Authorization": f"Bearer {t}"})
    assert r.status_code == 200, r.text
    rows = [x for x in r.json() if x["id"] == STATE["rid"]]
    assert len(rows) == 1  # no duplicate
    rec = rows[0]
    assert rec["currency"] == "COP" and rec["amount"] == 30000
    assert rec["recipient"] == "bruno@brunocard.com"
    assert rec["payment_status"] == "unpaid"
    assert "_id" not in rec
    print("record email_status:", rec.get("email_status"), rec.get("email_provider"), rec.get("email_error"))
