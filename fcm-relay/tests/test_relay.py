"""Pruebas del relay: firma inválida, replay, expiración, rotación de claves, errores FCM, validación y límites.
Ejecutar: cd /app/fcm-relay && RELAY_AUTOSTART=0 NONCE_STORE=memory python -m pytest -q
"""
import base64
import hashlib
import json
import os
import sys
import time
import uuid

os.environ.setdefault("RELAY_AUTOSTART", "0")
os.environ.setdefault("NONCE_STORE", "memory")
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient

from app.main import create_app
from app.security import MemoryNonceStore, load_public_keys


def keypair():
    pk = Ed25519PrivateKey.generate()
    pub = base64.b64encode(pk.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()
    return pk, pub


K1, PUB1 = keypair()
K2, PUB2 = keypair()
GOOD_TOKEN = "d" * 40
DEAD_TOKEN = "x" * 40


class FakeSender:
    def __init__(self, fail=False):
        self.fail = fail
        self.calls = []

    async def send(self, req):
        self.calls.append(req)
        if self.fail:
            raise RuntimeError("fcm down")
        invalid = [t for t in req.tokens if t == DEAD_TOKEN]
        return len(req.tokens) - len(invalid), len(invalid), invalid


def sign(pk, body: bytes, *, key_id="k1", ts=None, nonce=None, sig=None):
    ts = str(int(time.time())) if ts is None else str(ts)
    nonce = nonce or uuid.uuid4().hex
    canon = f"POST\n/v1/send\n{ts}\n{nonce}\n{hashlib.sha256(body).hexdigest()}".encode()
    s = sig if sig is not None else base64.b64encode(pk.sign(canon)).decode()
    return {"Content-Type": "application/json", "X-Bruno-Key-Id": key_id, "X-Bruno-Timestamp": ts, "X-Bruno-Nonce": nonce, "X-Bruno-Signature": s}


def payload(**over):
    p = {"request_id": uuid.uuid4().hex, "user_ref": hashlib.sha256(b"u1").hexdigest(), "tokens": [GOOD_TOKEN], "title": "Hola", "body": "Nuevo capítulo", "data": {"kind": "series_episode"}, "url": "/video/123?series=abc", "dry_run": True}
    p.update(over)
    return json.dumps(p, separators=(",", ":")).encode()


@pytest.fixture
def ctx():
    sender = FakeSender()
    app = create_app(sender=sender, nonce_store=MemoryNonceStore(), keys=load_public_keys(json.dumps({"k1": PUB1})))
    return TestClient(app), sender, app


def test_valid_request_is_sent(ctx):
    c, sender, _ = ctx
    body = payload()
    r = c.post("/v1/send", content=body, headers=sign(K1, body))
    assert r.status_code == 200 and r.json()["sent"] == 1 and r.json()["dry_run"] is True
    assert sender.calls[0].url == "/video/123?series=abc"


def test_invalid_signature_rejected_before_processing(ctx):
    c, sender, _ = ctx
    body = payload()
    bad = base64.b64encode(b"\x00" * 64).decode()
    r = c.post("/v1/send", content=body, headers=sign(K1, body, sig=bad))
    assert r.status_code == 401 and sender.calls == []


def test_tampered_body_rejected(ctx):
    c, sender, _ = ctx
    body = payload()
    h = sign(K1, body)
    r = c.post("/v1/send", content=payload(title="Otro"), headers=h)
    assert r.status_code == 401 and sender.calls == []


def test_unknown_key_id_rejected(ctx):
    c, sender, _ = ctx
    body = payload()
    r = c.post("/v1/send", content=body, headers=sign(K2, body, key_id="k2"))
    assert r.status_code == 401 and sender.calls == []


def test_expired_timestamp_rejected(ctx):
    c, sender, _ = ctx
    body = payload()
    r = c.post("/v1/send", content=body, headers=sign(K1, body, ts=int(time.time()) - 600))
    assert r.status_code == 401
    r = c.post("/v1/send", content=body, headers=sign(K1, body, ts=int(time.time()) + 600))
    assert r.status_code == 401 and sender.calls == []


def test_replay_rejected(ctx):
    c, sender, _ = ctx
    body = payload()
    h = sign(K1, body)
    assert c.post("/v1/send", content=body, headers=h).status_code == 200
    r = c.post("/v1/send", content=body, headers=h)
    assert r.status_code == 409 and len(sender.calls) == 1


def test_key_rotation_two_active_keys_then_retire():
    sender = FakeSender()
    app = create_app(sender=sender, nonce_store=MemoryNonceStore(), keys=load_public_keys(json.dumps({"k1": PUB1, "k2": PUB2})))
    c = TestClient(app)
    b1, b2 = payload(), payload()
    assert c.post("/v1/send", content=b1, headers=sign(K1, b1, key_id="k1")).status_code == 200
    assert c.post("/v1/send", content=b2, headers=sign(K2, b2, key_id="k2")).status_code == 200
    app.state.keys = load_public_keys(json.dumps({"k2": PUB2}))  # retirar k1
    b3 = payload()
    assert c.post("/v1/send", content=b3, headers=sign(K1, b3, key_id="k1")).status_code == 401
    b4 = payload()
    assert c.post("/v1/send", content=b4, headers=sign(K2, b4, key_id="k2")).status_code == 200


def test_fcm_dead_tokens_reported(ctx):
    c, _, _ = ctx
    body = payload(tokens=[GOOD_TOKEN, DEAD_TOKEN])
    r = c.post("/v1/send", content=body, headers=sign(K1, body))
    assert r.status_code == 200 and r.json()["invalid_tokens"] == [DEAD_TOKEN] and r.json()["failed"] == 1


def test_fcm_unavailable_returns_502():
    app = create_app(sender=FakeSender(fail=True), nonce_store=MemoryNonceStore(), keys=load_public_keys(json.dumps({"k1": PUB1})))
    c = TestClient(app)
    body = payload()
    assert c.post("/v1/send", content=body, headers=sign(K1, body)).status_code == 502


@pytest.mark.parametrize("over", [
    {"tokens": []}, {"tokens": ["short"]}, {"title": "x" * 101}, {"url": "https://evil.com/x"}, {"image": "https://evil.com/a.png"},
    {"extra": 1}, {"data": {str(i): "v" for i in range(21)}}, {"user_ref": "short"},
])
def test_strict_validation(ctx, over):
    c, sender, _ = ctx
    body = payload(**over)
    r = c.post("/v1/send", content=body, headers=sign(K1, body))
    assert r.status_code == 422 and sender.calls == []


def test_body_too_large(ctx):
    c, sender, _ = ctx
    body = payload(body="a" * 70000)
    assert c.post("/v1/send", content=body, headers=sign(K1, body)).status_code == 413 and sender.calls == []


def test_rate_limit(ctx, monkeypatch):
    c, _, app = ctx
    import app.main as m
    monkeypatch.setattr(m, "RATE_PER_MIN", 3)
    codes = []
    for _ in range(4):
        body = payload()
        codes.append(c.post("/v1/send", content=body, headers=sign(K1, body)).status_code)
    assert codes == [200, 200, 200, 429]


def test_nonce_store_failure_fails_closed():
    class Broken:
        async def claim(self, *a):
            raise ConnectionError("firestore down")
    sender = FakeSender()
    c = TestClient(create_app(sender=sender, nonce_store=Broken(), keys=load_public_keys(json.dumps({"k1": PUB1}))))
    body = payload()
    assert c.post("/v1/send", content=body, headers=sign(K1, body)).status_code == 503 and sender.calls == []


def test_backend_client_signature_is_accepted_by_relay(ctx):
    """El firmador real de BRUNO (backend/utils/fcm_relay.py) produce cabeceras que el relay acepta."""
    sys.path.insert(0, "/app/backend")
    from utils.fcm_relay import sign_headers
    c, sender, _ = ctx
    body = payload()
    assert c.post("/v1/send", content=body, headers=sign_headers(body, key_id="k1", private_key=K1)).status_code == 200
    assert len(sender.calls) == 1
