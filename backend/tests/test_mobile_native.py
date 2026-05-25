"""End-to-end smoke test for the mobile-native API surface.

Covers:
  1. Push notifications — device register / list / unregister.
  2. Biometric — enroll (Ed25519), challenge, sign, verify, refresh, logout.
  3. Sync — manifest, cards, store, deal-orders, bootstrap, push.

Run:  python /app/backend/tests/test_mobile_native.py
"""
from __future__ import annotations

import base64
import json
import os
import sys
import time
import uuid

import requests
from cryptography.hazmat.primitives.asymmetric import ed25519

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ENV_PATH = os.path.join(ROOT, "frontend", ".env")
API_URL = ""
with open(ENV_PATH, "r", encoding="utf-8") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            API_URL = line.split("=", 1)[1].strip()
            break

EMAIL = os.environ.get("TEST_USER_EMAIL", "newtest@bruno.com")
PASSWORD = os.environ.get("TEST_USER_PASSWORD", "Test1234!")
DEVICE_ID = f"test-device-{uuid.uuid4()}"

PASS = []
FAIL = []


def step(name: str, ok: bool, detail: str = ""):
    bucket = PASS if ok else FAIL
    bucket.append(name)
    icon = "[OK]" if ok else "[FAIL]"
    print(f"{icon} {name}  {detail}")


