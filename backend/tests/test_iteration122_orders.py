# Iteration 122: «Creamos tu tarjeta» order flow — roles, webhooks, payment-status, client emails
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api/bruno-service"
STATE = {}


def _login(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"login failed {email}: {r.status_code}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def admin():
    return _login("testc@brunoqa.com", "Prueba1234!")


@pytest.fixture(scope="module")
def prod():
    return _login("viewer3@bruno.com", "Test1234!")


@pytest.fixture(scope="module")
def client():
    return _login("newtest@bruno.com", "Test1234!")


# --- roles ---
class TestRoles:
    def test_prod_access(self, prod):
        r = requests.get(f"{API}/me/access", headers=prod)
        assert r.status_code == 200
        assert r.json() == {"staff": True, "admin": False}

    def test_prod_list_orders(self, prod):
        r = requests.get(f"{API}/orders", headers=prod)
        assert r.status_code == 200 and isinstance(r.json(), list)
        assert all("_id" not in o for o in r.json())
        STATE["any_order"] = r.json()[0]["id"] if r.json() else None
        STATE["co_orders"] = [o["id"] for o in r.json() if o.get("market") == "CO"]

    def test_prod_cannot_reconcile(self, prod):
        oid = STATE.get("any_order") or str(uuid.uuid4())
        r = requests.post(f"{API}/orders/{oid}/payment", headers=prod, json={"status": "paid", "reference": "QA-NOPE"})
        assert r.status_code == 403

    def test_client_cannot_list(self, client):
        assert requests.get(f"{API}/orders", headers=client).status_code == 403

    def test_client_access_flags(self, client):
        assert requests.get(f"{API}/me/access", headers=client).json() == {"staff": False, "admin": False}

    def test_staff_endpoint_non_admin(self, prod, client):
        for h in (prod, client):
            r = requests.post(f"{API}/staff", headers=h, json={"email": "viewer2@bruno.com", "role": "produccion"})
            assert r.status_code == 403


# --- webhooks ---
class TestWebhooks:
    def test_wompi_missing_signature(self):
        r = requests.post(f"{API}/payments/wompi/webhook", json={"event": "transaction.updated", "data": {"transaction": {"id": "x"}}})
        assert r.status_code == 401

    def test_wompi_bad_signature(self):
        ev = {"event": "transaction.updated", "data": {"transaction": {"id": "x", "status": "APPROVED"}}, "timestamp": 1,
              "signature": {"properties": ["transaction.id"], "checksum": "deadbeef"}}
        r = requests.post(f"{API}/payments/wompi/webhook", json=ev, headers={"X-Event-Checksum": "deadbeef"})
        assert r.status_code == 401

    def test_stripe_invalid_signature(self):
        r = requests.post(f"{API}/payments/stripe/webhook", data=b'{"id":"evt_qa_%s","type":"checkout.session.completed","data":{"object":{"id":"cs_x","metadata":{"kind":"bruno_service"}}}}' % uuid.uuid4().hex.encode(),
                          headers={"Stripe-Signature": "t=1,v1=bad", "Content-Type": "application/json"})
        assert r.status_code == 400, f"got {r.status_code}: {r.text[:200]}"


# --- US order with deliverable email, unpaid stripe session must not mark paid ---
class TestPaymentStatus:
    def test_create_us_order(self, client):
        rid = str(uuid.uuid4())
        data = {"requestId": rid, "type": "Personal", "name": "QA Iter122", "email": "delivered@resend.dev", "cardName": "QA Iter122 Card",
                "description": "qa", "consent": "on", "market": "US", "language": "en"}
        r = requests.post(f"{API}/requests", headers={**client, "Origin": BASE_URL}, files={k: (None, v) for k, v in data.items()})
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["id"] == rid and d["payAvailable"] is True and d["orderUrl"] == f"/pedido/{rid}"
        STATE["rid"] = rid
        print("CREATED ORDER", rid, "emailStatus", d.get("emailStatus"))

    def test_checkout_and_unpaid_session(self):
        rid = STATE["rid"]
        r = requests.post(f"{API}/orders/{rid}/checkout", headers={"Origin": BASE_URL})
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("https://checkout.stripe.com/")
        sid = url.split("/pay/")[1].split("#")[0]
        assert sid.startswith("cs_test_")
        r = requests.get(f"{API}/orders/{rid}/payment-status", params={"session_id": sid})
        assert r.status_code == 200
        assert r.json()["payment_status"] in ("pending", "unpaid")
        assert r.json()["production_status"] == "pending_payment"

    def test_fake_session_not_paid(self):
        rid = STATE["rid"]
        r = requests.get(f"{API}/orders/{rid}/payment-status", params={"session_id": "cs_test_fake123"})
        assert r.status_code == 200 and r.json()["payment_status"] != "paid"

    def test_client_emails_accepted(self, admin):
        d = requests.get(f"{API}/orders/{STATE['rid']}", headers=admin).json()
        assert d["user_id"], "order should be bound to logged-in newtest"
        emails = d.get("client_emails", [])
        print("client_emails", emails)
        assert any(e["kind"] == "confirmation" and e["status"] == "accepted" for e in emails)

    def test_send_review_email_accepted(self, admin):
        rid = STATE["rid"]
        assert requests.post(f"{API}/orders/{rid}/card", headers=admin).status_code == 200
        cid = requests.get(f"{API}/orders/{rid}", headers=admin).json()["card_id"]
        STATE["card"] = cid
        r = requests.post(f"{API}/orders/{rid}/send-review", headers=admin, json={"note": "QA v1"})
        assert r.status_code == 200
        assert r.json()["email_status"] == "accepted"
        STATE["review_url"] = r.json()["review_url"]
        print("REVIEW_URL", STATE["review_url"])
        with open("/tmp/iter122_state.txt", "w") as f:
            f.write(f"{rid}\n{STATE['review_url']}\n{cid}\n")

    def test_co_checkout_503(self, admin):
        co = STATE.get("co_orders") or []
        if not co:
            pytest.skip("no CO order in DB")
        r = requests.post(f"{API}/orders/{co[0]}/checkout", headers={"Origin": BASE_URL})
        assert r.status_code in (503, 409), r.text
        if r.status_code == 503:
            assert "Colombia" in str(r.json())

    def test_invalid_review_token(self):
        assert requests.get(f"{API}/review/garbage-token-xyz").status_code == 404

    def test_review_send_code_not_applicable(self, client):
        tok = STATE["review_url"].rsplit("/", 1)[1]
        r = requests.post(f"{API}/review/{tok}/verify-code", headers=client, json={"code": "000000"})
        assert r.status_code == 409  # bound user → verify step not applicable
