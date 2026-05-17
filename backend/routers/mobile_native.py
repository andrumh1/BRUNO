"""Mobile-native API surface.

Three pillars for native client consumption (React Native / Flutter):

1. PUSH NOTIFICATIONS ARCHITECTURE
   - Register / unregister mobile device tokens (FCM Android / APNs iOS / Expo).
   - Per-device metadata (platform, model, locale, app version).
   - Test endpoint to send a notification to a single device.

2. BIOMETRIC SECURITY (FaceID / Fingerprint)
   - Public-key challenge/response on top of the existing JWT.
   - Client generates an asymmetric keypair in the secure enclave, keeps the
     private key behind biometrics, and registers the public key with the
     server (authenticated, one-time during enrollment).
   - To re-authenticate via biometrics the client requests a challenge,
     signs it locally (after FaceID/Fingerprint unlocks the key), and the
     server verifies the signature and returns a fresh JWT + refresh token.

3. OFFLINE MODE — CATALOG SYNC
   - Sync manifest with per-collection timestamps & counts so the client
     can decide what to pull.
   - Delta endpoints (cards, store products, deal orders, profile) using
     `since` (ISO timestamp) + cursor pagination for large catalogs.
   - Bulk-pull endpoint for first install hydration.
"""
from __future__ import annotations

import base64
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed25519, padding, rsa
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from models.user import User
from utils.database import db
from utils.security import create_access_token, get_current_user

router = APIRouter(prefix="/mobile", tags=["mobile-native"])

# Challenges expire fast — biometric unlock should be near-instant.
CHALLENGE_TTL_SECONDS = 120
REFRESH_TOKEN_TTL_DAYS = 30
ACCESS_TOKEN_TTL_MINUTES = 60

VALID_PLATFORMS = {"ios", "android", "expo", "huawei"}
VALID_KEY_ALGOS = {"ed25519", "ecdsa-p256", "rsa-2048"}


# ─── Models ───────────────────────────────────────────────────────────────────


class DeviceRegisterRequest(BaseModel):
    device_token: str = Field(..., min_length=8, description="FCM/APNs/Expo token")
    platform: str = Field(..., description="ios | android | expo | huawei")
    device_id: Optional[str] = Field(None, description="Stable hardware-side device id")
    device_name: Optional[str] = None
    device_model: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    locale: Optional[str] = None
    timezone: Optional[str] = None


class DeviceOut(BaseModel):
    id: str
    device_id: Optional[str] = None
    platform: str
    device_name: Optional[str] = None
    device_model: Optional[str] = None
    app_version: Optional[str] = None
    locale: Optional[str] = None
    last_used_at: str
    created_at: str


class BiometricEnrollRequest(BaseModel):
    device_id: str = Field(..., description="Stable hardware-side device id")
    public_key: str = Field(..., description="Base64-encoded public key (DER or raw Ed25519)")
    key_algo: str = Field(..., description="ed25519 | ecdsa-p256 | rsa-2048")
    device_name: Optional[str] = None
    platform: Optional[str] = None


class BiometricChallengeRequest(BaseModel):
    user_identifier: str = Field(..., description="Email or user id")
    device_id: str


class BiometricChallengeOut(BaseModel):
    challenge_id: str
    challenge: str  # base64
    expires_at: str


class BiometricVerifyRequest(BaseModel):
    challenge_id: str
    signature: str = Field(..., description="Base64-encoded signature of the raw challenge bytes")


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access token seconds


class RefreshRequest(BaseModel):
    refresh_token: str


class SyncManifestOut(BaseModel):
    server_time: str
    collections: dict


class SyncEnvelope(BaseModel):
    server_time: str
    next_cursor: Optional[str] = None
    has_more: bool
    count: int
    items: List[dict]


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _b64decode(value: str) -> bytes:
    try:
        return base64.b64decode(value)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid base64: {e}") from e


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _load_public_key(public_key_b64: str, algo: str):
    raw = _b64decode(public_key_b64)
    try:
        if algo == "ed25519":
            # Accept either DER or 32-byte raw key.
            if len(raw) == 32:
                return ed25519.Ed25519PublicKey.from_public_bytes(raw)
            return serialization.load_der_public_key(raw)
        if algo in {"ecdsa-p256", "rsa-2048"}:
            return serialization.load_der_public_key(raw)
        raise HTTPException(status_code=400, detail=f"Unsupported key_algo: {algo}")
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid public key: {e}") from e


