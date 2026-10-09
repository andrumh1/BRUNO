"""BRUNO money: Stripe Connect (destination charges), fees, ledger, earnings, payouts, admin.

Model (user decisions): BRUNO is merchant of record and collects from the buyer (destination charges);
BRUNO keeps `application_fee` = its commission and ABSORBS Stripe processing costs inside that commission;
creators/sellers receive amount − BRUNO fee into their connected account; payouts are MANUAL (requested from
"Mis ingresos"); refunds reverse the transfer and the fee; disputes are BRUNO's responsibility (platform).
Money is always stored in minor units per currency. No wallet, no virtual coins, no P2P transfers.
"""
import asyncio
import csv
import io
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from utils.security import get_current_user
from utils.database import db
from utils.email import send_email, receipt_html
from models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/money", tags=["money"])

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY")
WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

DEFAULT_FEES = {"live_ticket_pct": 10.0, "gift_pct": 15.0, "marketplace_pct": 5.0}
# Kinds whose revenue is BRUNO's own (no creator share, no commission split)
PLATFORM_KINDS = {"piup", "promotion"}
CREATOR_KINDS = {"live_ticket": "live_ticket_pct", "gift": "gift_pct", "marketplace": "marketplace_pct"}

# Stripe Connect Express payout eligibility (seller side). Accepting a buyer card from a country ≠ paying a seller there.
SELLER_COUNTRIES = {
    "US": "usd", "MX": "mxn", "CA": "cad", "GB": "gbp", "ES": "eur", "DE": "eur", "FR": "eur", "IT": "eur", "PT": "eur", "NL": "eur",
    "BR": "brl", "AU": "aud", "JP": "jpy", "CH": "chf", "SE": "sek", "NO": "nok", "DK": "dkk", "PL": "pln", "IE": "eur", "BE": "eur", "AT": "eur",
}
UNSUPPORTED_SELLER_COUNTRIES = {"CO": "Stripe Connect todavía no permite abrir cuentas ni pagar a vendedores en Colombia. Los compradores colombianos sí pueden pagar con tarjeta."}
ZERO_DECIMAL = {"jpy", "krw", "clp", "vnd", "xaf", "xof", "pyg", "ugx", "rwf", "gnf", "mga", "bif", "djf", "kmf", "xpf"}
MIN_CHARGE = {"usd": 50, "eur": 50, "gbp": 30, "mxn": 1000, "cop": 200000, "brl": 50, "cad": 50, "jpy": 50}
GIFT_CATALOG = {"rose": {"name": "Rosa", "usd": 99}, "heart": {"name": "Corazón", "usd": 299}, "star": {"name": "Estrella", "usd": 499}, "diamond": {"name": "Diamante", "usd": 1999}, "rocket": {"name": "Cohete", "usd": 4999}, "crown": {"name": "Corona", "usd": 9999}}
PROMO_PACKAGES = {"promo_7d": {"name": "Promoción 7 días", "usd": 999, "days": 7}, "promo_30d": {"name": "Promoción 30 días", "usd": 2999, "days": 30}}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def is_admin(user: User) -> bool:
    return getattr(user, "role", None) in ("admin", "superadmin") or getattr(user, "is_admin", False)


def to_minor(amount: float, currency: str) -> int:
    return int(round(amount)) if currency in ZERO_DECIMAL else int(round(amount * 100))


def fmt_minor(minor: int, currency: str) -> float:
    return float(minor) if currency in ZERO_DECIMAL else round(minor / 100, 2)


def _stripe_unavailable(e: Exception) -> HTTPException:
    msg = str(e)
    if "signed up for Connect" in msg or "unclaimed Stripe sandbox" in msg:
        return HTTPException(status_code=503, detail={"code": "connect_not_enabled", "message": "Stripe Connect aún no está activado en la cuenta Stripe de BRUNO. Falta reclamar la cuenta y activar Connect en el panel de Stripe; hasta entonces no se pueden dar de alta creadores ni repartir cobros."})
    return HTTPException(status_code=502, detail={"code": "stripe_error", "message": msg[:300]})


async def get_fees() -> dict:
    doc = await db.money_settings.find_one({"key": "fees"}, {"_id": 0})
    return {**DEFAULT_FEES, **{k: v for k, v in (doc or {}).items() if k in DEFAULT_FEES}}


# ───────────────────────── config / admin fees ─────────────────────────
class FeesUpdate(BaseModel):
    live_ticket_pct: Optional[float] = Field(None, ge=0, le=50)
    gift_pct: Optional[float] = Field(None, ge=0, le=50)
    marketplace_pct: Optional[float] = Field(None, ge=0, le=50)
    note: Optional[str] = None


@router.get("/config")
async def money_config():
    return {"fees": await get_fees(), "gift_catalog": GIFT_CATALOG, "promo_packages": PROMO_PACKAGES, "seller_countries": sorted(SELLER_COUNTRIES), "unsupported_seller_countries": UNSUPPORTED_SELLER_COUNTRIES,
            "mode": os.environ.get("STRIPE_MODE", "test"), "processor_fees_paid_by": "bruno", "discounts_funded_by": "seller",
            "fee_base": "importe tras descuentos comerciales, sin impuestos ni envío"}


