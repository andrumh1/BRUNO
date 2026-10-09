"""Iteration 103 — Coupons CRUD, quote-with-coupon, receipts resend.
Run: cd /app/backend && python3 tests/test_coupons_receipts.py
"""
import asyncio, json, os, sys, uuid
import httpx
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0].strip() + "/api"

SELLER = ("newtest@bruno.com", "Test1234!")
BUYER = ("viewer2@bruno.com", "Test1234!")
BUYER_DELIVERED = ("delivered+brunoqa@resend.dev", "Prueba1234!")
OTHER = ("testb@brunoqa.com", "Prueba1234!")
PRODUCT_ID = "4334a391-d035-463c-b8cc-3e18e88aa833"

results = []


def check(name, ok, info=""):
    results.append((name, ok))
    print(("PASS " if ok else "FAIL ") + name + (f" — {info}" if info else ""))


async def login(c, email, pw):
    r = await c.post(f"{API}/auth/login", json={"email": email, "password": pw})
    j = r.json()
    return j.get("access_token") or j.get("token"), j.get("user", {}).get("id")


async def main():
    async with httpx.AsyncClient(timeout=40) as c:
        tS, uS = await login(c, *SELLER)
        tB, uB = await login(c, *BUYER)
        tD, uD = await login(c, *BUYER_DELIVERED)
        tO, uO = await login(c, *OTHER)
        H = lambda t: {"Authorization": f"Bearer {t}"}
        if not tS or not tB:
            print("LOGIN FAIL seller/buyer:", tS, tB); sys.exit(1)

        # ─── 1. Coupon CRUD ───
        r = await c.get(f"{API}/money/coupons", headers=H(tS))
        check("GET /coupons returns list", r.status_code == 200 and isinstance(r.json(), list),
              f"len={len(r.json()) if r.status_code==200 else r.text[:120]}")
        existing_codes = {co["code"] for co in r.json()} if r.status_code == 200 else set()
        check("Existing seller coupons include VERANO20 and FIJO5",
              "VERANO20" in existing_codes and "FIJO5" in existing_codes, str(existing_codes))

        # QA pct coupon unique
        qa_code = "QATEST" + uuid.uuid4().hex[:4].upper()
        r = await c.post(f"{API}/money/coupons",
                         json={"code": qa_code, "pct": 10, "applies_to": "all",
                               "max_uses": 5, "expires_at": "2027-01-01"},
                         headers=H(tS))
        check("Create pct coupon 201", r.status_code == 201 and r.json().get("pct") == 10, r.text[:200])
        qa_id = r.json().get("id") if r.status_code == 201 else None
        if qa_id:
            d = r.json()
            check("New coupon uses_count=0, active=true, expired=false, exhausted=false",
                  d["uses_count"] == 0 and d["active"] is True and d["expired"] is False and d["exhausted"] is False,
                  str(d)[:200])

        # Fixed amount coupon
        qa2 = "QAFIX" + uuid.uuid4().hex[:4].upper()
        r = await c.post(f"{API}/money/coupons",
                         json={"code": qa2, "amount": 3, "currency": "usd", "applies_to": "marketplace"},
                         headers=H(tS))
        check("Create fixed-amount coupon 201 (amount '3,00 US$')",
              r.status_code == 201 and r.json().get("amount") is not None, r.text[:200])
        qa2_id = r.json().get("id") if r.status_code == 201 else None

        # Reject: duplicate
        r = await c.post(f"{API}/money/coupons", json={"code": qa_code, "pct": 15}, headers=H(tS))
        check("Duplicate code → 409", r.status_code == 409, r.text[:120])

        # Reject: pct + amount together
        r = await c.post(f"{API}/money/coupons",
                         json={"code": "QABOTH" + uuid.uuid4().hex[:3].upper(), "pct": 10, "amount": 5},
                         headers=H(tS))
        check("pct + amount together → 400", r.status_code == 400, r.text[:120])

        # Reject: past date
        r = await c.post(f"{API}/money/coupons",
                         json={"code": "QAEXP" + uuid.uuid4().hex[:3].upper(), "pct": 10,
                               "expires_at": "2020-01-01"},
                         headers=H(tS))
        check("Past expiration → 400", r.status_code == 400, r.text[:120])

        # Reject: bad chars
        r = await c.post(f"{API}/money/coupons",
                         json={"code": "BAD CODE!", "pct": 10}, headers=H(tS))
        check("Weird chars → 400", r.status_code == 400, r.text[:120])

        # Isolation: another user cannot see seller's coupons
        r = await c.get(f"{API}/money/coupons", headers=H(tO))
        other_codes = {co["code"] for co in r.json()} if r.status_code == 200 else set()
        check("Other user does NOT see seller's coupons",
              "VERANO20" not in other_codes and (qa_code not in other_codes), str(other_codes)[:120])

        # PATCH toggle active
        if qa_id:
            r = await c.patch(f"{API}/money/coupons/{qa_id}", headers=H(tS))
            check("PATCH toggles active to false", r.status_code == 200 and r.json().get("active") is False, r.text[:120])
            r = await c.patch(f"{API}/money/coupons/{qa_id}", headers=H(tS))
            check("PATCH toggles active back to true", r.status_code == 200 and r.json().get("active") is True)

        # DELETE 404 if other user tries
        if qa_id:
            r = await c.delete(f"{API}/money/coupons/{qa_id}", headers=H(tO))
            check("DELETE other user's coupon → 404", r.status_code == 404, r.text[:120])

        # ─── 2. Quote with coupon ───
        base = {"kind": "marketplace", "ref_id": PRODUCT_ID, "origin_url": "https://x.test"}
        r = await c.post(f"{API}/money/quote", json=base, headers=H(tB))
        check("Base quote total 149,99 US$ (no coupon)",
              r.status_code == 200 and r.json().get("total") == 149.99, r.text[:200])
        q = r.json() if r.status_code == 200 else {}
        check("Quote exposes accepts_coupons=true for marketplace",
              q.get("accepts_coupons") is True, str(q)[:200])

        # VERANO20 (20% off)
        r = await c.post(f"{API}/money/quote",
                         json={**base, "discount_code": "VERANO20"}, headers=H(tB))
        q = r.json() if r.status_code == 200 else {}
        check("VERANO20: discount=29.99, total=120.0, bruno_fee=6.0, seller_net=114.0",
              q.get("discount") == 29.99 and q.get("total") == 120.0 and q.get("bruno_fee") == 6.0 and q.get("seller_net") == 114.0,
              str(q)[:220])

        # FIJO5 ($5 off)
        r = await c.post(f"{API}/money/quote",
                         json={**base, "discount_code": "FIJO5"}, headers=H(tB))
        q = r.json() if r.status_code == 200 else {}
        check("FIJO5: discount=5.0", q.get("discount") == 5.0, str(q)[:200])

        # Invalid code
        r = await c.post(f"{API}/money/quote",
                         json={**base, "discount_code": "NOEXISTE_XYZ"}, headers=H(tB))
        check("Non-existent code → 400 'Cupón no válido'",
              r.status_code == 400 and "no válido" in r.text, r.text[:160])

        # Deactivated coupon
        if qa_id:
            await c.patch(f"{API}/money/coupons/{qa_id}", headers=H(tS))  # toggle off
            r = await c.post(f"{API}/money/quote",
                             json={**base, "discount_code": qa_code}, headers=H(tB))
            check("Deactivated coupon → 400", r.status_code == 400, r.text[:160])
            await c.patch(f"{API}/money/coupons/{qa_id}", headers=H(tS))  # back on

        # Scope mismatch: create a live_ticket-scoped coupon and try on marketplace
        scope_code = "QASCOPE" + uuid.uuid4().hex[:3].upper()
        rc = await c.post(f"{API}/money/coupons",
                          json={"code": scope_code, "pct": 10, "applies_to": "live_ticket"},
                          headers=H(tS))
        scope_id = rc.json().get("id") if rc.status_code == 201 else None
        r = await c.post(f"{API}/money/quote",
                         json={**base, "discount_code": scope_code}, headers=H(tB))
        check("Scope mismatch (live_ticket on marketplace) → 400 with scope msg",
              r.status_code == 400 and ("solo vale" in r.text.lower() or "entradas" in r.text.lower()),
              r.text[:200])

        # promotion/piup → coupon rejected (no seller)
        # pick a post by buyer or create one
        pid = None
        rp = await c.get(f"{API}/posts/user/{uB}", headers=H(tB))
        if rp.status_code == 200:
            posts = rp.json() if isinstance(rp.json(), list) else rp.json().get("posts", [])
            pid = posts[0]["id"] if posts else None
        if not pid:
            from pymongo import MongoClient
            mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
            pid = str(uuid.uuid4())
            mdb.posts.insert_one({"id": pid, "user_id": uB, "content": "promo test", "media_urls": [],
                                  "created_at": "2026-10-01T00:00:00+00:00", "likes_count": 0, "comments_count": 0})
        r = await c.post(f"{API}/money/quote",
                         json={"kind": "promotion", "ref_id": pid, "option": "promo_7d",
                               "origin_url": "https://x.test", "discount_code": "VERANO20"},
                         headers=H(tB))
        check("Promotion with coupon → 400 'no admite cupones'",
              r.status_code == 400 and "no admite" in r.text.lower(), r.text[:200])

        # ─── 3. Receipts ───
        r = await c.get(f"{API}/money/purchases", headers=H(tD))
        purchases = r.json() if r.status_code == 200 else []
        paid = [p for p in purchases if p.get("status") in ("paid", "partially_refunded", "refunded")
                and p.get("receipt_sent_at")]
        check("delivered+brunoqa has paid purchase with receipt_sent_at and receipt_to",
              r.status_code == 200 and bool(paid), f"{len(purchases)} total, {len(paid)} paid-with-receipt")

        if paid:
            pid_led = paid[0]["id"]
            # First try resend — may 429 if recent
            r = await c.post(f"{API}/money/purchases/{pid_led}/receipt", headers=H(tD))
            check("Resend receipt returns 200 {sent:true} OR 429 rate-limited",
                  (r.status_code == 200 and r.json().get("sent") is True) or r.status_code == 429,
                  f"{r.status_code} {r.text[:120]}")

            # 2nd call immediately should 429
            r2 = await c.post(f"{API}/money/purchases/{pid_led}/receipt", headers=H(tD))
            check("Immediate 2nd resend → 429", r2.status_code == 429, r2.text[:120])

            # Other user → 404
            r = await c.post(f"{API}/money/purchases/{pid_led}/receipt", headers=H(tO))
            check("Resend on another user's ledger → 404", r.status_code == 404, r.text[:120])

        # ─── Cleanup created coupons ───
        for cid in [qa_id, qa2_id, scope_id]:
            if cid:
                await c.delete(f"{API}/money/coupons/{cid}", headers=H(tS))

    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        print("FAILED:", failed); sys.exit(1)


asyncio.run(main())
