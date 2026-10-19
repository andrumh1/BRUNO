"""Cliente del relay FCM (Cloud Run). Firma cada petición con Ed25519; la clave privada vive solo en el entorno del backend."""
import base64
import hashlib
import json
import logging
import os
import time
import uuid
from typing import Dict, List, Optional

import httpx
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

logger = logging.getLogger("bruno.fcm_relay")
_key_cache: Dict[str, Ed25519PrivateKey] = {}


def relay_enabled() -> bool:
    return bool(os.environ.get("FCM_RELAY_URL") and os.environ.get("FCM_RELAY_PRIVATE_KEY") and os.environ.get("FCM_RELAY_KEY_ID"))


def _private_key() -> Ed25519PrivateKey:
    raw = os.environ["FCM_RELAY_PRIVATE_KEY"].strip()
    if raw not in _key_cache:
        pem = raw.replace("\\n", "\n").encode()
        _key_cache[raw] = serialization.load_pem_private_key(pem, password=None)
    return _key_cache[raw]


def canonical(method: str, path: str, ts: str, nonce: str, body: bytes) -> bytes:
    return f"{method.upper()}\n{path}\n{ts}\n{nonce}\n{hashlib.sha256(body).hexdigest()}".encode()


def sign_headers(body: bytes, path: str = "/v1/send", key_id: Optional[str] = None, private_key: Optional[Ed25519PrivateKey] = None, request_id: Optional[str] = None) -> Dict[str, str]:
    ts = str(int(time.time()))
    nonce = uuid.uuid4().hex
    pk = private_key or _private_key()
    sig = pk.sign(canonical("POST", path, ts, nonce, body))
    return {
        "Content-Type": "application/json",
        "X-Bruno-Key-Id": key_id or os.environ["FCM_RELAY_KEY_ID"],
        "X-Bruno-Timestamp": ts,
        "X-Bruno-Nonce": nonce,
        "X-Bruno-Signature": base64.b64encode(sig).decode(),
        "X-Bruno-Request-Id": request_id or nonce,
    }


def user_ref(user_id: str) -> str:
    return hashlib.sha256(f"bruno:{user_id}".encode()).hexdigest()


async def relay_send(user_id: str, tokens: List[str], title: str, body: str, data: Optional[dict] = None, url: Optional[str] = None, image: Optional[str] = None, dry_run: bool = False) -> dict:
    """Devuelve {"sent", "failed", "invalid_tokens"}; lanza httpx.HTTPError / RuntimeError si el relay no acepta la petición."""
    rid = uuid.uuid4().hex
    payload = {"request_id": rid, "user_ref": user_ref(user_id), "tokens": tokens[:500], "title": title[:100], "body": (body or "")[:500],
               "data": {str(k)[:40]: str(v)[:400] for k, v in (data or {}).items() if str(k).replace("_", "").isalnum()}, "url": url, "dry_run": dry_run}
    if image and image.startswith("https://res.cloudinary.com/"):
        payload["image"] = image
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
    headers = sign_headers(raw, request_id=rid)
    base = os.environ["FCM_RELAY_URL"].rstrip("/")
    async with httpx.AsyncClient(timeout=httpx.Timeout(12.0, connect=4.0)) as client:
        last = None
        for attempt in range(3):  # cold start / 503 del store de nonces → reintento con firma nueva
            r = await client.post(f"{base}/v1/send", content=raw, headers=headers)
            if r.status_code == 200:
                return r.json()
            last = r
            if r.status_code in (401, 409, 413, 422, 429):
                break
            headers = sign_headers(raw, request_id=rid)
            time.sleep(0.4 * (attempt + 1))
    raise RuntimeError(f"relay {last.status_code}: {last.text[:160]}")


def generate_keypair() -> dict:
    """Utilidad de operación (no se ejecuta en producción): par Ed25519 nuevo. Guarda la privada solo en secretos del backend."""
    pk = Ed25519PrivateKey.generate()
    priv = pk.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
    pub = base64.b64encode(pk.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()
    return {"private_pem_one_line": priv.replace("\n", "\\n"), "public_key_b64": pub}