def login() -> str:
    r = requests.post(
        f"{API_URL}/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def main():
    print(f"Testing against {API_URL}")
    token = login()
    headers = {"Authorization": f"Bearer {token}"}

    # ── 1. PUSH DEVICE REGISTRATION ──────────────────────────────────────────
    r = requests.post(
        f"{API_URL}/api/mobile/devices/register",
        headers=headers,
        json={
            "device_token": f"fake-fcm-token-{uuid.uuid4()}",
            "platform": "ios",
            "device_id": DEVICE_ID,
            "device_name": "iPhone 15 Pro Test",
            "device_model": "iPhone16,1",
            "os_version": "iOS 18.0",
            "app_version": "1.0.0",
            "locale": "es-ES",
            "timezone": "Europe/Madrid",
        },
        timeout=15,
    )
    step("register_device", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        device_pk = r.json()["id"]

    r = requests.get(f"{API_URL}/api/mobile/devices", headers=headers, timeout=15)
    step(
        "list_devices",
        r.status_code == 200 and any(d["device_id"] == DEVICE_ID for d in r.json()),
        f"count={len(r.json()) if r.status_code == 200 else 'n/a'}",
    )

    # invalid platform → 400
    r = requests.post(
        f"{API_URL}/api/mobile/devices/register",
        headers=headers,
        json={"device_token": "abc12345", "platform": "windows-phone"},
        timeout=15,
    )
    step("reject_invalid_platform", r.status_code == 400, f"status={r.status_code}")

    # ── 2. BIOMETRIC ENROLL / CHALLENGE / VERIFY ────────────────────────────
    priv = ed25519.Ed25519PrivateKey.generate()
    pub = priv.public_key()
    raw_pub = pub.public_bytes_raw()
    pub_b64 = base64.b64encode(raw_pub).decode("ascii")

    r = requests.post(
        f"{API_URL}/api/mobile/biometric/enroll",
        headers=headers,
        json={
            "device_id": DEVICE_ID,
            "public_key": pub_b64,
            "key_algo": "ed25519",
            "device_name": "iPhone 15 Pro Test",
            "platform": "ios",
        },
        timeout=15,
    )
    step("biometric_enroll", r.status_code == 200, f"status={r.status_code} body={r.text[:100]}")

    r = requests.post(
        f"{API_URL}/api/mobile/biometric/challenge",
        json={"user_identifier": EMAIL, "device_id": DEVICE_ID},
        timeout=15,
    )
    step("biometric_challenge", r.status_code == 200, f"status={r.status_code}")
    body = r.json()
    challenge_id = body["challenge_id"]
    challenge_bytes = base64.b64decode(body["challenge"])
    signature = priv.sign(challenge_bytes)
    sig_b64 = base64.b64encode(signature).decode("ascii")

    r = requests.post(
        f"{API_URL}/api/mobile/biometric/verify",
        json={"challenge_id": challenge_id, "signature": sig_b64},
        timeout=15,
    )
    ok = r.status_code == 200 and "access_token" in r.json() and "refresh_token" in r.json()
    step("biometric_verify_signature", ok, f"status={r.status_code} body={r.text[:120]}")
    refresh_token = r.json().get("refresh_token") if ok else None

    # Re-using the same challenge must fail.
    r = requests.post(
        f"{API_URL}/api/mobile/biometric/verify",
        json={"challenge_id": challenge_id, "signature": sig_b64},
        timeout=15,
    )
    step("reject_replay_challenge", r.status_code == 401, f"status={r.status_code}")

    # Bad signature must fail.
    r = requests.post(
        f"{API_URL}/api/mobile/biometric/challenge",
        json={"user_identifier": EMAIL, "device_id": DEVICE_ID},
        timeout=15,
    )
    bad_challenge_id = r.json()["challenge_id"]
    r = requests.post(
        f"{API_URL}/api/mobile/biometric/verify",
        json={"challenge_id": bad_challenge_id, "signature": base64.b64encode(b"x" * 64).decode()},
        timeout=15,
    )
    step("reject_bad_signature", r.status_code == 401, f"status={r.status_code}")

    # Refresh
    if refresh_token:
        r = requests.post(
            f"{API_URL}/api/mobile/auth/refresh",
            json={"refresh_token": refresh_token},
            timeout=15,
        )
        ok = r.status_code == 200 and r.json().get("access_token")
        step("refresh_token_rotation", ok, f"status={r.status_code}")
        new_refresh = r.json().get("refresh_token") if ok else None

        # Old refresh token should be revoked after rotation.
        r = requests.post(
            f"{API_URL}/api/mobile/auth/refresh",
            json={"refresh_token": refresh_token},
            timeout=15,
        )
        step("reject_rotated_refresh", r.status_code == 401, f"status={r.status_code}")

        if new_refresh:
            r = requests.post(
                f"{API_URL}/api/mobile/auth/logout",
                headers=headers,
                json={"refresh_token": new_refresh},
                timeout=15,
            )
            step("mobile_logout", r.status_code == 200, f"status={r.status_code}")

    # ── 3. SYNC ENDPOINTS ────────────────────────────────────────────────────
    r = requests.get(f"{API_URL}/api/mobile/sync/manifest", headers=headers, timeout=15)
    body = r.json() if r.status_code == 200 else {}
    step(
        "sync_manifest",
        r.status_code == 200 and "cards" in body.get("collections", {}),
        f"status={r.status_code}",
    )

    r = requests.get(
        f"{API_URL}/api/mobile/sync/cards?limit=5", headers=headers, timeout=15
    )
    body = r.json() if r.status_code == 200 else {}
    step(
        "sync_cards",
        r.status_code == 200 and "items" in body and "has_more" in body,
        f"status={r.status_code} count={body.get('count')}",
    )

    r = requests.get(
        f"{API_URL}/api/mobile/sync/store?limit=10", timeout=15, headers=headers
    )
    step("sync_store", r.status_code == 200, f"status={r.status_code}")

    r = requests.get(
        f"{API_URL}/api/mobile/sync/deal-orders?limit=10", headers=headers, timeout=15
    )
    step("sync_deal_orders", r.status_code == 200, f"status={r.status_code}")

    r = requests.get(f"{API_URL}/api/mobile/sync/profile", headers=headers, timeout=15)
    step(
        "sync_profile",
        r.status_code == 200 and r.json().get("profile", {}).get("email") == EMAIL,
        f"status={r.status_code}",
    )

    r = requests.get(f"{API_URL}/api/mobile/sync/bootstrap", headers=headers, timeout=15)
    body = r.json() if r.status_code == 200 else {}
    step(
        "sync_bootstrap",
        r.status_code == 200 and {"cards", "store_products", "deal_orders", "profile"} <= set(body.keys()),
        f"status={r.status_code}",
    )

    # Offline push — create a new card.
    new_id = str(uuid.uuid4())
    r = requests.post(
        f"{API_URL}/api/mobile/sync/push",
        headers=headers,
        json={"cards": [
            {"op": "create", "data": {
                "id": new_id, "title": "Offline created", "type": "personal"
            }},
        ]},
        timeout=15,
    )
    body = r.json() if r.status_code == 200 else {}
    created_ok = (
        r.status_code == 200
        and body.get("results")
        and body["results"][0].get("status") == "created"
    )
    step("sync_push_create", created_ok, f"status={r.status_code}")

    # Delta sync should return the new card.
    if created_ok:
        time.sleep(1)
        r = requests.get(
            f"{API_URL}/api/mobile/sync/cards?since=2020-01-01T00:00:00Z&limit=500",
            headers=headers,
            timeout=15,
        )
        body = r.json() if r.status_code == 200 else {}
        ids = [c.get("id") for c in body.get("items", [])]
        step(
            "delta_includes_new_card",
            new_id in ids,
            f"found={new_id in ids}",
        )

    # Delete the created card.
    if created_ok:
        r = requests.post(
            f"{API_URL}/api/mobile/sync/push",
            headers=headers,
            json={"cards": [{"op": "delete", "id": new_id}]},
            timeout=15,
        )
        deleted_ok = (
            r.status_code == 200
            and r.json().get("results", [{}])[0].get("status") == "deleted"
        )
        step("sync_push_delete", deleted_ok, f"status={r.status_code}")

    # ── 4. Cleanup ──────────────────────────────────────────────────────────
    try:
        r = requests.delete(
            f"{API_URL}/api/mobile/devices/{device_pk}", headers=headers, timeout=15
        )
        step("unregister_device", r.status_code == 200, f"status={r.status_code}")
    except Exception:
        pass

    print()
    print(f"PASSED: {len(PASS)}")
    print(f"FAILED: {len(FAIL)}")
    if FAIL:
        print("Failures:")
        for f in FAIL:
            print(f"  - {f}")
        sys.exit(1)


if __name__ == "__main__":
    main()
