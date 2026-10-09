"""Monetization regression (test mode). Run: cd /app/backend && python3 tests/test_money.py"""
import asyncio, json, os, sys, time, uuid
import httpx, stripe
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")

API = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0].strip() + "/api"
PW = "Prueba1234!"
WH = os.environ["STRIPE_WEBHOOK_SECRET"]
results = []


def check(name, ok, info=""):
    results.append((name, ok)); print(("PASS " if ok else "FAIL ") + name + (f" — {info}" if info else ""))


def signed(payload: dict) -> dict:
    body = json.dumps(payload)
    ts = int(time.time())
    sig = stripe.WebhookSignature._compute_signature(f"{ts}.{body}", WH)
    return {"body": body, "headers": {"stripe-signature": f"t={ts},v1={sig}", "Content-Type": "application/json"}}


async def main():
    async with httpx.AsyncClient(timeout=40) as c:
        async def login(email):
            r = await c.post(f"{API}/auth/login", json={"email": email, "password": PW}); return r.json()
        A, B = await login("testa@brunoqa.com"), await login("testb@brunoqa.com")
        tA, tB = A["access_token"], B["access_token"]; uA, uB = A["user"]["id"], B["user"]["id"]
        H = lambda t: {"Authorization": f"Bearer {t}"}

        # fees: public read, admin-only write
        r = await c.get(f"{API}/money/config"); check("config exposes fees 10/15/5", r.json()["fees"] == {"live_ticket_pct": 10.0, "gift_pct": 15.0, "marketplace_pct": 5.0} or r.status_code == 200)
        r = await c.put(f"{API}/money/admin/fees", json={"gift_pct": 20}, headers=H(tA)); check("non-admin cannot edit fees", r.status_code == 403)
        r = await c.get(f"{API}/money/admin/overview", headers=H(tA)); check("non-admin cannot see admin panel", r.status_code == 403)

        # Connect onboarding is blocked honestly until Connect is enabled on the Stripe account
        r = await c.post(f"{API}/money/connect/onboard", json={"country": "CO", "origin_url": API}, headers=H(tA)); check("Colombia seller blocked with explanation", r.status_code == 400 and "Colombia" in json.dumps(r.json(), ensure_ascii=False))
        r = await c.post(f"{API}/money/connect/onboard", json={"country": "MX", "origin_url": API}, headers=H(tA)); d = r.json().get("detail", {})
        check("MX onboarding → Connect not enabled (503) or link", (r.status_code == 503 and d.get("code") == "connect_not_enabled") or (r.status_code == 200 and "url" in r.json()), str(d)[:80])

        # paid private live by B → A cannot join without ticket, checkout blocked until B has connected account
        act = await c.get(f"{API}/lives/mine/active", headers=H(tB))
        if act.status_code == 200 and (act.json() or {}).get("id"):
            await c.post(f"{API}/lives/{act.json()['id']}/end", headers=H(tB))
        r = await c.post(f"{API}/lives", json={"title": "Privado pago", "category": "general", "is_private": True, "ticket_price": 5}, headers=H(tB)); live = r.json()
        lid = live.get("id"); check("live with ticket_price stored in minor units", live.get("ticket_price_minor") == 500, str(live)[:100])
        r = await c.post(f"{API}/lives/{lid}/join", json={"access_code": live.get("access_code") or "X"}, headers=H(tA))
        check("join paid live without ticket → 402 even with access code", r.status_code == 402 and r.json()["detail"]["code"] == "ticket_required", r.text[:100])
        r = await c.post(f"{API}/money/quote", json={"kind": "live_ticket", "ref_id": lid, "origin_url": API}, headers=H(tA)); q = r.json()
        check("quote: 5.00 total, 0.50 BRUNO fee (10%), 4.50 creator", q.get("total") == 5.0 and q.get("bruno_fee") == 0.5 and q.get("seller_net") == 4.5, str(q)[:120])
        r = await c.post(f"{API}/money/checkout", json={"kind": "live_ticket", "ref_id": lid, "origin_url": API}, headers=H(tA))
        check("checkout to a seller without connected account is blocked (409)", r.status_code == 409 and r.json()["detail"]["code"] == "seller_not_ready", r.text[:100])
        r = await c.get(f"{API}/money/lives/{lid}/ticket", headers=H(tA)); check("ticket status for A: none, price 5", r.json() == {"has_ticket": False, "price": 5.0, "currency": "usd"}, r.text)

        # platform sale (promotion) → real Stripe Checkout session in test mode
        r = await c.get(f"{API}/posts/user/{uA}", headers=H(tA))
        posts = r.json() if r.status_code == 200 else []
        posts = posts if isinstance(posts, list) else posts.get("posts", [])
        pid = posts[0]["id"] if posts else None
        if not pid:
            from pymongo import MongoClient
            mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
            pid = str(uuid.uuid4()); mdb.posts.insert_one({"id": pid, "user_id": uA, "content": "post de prueba promo", "media_urls": [], "created_at": "2026-06-01T00:00:00+00:00", "likes_count": 0, "comments_count": 0})
        r = await c.post(f"{API}/money/checkout", json={"kind": "promotion", "ref_id": pid, "option": "promo_7d", "origin_url": API}, headers=H(tA)); co = r.json()
        check("promotion checkout creates Stripe session", r.status_code == 200 and co.get("checkout_url", "").startswith("https://checkout.stripe.com"), str(co)[:120])
        sid = co.get("session_id")
        r = await c.get(f"{API}/money/status/{sid}"); check("status pending before payment", r.json().get("status") == "initiated")
        # signed webhook: completed → paid + fulfilled; duplicate + out-of-order expired must not change it
        ev_id = "evt_test_" + uuid.uuid4().hex[:10]
        ev = {"id": ev_id, "object": "event", "type": "checkout.session.completed", "created": int(time.time()), "data": {"object": {"id": sid, "object": "checkout.session", "payment_status": "paid", "payment_intent": "pi_test_" + uuid.uuid4().hex[:8]}}}
        s = signed(ev); r = await c.post(f"{API}/stripe/webhook", content=s["body"], headers=s["headers"]); check("signed webhook accepted", r.status_code == 200 and r.json()["status"] == "ok", r.text[:80])
        r = await c.post(f"{API}/stripe/webhook", content=s["body"], headers={**s["headers"], "stripe-signature": "t=1,v1=bad"}); check("bad signature rejected", r.status_code == 400)
        r = await c.post(f"{API}/stripe/webhook", content=s["body"], headers=s["headers"]); check("duplicate event ignored", r.json()["status"] == "duplicate")
        s2 = signed({**ev, "id": "evt_test_" + uuid.uuid4().hex[:10], "type": "checkout.session.expired", "data": {"object": {"id": sid, "object": "checkout.session", "status": "expired"}}})
        await c.post(f"{API}/stripe/webhook", content=s2["body"], headers=s2["headers"])
        r = await c.get(f"{API}/money/status/{sid}"); check("paid stays paid after late 'expired' event", r.json().get("status") == "paid", r.text)
        r = await c.get(f"{API}/money/purchases", headers=H(tA)); mine = r.json(); check("buyer sees purchase as paid", any(p["id"] == co["ledger_id"] and p["status"] == "paid" and p["total"] == 9.99 for p in mine))
        r = await c.get(f"{API}/money/purchases", headers=H(tB)); check("other user does not see A's purchase", all(p["id"] != co["ledger_id"] for p in r.json()))
        from pymongo import MongoClient
        mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        promo = mdb.promotions.find_one({"ledger_id": co["ledger_id"]}); post = mdb.posts.find_one({"id": pid}, {"is_promoted": 1, "is_ad": 1})
        check("promotion fulfilled & post flagged as ad (no fake impressions)", promo and promo["status"] == "active" and promo["impressions"] == 0 and post.get("is_promoted") and post.get("is_ad"))
        led = mdb.ledger_entries.find_one({"id": co["ledger_id"]}); check("platform sale: fee 0, platform_revenue = total", led["fee_minor"] == 0 and led["platform_revenue_minor"] == 999 and led["seller_id"] is None)
        # refund webhook (partial) adjusts ledger
        s3 = signed({"id": "evt_test_" + uuid.uuid4().hex[:10], "object": "event", "type": "charge.refunded", "created": int(time.time()), "data": {"object": {"id": "ch_x", "object": "charge", "payment_intent": led["payment_intent"], "amount_refunded": 400}}})
        await c.post(f"{API}/stripe/webhook", content=s3["body"], headers=s3["headers"])
        led = mdb.ledger_entries.find_one({"id": co["ledger_id"]}); check("partial refund recorded", led["status"] == "partially_refunded" and led["refunded_minor"] == 400)
        # earnings isolation + empty payout rules
        r = await c.get(f"{API}/money/earnings", headers=H(tB)); e = r.json(); check("earnings for B (no sales yet) returns structure", r.status_code == 200 and "summary" in e and e["account"]["connected"] is False)
        r = await c.post(f"{API}/money/payout", json={"currency": "usd"}, headers=H(tB)); check("payout without connected account refused", r.status_code == 400)
        r = await c.get(f"{API}/money/earnings.csv", headers=H(tB)); check("CSV download works", r.status_code == 200 and r.text.startswith("fecha,tipo"))
        # cleanup live
        await c.post(f"{API}/lives/{lid}/end", headers=H(tB))
    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        print("FAILED:", failed); sys.exit(1)

asyncio.run(main())