def _verify_signature(public_key_b64: str, algo: str, signature: bytes, message: bytes) -> bool:
    pub = _load_public_key(public_key_b64, algo)
    try:
        if algo == "ed25519":
            pub.verify(signature, message)  # type: ignore[union-attr]
            return True
        if algo == "ecdsa-p256":
            pub.verify(signature, message, ec.ECDSA(hashes.SHA256()))  # type: ignore[union-attr]
            return True
        if algo == "rsa-2048":
            pub.verify(  # type: ignore[union-attr]
                signature,
                message,
                padding.PKCS1v15(),
                hashes.SHA256(),
            )
            return True
    except InvalidSignature:
        return False
    except Exception:  # noqa: BLE001
        return False
    return False


async def _resolve_user(identifier: str) -> Optional[dict]:
    return await db.users.find_one(
        {"$or": [{"email": identifier.lower()}, {"id": identifier}]},
        {"_id": 0},
    )


async def _issue_token_pair(user_doc: dict, device_id: str) -> TokenPair:
    access = create_access_token(
        data={"sub": user_doc["email"], "uid": user_doc["id"], "device": device_id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_TTL_MINUTES),
    )
    refresh = secrets.token_urlsafe(48)
    await db.refresh_tokens.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_doc["id"],
        "device_id": device_id,
        "token_hash": _hash_token(refresh),
        "expires_at": _iso(_now() + timedelta(days=REFRESH_TOKEN_TTL_DAYS)),
        "created_at": _iso(_now()),
        "revoked": False,
    })
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=ACCESS_TOKEN_TTL_MINUTES * 60,
    )


# ─── 1. PUSH NOTIFICATIONS — DEVICE REGISTRATION ──────────────────────────────


@router.post("/devices/register", response_model=DeviceOut)
async def register_device(
    req: DeviceRegisterRequest,
    current_user: User = Depends(get_current_user),
):
    if req.platform not in VALID_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"platform must be one of {sorted(VALID_PLATFORMS)}")

    now = _iso(_now())
    # Upsert by (user_id, device_token) — re-registration just refreshes metadata.
    existing = await db.mobile_devices.find_one(
        {"user_id": current_user.id, "device_token": req.device_token},
        {"_id": 0},
    )
    if existing:
        await db.mobile_devices.update_one(
            {"id": existing["id"]},
            {"$set": {
                "platform": req.platform,
                "device_id": req.device_id,
                "device_name": req.device_name,
                "device_model": req.device_model,
                "os_version": req.os_version,
                "app_version": req.app_version,
                "locale": req.locale,
                "timezone": req.timezone,
                "last_used_at": now,
                "is_active": True,
            }},
        )
        device_id = existing["id"]
        created_at = existing.get("created_at", now)
    else:
        device_id = str(uuid.uuid4())
        await db.mobile_devices.insert_one({
            "id": device_id,
            "user_id": current_user.id,
            "device_token": req.device_token,
            "platform": req.platform,
            "device_id": req.device_id,
            "device_name": req.device_name,
            "device_model": req.device_model,
            "os_version": req.os_version,
            "app_version": req.app_version,
            "locale": req.locale,
            "timezone": req.timezone,
            "created_at": now,
            "last_used_at": now,
            "is_active": True,
        })
        created_at = now

    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"push_notifications_enabled": True}},
    )

    return DeviceOut(
        id=device_id,
        device_id=req.device_id,
        platform=req.platform,
        device_name=req.device_name,
        device_model=req.device_model,
        app_version=req.app_version,
        locale=req.locale,
        last_used_at=now,
        created_at=created_at,
    )


@router.get("/devices", response_model=List[DeviceOut])
async def list_devices(current_user: User = Depends(get_current_user)):
    devices = await db.mobile_devices.find(
        {"user_id": current_user.id, "is_active": True},
        {"_id": 0, "device_token": 0},
    ).sort("last_used_at", -1).to_list(50)
    return [
        DeviceOut(
            id=d["id"],
            device_id=d.get("device_id"),
            platform=d["platform"],
            device_name=d.get("device_name"),
            device_model=d.get("device_model"),
            app_version=d.get("app_version"),
            locale=d.get("locale"),
            last_used_at=d.get("last_used_at", ""),
            created_at=d.get("created_at", ""),
        )
        for d in devices
    ]


