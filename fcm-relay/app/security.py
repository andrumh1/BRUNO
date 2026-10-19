"""Seguridad del relay: firma Ed25519 por petición + anti-replay (Firestore o memoria)."""
import base64
import hashlib
import json
import os
import time
from typing import Dict, Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

REPLAY_WINDOW_S = int(os.environ.get("REPLAY_WINDOW_S", "300"))
MAX_BODY_BYTES = int(os.environ.get("MAX_BODY_BYTES", str(64 * 1024)))


def canonical(method: str, path: str, ts: str, nonce: str, body: bytes) -> bytes:
    return f"{method.upper()}\n{path}\n{ts}\n{nonce}\n{hashlib.sha256(body).hexdigest()}".encode()


def load_public_keys(raw: Optional[str]) -> Dict[str, Ed25519PublicKey]:
    """SIGNING_KEYS = {"k1": "<base64 raw 32 bytes>", "k2": "..."}: varias claves activas permiten rotar sin corte."""
    if not raw:
        return {}
    keys = {}
    for kid, b64 in json.loads(raw).items():
        keys[str(kid)] = Ed25519PublicKey.from_public_bytes(base64.b64decode(b64))
    return keys


class SignatureError(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def verify_request(keys: Dict[str, Ed25519PublicKey], *, key_id: str, ts: str, nonce: str, signature_b64: str, method: str, path: str, body: bytes, now: Optional[float] = None) -> None:
    """Falla cerrado: cualquier defecto → SignatureError. Se ejecuta ANTES de parsear el cuerpo."""
    if not key_id or key_id not in keys:
        raise SignatureError("unknown_key_id")
    try:
        ts_i = int(ts)
    except (TypeError, ValueError):
        raise SignatureError("bad_timestamp")
    now = now if now is not None else time.time()
    if abs(now - ts_i) > REPLAY_WINDOW_S:
        raise SignatureError("expired")
    if not nonce or not (16 <= len(nonce) <= 64) or not all(c.isalnum() or c in "-_" for c in nonce):
        raise SignatureError("bad_nonce")
    try:
        sig = base64.b64decode(signature_b64 or "", validate=True)
        keys[key_id].verify(sig, canonical(method, path, ts, nonce, body))
    except (InvalidSignature, ValueError, TypeError):
        raise SignatureError("invalid_signature")


class MemoryNonceStore:
    """Solo para pruebas / desarrollo local: la memoria es por instancia."""
    def __init__(self):
        self._seen: Dict[str, float] = {}

    async def claim(self, nonce: str, ttl_s: int) -> bool:
        now = time.time()
        for k, exp in list(self._seen.items()):
            if exp < now:
                self._seen.pop(k, None)
        if nonce in self._seen:
            return False
        self._seen[nonce] = now + ttl_s
        return True


class FirestoreNonceStore:
    """Anti-replay compartido entre instancias: `create()` es atómico → la segunda petición con el mismo nonce falla.
    Los documentos expiran con la política TTL de Firestore (campo `expires_at`), sin coste de borrado."""
    def __init__(self, project: str, collection: str = "fcm_relay_nonces"):
        from google.cloud import firestore  # import diferido: no requerido en tests
        self._db = firestore.AsyncClient(project=project)
        self._col = collection
        self._exc = __import__("google.api_core.exceptions", fromlist=["AlreadyExists"])

    async def claim(self, nonce: str, ttl_s: int) -> bool:
        from datetime import datetime, timedelta, timezone
        now = datetime.now(timezone.utc)
        try:
            await self._db.collection(self._col).document(nonce).create({"created_at": now, "expires_at": now + timedelta(seconds=ttl_s * 2)})
            return True
        except self._exc.AlreadyExists:
            return False


def build_nonce_store():
    mode = os.environ.get("NONCE_STORE", "firestore")
    if mode == "memory":
        return MemoryNonceStore()
    return FirestoreNonceStore(os.environ["GOOGLE_CLOUD_PROJECT"])