@router.put("/admin/fees")
async def update_fees(body: FeesUpdate, current_user: User = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    current = await get_fees()
    changes = {k: v for k, v in body.model_dump().items() if k in DEFAULT_FEES and v is not None}
    if not changes:
        return {"fees": current}
    entry = {"at": now_iso(), "by": current_user.id, "from": current, "to": {**current, **changes}, "note": body.note}
    await db.money_settings.update_one({"key": "fees"}, {"$set": {"key": "fees", **changes, "updated_at": now_iso(), "updated_by": current_user.id}, "$push": {"history": entry}}, upsert=True)
    return {"fees": await get_fees()}


# ───────────────────────── Stripe Connect onboarding ─────────────────────────
class OnboardRequest(BaseModel):
    country: str
    origin_url: str


@router.post("/connect/onboard")
async def connect_onboard(body: OnboardRequest, current_user: User = Depends(get_current_user)):
    country = body.country.strip().upper()
    if country in UNSUPPORTED_SELLER_COUNTRIES:
        raise HTTPException(status_code=400, detail={"code": "country_unsupported", "message": UNSUPPORTED_SELLER_COUNTRIES[country]})
    if country not in SELLER_COUNTRIES:
        raise HTTPException(status_code=400, detail={"code": "country_unsupported", "message": f"Todavía no pagamos a vendedores en {country}."})
    acct_doc = await db.connected_accounts.find_one({"user_id": current_user.id}, {"_id": 0})
    try:
        if not acct_doc:
            acct = stripe.Account.create(type="express", country=country, email=current_user.email,
                                         capabilities={"card_payments": {"requested": True}, "transfers": {"requested": True}},
                                         settings={"payouts": {"schedule": {"interval": "manual"}}},
                                         business_profile={"product_description": "Creador/vendedor en BRUNO"},
                                         metadata={"bruno_user_id": current_user.id})
            acct_doc = {"user_id": current_user.id, "account_id": acct.id, "country": country, "currency": SELLER_COUNTRIES[country], "created_at": now_iso(), "status": "onboarding"}
            await db.connected_accounts.insert_one(dict(acct_doc))
        link = stripe.AccountLink.create(account=acct_doc["account_id"], refresh_url=f"{body.origin_url}/earnings?connect=refresh", return_url=f"{body.origin_url}/earnings?connect=return", type="account_onboarding")
    except stripe.error.StripeError as e:
        raise _stripe_unavailable(e)
    return {"url": link.url, "account_id": acct_doc["account_id"]}


async def _account_status(user_id: str) -> dict:
    doc = await db.connected_accounts.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        return {"connected": False}
    try:
        acct = stripe.Account.retrieve(doc["account_id"])
        status = {"connected": True, "account_id": doc["account_id"], "country": doc["country"], "currency": doc.get("currency"),
                  "charges_enabled": bool(acct.get("charges_enabled")), "payouts_enabled": bool(acct.get("payouts_enabled")),
                  "requirements_due": list((acct.get("requirements") or {}).get("currently_due") or []), "disabled_reason": (acct.get("requirements") or {}).get("disabled_reason"),
                  "has_bank_account": bool((acct.get("external_accounts") or {}).get("data"))}
        await db.connected_accounts.update_one({"user_id": user_id}, {"$set": {"charges_enabled": status["charges_enabled"], "payouts_enabled": status["payouts_enabled"], "status": "active" if status["payouts_enabled"] else "onboarding", "checked_at": now_iso()}})
        return status
    except stripe.error.StripeError as e:
        return {"connected": True, "account_id": doc["account_id"], "country": doc["country"], "currency": doc.get("currency"), "error": str(e)[:200]}


@router.get("/connect/status")
async def connect_status(current_user: User = Depends(get_current_user)):
    return await _account_status(current_user.id)


@router.post("/connect/dashboard")
async def connect_dashboard(current_user: User = Depends(get_current_user)):
    doc = await db.connected_accounts.find_one({"user_id": current_user.id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Sin cuenta conectada")
    try:
        return {"url": stripe.Account.create_login_link(doc["account_id"]).url}
    except stripe.error.StripeError as e:
        raise _stripe_unavailable(e)


# ───────────────────────── checkout (server computes everything) ─────────────────────────
class CheckoutBody(BaseModel):
    kind: str  # live_ticket | gift | marketplace | piup | promotion
    ref_id: str  # live id / live id (gift) / product id / piup order id / post id (promotion)
    origin_url: str
    option: Optional[str] = None  # gift type / promo package
    quantity: int = Field(1, ge=1, le=20)
    discount_code: Optional[str] = None


async def _price_for(body: CheckoutBody, buyer: User) -> dict:
    """Resolve what is being bought → {name, unit_minor, currency, seller_id|None, meta}."""
    k = body.kind
    if k == "live_ticket":
        live = await db.lives.find_one({"id": body.ref_id}, {"_id": 0})
        if not live or not live.get("ticket_price_minor"):
            raise HTTPException(status_code=404, detail="Este live no vende entradas")
        if live["host_id"] == buyer.id:
            raise HTTPException(status_code=400, detail="Eres el anfitrión")
        return {"name": f"Entrada · {live.get('title', 'Live privado')}", "unit_minor": int(live["ticket_price_minor"]), "currency": live.get("ticket_currency", "usd"), "seller_id": live["host_id"], "meta": {"live_id": live["id"]}}
    if k == "gift":
        live = await db.lives.find_one({"id": body.ref_id}, {"_id": 0, "host_id": 1, "title": 1, "allow_gifts": 1, "status": 1})
        g = GIFT_CATALOG.get(body.option or "")
        if not live or not g:
            raise HTTPException(status_code=404, detail="Regalo o live no válido")
        if live.get("status") != "live" or live.get("allow_gifts") is False:
            raise HTTPException(status_code=400, detail="Este live no acepta regalos ahora")
        return {"name": f"Regalo {g['name']} · {live.get('title', '')}", "unit_minor": g["usd"], "currency": "usd", "seller_id": live["host_id"], "meta": {"live_id": body.ref_id, "gift_type": body.option}}
    if k == "marketplace":
        p = await db.marketplace_products.find_one({"id": body.ref_id}, {"_id": 0})
        if not p or p.get("status") not in (None, "active", "available"):
            raise HTTPException(status_code=404, detail="Producto no disponible")
        if p.get("seller_id") == buyer.id or p.get("user_id") == buyer.id:
            raise HTTPException(status_code=400, detail="Es tu propio producto")
        cur = (p.get("currency") or "usd").lower()
        return {"name": p.get("title") or p.get("name") or "Producto", "unit_minor": to_minor(float(p["price"]), cur), "currency": cur, "seller_id": p.get("seller_id") or p.get("user_id"), "meta": {"product_id": p["id"]}, "shipping_minor": to_minor(float(p.get("shipping_cost") or 0), cur)}
    if k == "piup":
        o = await db.piup_orders.find_one({"id": body.ref_id, "user_id": buyer.id}, {"_id": 0})
        if not o:
            raise HTTPException(status_code=404, detail="Pedido PIUP no encontrado")
        cur = (o.get("currency") or "usd").lower()
        return {"name": f"PIUP · {o.get('product_name') or o.get('design') or 'Tarjeta NFC'}", "unit_minor": to_minor(float(o.get("total") or o.get("price") or 0), cur), "currency": cur, "seller_id": None, "meta": {"piup_order_id": o["id"]}, "shipping_minor": 0}
    if k == "promotion":
        pk = PROMO_PACKAGES.get(body.option or "")
        post = await db.posts.find_one({"id": body.ref_id, "user_id": buyer.id}, {"_id": 0, "id": 1})
        if not pk or not post:
            raise HTTPException(status_code=404, detail="Publicación o paquete no válido")
        return {"name": pk["name"], "unit_minor": pk["usd"], "currency": "usd", "seller_id": None, "meta": {"post_id": body.ref_id, "package": body.option, "days": pk["days"]}}
    raise HTTPException(status_code=400, detail="Tipo de compra no válido")


async def _discount(code: Optional[str], seller_id: Optional[str], subtotal: int, kind: str = "", currency: str = "usd") -> dict:
    if not code:
        return {"minor": 0, "code": None}
    if not seller_id:
        raise HTTPException(status_code=400, detail="Este producto no admite cupones")
    d = await db.discount_codes.find_one({"code": code.strip().upper(), "seller_id": seller_id}, {"_id": 0})
    if not d or not d.get("active"):
        raise HTTPException(status_code=400, detail="Cupón no válido")
    if d.get("expires_at") and d["expires_at"] < now_iso():
        raise HTTPException(status_code=400, detail="Este cupón ha caducado")
    if d.get("max_uses") and int(d.get("uses_count") or 0) >= int(d["max_uses"]):
        raise HTTPException(status_code=400, detail="Este cupón ya alcanzó su límite de usos")
    if d.get("applies_to", "all") != "all" and kind and d["applies_to"] != kind:
        raise HTTPException(status_code=400, detail=f"Este cupón solo vale para {KIND_LABEL.get(d['applies_to'], d['applies_to']).lower()}")
    if d.get("pct"):
        minor = int(subtotal * float(d["pct"]) / 100)
    else:
        if (d.get("currency") or "usd") != currency:
            raise HTTPException(status_code=400, detail=f"Este cupón es en {(d.get('currency') or 'usd').upper()}, no en {currency.upper()}")
        minor = int(d.get("amount_minor") or 0)
    return {"minor": min(minor, subtotal), "code": d["code"], "coupon_id": d["id"], "funded_by": "seller"}


# ───────────────────────── creator coupons (seller funds the discount) ─────────────────────────
KIND_LABEL = {"live_ticket": "Entradas a lives", "gift": "Regalos", "marketplace": "Marketplace", "all": "Todo"}


class CouponBody(BaseModel):
    code: str = Field(..., min_length=3, max_length=24)
    pct: Optional[float] = Field(None, gt=0, le=100)
    amount: Optional[float] = Field(None, gt=0)
    currency: str = "usd"
    applies_to: str = "all"  # all | live_ticket | gift | marketplace
    max_uses: Optional[int] = Field(None, ge=1, le=100000)
    expires_at: Optional[str] = None  # ISO date/datetime


def _coupon_out(d: dict) -> dict:
    cur = d.get("currency") or "usd"
    return {**d, "amount": fmt_minor(int(d["amount_minor"]), cur) if d.get("amount_minor") else None, "uses_count": int(d.get("uses_count") or 0),
            "expired": bool(d.get("expires_at") and d["expires_at"] < now_iso()), "exhausted": bool(d.get("max_uses") and int(d.get("uses_count") or 0) >= int(d["max_uses"]))}


@router.get("/coupons")
async def my_coupons(current_user: User = Depends(get_current_user)):
    docs = await db.discount_codes.find({"seller_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [_coupon_out(d) for d in docs]


@router.post("/coupons", status_code=201)
async def create_coupon(body: CouponBody, current_user: User = Depends(get_current_user)):
    code = body.code.strip().upper()
    if not code.replace("-", "").replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="El código solo puede tener letras, números, guiones y guiones bajos")
    if bool(body.pct) == bool(body.amount):
        raise HTTPException(status_code=400, detail="Indica un porcentaje o un importe fijo (solo uno)")
    if body.applies_to not in KIND_LABEL:
        raise HTTPException(status_code=400, detail="Ámbito no válido")
    expires = None
    if body.expires_at:
        try:
            dt = datetime.fromisoformat(body.expires_at.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            expires = dt.astimezone(timezone.utc).isoformat()
        except ValueError:
            raise HTTPException(status_code=400, detail="Fecha de caducidad no válida")
        if expires < now_iso():
            raise HTTPException(status_code=400, detail="La fecha de caducidad ya pasó")
    if await db.discount_codes.find_one({"seller_id": current_user.id, "code": code}, {"_id": 0, "id": 1}):
        raise HTTPException(status_code=409, detail="Ya tienes un cupón con ese código")
    cur = body.currency.lower()
    doc = {"id": str(uuid.uuid4()), "seller_id": current_user.id, "code": code, "pct": body.pct, "amount_minor": to_minor(body.amount, cur) if body.amount else None, "currency": cur if body.amount else None,
           "applies_to": body.applies_to, "max_uses": body.max_uses, "uses_count": 0, "expires_at": expires, "active": True, "created_at": now_iso()}
    await db.discount_codes.insert_one(dict(doc))
    return _coupon_out(doc)


@router.patch("/coupons/{coupon_id}")
async def toggle_coupon(coupon_id: str, current_user: User = Depends(get_current_user)):
    d = await db.discount_codes.find_one({"id": coupon_id, "seller_id": current_user.id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Cupón no encontrado")
    await db.discount_codes.update_one({"id": coupon_id}, {"$set": {"active": not d.get("active"), "updated_at": now_iso()}})
    return _coupon_out({**d, "active": not d.get("active")})


@router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, current_user: User = Depends(get_current_user)):
    res = await db.discount_codes.delete_one({"id": coupon_id, "seller_id": current_user.id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Cupón no encontrado")
    return {"deleted": True}


@router.post("/quote")
async def quote(body: CheckoutBody, current_user: User = Depends(get_current_user)):
    """What the buyer will pay and how it splits — shown before confirming."""
    item = await _price_for(body, current_user)
    fees = await get_fees()
    subtotal = item["unit_minor"] * body.quantity
    disc = await _discount(body.discount_code, item.get("seller_id"), subtotal, body.kind, item["currency"])
    base = subtotal - disc["minor"]
    shipping = int(item.get("shipping_minor") or 0)
    pct = fees[CREATOR_KINDS[body.kind]] if body.kind in CREATOR_KINDS else 0.0
    fee = int(round(base * pct / 100))
    cur = item["currency"]
    return {"name": item["name"], "currency": cur, "subtotal": fmt_minor(subtotal, cur), "discount": fmt_minor(disc["minor"], cur), "discount_code": disc["code"], "shipping": fmt_minor(shipping, cur),
            "total": fmt_minor(base + shipping, cur), "bruno_fee_pct": pct, "bruno_fee": fmt_minor(fee, cur), "seller_net": fmt_minor(base - fee + shipping, cur) if item.get("seller_id") else None,
            "processor_fees_paid_by": "bruno", "discount_funded_by": "seller", "is_platform_sale": body.kind in PLATFORM_KINDS, "accepts_coupons": bool(item.get("seller_id"))}


@router.post("/checkout")
async def create_checkout(body: CheckoutBody, current_user: User = Depends(get_current_user)):
    item = await _price_for(body, current_user)
    fees = await get_fees()
    cur = item["currency"]
    subtotal = item["unit_minor"] * body.quantity
    disc = await _discount(body.discount_code, item.get("seller_id"), subtotal, body.kind, cur)
    base = subtotal - disc["minor"]
    shipping = int(item.get("shipping_minor") or 0)
    total = base + shipping
    if total < MIN_CHARGE.get(cur, 50):
        raise HTTPException(status_code=400, detail="Importe inferior al mínimo permitido")
    pct = fees[CREATOR_KINDS[body.kind]] if body.kind in CREATOR_KINDS else 0.0
    fee = int(round(base * pct / 100))

    seller_acct = None
    if item.get("seller_id"):
        if body.kind == "live_ticket":
            paid = await db.ledger_entries.find_one({"kind": "live_ticket", "buyer_id": current_user.id, "meta.live_id": body.ref_id, "status": "paid"}, {"_id": 0, "id": 1})
            if paid:
                raise HTTPException(status_code=400, detail="Ya tienes entrada para este live")
        acct = await db.connected_accounts.find_one({"user_id": item["seller_id"]}, {"_id": 0})
        if not acct or not acct.get("charges_enabled"):
            st = await _account_status(item["seller_id"]) if acct else {"connected": False}
            if not st.get("charges_enabled"):
                raise HTTPException(status_code=409, detail={"code": "seller_not_ready", "message": "Este creador/vendedor aún no ha completado su cuenta de cobros en BRUNO. No se puede cobrar hasta que la active."})
        seller_acct = acct["account_id"]

    entry_id = str(uuid.uuid4())
    line_items = [{"price_data": {"currency": cur, "unit_amount": item["unit_minor"] if not disc["minor"] else int(base / body.quantity), "product_data": {"name": item["name"]}}, "quantity": body.quantity}]
    if shipping:
        line_items.append({"price_data": {"currency": cur, "unit_amount": shipping, "product_data": {"name": "Envío"}}, "quantity": 1})
    kwargs = dict(mode="payment", line_items=line_items, client_reference_id=entry_id,
                  success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&kind={body.kind}&ref={body.ref_id}",
                  cancel_url=f"{body.origin_url}/payment/cancel?kind={body.kind}&ref={body.ref_id}",
                  metadata={"ledger_id": entry_id, "kind": body.kind, "ref_id": body.ref_id, "buyer_id": current_user.id, "seller_id": item.get("seller_id") or ""},
                  payment_intent_data={"metadata": {"ledger_id": entry_id, "kind": body.kind}})
    if seller_acct:
        kwargs["payment_intent_data"].update({"application_fee_amount": fee, "transfer_data": {"destination": seller_acct}})
    try:
        session = stripe.checkout.Session.create(**kwargs)
    except stripe.error.StripeError as e:
        raise _stripe_unavailable(e)
    entry = {"id": entry_id, "kind": body.kind, "ref_id": body.ref_id, "buyer_id": current_user.id, "seller_id": item.get("seller_id"), "seller_account": seller_acct,
             "currency": cur, "subtotal_minor": subtotal, "discount_minor": disc["minor"], "discount_code": disc["code"], "shipping_minor": shipping, "total_minor": total,
             "fee_pct": pct, "fee_minor": fee, "seller_net_minor": (base - fee + shipping) if seller_acct else 0, "platform_revenue_minor": total if body.kind in PLATFORM_KINDS else fee,
             "refunded_minor": 0, "disputed": False, "status": "initiated", "session_id": session.id, "payment_intent": None, "meta": item.get("meta") or {}, "name": item["name"],
             "quantity": body.quantity, "created_at": now_iso(), "updated_at": now_iso(), "fee_snapshot": fees, "coupon_id": disc.get("coupon_id"), "origin_url": body.origin_url.rstrip("/")}
    await db.ledger_entries.insert_one(dict(entry))
    return {"checkout_url": session.url, "session_id": session.id, "ledger_id": entry_id}


# ───────────────────────── fulfilment + webhook ─────────────────────────
async def _fulfil(entry: dict):
    k, m = entry["kind"], entry.get("meta") or {}
    ts = now_iso()
    if k == "live_ticket":
        await db.live_tickets.update_one({"live_id": m["live_id"], "user_id": entry["buyer_id"]}, {"$set": {"live_id": m["live_id"], "user_id": entry["buyer_id"], "ledger_id": entry["id"], "paid_at": ts}}, upsert=True)
        await db.lives.update_one({"id": m["live_id"]}, {"$inc": {"tickets_sold": 1, "ticket_revenue_minor": entry["total_minor"]}})
    elif k == "gift":
        await db.lives.update_one({"id": m["live_id"]}, {"$inc": {"total_gifts": 1, "paid_gift_revenue_minor": entry["total_minor"]}})
        await db.live_gifts.insert_one({"id": str(uuid.uuid4()), "live_id": m["live_id"], "from_user_id": entry["buyer_id"], "gift_type": m.get("gift_type"), "paid": True, "amount_minor": entry["total_minor"], "currency": entry["currency"], "ledger_id": entry["id"], "created_at": ts})
        try:
            from routers.lives import _broadcast
            buyer = await db.users.find_one({"id": entry["buyer_id"]}, {"_id": 0, "name": 1})
            await _broadcast(m["live_id"], {"type": "gift", "gift_type": m.get("gift_type"), "amount": 1, "value": fmt_minor(entry["total_minor"], entry["currency"]), "paid": True, "currency": entry["currency"], "user_name": (buyer or {}).get("name", "Alguien")})
        except Exception:
            pass
    elif k == "marketplace":
        await db.marketplace_orders.update_one({"ledger_id": entry["id"]}, {"$set": {"id": str(uuid.uuid4()), "ledger_id": entry["id"], "product_id": m["product_id"], "buyer_id": entry["buyer_id"], "seller_id": entry["seller_id"], "quantity": entry["quantity"], "total_minor": entry["total_minor"], "currency": entry["currency"], "status": "paid", "paid_in_bruno": True, "created_at": ts}}, upsert=True)
    elif k == "piup":
        await db.piup_orders.update_one({"id": m["piup_order_id"]}, {"$set": {"payment_status": "paid", "status": "paid", "ledger_id": entry["id"], "paid_at": ts}})
    elif k == "promotion":
        from datetime import timedelta
        ends = (datetime.now(timezone.utc) + timedelta(days=int(m.get("days") or 7))).isoformat()
        await db.promotions.update_one({"ledger_id": entry["id"]}, {"$set": {"id": str(uuid.uuid4()), "ledger_id": entry["id"], "post_id": m["post_id"], "user_id": entry["buyer_id"], "package": m.get("package"), "status": "active", "starts_at": ts, "ends_at": ends, "is_ad": True, "impressions": 0, "clicks": 0}}, upsert=True)
        await db.posts.update_one({"id": m["post_id"]}, {"$set": {"is_promoted": True, "promoted_until": ends, "is_ad": True}})


async def _mark_paid(session: dict) -> Optional[dict]:
    entry = await db.ledger_entries.find_one_and_update({"session_id": session["id"], "status": {"$nin": ["paid", "refunded", "partially_refunded"]}},
                                                        {"$set": {"status": "paid", "paid_at": now_iso(), "payment_intent": session.get("payment_intent"), "updated_at": now_iso()}}, projection={"_id": 0})
    if entry:
        await _fulfil({**entry, "payment_intent": session.get("payment_intent")})
        if entry.get("coupon_id"):
            await db.discount_codes.update_one({"id": entry["coupon_id"]}, {"$inc": {"uses_count": 1}, "$set": {"last_used_at": now_iso()}})
        asyncio.create_task(_send_receipt(entry, quiet=True))
    return entry


KIND_RECEIPT = {"live_ticket": "Entrada a live privado", "gift": "Regalo en vivo", "marketplace": "Compra en Marketplace", "piup": "Pedido PIUP", "promotion": "Promoción de publicación"}


async def _send_receipt(entry: dict, quiet: bool = False) -> Optional[str]:
    """Email receipt to the buyer (server-side template, recipient from DB). Never blocks fulfilment."""
    buyer = await db.users.find_one({"id": entry["buyer_id"]}, {"_id": 0, "email": 1, "name": 1})
    if not buyer or not buyer.get("email"):
        return None
    seller = await db.users.find_one({"id": entry["seller_id"]}, {"_id": 0, "name": 1}) if entry.get("seller_id") else None
    cur = entry["currency"]
    money = lambda m: f"{fmt_minor(int(m), cur):,.2f} {cur.upper()}" if cur not in ZERO_DECIMAL else f"{int(m):,} {cur.upper()}"
    paid_at = entry.get("paid_at") or entry["created_at"]
    try:
        date_label = datetime.fromisoformat(paid_at).strftime("%d/%m/%Y %H:%M UTC")
    except ValueError:
        date_label = paid_at[:16]
    app_url = (entry.get("origin_url") or os.environ.get("FRONTEND_URL") or "").rstrip("/")
    html = receipt_html(buyer_name=buyer.get("name") or "hola", item_name=entry["name"], kind_label=KIND_RECEIPT.get(entry["kind"], entry["kind"]), date_label=date_label,
                        receipt_no=entry["id"][:8].upper(), subtotal=money(entry["subtotal_minor"]), discount=money(entry["discount_minor"]) if entry.get("discount_minor") else None,
                        discount_code=entry.get("discount_code"), shipping=money(entry["shipping_minor"]) if entry.get("shipping_minor") else None, total=money(entry["total_minor"]),
                        seller_name=(seller or {}).get("name"), app_url=app_url if app_url.startswith("https://") else None)
    try:
        email_id = await send_email(to=buyer["email"], subject=f"Recibo BRUNO · {entry['name'][:60]}", html=html)
        await db.ledger_entries.update_one({"id": entry["id"]}, {"$set": {"receipt_sent_at": now_iso(), "receipt_email_id": email_id, "receipt_to": buyer["email"]}})
        return email_id
    except HTTPException as e:
        await db.ledger_entries.update_one({"id": entry["id"]}, {"$set": {"receipt_error": str(e.detail)[:200], "receipt_error_at": now_iso()}})
        if quiet:
            logger.warning(f"Receipt not sent for {entry['id']}: {e.detail}")
            return None
        raise
    except Exception as e:
        logger.error(f"Receipt failed for {entry['id']}: {e}")
        await db.ledger_entries.update_one({"id": entry["id"]}, {"$set": {"receipt_error": str(e)[:200], "receipt_error_at": now_iso()}})
        return None


@router.post("/purchases/{ledger_id}/receipt")
async def resend_receipt(ledger_id: str, current_user: User = Depends(get_current_user)):
    entry = await db.ledger_entries.find_one({"id": ledger_id, "buyer_id": current_user.id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    if entry["status"] not in ("paid", "partially_refunded", "refunded"):
        raise HTTPException(status_code=400, detail="Esta compra aún no está pagada")
    recent = entry.get("receipt_sent_at")
    if recent and (datetime.now(timezone.utc) - datetime.fromisoformat(recent)).total_seconds() < 60:
        raise HTTPException(status_code=429, detail="Acabamos de enviarte el recibo. Espera un minuto.")
    email_id = await _send_receipt(entry)
    return {"sent": bool(email_id), "to": (await db.users.find_one({"id": current_user.id}, {"_id": 0, "email": 1}) or {}).get("email")}


@router.get("/status/{session_id}")
async def payment_status(session_id: str):
    entry = await db.ledger_entries.find_one({"session_id": session_id}, {"_id": 0, "status": 1, "kind": 1, "ref_id": 1})
    if not entry:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    if entry["status"] not in ("paid", "refunded", "partially_refunded"):
        try:  # webhook fallback — same idempotent guard
            s = stripe.checkout.Session.retrieve(session_id)
            if s.get("payment_status") == "paid":
                await _mark_paid(s)
                entry["status"] = "paid"
            elif s.get("status") == "expired":
                await db.ledger_entries.update_one({"session_id": session_id, "status": "initiated"}, {"$set": {"status": "expired", "updated_at": now_iso()}})
                entry["status"] = "expired"
        except stripe.error.StripeError:
            pass
    return {"session_id": session_id, "status": entry["status"], "kind": entry["kind"], "ref_id": entry["ref_id"]}


async def handle_stripe_event(event: dict) -> dict:
    """Idempotent on event id; tolerant to out-of-order delivery."""
    if await db.stripe_events.find_one({"id": event["id"]}, {"_id": 0, "id": 1}):
        return {"status": "duplicate"}
    await db.stripe_events.insert_one({"id": event["id"], "type": event["type"], "created": event.get("created"), "received_at": now_iso(), "account": event.get("account")})
    obj, t = event["data"]["object"], event["type"]
    if t in ("checkout.session.completed", "checkout.session.async_payment_succeeded") and obj.get("payment_status", "paid") == "paid":
        await _mark_paid(obj)
    elif t in ("checkout.session.async_payment_failed",):
        await db.ledger_entries.update_one({"session_id": obj["id"], "status": "initiated"}, {"$set": {"status": "failed", "updated_at": now_iso()}})
    elif t == "checkout.session.expired":
        await db.ledger_entries.update_one({"session_id": obj["id"], "status": "initiated"}, {"$set": {"status": "expired", "updated_at": now_iso()}})
    elif t == "charge.refunded":
        refunded = int(obj.get("amount_refunded") or 0)
        entry = await db.ledger_entries.find_one({"payment_intent": obj.get("payment_intent")}, {"_id": 0})
        if entry:
            full = refunded >= entry["total_minor"]
            ratio = refunded / entry["total_minor"] if entry["total_minor"] else 0
            await db.ledger_entries.update_one({"id": entry["id"]}, {"$set": {"refunded_minor": refunded, "fee_refunded_minor": int(round(entry["fee_minor"] * ratio)), "status": "refunded" if full else "partially_refunded", "updated_at": now_iso()}})
            if full and entry["kind"] == "live_ticket":
                await db.live_tickets.delete_one({"ledger_id": entry["id"]})
    elif t == "charge.dispute.created":
        await db.ledger_entries.update_one({"payment_intent": obj.get("payment_intent")}, {"$set": {"disputed": True, "dispute_status": obj.get("status"), "dispute_amount_minor": obj.get("amount"), "updated_at": now_iso()}})
    elif t == "charge.dispute.closed":
        await db.ledger_entries.update_one({"payment_intent": obj.get("payment_intent")}, {"$set": {"dispute_status": obj.get("status"), "updated_at": now_iso()}})
    elif t == "account.updated":
        await db.connected_accounts.update_one({"account_id": obj["id"]}, {"$set": {"charges_enabled": bool(obj.get("charges_enabled")), "payouts_enabled": bool(obj.get("payouts_enabled")), "requirements_due": list((obj.get("requirements") or {}).get("currently_due") or []), "checked_at": now_iso()}})
    elif t in ("payout.paid", "payout.failed"):
        await db.payout_requests.update_one({"payout_id": obj["id"]}, {"$set": {"status": "paid" if t == "payout.paid" else "failed", "failure": obj.get("failure_message"), "updated_at": now_iso()}})
    return {"status": "ok"}


webhook_router = APIRouter(tags=["money"])


@webhook_router.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid signature")
    return await handle_stripe_event(event if isinstance(event, dict) else event.to_dict())


# ───────────────────────── earnings (per user, per currency) ─────────────────────────
def _sum(entries: List[dict]) -> dict:
    out = {}
    for e in entries:
        c = out.setdefault(e["currency"], {"gross": 0, "discounts": 0, "fees": 0, "refunds": 0, "net": 0, "count": 0, "disputed": 0})
        if e["status"] in ("paid", "partially_refunded", "refunded"):
            c["gross"] += e["subtotal_minor"] + e.get("shipping_minor", 0)
            c["discounts"] += e["discount_minor"]
            c["fees"] += e["fee_minor"] - int(e.get("fee_refunded_minor") or 0)
            c["refunds"] += int(e.get("refunded_minor") or 0)
            c["count"] += 1
            if e.get("disputed"):
                c["disputed"] += 1
    for cur, c in out.items():
        c["net"] = c["gross"] - c["discounts"] - c["fees"] - c["refunds"]
        for k in list(c):
            if k not in ("count", "disputed"):
                c[k] = fmt_minor(c[k], cur)
    return out


@router.get("/earnings")
async def my_earnings(current_user: User = Depends(get_current_user)):
    entries = await db.ledger_entries.find({"seller_id": current_user.id, "status": {"$in": ["paid", "partially_refunded", "refunded"]}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    by_kind = {}
    for e in entries:
        k = by_kind.setdefault(e["kind"], {})
        k[e["currency"]] = round(k.get(e["currency"], 0) + fmt_minor(e["seller_net_minor"] - int(e.get("refunded_minor") or 0) + int(e.get("fee_refunded_minor") or 0), e["currency"]), 2)
    acct = await _account_status(current_user.id)
    balances = {"available": {}, "pending": {}}
    if acct.get("connected") and not acct.get("error"):
        try:
            bal = stripe.Balance.retrieve(stripe_account=acct["account_id"])
            for b in bal.get("available", []):
                balances["available"][b["currency"]] = fmt_minor(b["amount"], b["currency"])
            for b in bal.get("pending", []):
                balances["pending"][b["currency"]] = fmt_minor(b["amount"], b["currency"])
        except stripe.error.StripeError:
            pass
    payouts = await db.payout_requests.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    paid_out = {}
    for p in payouts:
        if p["status"] == "paid":
            paid_out[p["currency"]] = round(paid_out.get(p["currency"], 0) + fmt_minor(p["amount_minor"], p["currency"]), 2)
    rows = [{"id": e["id"], "date": e.get("paid_at") or e["created_at"], "kind": e["kind"], "name": e["name"], "currency": e["currency"], "gross": fmt_minor(e["subtotal_minor"] + e.get("shipping_minor", 0), e["currency"]), "discount": fmt_minor(e["discount_minor"], e["currency"]),
             "bruno_fee": fmt_minor(e["fee_minor"], e["currency"]), "refunded": fmt_minor(int(e.get("refunded_minor") or 0), e["currency"]), "net": fmt_minor(e["seller_net_minor"] - int(e.get("refunded_minor") or 0) + int(e.get("fee_refunded_minor") or 0), e["currency"]),
             "status": e["status"], "disputed": bool(e.get("disputed")), "ref_id": e["ref_id"], "fee_pct": e["fee_pct"]} for e in entries]
    return {"summary": _sum(entries), "by_kind": by_kind, "balances": balances, "paid_out": paid_out, "account": acct, "rows": rows, "payouts": payouts,
            "notes": {"processor_fees": "BRUNO asume las comisiones de Stripe dentro de su porcentaje", "available_vs_pending": "Solo el saldo disponible se puede retirar; el pendiente lo libera Stripe en unos días"}}


@router.get("/earnings.csv")
async def earnings_csv(current_user: User = Depends(get_current_user)):
    data = await my_earnings(current_user)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["fecha", "tipo", "concepto", "moneda", "bruto", "descuento", "comision_bruno", "reembolsado", "neto", "estado", "disputa"])
    for r in data["rows"]:
        w.writerow([r["date"], r["kind"], r["name"], r["currency"], r["gross"], r["discount"], r["bruno_fee"], r["refunded"], r["net"], r["status"], "si" if r["disputed"] else "no"])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=mis-ingresos-bruno.csv"})


class PayoutBody(BaseModel):
    currency: str
    amount: Optional[float] = None  # default: full available


@router.post("/payout")
async def request_payout(body: PayoutBody, current_user: User = Depends(get_current_user)):
    acct = await _account_status(current_user.id)
    if not acct.get("connected"):
        raise HTTPException(status_code=400, detail="Primero conecta tu cuenta de cobros")
    if not acct.get("payouts_enabled"):
        raise HTTPException(status_code=400, detail={"code": "payouts_disabled", "message": "Stripe aún no permite pagos a tu cuenta. Completa los requisitos pendientes.", "requirements_due": acct.get("requirements_due", [])})
    cur = body.currency.lower()
    pending = await db.payout_requests.find_one({"user_id": current_user.id, "status": {"$in": ["requested", "pending", "in_transit"]}}, {"_id": 0, "id": 1})
    if pending:
        raise HTTPException(status_code=409, detail="Ya tienes un retiro en curso")
    try:
        bal = stripe.Balance.retrieve(stripe_account=acct["account_id"])
        available = next((b["amount"] for b in bal.get("available", []) if b["currency"] == cur), 0)
        amount = to_minor(body.amount, cur) if body.amount else available
        if amount <= 0 or amount > available:
            raise HTTPException(status_code=400, detail=f"Saldo disponible insuficiente ({fmt_minor(available, cur)} {cur.upper()})")
        req_id = str(uuid.uuid4())
        payout = stripe.Payout.create(amount=amount, currency=cur, metadata={"bruno_user_id": current_user.id, "request_id": req_id}, stripe_account=acct["account_id"], idempotency_key=f"payout-{req_id}")
    except stripe.error.StripeError as e:
        await db.payout_requests.insert_one({"id": str(uuid.uuid4()), "user_id": current_user.id, "currency": cur, "amount_minor": 0, "status": "failed", "failure": str(e)[:300], "created_at": now_iso()})
        raise HTTPException(status_code=502, detail={"code": "payout_failed", "message": str(getattr(e, "user_message", None) or e)[:300]})
    doc = {"id": req_id, "user_id": current_user.id, "currency": cur, "amount_minor": amount, "payout_id": payout.id, "status": payout.status, "arrival_date": payout.get("arrival_date"), "created_at": now_iso(), "updated_at": now_iso()}
    await db.payout_requests.insert_one(dict(doc))
    return doc


# ───────────────────────── refunds + admin ─────────────────────────
class RefundBody(BaseModel):
    ledger_id: str
    amount: Optional[float] = None
    reason: Optional[str] = None


@router.post("/refund")
async def refund(body: RefundBody, current_user: User = Depends(get_current_user)):
    entry = await db.ledger_entries.find_one({"id": body.ledger_id}, {"_id": 0})
    if not entry or not entry.get("payment_intent"):
        raise HTTPException(status_code=404, detail="Operación no encontrada o no pagada")
    if not (is_admin(current_user) or entry.get("seller_id") == current_user.id):
        raise HTTPException(status_code=403, detail="Sin permiso")
    kwargs = {"payment_intent": entry["payment_intent"], "metadata": {"ledger_id": entry["id"], "by": current_user.id, "reason": body.reason or ""}}
    if body.amount:
        kwargs["amount"] = to_minor(body.amount, entry["currency"])
    if entry.get("seller_account"):
        kwargs.update({"reverse_transfer": True, "refund_application_fee": True})
    try:
        r = stripe.Refund.create(**kwargs, idempotency_key=f"refund-{entry['id']}-{kwargs.get('amount', 'full')}")
    except stripe.error.StripeError as e:
        raise _stripe_unavailable(e)
    return {"refund_id": r.id, "status": r.status, "amount": fmt_minor(r.amount, entry["currency"])}


@router.get("/admin/overview")
async def admin_overview(current_user: User = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    entries = await db.ledger_entries.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    agg = {}
    for e in entries:
        c = agg.setdefault(e["currency"], {"third_party_gross": 0, "bruno_fees": 0, "commercial_revenue": 0, "transfers_to_sellers": 0, "refunds": 0, "disputes": 0, "fees_refunded": 0, "count_paid": 0})
        if e["status"] in ("paid", "partially_refunded", "refunded"):
            c["count_paid"] += 1
            if e["kind"] in PLATFORM_KINDS:
                c["commercial_revenue"] += e["total_minor"] - int(e.get("refunded_minor") or 0)
            else:
                c["third_party_gross"] += e["total_minor"]
                c["bruno_fees"] += e["fee_minor"]
                c["fees_refunded"] += int(e.get("fee_refunded_minor") or 0)
                c["transfers_to_sellers"] += e["seller_net_minor"]
            c["refunds"] += int(e.get("refunded_minor") or 0)
            if e.get("disputed"):
                c["disputes"] += int(e.get("dispute_amount_minor") or e["total_minor"])
    for cur, c in agg.items():
        c["bruno_net_fees"] = fmt_minor(c["bruno_fees"] - c["fees_refunded"], cur)
        for k in list(c):
            if k not in ("count_paid", "bruno_net_fees"):
                c[k] = fmt_minor(c[k], cur)
    platform_balance = {}
    try:
        bal = stripe.Balance.retrieve()
        platform_balance = {"available": {b["currency"]: fmt_minor(b["amount"], b["currency"]) for b in bal.get("available", [])}, "pending": {b["currency"]: fmt_minor(b["amount"], b["currency"]) for b in bal.get("pending", [])}}
    except stripe.error.StripeError as e:
        platform_balance = {"error": str(e)[:200]}
    accounts = await db.connected_accounts.count_documents({})
    active = await db.connected_accounts.count_documents({"payouts_enabled": True})
    fees_doc = await db.money_settings.find_one({"key": "fees"}, {"_id": 0})
    return {"by_currency": agg, "platform_balance": platform_balance, "connected_accounts": {"total": accounts, "payouts_enabled": active}, "fees": await get_fees(), "fees_history": (fees_doc or {}).get("history", [])[-20:],
            "recent": [{k: e.get(k) for k in ("id", "kind", "name", "currency", "status", "created_at", "buyer_id", "seller_id", "fee_pct")} | {"total": fmt_minor(e["total_minor"], e["currency"]), "bruno_fee": fmt_minor(e["fee_minor"], e["currency"]), "seller_net": fmt_minor(e["seller_net_minor"], e["currency"]), "refunded": fmt_minor(int(e.get("refunded_minor") or 0), e["currency"]), "disputed": bool(e.get("disputed"))} for e in entries[:200]],
            "reconciliation_note": "El dinero de terceros (bruto de creadores/vendedores) no es ingreso de BRUNO; solo las comisiones netas y las ventas comerciales (PIUP, promociones) lo son."}


@router.get("/purchases")
async def my_purchases(current_user: User = Depends(get_current_user)):
    entries = await db.ledger_entries.find({"buyer_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [{"id": e["id"], "date": e.get("paid_at") or e["created_at"], "kind": e["kind"], "name": e["name"], "currency": e["currency"], "total": fmt_minor(e["total_minor"], e["currency"]), "status": e["status"], "refunded": fmt_minor(int(e.get("refunded_minor") or 0), e["currency"]), "ref_id": e["ref_id"], "receipt_sent_at": e.get("receipt_sent_at"), "receipt_to": e.get("receipt_to")} for e in entries]


@router.get("/lives/{live_id}/ticket")
async def my_ticket(live_id: str, current_user: User = Depends(get_current_user)):
    t = await db.live_tickets.find_one({"live_id": live_id, "user_id": current_user.id}, {"_id": 0})
    live = await db.lives.find_one({"id": live_id}, {"_id": 0, "ticket_price_minor": 1, "ticket_currency": 1, "host_id": 1})
    return {"has_ticket": bool(t) or (live or {}).get("host_id") == current_user.id, "price": fmt_minor(int((live or {}).get("ticket_price_minor") or 0), (live or {}).get("ticket_currency", "usd")) if (live or {}).get("ticket_price_minor") else None, "currency": (live or {}).get("ticket_currency", "usd")}