@router.delete("/devices/{device_id}")
async def unregister_device(device_id: str, current_user: User = Depends(get_current_user)):
    result = await db.mobile_devices.update_one(
        {"id": device_id, "user_id": current_user.id},
        {"$set": {"is_active": False, "unregistered_at": _iso(_now())}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    remaining = await db.mobile_devices.count_documents(
        {"user_id": current_user.id, "is_active": True}
    )
    if remaining == 0:
        # Also check web push subscriptions before flipping the flag.
        web_subs = await db.push_subscriptions.count_documents({"user_id": current_user.id})
        if web_subs == 0:
            await db.users.update_one(
                {"id": current_user.id},
                {"$set": {"push_notifications_enabled": False}},
            )
    return {"status": "unregistered", "device_id": device_id}


# ─── 2. BIOMETRIC SECURITY ────────────────────────────────────────────────────


@router.post("/biometric/enroll")
async def biometric_enroll(
    req: BiometricEnrollRequest,
    current_user: User = Depends(get_current_user),
):
    """Register a device public key after the user has authenticated with password/JWT."""
    if req.key_algo not in VALID_KEY_ALGOS:
        raise HTTPException(status_code=400, detail=f"key_algo must be one of {sorted(VALID_KEY_ALGOS)}")

    # Validate the public key shape immediately so bad data never lands in DB.
    _load_public_key(req.public_key, req.key_algo)

    now = _iso(_now())
    existing = await db.biometric_credentials.find_one(
        {"user_id": current_user.id, "device_id": req.device_id},
        {"_id": 0},
    )
    if existing:
        await db.biometric_credentials.update_one(
            {"id": existing["id"]},
            {"$set": {
                "public_key": req.public_key,
                "key_algo": req.key_algo,
                "device_name": req.device_name,
                "platform": req.platform,
                "updated_at": now,
                "is_active": True,
            }},
        )
        return {"status": "updated", "credential_id": existing["id"]}

    cred_id = str(uuid.uuid4())
    await db.biometric_credentials.insert_one({
        "id": cred_id,
        "user_id": current_user.id,
        "device_id": req.device_id,
        "public_key": req.public_key,
        "key_algo": req.key_algo,
        "device_name": req.device_name,
        "platform": req.platform,
        "created_at": now,
        "updated_at": now,
        "last_used_at": None,
        "is_active": True,
    })
    return {"status": "enrolled", "credential_id": cred_id}


@router.get("/biometric/credentials")
async def list_biometric_credentials(current_user: User = Depends(get_current_user)):
    creds = await db.biometric_credentials.find(
        {"user_id": current_user.id, "is_active": True},
        {"_id": 0, "public_key": 0},
    ).sort("created_at", -1).to_list(20)
    return creds


@router.delete("/biometric/credentials/{credential_id}")
async def revoke_biometric_credential(
    credential_id: str,
    current_user: User = Depends(get_current_user),
):
    result = await db.biometric_credentials.update_one(
        {"id": credential_id, "user_id": current_user.id},
        {"$set": {"is_active": False, "revoked_at": _iso(_now())}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Credential not found")
    return {"status": "revoked"}


@router.post("/biometric/challenge", response_model=BiometricChallengeOut)
async def biometric_challenge(req: BiometricChallengeRequest):
    """Public endpoint — client requests a one-time challenge to sign."""
    user_doc = await _resolve_user(req.user_identifier)
    if not user_doc:
        # Do not leak whether the user exists — return generic 401.
        raise HTTPException(status_code=401, detail="Invalid credentials")

    cred = await db.biometric_credentials.find_one(
        {"user_id": user_doc["id"], "device_id": req.device_id, "is_active": True},
        {"_id": 0},
    )
    if not cred:
        raise HTTPException(status_code=401, detail="Biometric not enrolled on this device")

    challenge_bytes = secrets.token_bytes(32)
    challenge_b64 = base64.b64encode(challenge_bytes).decode("ascii")
    challenge_id = str(uuid.uuid4())
    expires_at = _now() + timedelta(seconds=CHALLENGE_TTL_SECONDS)

    await db.biometric_challenges.insert_one({
        "id": challenge_id,
        "user_id": user_doc["id"],
        "device_id": req.device_id,
        "credential_id": cred["id"],
        "challenge": challenge_b64,
        "expires_at": _iso(expires_at),
        "used": False,
        "created_at": _iso(_now()),
    })
    return BiometricChallengeOut(
        challenge_id=challenge_id,
        challenge=challenge_b64,
        expires_at=_iso(expires_at),
    )


@router.post("/biometric/verify", response_model=TokenPair)
async def biometric_verify(req: BiometricVerifyRequest):
    """Verify the signature and issue a token pair."""
    ch = await db.biometric_challenges.find_one({"id": req.challenge_id}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=401, detail="Challenge not found")
    if ch.get("used"):
        raise HTTPException(status_code=401, detail="Challenge already used")

    expires_at = ch["expires_at"]
    if isinstance(expires_at, str):
        expires_at_dt = datetime.fromisoformat(expires_at)
    else:
        expires_at_dt = expires_at
    if expires_at_dt.tzinfo is None:
        expires_at_dt = expires_at_dt.replace(tzinfo=timezone.utc)
    if expires_at_dt < _now():
        raise HTTPException(status_code=401, detail="Challenge expired")

    cred = await db.biometric_credentials.find_one(
        {"id": ch["credential_id"], "is_active": True}, {"_id": 0}
    )
    if not cred:
        raise HTTPException(status_code=401, detail="Credential revoked")

    signature = _b64decode(req.signature)
    message = _b64decode(ch["challenge"])  # client signs the raw challenge bytes

    ok = _verify_signature(cred["public_key"], cred["key_algo"], signature, message)
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid signature")

    user_doc = await db.users.find_one({"id": ch["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User no longer exists")

    now = _iso(_now())
    await db.biometric_challenges.update_one(
        {"id": ch["id"]}, {"$set": {"used": True, "used_at": now}}
    )
    await db.biometric_credentials.update_one(
        {"id": cred["id"]}, {"$set": {"last_used_at": now}}
    )

    return await _issue_token_pair(user_doc, ch["device_id"])


@router.post("/auth/refresh", response_model=TokenPair)
async def refresh_token_endpoint(req: RefreshRequest):
    """Exchange a refresh token for a fresh access+refresh pair (rotation)."""
    token_hash = _hash_token(req.refresh_token)
    rec = await db.refresh_tokens.find_one(
        {"token_hash": token_hash, "revoked": False}, {"_id": 0}
    )
    if not rec:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    expires_at = rec["expires_at"]
    if isinstance(expires_at, str):
        expires_at_dt = datetime.fromisoformat(expires_at)
    else:
        expires_at_dt = expires_at
    if expires_at_dt.tzinfo is None:
        expires_at_dt = expires_at_dt.replace(tzinfo=timezone.utc)
    if expires_at_dt < _now():
        raise HTTPException(status_code=401, detail="Refresh token expired")

    user_doc = await db.users.find_one({"id": rec["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User no longer exists")

    # Rotate — revoke the old one.
    await db.refresh_tokens.update_one(
        {"id": rec["id"]}, {"$set": {"revoked": True, "revoked_at": _iso(_now())}}
    )

    return await _issue_token_pair(user_doc, rec.get("device_id") or "unknown")


@router.post("/auth/logout")
async def mobile_logout(
    req: RefreshRequest,
    current_user: User = Depends(get_current_user),
):
    """Revoke the refresh token used by this device."""
    token_hash = _hash_token(req.refresh_token)
    await db.refresh_tokens.update_one(
        {"token_hash": token_hash, "user_id": current_user.id},
        {"$set": {"revoked": True, "revoked_at": _iso(_now())}},
    )
    return {"status": "logged_out"}


# ─── 3. OFFLINE MODE — CATALOG SYNC ───────────────────────────────────────────


def _parse_since(since: Optional[str]) -> Optional[datetime]:
    if not since:
        return None
    try:
        dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid 'since' timestamp: {e}") from e
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _doc_updated_at(doc: dict) -> str:
    """Return an ISO timestamp the client can use as next-cursor anchor."""
    val = doc.get("updated_at") or doc.get("created_at")
    if isinstance(val, datetime):
        return _iso(val)
    return val or _iso(_now())


async def _max_updated(collection: str, query: dict) -> Optional[str]:
    cursor = db[collection].find(query, {"_id": 0, "updated_at": 1, "created_at": 1}).sort(
        [("updated_at", -1), ("created_at", -1)]
    ).limit(1)
    docs = await cursor.to_list(1)
    if not docs:
        return None
    return _doc_updated_at(docs[0])


@router.get("/sync/manifest", response_model=SyncManifestOut)
async def sync_manifest(current_user: User = Depends(get_current_user)):
    """Lightweight manifest the client polls to decide which collections need pulling."""
    uid = current_user.id

    cards_count = await db.cards.count_documents({"user_id": uid})
    store_count = await db.store_products.count_documents({"is_active": True})
    orders_count = await db.deal_orders.count_documents({"user_id": uid})

    collections = {
        "cards": {
            "count": cards_count,
            "last_modified": await _max_updated("cards", {"user_id": uid}),
            "endpoint": "/api/mobile/sync/cards",
        },
        "store_products": {
            "count": store_count,
            "last_modified": await _max_updated("store_products", {"is_active": True}),
            "endpoint": "/api/mobile/sync/store",
        },
        "deal_orders": {
            "count": orders_count,
            "last_modified": await _max_updated("deal_orders", {"user_id": uid}),
            "endpoint": "/api/mobile/sync/deal-orders",
        },
        "profile": {
            "count": 1,
            "last_modified": _iso(_now()),
            "endpoint": "/api/mobile/sync/profile",
        },
    }
    return SyncManifestOut(server_time=_iso(_now()), collections=collections)


async def _paginated_delta(
    collection: str,
    base_query: dict,
    since: Optional[str],
    cursor: Optional[str],
    limit: int,
    projection: Optional[dict] = None,
) -> SyncEnvelope:
    proj = projection if projection is not None else {"_id": 0}
    query = dict(base_query)

    # Cursor wins over `since` for pagination continuity.
    anchor = cursor or since
    anchor_dt = _parse_since(anchor)
    if anchor_dt:
        query["$or"] = [
            {"updated_at": {"$gt": _iso(anchor_dt)}},
            {"$and": [
                {"updated_at": {"$exists": False}},
                {"created_at": {"$gt": _iso(anchor_dt)}},
            ]},
        ]

    docs = await db[collection].find(query, proj).sort(
        [("updated_at", 1), ("created_at", 1)]
    ).limit(limit + 1).to_list(limit + 1)

    has_more = len(docs) > limit
    items = docs[:limit]
    next_cursor = _doc_updated_at(items[-1]) if has_more and items else None

    return SyncEnvelope(
        server_time=_iso(_now()),
        next_cursor=next_cursor,
        has_more=has_more,
        count=len(items),
        items=items,
    )


@router.get("/sync/cards", response_model=SyncEnvelope)
async def sync_cards(
    current_user: User = Depends(get_current_user),
    since: Optional[str] = Query(None, description="ISO timestamp — only changes after this"),
    cursor: Optional[str] = Query(None, description="next_cursor from previous page"),
    limit: int = Query(100, ge=1, le=500),
):
    return await _paginated_delta(
        "cards", {"user_id": current_user.id}, since, cursor, limit
    )


@router.get("/sync/store", response_model=SyncEnvelope)
async def sync_store(
    current_user: User = Depends(get_current_user),  # noqa: ARG001
    since: Optional[str] = Query(None),
    cursor: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    return await _paginated_delta(
        "store_products", {"is_active": True}, since, cursor, limit
    )


@router.get("/sync/deal-orders", response_model=SyncEnvelope)
async def sync_deal_orders(
    current_user: User = Depends(get_current_user),
    since: Optional[str] = Query(None),
    cursor: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    return await _paginated_delta(
        "deal_orders", {"user_id": current_user.id}, since, cursor, limit
    )


@router.get("/sync/profile")
async def sync_profile(current_user: User = Depends(get_current_user)):
    user_doc = await db.users.find_one(
        {"id": current_user.id},
        {"_id": 0, "hashed_password": 0, "password": 0},
    )
    if not user_doc:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"server_time": _iso(_now()), "profile": user_doc}


@router.get("/sync/bootstrap")
async def sync_bootstrap(
    current_user: User = Depends(get_current_user),
    cards_limit: int = Query(200, ge=0, le=500),
    store_limit: int = Query(200, ge=0, le=500),
    orders_limit: int = Query(100, ge=0, le=500),
):
    """One-shot hydration endpoint for first-run installs.

    Mobile clients call this once after login to fill local SQLite/Realm cache
    instead of paginating each collection.
    """
    cards = await db.cards.find(
        {"user_id": current_user.id}, {"_id": 0}
    ).sort([("sort_order", 1), ("created_at", -1)]).limit(cards_limit).to_list(cards_limit)

    store = await db.store_products.find(
        {"is_active": True}, {"_id": 0}
    ).sort("created_at", -1).limit(store_limit).to_list(store_limit)

    orders = await db.deal_orders.find(
        {"user_id": current_user.id}, {"_id": 0}
    ).sort("created_at", -1).limit(orders_limit).to_list(orders_limit)

    profile = await db.users.find_one(
        {"id": current_user.id}, {"_id": 0, "hashed_password": 0, "password": 0}
    )

    return {
        "server_time": _iso(_now()),
        "profile": profile,
        "cards": cards,
        "store_products": store,
        "deal_orders": orders,
        "counts": {
            "cards": len(cards),
            "store_products": len(store),
            "deal_orders": len(orders),
        },
    }


class OfflineCardChange(BaseModel):
    op: str = Field(..., description="create | update | delete")
    id: Optional[str] = None
    data: Optional[dict] = None
    client_updated_at: Optional[str] = None


class OfflinePushRequest(BaseModel):
    cards: List[OfflineCardChange] = []


@router.post("/sync/push")
async def sync_push(
    req: OfflinePushRequest,
    current_user: User = Depends(get_current_user),
):
    """Apply changes the client made while offline.

    Conflict resolution uses last-write-wins by `updated_at`. The response
    enumerates each change so the client can reconcile its local cache.
    """
    results = []
    now = _iso(_now())
    for change in req.cards:
        op = (change.op or "").lower()
        if op == "create" and change.data:
            new_id = change.data.get("id") or str(uuid.uuid4())
            doc = {
                **change.data,
                "id": new_id,
                "user_id": current_user.id,
                "created_at": change.data.get("created_at") or now,
                "updated_at": now,
            }
            try:
                await db.cards.insert_one(doc)
                results.append({"op": op, "id": new_id, "status": "created"})
            except Exception as e:  # noqa: BLE001
                results.append({"op": op, "id": new_id, "status": "error", "error": str(e)})
        elif op == "update" and change.id and change.data:
            existing = await db.cards.find_one(
                {"id": change.id, "user_id": current_user.id}, {"_id": 0}
            )
            if not existing:
                results.append({"op": op, "id": change.id, "status": "not_found"})
                continue
            # Last-write-wins.
            server_updated = existing.get("updated_at")
            client_updated = change.client_updated_at
            if server_updated and client_updated and server_updated > client_updated:
                results.append({
                    "op": op, "id": change.id, "status": "conflict",
                    "server": existing,
                })
                continue
            update_doc = {**change.data, "updated_at": now}
            update_doc.pop("id", None)
            update_doc.pop("user_id", None)
            await db.cards.update_one(
                {"id": change.id, "user_id": current_user.id},
                {"$set": update_doc},
            )
            results.append({"op": op, "id": change.id, "status": "updated"})
        elif op == "delete" and change.id:
            result = await db.cards.delete_one(
                {"id": change.id, "user_id": current_user.id}
            )
            results.append({
                "op": op, "id": change.id,
                "status": "deleted" if result.deleted_count else "not_found",
            })
        else:
            results.append({"op": op, "id": change.id, "status": "invalid"})

    return {"server_time": now, "results": results}


# ─── Public utility — VAPID key & app config for native bootstrap ─────────────


@router.get("/config")
async def mobile_config():
    """Public config the mobile app reads on startup."""
    import os as _os
    return {
        "min_app_version": "1.0.0",
        "vapid_public_key": _os.environ.get("VAPID_PUBLIC_KEY", ""),
        "supports": {
            "biometric": True,
            "fcm": True,
            "apns": True,
            "expo": True,
            "offline_sync": True,
            "stripe": True,
            "deal_integration": True,
        },
        "endpoints": {
            "auth_refresh": "/api/mobile/auth/refresh",
            "biometric_challenge": "/api/mobile/biometric/challenge",
            "biometric_verify": "/api/mobile/biometric/verify",
            "device_register": "/api/mobile/devices/register",
            "sync_manifest": "/api/mobile/sync/manifest",
            "sync_bootstrap": "/api/mobile/sync/bootstrap",
        },
    }
