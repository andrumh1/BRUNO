"""Pedidos del servicio «Creamos tu tarjeta»: pago (Stripe US / Wompi CO), producción privada, revisión, aprobación y entrega."""
import asyncio
import hashlib
import hmac
import json
import logging
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from html import escape
from typing import Optional
from urllib.parse import urlencode

import httpx
import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from models.user import User
from utils.database import db
from utils.security import get_current_user, get_current_user_optional
from routers.bruno_service import OFFERS, RECIPIENT, STAFF_ROLES, _clean, _now, _signed_url, is_staff

logger = logging.getLogger("bruno.orders")
router = APIRouter(prefix="/bruno-service", tags=["bruno-service"])

PRODUCTION = ("received", "pending_payment", "paid", "in_preparation", "pending_approval", "changes_requested", "approved", "delivered", "cancelled")
PAYMENT = ("unpaid", "pending", "paid", "failed", "refunded", "disputed")
REVIEW_TTL_DAYS, CODE_TTL_MIN = 7, 10
CARD_HASH_SKIP = {"_id", "views", "updated_at", "created_at", "user_id", "production_hidden", "is_draft", "is_public", "show_in_feed", "sort_order", "service_order_id"}


def _frontend() -> str:
    return (os.environ.get("FRONTEND_URL") or "").strip('"').rstrip("/")


def _err(es: str, en: str, code: int = 400):
    return HTTPException(status_code=code, detail={"error": es, "errorEn": en})


def _staff(user: User):
    if not is_staff(user):
        raise HTTPException(status_code=403, detail="Solo equipo autorizado de BRUNO")


def _mask(email: str) -> str:
    name, _, dom = (email or "").partition("@")
    return f"{name[:2]}{'•' * max(1, len(name) - 2)}@{dom}"


def _t(lang: str, es: str, en: str) -> str:
    return en if lang == "en" else es


def card_hash(card: dict) -> str:
    body = {k: v for k, v in card.items() if k not in CARD_HASH_SKIP}
    return hashlib.sha256(json.dumps(body, sort_keys=True, default=str).encode()).hexdigest()


async def _history(order_id: str, action: str, by: Optional[str] = None, **extra):
    entry = {"at": _now().isoformat(), "action": action, "by": by, **extra}
    await db.service_requests.update_one({"id": order_id}, {"$push": {"history": entry}})


async def _set_production(order_id: str, status: str, by: Optional[str] = None, **extra):
    await db.service_requests.update_one({"id": order_id}, {"$set": {"production_status": status, "updated_at": _now().isoformat()}})
    await _history(order_id, f"status:{status}", by, **extra)


async def _get_order(order_id: str) -> dict:
    o = await db.service_requests.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return o


def _public(o: dict) -> dict:
    offer = OFFERS[o["market"]]
    return {"id": o["id"], "market": o["market"], "currency": o["currency"], "amount": o["amount"], "label": offer["label"], "language": o.get("language", "es"),
            "payment_status": o.get("payment_status", "unpaid"), "production_status": o.get("production_status", "received"), "card_type": o.get("type"),
            "provider": "wompi" if o["market"] == "CO" else "stripe", "provider_ready": _provider_ready(o["market"]), "created_at": o.get("created_at"),
            "review_version": o.get("review_version", 0), "publish_authorized": o.get("publish_authorized"), "delivered_at": o.get("delivered_at"), "card_id": o.get("card_id") if o.get("delivered_at") else None}


def _provider_ready(market: str) -> bool:
    if market == "CO":
        pub, prv = os.environ.get("WOMPI_PUBLIC_KEY", ""), os.environ.get("WOMPI_PRIVATE_KEY", "")
        ok_keys = pub.startswith(("pub_test_", "pub_prod_")) and prv.startswith(("prv_test_", "prv_prod_"))
        return ok_keys and all(os.environ.get(k) for k in ("WOMPI_INTEGRITY_SECRET", "WOMPI_EVENTS_SECRET"))
    return bool(os.environ.get("STRIPE_API_KEY"))


# ---------- correo y notificaciones ----------
def _mail(title: str, intro: str, rows: list, cta: Optional[tuple], footer: str) -> str:
    rws = "".join(f'<tr><td style="padding:5px 10px 5px 0;color:#6c6d64;font-size:13px;vertical-align:top">{escape(k)}</td><td style="padding:5px 0;font-size:14px">{escape(str(v))}</td></tr>' for k, v in rows)
    btn = f'<p style="margin:22px 0"><a href="{cta[1]}" style="background:#fa632e;color:#fff;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:700;display:inline-block">{escape(cta[0])}</a></p>' if cta else ""
    return (f'<div style="font-family:Arial,sans-serif;max-width:620px;color:#1c1c1a"><h2 style="margin:0 0 8px">{escape(title)}</h2><p style="margin:0 0 14px;color:#4a4b45">{escape(intro)}</p>'
            f'<table>{rws}</table>{btn}<p style="font-size:12px;color:#6c6d64;margin-top:18px">{escape(footer)}</p><p style="font-size:12px;color:#6c6d64">BRUNO · Octopus Vision Company · bruno@brunocard.com</p></div>')


async def _send_client_once(to: str, subject: str, html: str) -> tuple:
    from utils.email import send_email
    try:
        return "accepted", await send_email(to=to, subject=subject, html=html), None
    except HTTPException as e:
        retry = e.status_code in (502, 503, 500) and "no configurado" not in str(e.detail)
        return ("retrying" if retry else ("pending_configuration" if e.status_code == 503 else "failed")), None, str(e.detail)[:160]


async def _retry_client_email(order_id: str, at: str, to: str, subject: str, html: str):
    """Reintento en segundo plano (p. ej. 429/5xx del proveedor); nunca duplica un correo ya aceptado."""
    for delay in (30, 120, 600):
        await asyncio.sleep(delay)
        status, pid, err = await _send_client_once(to, subject, html)
        final = status if status != "retrying" else ("retrying" if delay < 600 else "failed")
        await db.service_requests.update_one({"id": order_id, "client_emails.at": at}, {"$set": {"client_emails.$.status": final, "client_emails.$.provider_id": pid, "client_emails.$.error": err}, "$inc": {"client_emails.$.attempts": 1}})
        if status != "retrying":
            return


