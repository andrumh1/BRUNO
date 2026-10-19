"""BRUNO · FCM relay (Cloud Run). Un endpoint: POST /v1/send. La firma Ed25519 se verifica antes de leer el cuerpo."""
import json
import logging
import os
import sys
import time
import uuid
from collections import defaultdict

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .models import SendRequest, SendResponse
from .security import MAX_BODY_BYTES, REPLAY_WINDOW_S, SignatureError, build_nonce_store, load_public_keys, verify_request

logging.basicConfig(stream=sys.stdout, level=logging.INFO, format="%(message)s")
log = logging.getLogger("fcm-relay")

RATE_PER_MIN = int(os.environ.get("RATE_LIMIT_PER_MIN", "600"))
TOKENS_PER_MIN = int(os.environ.get("TOKENS_LIMIT_PER_MIN", "20000"))


def jlog(event: str, **kw):
    log.info(json.dumps({"event": event, "severity": kw.pop("severity", "INFO"), **kw}))


class Bucket:
    """Token bucket por key_id (protege FCM y el coste aunque la clave se filtre)."""
    def __init__(self):
        self.reqs = defaultdict(list)
        self.toks = defaultdict(list)

    def allow(self, key_id: str, n_tokens: int) -> bool:
        now = time.time()
        for store in (self.reqs, self.toks):
            store[key_id] = [(t, n) for t, n in store[key_id] if now - t < 60]
        if len(self.reqs[key_id]) >= RATE_PER_MIN or sum(n for _, n in self.toks[key_id]) + n_tokens > TOKENS_PER_MIN:
            return False
        self.reqs[key_id].append((now, 1)); self.toks[key_id].append((now, n_tokens))
        return True


def create_app(sender=None, nonce_store=None, keys=None) -> FastAPI:
    app = FastAPI(title="BRUNO FCM relay", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.keys = keys if keys is not None else load_public_keys(os.environ.get("SIGNING_KEYS"))
    app.state.nonces = nonce_store or build_nonce_store()
    app.state.bucket = Bucket()
    app.state.sender = sender  # perezoso: se crea en la primera petición válida

    @app.get("/healthz")
    async def healthz():
        return {"ok": True, "keys": sorted(app.state.keys.keys())}

    @app.post("/v1/send", response_model=SendResponse)
    async def send(request: Request):
        rid = request.headers.get("x-bruno-request-id") or uuid.uuid4().hex
        key_id = request.headers.get("x-bruno-key-id", "")
        ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "")
        cl = request.headers.get("content-length")
        if cl and int(cl) > MAX_BODY_BYTES:
            jlog("body_too_large", request_id=rid, key_id=key_id, ip=ip, severity="WARNING")
            return JSONResponse({"detail": "body too large"}, status_code=413)
        body = await request.body()
        if len(body) > MAX_BODY_BYTES:
            return JSONResponse({"detail": "body too large"}, status_code=413)
        # 1) firma (antes de cualquier parseo)
        try:
            verify_request(app.state.keys, key_id=key_id, ts=request.headers.get("x-bruno-timestamp", ""), nonce=request.headers.get("x-bruno-nonce", ""),
                           signature_b64=request.headers.get("x-bruno-signature", ""), method="POST", path="/v1/send", body=body)
        except SignatureError as e:
            jlog("signature_rejected", request_id=rid, key_id=key_id, ip=ip, reason=e.reason, severity="WARNING")
            return JSONResponse({"detail": "unauthorized"}, status_code=401)
        # 2) anti-replay compartido (Firestore)
        try:
            fresh = await app.state.nonces.claim(request.headers["x-bruno-nonce"], REPLAY_WINDOW_S)
        except Exception as e:  # noqa: BLE001 — fail closed
            jlog("nonce_store_error", request_id=rid, key_id=key_id, error=type(e).__name__, severity="ERROR")
            return JSONResponse({"detail": "nonce store unavailable"}, status_code=503)
        if not fresh:
            jlog("replay_rejected", request_id=rid, key_id=key_id, ip=ip, severity="WARNING")
            return JSONResponse({"detail": "replay"}, status_code=409)
        # 3) esquema estricto
        try:
            req = SendRequest.model_validate_json(body)
        except ValidationError as e:
            jlog("invalid_request", request_id=rid, key_id=key_id, errors=[x["loc"] for x in e.errors()][:5], severity="WARNING")
            return JSONResponse({"detail": "invalid request", "errors": [{"loc": x["loc"], "msg": x["msg"]} for x in e.errors()][:5]}, status_code=422)
        # 4) límites de frecuencia
        if not app.state.bucket.allow(key_id, len(req.tokens)):
            jlog("rate_limited", request_id=req.request_id, key_id=key_id, severity="WARNING")
            return JSONResponse({"detail": "rate limited"}, status_code=429, headers={"Retry-After": "30"})
        # 5) envío
        if app.state.sender is None:
            from .fcm import FcmSender
            app.state.sender = FcmSender()
        t0 = time.time()
        try:
            sent, failed, invalid = await app.state.sender.send(req)
        except Exception as e:  # noqa: BLE001
            jlog("fcm_unavailable", request_id=req.request_id, key_id=key_id, error=type(e).__name__, severity="ERROR")
            return JSONResponse({"detail": "fcm unavailable"}, status_code=502)
        jlog("sent", request_id=req.request_id, key_id=key_id, user_ref=req.user_ref[:16], tokens=len(req.tokens), sent=sent, failed=failed,
             invalid=len(invalid), dry_run=req.dry_run, ms=int((time.time() - t0) * 1000))
        return SendResponse(request_id=req.request_id, sent=sent, failed=failed, invalid_tokens=invalid, dry_run=req.dry_run)

    return app


app = create_app() if os.environ.get("RELAY_AUTOSTART", "1") == "1" else None