async def _email_client(o: dict, subject: str, title: str, intro: str, rows: list, cta: Optional[tuple], footer: str, kind: str) -> str:
    html = _mail(title, intro, rows, cta, footer)
    status, pid, err = await _send_client_once(o["email"], subject, html)
    at = _now().isoformat()
    await db.service_requests.update_one({"id": o["id"]}, {"$push": {"client_emails": {"kind": kind, "at": at, "status": status, "provider_id": pid, "error": err, "attempts": 1}}})
    if status == "retrying":
        asyncio.create_task(_retry_client_email(o["id"], at, o["email"], subject, html))
    return status


async def _email_team(o: dict, subject: str, intro: str, rows: list):
    from utils.email import send_email
    try:
        await send_email(to=RECIPIENT, subject=subject, html=_mail(subject, intro, rows, (("Abrir pedido", f"{_frontend()}/admin/pedidos/{o['id']}") if _frontend().startswith("https://") else None), "Correo interno del flujo de pedidos."), reply_to=o.get("email"))
    except Exception as e:
        logger.warning(f"team email failed: {e}")


async def _notify_user(user_id: Optional[str], ntype: str, message: str, order_id: str, url: str, title: str):
    if not user_id:
        return
    try:
        from utils.notification_realtime import emit_notification_ws
        from routers.push_notifications import send_push_notification, NotificationPayload
        doc = {"id": str(uuid.uuid4()), "user_id": user_id, "actor_id": None, "type": ntype, "message": message, "target_id": order_id, "target_type": "service_order", "url": url, "is_read": False, "created_at": _now().isoformat()}
        await db.notifications.insert_one(dict(doc))
        await emit_notification_ws(doc)
        await send_push_notification(user_id, NotificationPayload(title=title, body=message, url=url, tag=f"order_{order_id}", data={"order_id": order_id, "url": url, "kind": ntype}))
    except Exception as e:
        logger.warning(f"order notification failed: {e}")


async def send_client_confirmation(o: dict):
    """Confirmación bilingüe al solicitante con su referencia (sin cobro)."""
    ref, label = o["id"], OFFERS[o["market"]]["label"]
    url = f"{_frontend()}/pedido/{ref}"
    rows = [("Referencia / Reference", ref), ("Tipo / Type", o["type"]), ("Tarjeta / Card", o["card_name"]), ("País / Country", "Colombia" if o["market"] == "CO" else "United States"), ("Valor / Price", label)]
    intro = ("Recibimos tu solicitud. Aún no se ha realizado ningún cobro: el siguiente paso es el pago seguro y después prepararemos tu tarjeta para que la revises y apruebes. "
             "We received your request. You have not been charged yet: the next step is the secure payment, then we will prepare your card for your review and approval.")
    await _email_client(o, f"BRUNO · Solicitud recibida / Request received · {ref[:8]}", "Solicitud recibida · Request received", intro, rows,
                        ("Ver mi pedido · View my order", url) if url.startswith("https://") else None,
                        "Guarda esta referencia. Si no hiciste esta solicitud, ignora este correo. · Keep this reference. If you did not make this request, ignore this email.", "confirmation")


# ---------- pago: Stripe (US) ----------
def _stripe():
    key = os.environ.get("STRIPE_API_KEY")
    if not key:
        raise _err("El pago con tarjeta aún no está habilitado.", "Card payment is not enabled yet.", 503)
    stripe.api_key = key
    if "sk_test_emergent" in key:
        stripe.api_base = "https://integrations.emergentagent.com/stripe"


async def _stripe_checkout(o: dict, attempt_id: str) -> str:
    _stripe()
    offer = OFFERS["US"]
    base = f"{_frontend()}/pedido/{o['id']}/pago"
    session = await asyncio.to_thread(stripe.checkout.Session.create, mode="payment", line_items=[{"quantity": 1, "price_data": {"currency": "usd", "unit_amount": offer["amount"] * 100,
                                      "product_data": {"name": "BRUNO + OVC · Diseño y configuración de tarjeta", "description": f"Pedido {o['id'][:8]} · Octopus Vision Company"}}}],
                                      customer_email=o["email"], client_reference_id=o["id"], metadata={"order_id": o["id"], "attempt_id": attempt_id, "kind": "bruno_service"},
                                      payment_intent_data={"metadata": {"order_id": o["id"], "kind": "bruno_service"}},
                                      success_url=f"{base}?session_id={{CHECKOUT_SESSION_ID}}", cancel_url=f"{base}?cancel=1", expires_at=int(_now().timestamp()) + 3600)
    await db.service_payments.update_one({"id": attempt_id}, {"$set": {"provider_ref": session.id, "status": "created"}})
    return session.url


async def _stripe_verify(session_id: str) -> Optional[dict]:
    """Consulta autenticada a Stripe: la única fuente de verdad para marcar pagado."""
    _stripe()
    s = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
    return {"id": s.id, "order_id": (s.metadata or {}).get("order_id"), "amount": s.amount_total, "currency": (s.currency or "").upper(), "paid": s.payment_status == "paid",
            "status": s.status, "payment_intent": s.payment_intent}


# ---------- pago: Wompi (CO) ----------
def _wompi_base() -> str:
    return (os.environ.get("WOMPI_API_BASE") or ("https://sandbox.wompi.co/v1" if (os.environ.get("WOMPI_PUBLIC_KEY") or "").startswith("pub_test") else "https://production.wompi.co/v1")).rstrip("/")


async def _wompi_checkout(o: dict, attempt_id: str, reference: str) -> str:
    if not _provider_ready("CO"):
        raise _err("El pago para Colombia aún no está habilitado. Escríbenos a bruno@brunocard.com.", "Payment for Colombia is not enabled yet. Email bruno@brunocard.com.", 503)
    cents = OFFERS["CO"]["amount"] * 100
    sig = hashlib.sha256(f"{reference}{cents}COP{os.environ['WOMPI_INTEGRITY_SECRET']}".encode()).hexdigest()
    params = {"public-key": os.environ["WOMPI_PUBLIC_KEY"], "currency": "COP", "amount-in-cents": str(cents), "reference": reference, "signature:integrity": sig,
              "redirect-url": f"{_frontend()}/pedido/{o['id']}/pago", "customer-data:email": o["email"], "customer-data:full-name": o["name"][:60]}
    await db.service_payments.update_one({"id": attempt_id}, {"$set": {"provider_ref": reference, "status": "created"}})
    return "https://checkout.wompi.co/p/?" + urlencode(params)


async def _wompi_transaction(tx_id: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{_wompi_base()}/transactions/{tx_id}", headers={"Authorization": f"Bearer {os.environ['WOMPI_PRIVATE_KEY']}", "Accept": "application/json"})
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="No se pudo verificar la transacción con Wompi")
    return r.json()["data"]


def _wompi_signature_ok(event: dict, header_checksum: Optional[str]) -> bool:
    sig = event.get("signature") or {}
    props, ts, supplied = sig.get("properties") or [], event.get("timestamp", sig.get("timestamp")), header_checksum or sig.get("checksum")
    if not props or ts is None or not supplied:
        return False
    try:
        vals = []
        for p in props:
            v = event.get("data") or {}
            for part in p.split("."):
                v = v[part]
            vals.append(str(v))
    except (KeyError, TypeError):
        return False
    calc = hashlib.sha256(f"{''.join(vals)}{ts}{os.environ.get('WOMPI_EVENTS_SECRET', '')}".encode()).hexdigest()
    return hmac.compare_digest(calc.lower(), str(supplied).lower())


# ---------- confirmación de pago (idempotente) ----------
async def _mark_paid(order_id: str, provider: str, tx_id: str, amount: int, currency: str, by: Optional[str] = None, extra: Optional[dict] = None):
    r = await db.service_requests.find_one_and_update({"id": order_id, "payment_status": {"$ne": "paid"}},
                                                      {"$set": {"payment_status": "paid", "payment_provider": provider, "payment_transaction_id": tx_id, "payment_confirmed_at": _now().isoformat(), "payment_amount_confirmed": amount, "payment_currency_confirmed": currency, **(extra or {})}})
    if not r:
        return False
    await _history(order_id, "payment:paid", by, provider=provider, transaction_id=tx_id, amount=amount, currency=currency)
    o = await _get_order(order_id)
    if o.get("production_status") in ("received", "pending_payment"):
        await _set_production(order_id, "paid", by)
    label = OFFERS[o["market"]]["label"]
    await _email_client(o, f"BRUNO · Pago confirmado / Payment confirmed · {order_id[:8]}", "Pago confirmado · Payment confirmed",
                        f"Confirmamos tu pago de {label}. Ahora prepararemos tu tarjeta y te avisaremos cuando esté lista para revisar. · We confirmed your payment of {label}. We will now prepare your card and let you know when it is ready for review.",
                        [("Referencia / Reference", order_id), ("Proveedor / Provider", provider.title()), ("Transacción / Transaction", tx_id)],
                        ("Ver mi pedido · View my order", f"{_frontend()}/pedido/{order_id}") if _frontend().startswith("https://") else None, "Este correo no requiere ninguna acción.", "payment_confirmed")
    await _email_team(o, f"Pago confirmado · {label} · {order_id[:8]}", f"{o['name']} ({o['email']}) pagó el servicio.", [("Referencia", order_id), ("Proveedor", provider), ("Transacción", tx_id), ("Importe", f"{currency} {amount}")])
    await _notify_user(o.get("user_id"), "service_order", _t(o.get("language"), "Pago confirmado. Estamos preparando tu tarjeta.", "Payment confirmed. We are preparing your card."), order_id, f"/pedido/{order_id}", "BRUNO + OVC")
    if o.get("production_status") == "approved":
        await deliver_card(order_id, by="system:payment")
    return True


async def _apply_stripe_session(session_id: str, by: Optional[str] = None) -> dict:
    s = await _stripe_verify(session_id)
    att = await db.service_payments.find_one({"provider": "stripe", "provider_ref": session_id}, {"_id": 0})
    if att and att.get("package_id"):
        from routers.bruno_packages import apply_stripe_pkg
        return await apply_stripe_pkg(att, s, by)
    if not att or not s["order_id"] or att["order_id"] != s["order_id"]:
        raise HTTPException(status_code=400, detail="La sesión de pago no corresponde a este pedido")
    expected = OFFERS["US"]["amount"] * 100
    ok = s["paid"] and s["amount"] == expected and s["currency"] == "USD"
    st = "paid" if ok else ("expired" if s["status"] == "expired" else ("mismatch" if s["paid"] else "pending"))
    await db.service_payments.update_one({"id": att["id"]}, {"$set": {"status": st, "payment_intent": s["payment_intent"], "verified_at": _now().isoformat()}})
    if ok:
        await _mark_paid(att["order_id"], "stripe", s["id"], s["amount"], "USD", by, {"payment_intent": s["payment_intent"]})
    elif s["paid"]:
        await _history(att["order_id"], "payment:mismatch", by, provider="stripe", amount=s["amount"], currency=s["currency"])
    return {"attempt": st}


async def _apply_wompi_tx(tx_id: str, by: Optional[str] = None) -> dict:
    tx = await _wompi_transaction(tx_id)
    att = await db.service_payments.find_one({"provider": "wompi", "provider_ref": tx.get("reference")}, {"_id": 0})
    if att and att.get("package_id"):
        from routers.bruno_packages import apply_wompi_pkg
        return await apply_wompi_pkg(att, tx, by)
    if not att:
        raise HTTPException(status_code=400, detail="La transacción no corresponde a ningún pedido")
    expected = OFFERS["CO"]["amount"] * 100
    status = tx.get("status")
    ok = status == "APPROVED" and tx.get("amount_in_cents") == expected and tx.get("currency") == "COP"
    st = "paid" if ok else {"PENDING": "pending", "DECLINED": "failed", "VOIDED": "voided", "ERROR": "failed"}.get(status, "mismatch" if status == "APPROVED" else "pending")
    await db.service_payments.update_one({"id": att["id"]}, {"$set": {"status": st, "transaction_id": tx_id, "verified_at": _now().isoformat(), "provider_status": status}})
    if ok:
        await _mark_paid(att["order_id"], "wompi", tx_id, tx["amount_in_cents"], "COP", by, {"payment_method": (tx.get("payment_method_type") or "")})
    else:
        o = await _get_order(att["order_id"])
        if o.get("payment_status") != "paid":
            await db.service_requests.update_one({"id": o["id"]}, {"$set": {"payment_status": "pending" if st == "pending" else ("failed" if st in ("failed", "voided") else o.get("payment_status", "unpaid"))}})
            await _history(o["id"], f"payment:{st}", by, provider="wompi", transaction_id=tx_id, provider_status=status)
    return {"attempt": st}


# ---------- cliente: pedido y checkout ----------
@router.get("/orders/mine")
async def my_orders(user: User = Depends(get_current_user)):
    rows = await db.service_requests.find({"user_id": user.id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return [_public(o) for o in rows]


@router.get("/orders/{order_id}/public")
async def order_public(order_id: str):
    await _refresh_pending(await _get_order(order_id))
    return _public(await _get_order(order_id))


@router.post("/orders/{order_id}/checkout")
async def checkout(order_id: str, request: Request):
    from routers.bruno_service import _origin_ok
    if not _origin_ok(request):
        raise _err("Origen no permitido.", "Origin not allowed.", 403)
    o = await _get_order(order_id)
    if o.get("production_status") == "cancelled":
        raise _err("Este pedido fue cancelado.", "This order was cancelled.", 409)
    if o.get("payment_status") == "paid":
        raise _err("Este pedido ya está pagado.", "This order is already paid.", 409)
    if not _frontend().startswith("https://"):
        raise _err("El pago requiere una URL pública segura.", "Payment requires a secure public URL.", 503)
    provider = "wompi" if o["market"] == "CO" else "stripe"
    n = await db.service_payments.count_documents({"order_id": order_id}) + 1
    att = {"id": str(uuid.uuid4()), "order_id": order_id, "provider": provider, "amount": o["amount"], "currency": o["currency"], "status": "initiated", "attempt": n, "created_at": _now().isoformat()}
    await db.service_payments.insert_one(dict(att))
    url = await (_wompi_checkout(o, att["id"], f"BRN-{order_id[:8].upper()}-{n}-{secrets.token_hex(3).upper()}") if provider == "wompi" else _stripe_checkout(o, att["id"]))
    await db.service_requests.update_one({"id": order_id, "payment_status": {"$in": ["unpaid", "failed"]}}, {"$set": {"payment_status": "pending"}})
    if o.get("production_status") == "received":
        await _set_production(order_id, "pending_payment")
    await _history(order_id, "payment:checkout_started", None, provider=provider, attempt=n)
    return {"url": url, "provider": provider, "amount": o["amount"], "currency": o["currency"], "label": OFFERS[o["market"]]["label"], "merchant": "Octopus Vision Company (OVC)"}


async def _refresh_pending(o: dict, cancelled: bool = False) -> None:
    """Un intento abandonado/cancelado no deja el pedido «verificando»: vuelve a sin pago si ningún intento está confirmado o pendiente en el proveedor."""
    if o.get("payment_status") != "pending":
        return
    last = await db.service_payments.find_one({"order_id": o["id"]}, {"_id": 0}, sort=[("created_at", -1)])
    if not last:
        return
    stale = last["created_at"] < (_now() - timedelta(hours=1)).isoformat()
    if cancelled and last["status"] in ("initiated", "created"):
        await db.service_payments.update_one({"id": last["id"]}, {"$set": {"status": "cancelled"}})
        last["status"] = "cancelled"
    provider_pending = last["status"] == "pending" and last.get("verified_at")
    if (cancelled or stale) and not provider_pending and last["status"] in ("initiated", "created", "cancelled", "expired", "failed", "voided"):
        await db.service_requests.update_one({"id": o["id"], "payment_status": "pending"}, {"$set": {"payment_status": "unpaid"}})
        await _history(o["id"], "payment:abandoned" if not cancelled else "payment:cancelled", None, attempt=last.get("attempt"))


@router.get("/orders/{order_id}/payment-status")
async def payment_status(order_id: str, session_id: Optional[str] = None, id: Optional[str] = None, cancel: Optional[int] = None):
    o = await _get_order(order_id)
    if cancel and not session_id and not id:
        await _refresh_pending(o, cancelled=True)
    if o.get("payment_status") != "paid":
        try:
            if session_id:
                await _apply_stripe_session(session_id)
            elif id and _provider_ready("CO"):
                await _apply_wompi_tx(id)
        except HTTPException as e:
            logger.info(f"payment-status verify: {e.detail}")
        except Exception as e:
            logger.warning(f"payment-status verify error: {e}")
    return _public(await _get_order(order_id))


@router.post("/payments/stripe/webhook")
async def stripe_webhook(request: Request):
    body = await request.body()
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    try:
        if secret:
            event = stripe.Webhook.construct_event(body, request.headers.get("Stripe-Signature", ""), secret)
        else:
            event = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Firma inválida")
    eid = event.get("id") if isinstance(event, dict) else event.id
    try:
        await db.service_payment_events.insert_one({"_id": f"stripe:{eid}", "received_at": _now().isoformat()})
    except Exception:
        return {"received": True, "duplicate": True}
    etype = event.get("type") if isinstance(event, dict) else event.type
    obj = (event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object)
    meta = dict(obj.get("metadata") or {}) if isinstance(obj, dict) else dict(getattr(obj, "metadata", {}) or {})
    if meta.get("kind") not in ("bruno_service", "bruno_package"):
        return {"received": True, "ignored": True}
    sid = obj.get("id") if isinstance(obj, dict) else obj.id
    if etype in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        await _apply_stripe_session(sid, by="webhook:stripe")  # re-consulta autenticada, no confía en el payload
    elif etype in ("charge.refunded", "charge.dispute.created"):
        oid = meta.get("order_id")
        if oid and meta.get("kind") == "bruno_package":
            await db.packages.update_one({"id": oid}, {"$set": {"payment_status": "refunded" if etype == "charge.refunded" else "disputed"}, "$push": {"history": {"at": _now().isoformat(), "action": f"payment:{'refunded' if etype == 'charge.refunded' else 'disputed'}", "by": "webhook:stripe", "event": eid}}})
        elif oid:
            await db.service_requests.update_one({"id": oid}, {"$set": {"payment_status": "refunded" if etype == "charge.refunded" else "disputed"}})
            await _history(oid, f"payment:{'refunded' if etype == 'charge.refunded' else 'disputed'}", "webhook:stripe", event=eid)
    return {"received": True}


@router.post("/payments/wompi/webhook")
async def wompi_webhook(request: Request, x_event_checksum: Optional[str] = Header(None)):
    raw = await request.body()
    try:
        event = json.loads(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="JSON inválido")
    if not _provider_ready("CO") or not _wompi_signature_ok(event, x_event_checksum):
        raise HTTPException(status_code=401, detail="Firma Wompi inválida")
    if event.get("event") != "transaction.updated":
        return {"received": True}
    try:
        await db.service_payment_events.insert_one({"_id": f"wompi:{hashlib.sha256(raw).hexdigest()}", "received_at": _now().isoformat()})
    except Exception:
        return {"received": True, "duplicate": True}
    tx = (event.get("data") or {}).get("transaction") or {}
    if not tx.get("id"):
        raise HTTPException(status_code=400, detail="Transacción incompleta")
    await _apply_wompi_tx(tx["id"], by="webhook:wompi")  # re-consulta autenticada
    return {"received": True}


# ---------- producción (equipo autorizado) ----------
@router.get("/orders")
async def list_orders(status: Optional[str] = None, payment: Optional[str] = None, user: User = Depends(get_current_user)):
    _staff(user)
    q = {}
    if status:
        q["production_status"] = status
    if payment:
        q["payment_status"] = payment
    rows = await db.service_requests.find(q, {"_id": 0, "files.public_id": 0, "history": 0, "client_emails": 0}).sort("created_at", -1).to_list(300)
    return rows


@router.get("/orders/{order_id}")
async def order_detail(order_id: str, user: User = Depends(get_current_user)):
    _staff(user)
    o = await _get_order(order_id)
    o["files"] = [{"field": f["field"], "name": f["name"], "size": f["size"], "url": _signed_url(f)} for f in o.get("files", [])]
    o["payments"] = await db.service_payments.find({"order_id": order_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    o["recipient"] = await db.users.find_one({"id": o["user_id"]}, {"_id": 0, "id": 1, "name": 1, "email": 1}) if o.get("user_id") else None
    if o.get("card_id"):
        c = await db.cards.find_one({"id": o["card_id"]}, {"_id": 0, "id": 1, "title": 1, "is_public": 1, "is_draft": 1, "user_id": 1, "updated_at": 1})
        o["card"] = c
        o["card_changed_since_review"] = bool(c and o.get("review_hash") and card_hash(await db.cards.find_one({"id": o["card_id"]}, {"_id": 0})) != o["review_hash"])
    return o


@router.post("/orders/{order_id}/card")
async def create_order_card(order_id: str, user: User = Depends(get_current_user)):
    """Crea (una sola vez) el borrador privado vinculado al pedido; oculto del perfil del administrador."""
    _staff(user)
    o = await _get_order(order_id)
    if o.get("production_status") == "cancelled":
        raise HTTPException(status_code=409, detail="Pedido cancelado")
    if o.get("card_id"):
        return {"card_id": o["card_id"], "created": False}
    from routers.cards import Card, DESIGN_VERSION
    from utils.card_design import ensure_design
    type_map = {"Personal": "personal", "Negocio / empresa": "business", "Currículum": "curriculum", "Guardián": "guardian", "Mascota": "pet"}
    card = Card(user_id=user.id, card_type=type_map.get(o["type"], "personal"), title=o["card_name"], description=(o.get("description") or "")[:500], is_public=False, is_draft=True, show_in_feed=False)
    doc = card.model_dump()
    doc["created_at"], doc["updated_at"] = doc["created_at"].isoformat(), doc["updated_at"].isoformat()
    doc, _ = ensure_design(doc)
    doc.update({"card_design_version": DESIGN_VERSION, "production_hidden": True, "service_order_id": order_id})
    r = await db.service_requests.find_one_and_update({"id": order_id, "card_id": None}, {"$set": {"card_id": doc["id"], "card_created_by": user.id}})
    if not r:
        return {"card_id": (await _get_order(order_id))["card_id"], "created": False}
    await db.cards.insert_one(dict(doc))
    await _set_production(order_id, "in_preparation", user.id, card_id=doc["id"])
    return {"card_id": doc["id"], "created": True}


class ReviewSend(BaseModel):
    note: Optional[str] = None


@router.post("/orders/{order_id}/send-review")
async def send_review(order_id: str, body: ReviewSend, user: User = Depends(get_current_user)):
    _staff(user)
    o = await _get_order(order_id)
    if o.get("production_status") in ("cancelled", "delivered", "approved"):
        raise HTTPException(status_code=409, detail="El pedido no admite revisión en su estado actual (aprobado, entregado o cancelado). Para una nueva versión, vuelve a preparación primero.")
    card = await db.cards.find_one({"id": o.get("card_id")}, {"_id": 0}) if o.get("card_id") else None
    if not card:
        raise HTTPException(status_code=400, detail="Primero crea la tarjeta del pedido")
    if not (card.get("title") or "").strip():
        raise HTTPException(status_code=400, detail="La tarjeta necesita un nombre o título")
    h = card_hash(card)
    version = o.get("review_version", 0) + (0 if h == o.get("review_hash") and o.get("review_version") else 1)
    now = _now()
    await db.review_tokens.update_many({"order_id": order_id, "revoked_at": None}, {"$set": {"revoked_at": now.isoformat(), "revoked_reason": "superseded"}})
    token = secrets.token_urlsafe(32)
    await db.review_tokens.insert_one({"token_hash": hashlib.sha256(token.encode()).hexdigest(), "order_id": order_id, "version": version, "created_at": now.isoformat(), "expires_at": (now + timedelta(days=REVIEW_TTL_DAYS)).isoformat(), "revoked_at": None, "created_by": user.id})
    await db.service_requests.update_one({"id": order_id}, {"$set": {"review_version": version, "review_hash": h, "review_sent_at": now.isoformat(), "review_note": _clean(body.note, 1000), "approval": None}})
    await _set_production(order_id, "pending_approval", user.id, version=version, resent=version == o.get("review_version"))
    lang = o.get("language", "es")
    url = f"{_frontend()}/pedido/revisar/{token}"
    st = await _email_client(o, _t(lang, f"BRUNO · Tu tarjeta está lista para revisar · {order_id[:8]}", f"BRUNO · Your card is ready for review · {order_id[:8]}"),
                             _t(lang, "Tu tarjeta está lista para revisar", "Your card is ready for review"),
                             _t(lang, "Preparamos tu tarjeta BRUNO. Entra para verla completa y aprobarla o pedir ajustes. Abrir este correo o el enlace no aprueba ni publica nada: la decisión es tuya dentro de BRUNO.",
                                "We prepared your BRUNO card. Sign in to see it in full and approve it or request changes. Opening this email or link does not approve or publish anything: you decide inside BRUNO."),
                             [(_t(lang, "Referencia", "Reference"), order_id), (_t(lang, "Versión", "Version"), str(version)), (_t(lang, "Enlace válido hasta", "Link valid until"), (now + timedelta(days=REVIEW_TTL_DAYS)).strftime("%Y-%m-%d"))] + ([(_t(lang, "Nota del equipo", "Team note"), body.note)] if body.note else []),
                             (_t(lang, "Revisar mi tarjeta", "Review my card"), url) if url.startswith("https://") else None,
                             _t(lang, "Si no reconoces este pedido, ignora este mensaje.", "If you do not recognize this order, ignore this message."), "review")
    await _notify_user(o.get("user_id"), "service_order", _t(lang, "Tu tarjeta está lista para revisar.", "Your card is ready for review."), order_id, f"/pedido/revisar/{token}", "BRUNO + OVC")
    return {"version": version, "email_status": st, "expires_at": (now + timedelta(days=REVIEW_TTL_DAYS)).isoformat(), "review_url": url}


class StatusBody(BaseModel):
    production_status: str
    note: Optional[str] = None


@router.post("/orders/{order_id}/status")
async def set_status(order_id: str, body: StatusBody, user: User = Depends(get_current_user)):
    _staff(user)
    if body.production_status not in ("cancelled", "in_preparation"):
        raise HTTPException(status_code=400, detail="Solo se permite cancelar o volver a preparación")
    o = await _get_order(order_id)
    if o.get("production_status") == "delivered":
        raise HTTPException(status_code=409, detail="Un pedido entregado no cambia de estado")
    if body.production_status == "in_preparation" and o.get("approval"):
        await db.service_requests.update_one({"id": order_id}, {"$set": {"approval": None, "publish_authorized": None}})
        await _history(order_id, "approval:reset", user.id, previous=o["approval"])
    if body.production_status == "cancelled":
        await db.review_tokens.update_many({"order_id": order_id, "revoked_at": None}, {"$set": {"revoked_at": _now().isoformat(), "revoked_reason": "cancelled"}})
    await _set_production(order_id, body.production_status, user.id, note=_clean(body.note, 500))
    return {"ok": True}


class RecipientBody(BaseModel):
    email: str
    reason: str


@router.post("/orders/{order_id}/recipient")
async def change_recipient(order_id: str, body: RecipientBody, user: User = Depends(get_current_user)):
    """Cambio de destinatario: procedimiento verificado por el equipo, registrado y con re-verificación del nuevo correo."""
    _staff(user)
    o = await _get_order(order_id)
    if o.get("delivered_at"):
        raise HTTPException(status_code=409, detail="La tarjeta ya fue entregada")
    email = _clean(body.email, 120).lower()
    if "@" not in email or len(body.reason.strip()) < 5:
        raise HTTPException(status_code=400, detail="Correo o motivo inválido")
    await db.review_tokens.update_many({"order_id": order_id, "revoked_at": None}, {"$set": {"revoked_at": _now().isoformat(), "revoked_reason": "recipient_changed"}})
    await db.service_requests.update_one({"id": order_id}, {"$set": {"email": email, "user_id": None, "recipient_verified_at": None, "approval": None}})
    await _history(order_id, "recipient:changed", user.id, old_email=o["email"], new_email=email, reason=_clean(body.reason, 300))
    if o.get("production_status") == "pending_approval":
        await _set_production(order_id, "in_preparation", user.id, note="recipient changed; resend review")
    return {"ok": True}


class PaymentBody(BaseModel):
    status: str
    reference: str
    note: Optional[str] = None


@router.post("/orders/{order_id}/payment")
async def manual_payment(order_id: str, body: PaymentBody, user: User = Depends(get_current_user)):
    """Conciliación manual: solo administradores (no producción), con referencia obligatoria."""
    if getattr(user, "role", None) not in ("admin", "superadmin", "super_admin") and not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Solo administradores pueden conciliar pagos")
    if body.status not in PAYMENT:
        raise HTTPException(status_code=400, detail="Estado de pago inválido")
    if len(body.reference.strip()) < 4:
        raise HTTPException(status_code=400, detail="Referencia del proveedor obligatoria")
    o = await _get_order(order_id)
    if body.status == "paid" and o.get("production_status") == "cancelled":
        raise HTTPException(status_code=409, detail="El pedido está cancelado; reactívalo (volver a preparación) antes de registrar un pago")
    if body.status == "paid":
        done = await _mark_paid(order_id, "manual", body.reference.strip(), o["amount"] * 100, o["currency"], user.id, {"payment_marked_by": user.id, "payment_note": _clean(body.note, 300)})
        return {"ok": True, "changed": done}
    await db.service_requests.update_one({"id": order_id}, {"$set": {"payment_status": body.status, "payment_marked_by": user.id, "payment_note": _clean(body.note, 300)}})
    await _history(order_id, f"payment:{body.status}", user.id, reference=body.reference.strip(), manual=True)
    return {"ok": True, "changed": True}


# ---------- revisión del cliente ----------
async def _resolve_token(token: str) -> tuple[dict, dict]:
    t = await db.review_tokens.find_one({"token_hash": hashlib.sha256(token.encode()).hexdigest()}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail={"state": "invalid"})
    o = await _get_order(t["order_id"])
    if t.get("revoked_at"):
        raise HTTPException(status_code=410, detail={"state": "revoked", "order_id": o["id"]})
    if t["expires_at"] <= _now().isoformat():
        raise HTTPException(status_code=410, detail={"state": "expired", "order_id": o["id"]})
    return t, o


def _identity(o: dict, user: Optional[User]) -> str:
    if not user:
        return "login"
    if o.get("user_id"):
        return "ok" if o["user_id"] == user.id else "switch_account"
    return "verify_email" if (user.email or "").lower() == (o.get("email") or "").lower() else "switch_account"


@router.get("/review/{token}")
async def review_get(token: str, user: Optional[User] = Depends(get_current_user_optional)):
    t, o = await _resolve_token(token)
    state = _identity(o, user)
    out = {"state": state, "order": _public(o), "email_masked": _mask(o["email"]), "version": t["version"], "version_current": t["version"] == o.get("review_version"),
           "has_account": bool(await db.users.find_one({"email": o["email"].lower()}, {"_id": 1})), "note": o.get("review_note")}
    if state == "ok" and out["version_current"]:
        card = await db.cards.find_one({"id": o["card_id"]}, {"_id": 0}) if o.get("card_id") else None
        if card:
            from utils.card_design import ensure_design
            out["card_changed"] = card_hash(card) != o.get("review_hash")
            card, _ = ensure_design(card)
            out["card"] = card
    return out


@router.post("/review/{token}/send-code")
async def review_send_code(token: str, user: User = Depends(get_current_user)):
    t, o = await _resolve_token(token)
    if _identity(o, user) != "verify_email":
        raise _err("Este paso no aplica a tu cuenta.", "This step does not apply to your account.", 409)
    code = f"{secrets.randbelow(10**6):06d}"
    await db.review_codes.update_one({"order_id": o["id"], "user_id": user.id}, {"$set": {"code_hash": hashlib.sha256(code.encode()).hexdigest(), "expires_at": (_now() + timedelta(minutes=CODE_TTL_MIN)).isoformat(), "attempts": 0}}, upsert=True)
    lang = o.get("language", "es")
    st = await _email_client(o, _t(lang, "BRUNO · Código para confirmar tu pedido", "BRUNO · Code to confirm your order"), _t(lang, "Confirma que este pedido es tuyo", "Confirm this order is yours"),
                             _t(lang, f"Escribe este código en BRUNO para vincular el pedido {o['id'][:8]} a tu cuenta. Caduca en {CODE_TTL_MIN} minutos.", f"Enter this code in BRUNO to link order {o['id'][:8]} to your account. It expires in {CODE_TTL_MIN} minutes."),
                             [(_t(lang, "Código", "Code"), code)], None, _t(lang, "Nunca compartas este código. Si no lo solicitaste, ignora este mensaje.", "Never share this code. If you did not request it, ignore this message."), "code")
    return {"sent": st == "accepted", "email_status": st}


class CodeBody(BaseModel):
    code: str


@router.post("/review/{token}/verify-code")
async def review_verify_code(token: str, body: CodeBody, user: User = Depends(get_current_user)):
    t, o = await _resolve_token(token)
    if _identity(o, user) != "verify_email":
        raise _err("Este paso no aplica a tu cuenta.", "This step does not apply to your account.", 409)
    rc = await db.review_codes.find_one({"order_id": o["id"], "user_id": user.id}, {"_id": 0})
    if not rc or rc["expires_at"] <= _now().isoformat() or rc.get("attempts", 0) >= 5:
        raise _err("Código vencido. Solicita uno nuevo.", "Code expired. Request a new one.")
    if not hmac.compare_digest(rc["code_hash"], hashlib.sha256(body.code.strip().encode()).hexdigest()):
        await db.review_codes.update_one({"order_id": o["id"], "user_id": user.id}, {"$inc": {"attempts": 1}})
        raise _err("Código incorrecto.", "Incorrect code.")
    r = await db.service_requests.find_one_and_update({"id": o["id"], "user_id": None}, {"$set": {"user_id": user.id, "recipient_verified_at": _now().isoformat()}})
    await db.review_codes.delete_one({"order_id": o["id"], "user_id": user.id})
    if r:
        await _history(o["id"], "recipient:verified", user.id, email=o["email"])
    return {"ok": True}


class ChangesBody(BaseModel):
    message: str


@router.post("/review/{token}/changes")
async def review_changes(token: str, body: ChangesBody, user: User = Depends(get_current_user)):
    t, o = await _resolve_token(token)
    if _identity(o, user) != "ok":
        raise _err("Inicia sesión con la cuenta vinculada al pedido.", "Sign in with the account linked to the order.", 403)
    if o.get("production_status") not in ("pending_approval", "changes_requested"):
        raise _err("El pedido no está en revisión.", "The order is not under review.", 409)
    msg = _clean(body.message, 2000)
    if len(msg) < 3:
        raise _err("Describe los ajustes.", "Describe the changes.")
    rounds = o.get("adjustment_rounds", 0) + 1
    await db.service_requests.update_one({"id": o["id"]}, {"$set": {"adjustment_rounds": rounds}, "$push": {"change_requests": {"at": _now().isoformat(), "version": t["version"], "message": msg, "by": user.id}}})
    await _set_production(o["id"], "changes_requested", user.id, version=t["version"], round=rounds)
    await _email_team(o, f"Ajustes solicitados · {o['id'][:8]} (ronda {rounds})", f"{o['name']} pidió ajustes a la versión {t['version']}.", [("Referencia", o["id"]), ("Mensaje", msg), ("Ronda", f"{rounds} (la oferta incluye 1)")])
    return {"ok": True, "round": rounds, "included": rounds <= 1}


class ApproveBody(BaseModel):
    version: int
    publish: bool = False


@router.post("/review/{token}/approve")
async def review_approve(token: str, body: ApproveBody, user: User = Depends(get_current_user)):
    t, o = await _resolve_token(token)
    if _identity(o, user) != "ok":
        raise _err("Inicia sesión con la cuenta vinculada al pedido.", "Sign in with the account linked to the order.", 403)
    if o.get("production_status") == "cancelled":
        raise _err("Este pedido fue cancelado.", "This order was cancelled.", 409)
    if o.get("approval") and o["approval"].get("version") == o.get("review_version"):
        return {"ok": True, "already": True, **_public(await _get_order(o["id"]))}  # doble clic / recarga
    if body.version != o.get("review_version") or t["version"] != o.get("review_version"):
        raise HTTPException(status_code=409, detail={"state": "stale", "error": "Hay una versión más reciente. Revisa la nueva versión antes de aprobar.", "errorEn": "There is a newer version. Review the new version before approving."})
    if o.get("production_status") not in ("pending_approval", "changes_requested"):
        raise _err("El pedido no está pendiente de aprobación.", "The order is not pending approval.", 409)
    card = await db.cards.find_one({"id": o["card_id"]}, {"_id": 0})
    if not card or card_hash(card) != o.get("review_hash"):
        raise HTTPException(status_code=409, detail={"state": "stale", "error": "El equipo modificó la tarjeta después de enviarla. Espera la nueva versión.", "errorEn": "The team modified the card after sending it. Wait for the new version."})
    approval = {"version": body.version, "publish": bool(body.publish), "at": _now().isoformat(), "by": user.id, "hash": o["review_hash"]}
    r = await db.service_requests.find_one_and_update({"id": o["id"], "production_status": {"$in": ["pending_approval", "changes_requested"]}, "review_version": body.version},
                                                      {"$set": {"approval": approval, "publish_authorized": bool(body.publish)}})
    if not r:
        return {"ok": True, "already": True, **_public(await _get_order(o["id"]))}
    await _set_production(o["id"], "approved", user.id, version=body.version, publish=bool(body.publish))
    await _email_team(o, f"Tarjeta aprobada · {o['id'][:8]} (v{body.version})", f"{o['name']} aprobó la versión {body.version}. Publicación autorizada: {'sí' if body.publish else 'no'}.", [("Referencia", o["id"]), ("Pago", o.get("payment_status", "unpaid"))])
    o2 = await _get_order(o["id"])
    if o2.get("payment_status") == "paid":
        await deliver_card(o["id"], by=user.id)
    return {"ok": True, **_public(await _get_order(o["id"]))}


# ---------- entrega (idempotente, requiere aprobación + pago) ----------
async def deliver_card(order_id: str, by: Optional[str] = None) -> bool:
    o = await db.service_requests.find_one_and_update({"id": order_id, "delivered_at": None, "production_status": "approved", "payment_status": "paid", "user_id": {"$ne": None}, "card_id": {"$ne": None}},
                                                      {"$set": {"delivered_at": _now().isoformat(), "production_status": "delivered"}}, projection={"_id": 0})
    if not o:
        return False
    publish = bool(o.get("publish_authorized"))
    await db.cards.update_one({"id": o["card_id"]}, {"$set": {"user_id": o["user_id"], "is_draft": False, "is_public": publish, "show_in_feed": publish, "updated_at": _now().isoformat(), "delivered_from_order": order_id}, "$unset": {"production_hidden": ""}})
    await _history(order_id, "status:delivered", by, card_id=o["card_id"], published=publish)
    try:
        from utils import search_sync
        await search_sync.index_card(await db.cards.find_one({"id": o["card_id"]}, {"_id": 0}))
    except Exception:
        pass
    lang = o.get("language", "es")
    card_url, share = f"{_frontend()}/c/{o['card_id']}", publish
    rows = [(_t(lang, "Referencia", "Reference"), order_id), (_t(lang, "Estado", "Status"), _t(lang, "Publicada" if publish else "Privada (puedes publicarla cuando quieras)", "Published" if publish else "Private (publish it whenever you want)"))]
    if share:
        rows += [(_t(lang, "Enlace para compartir", "Share link"), card_url), ("QR", f"{_frontend()}/cards/{o['card_id']}/qr")]
    await _email_client(o, _t(lang, f"BRUNO · Tu tarjeta ya está en tu cuenta · {order_id[:8]}", f"BRUNO · Your card is now in your account · {order_id[:8]}"), _t(lang, "¡Tu tarjeta ya es tuya!", "Your card is yours!"),
                        _t(lang, "La tarjeta aprobada ya está en Perfil → Tarjetas. Puedes editarla y administrarla con los controles habituales de BRUNO.", "Your approved card is now in Profile → Cards. You can edit and manage it with the usual BRUNO controls."),
                        rows, (_t(lang, "Abrir mi tarjeta", "Open my card"), card_url) if card_url.startswith("https://") else None, _t(lang, "Gracias por confiar en BRUNO + OVC.", "Thank you for trusting BRUNO + OVC."), "delivered")
    await _notify_user(o["user_id"], "service_order_delivered", _t(lang, "Tu tarjeta ya está en tu cuenta.", "Your card is now in your account."), order_id, f"/c/{o['card_id']}", "BRUNO + OVC")
    await _email_team(o, f"Tarjeta entregada · {order_id[:8]}", f"La tarjeta {o['card_id']} pasó a la cuenta de {o['email']}. Publicada: {'sí' if publish else 'no'}.", [("Referencia", order_id)])
    return True


@router.post("/orders/{order_id}/resend-review")
async def resend_review(order_id: str, user: User = Depends(get_current_user)):
    return await send_review(order_id, ReviewSend(note=None), user)


class StaffBody(BaseModel):
    email: str
    role: str


@router.post("/staff")
async def set_staff_role(body: StaffBody, user: User = Depends(get_current_user)):
    """Solo administradores: otorga o retira el rol «produccion» (acceso al área de pedidos sin ser admin)."""
    if getattr(user, "role", None) not in ("admin", "superadmin", "super_admin") and not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Solo administradores")
    if body.role not in ("produccion", "personal"):
        raise HTTPException(status_code=400, detail="Rol inválido")
    target = await db.users.find_one({"email": body.email.strip().lower()}, {"_id": 0, "id": 1, "role": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target.get("role") in ("admin", "superadmin", "super_admin"):
        raise HTTPException(status_code=409, detail="No se modifica el rol de un administrador")
    await db.users.update_one({"id": target["id"]}, {"$set": {"role": body.role}})
    await db.staff_audit.insert_one({"at": _now().isoformat(), "by": user.id, "target": target["id"], "role": body.role})
    return {"ok": True, "user_id": target["id"], "role": body.role}


@router.get("/me/access")
async def my_access(user: User = Depends(get_current_user)):
    return {"staff": is_staff(user), "admin": getattr(user, "role", None) in ("admin", "superadmin", "super_admin") or getattr(user, "is_admin", False)}
