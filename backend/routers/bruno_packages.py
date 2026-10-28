"""Paquetes «perfil completo + 3 tarjetas»: área de asesores, enlace de entrega, aceptación del cliente, pago (Stripe/Wompi/efectivo) y transferencia."""
import asyncio
import hashlib
import logging
import secrets
import uuid
from datetime import timedelta
from typing import Optional
from urllib.parse import urlencode

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from models.user import User
from utils.database import db
from utils.security import get_current_user, get_current_user_optional
from routers.bruno_service import OFFERS, _clean, _now, _origin_ok
from routers.bruno_orders import _err, _frontend, _mail, _mask, _notify_user, _provider_ready, _stripe, _stripe_verify, _wompi_transaction
import os

logger = logging.getLogger("bruno.packages")
router = APIRouter(prefix="/packages", tags=["packages"])

ADMIN_ROLES = ("admin", "superadmin", "super_admin")
PACKAGE_LABEL = {"es": "Perfil completo + 3 tarjetas digitales", "en": "Complete profile + 3 digital cards"}
CLAIM_TTL_DAYS = 30
PROFILE_FIELDS = ("name", "display_name", "bio", "avatar_url", "location", "website", "profession", "company", "social_links", "phone")
CARD_TYPES = ["personal", "business", "curriculum"]


def is_admin(u: Optional[User]) -> bool:
    return bool(u) and (getattr(u, "role", None) in ADMIN_ROLES or getattr(u, "is_admin", False))


def is_advisor(u: Optional[User]) -> bool:
    return bool(u) and (getattr(u, "role", None) == "asesor" or is_admin(u))


async def can_collect_cash(u: User) -> bool:
    if is_admin(u):
        return True
    doc = await db.users.find_one({"id": u.id}, {"_id": 0, "cash_collector": 1})
    return bool(doc and doc.get("cash_collector"))


def _handle(u: dict) -> str:
    return (u.get("username") or u.get("name") or (u.get("email") or "usuario").split("@")[0]).replace(" ", "_")


async def _advisor_handle(user_id: str) -> str:
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "username": 1, "name": 1, "email": 1})
    return _handle(u or {})


async def _get(pkg_id: str) -> dict:
    p = await db.packages.find_one({"id": pkg_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Paquete no encontrado")
    return p


def _owner_or_admin(p: dict, u: User):
    if not (is_admin(u) or p["advisor_id"] == u.id):
        raise HTTPException(status_code=403, detail="Este paquete pertenece a otro asesor")


async def _hist(pkg_id: str, action: str, by: Optional[str], **extra):
    await db.packages.update_one({"id": pkg_id}, {"$push": {"history": {"at": _now().isoformat(), "action": action, "by": by, **extra}}, "$set": {"updated_at": _now().isoformat()}})


def _view(p: dict) -> dict:
    out = {k: v for k, v in p.items() if k not in ("claim_token_hash", "history")}
    out["price_label"] = OFFERS[p["market"]]["label"] if p.get("market") in OFFERS else None
    return out


def _public_preview(p: dict) -> dict:
    """Vista previa limitada antes de iniciar sesión: sin datos privados del cliente."""
    return {"ref": p["ref"], "advisor_handle": p.get("advisor_handle"), "client_first_name": (p.get("client", {}).get("name") or "").split(" ")[0],
            "cards_count": len(p.get("card_ids", [])), "market": p.get("market"), "price_label": OFFERS[p["market"]]["label"] if p.get("market") in OFFERS else None,
            "payment_method": p.get("payment_method"), "payment_status": p.get("payment_status"), "delivery_status": p.get("delivery_status"), "label": PACKAGE_LABEL}


# ---------- acceso y roles ----------
@router.get("/me/access")
async def my_access(user: User = Depends(get_current_user)):
    return {"advisor": is_advisor(user), "admin": is_admin(user), "cash": await can_collect_cash(user), "handle": await _advisor_handle(user.id)}


class StaffBody(BaseModel):
    email: str
    role: Optional[str] = None  # asesor | personal
    cash_collector: Optional[bool] = None


@router.post("/staff")
async def set_staff(body: StaffBody, user: User = Depends(get_current_user)):
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores")
    target = await db.users.find_one({"email": body.email.strip().lower()}, {"_id": 0, "id": 1, "role": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    upd = {}
    if body.role in ("asesor", "personal") and target.get("role") not in ADMIN_ROLES:
        upd["role"] = body.role
    if body.cash_collector is not None:
        upd["cash_collector"] = bool(body.cash_collector)
    if not upd:
        raise HTTPException(status_code=400, detail="Nada que cambiar")
    await db.users.update_one({"id": target["id"]}, {"$set": upd})
    await db.staff_audit.insert_one({"at": _now().isoformat(), "by": user.id, "target": target["id"], **upd})
    return {"ok": True, **upd}


# ---------- asesor: crear y preparar ----------
@router.post("")
async def create_package(user: User = Depends(get_current_user)):
    if not is_advisor(user):
        raise HTTPException(status_code=403, detail="Solo asesores autorizados")
    from routers.cards import Card, DESIGN_VERSION
    from utils.card_design import ensure_design
    pkg_id, ref = str(uuid.uuid4()), f"BP-{secrets.token_hex(3).upper()}"
    card_ids = []
    for i, ct in enumerate(CARD_TYPES):
        c = Card(user_id=user.id, card_type=ct, title="", is_public=False, is_draft=True, show_in_feed=False).model_dump()
        c["created_at"], c["updated_at"] = c["created_at"].isoformat(), c["updated_at"].isoformat()
        c, _ = ensure_design(c)
        c.update({"card_design_version": DESIGN_VERSION, "production_hidden": True, "package_id": pkg_id, "package_slot": i + 1})
        await db.cards.insert_one(dict(c)); card_ids.append(c["id"])
    p = {"id": pkg_id, "ref": ref, "advisor_id": user.id, "advisor_handle": await _advisor_handle(user.id), "client": {"name": "", "bio": "", "avatar_url": None, "phone": "", "email": "", "website": "", "location": "", "profession": "", "company": "", "social_links": []},
         "card_ids": card_ids, "market": None, "currency": None, "amount": None, "payment_method": None, "prep_status": "draft", "payment_status": "pending", "delivery_status": "pending_acceptance",
         "claim_token_hash": None, "claim_expires_at": None, "claim_revoked_at": None, "claimed_by": None, "accepted_at": None, "acceptance": None, "cash": None, "receipt": None,
         "created_at": _now().isoformat(), "updated_at": _now().isoformat(), "history": [{"at": _now().isoformat(), "action": "created", "by": user.id}]}
    await db.packages.insert_one(dict(p))
    return _view(p)


@router.get("")
async def list_packages(advisor: Optional[str] = None, market: Optional[str] = None, payment_method: Optional[str] = None, payment: Optional[str] = None, delivery: Optional[str] = None, prep: Optional[str] = None, since: Optional[str] = None, until: Optional[str] = None, user: User = Depends(get_current_user)):
    if not is_advisor(user):
        raise HTTPException(status_code=403, detail="Solo asesores autorizados")
    q = {} if is_admin(user) else {"advisor_id": user.id}
    if advisor and is_admin(user):
        q["$or"] = [{"advisor_id": advisor}, {"advisor_handle": {"$regex": f"^{advisor.lstrip('@')}$", "$options": "i"}}]
    for k, v in (("market", market), ("payment_method", payment_method), ("payment_status", payment), ("delivery_status", delivery), ("prep_status", prep)):
        if v:
            q[k] = v
    if since or until:
        q["created_at"] = {**({"$gte": since} if since else {}), **({"$lte": until + "T23:59:59" if len(until or "") == 10 else until} if until else {})}
    rows = await db.packages.find(q, {"_id": 0, "claim_token_hash": 0, "history": 0}).sort("created_at", -1).to_list(500)
    return [_view(r) for r in rows]


@router.get("/{pkg_id}")
async def get_package(pkg_id: str, user: User = Depends(get_current_user)):
    p = await _get(pkg_id); _owner_or_admin(p, user)
    out = _view(p)
    out["cards"] = await db.cards.find({"id": {"$in": p["card_ids"]}}, {"_id": 0, "id": 1, "title": 1, "card_type": 1, "profile_image": 1, "updated_at": 1, "package_slot": 1}).sort("package_slot", 1).to_list(3)
    out["history"] = p.get("history", [])
    out["payments"] = await db.service_payments.find({"package_id": pkg_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    if p.get("claimed_by"):
        out["claimant"] = await db.users.find_one({"id": p["claimed_by"]}, {"_id": 0, "id": 1, "name": 1, "username": 1, "email": 1})
    return out


class ClientBody(BaseModel):
    client: dict


@router.patch("/{pkg_id}")
async def update_client(pkg_id: str, body: ClientBody, user: User = Depends(get_current_user)):
    """Autoguardado del perfil del cliente (borrador privado). Bloqueado tras la entrega."""
    p = await _get(pkg_id); _owner_or_admin(p, user)
    if p.get("delivery_status") == "activated":
        raise HTTPException(status_code=409, detail="El paquete ya fue entregado; el asesor no puede editarlo")
    allowed = {"name", "bio", "avatar_url", "phone", "email", "website", "location", "profession", "company", "social_links"}
    client = {**p["client"], **{k: (v if k == "social_links" else _clean(v, 600)) for k, v in body.client.items() if k in allowed}}
    if not isinstance(client.get("social_links"), list):
        client["social_links"] = []
    await db.packages.update_one({"id": pkg_id}, {"$set": {"client": client, "updated_at": _now().isoformat()}})
    return {"ok": True, "client": client}


class FinalizeBody(BaseModel):
    advisor_handle: str
    market: str
    payment_method: str  # virtual | cash


@router.post("/{pkg_id}/finalize")
async def finalize(pkg_id: str, body: FinalizeBody, user: User = Depends(get_current_user)):
    """«¿Qué asesor creó este paquete?» + país + método → listo para entregar; genera el enlace único de activación."""
    p = await _get(pkg_id); _owner_or_admin(p, user)
    if p.get("delivery_status") == "activated":
        raise HTTPException(status_code=409, detail="Paquete ya entregado")
    if body.market not in OFFERS or body.payment_method not in ("virtual", "cash"):
        raise HTTPException(status_code=400, detail="País o método de pago inválido")
    if p.get("payment_status") == "confirmed" and (p.get("market") != body.market):
        raise HTTPException(status_code=409, detail="No se puede cambiar el país de una operación ya pagada")
    mine = await _advisor_handle(user.id)
    if body.advisor_handle.lstrip("@").lower() != (mine if not is_admin(user) else p.get("advisor_handle", mine)).lower() and not is_admin(user):
        raise HTTPException(status_code=400, detail=f"El @ no coincide con tu cuenta (@{mine}). Solo un administrador puede reasignar la venta.")
    if not (p["client"].get("name") or "").strip():
        raise HTTPException(status_code=400, detail="Indica el nombre del cliente")
    cards = await db.cards.find({"id": {"$in": p["card_ids"]}}, {"_id": 0, "title": 1}).to_list(3)
    if len(cards) != 3 or any(not (c.get("title") or "").strip() for c in cards):
        raise HTTPException(status_code=400, detail="Las 3 tarjetas necesitan al menos un nombre/título")
    offer = OFFERS[body.market]
    upd = {"prep_status": "ready", "market": body.market, "currency": offer["currency"], "amount": offer["amount"], "payment_method": body.payment_method, "finalized_at": _now().isoformat(),
           "cash": {"expected_amount": offer["amount"], "currency": offer["currency"], "status": "pending_confirmation"} if body.payment_method == "cash" else p.get("cash")}
    if p.get("payment_status") == "confirmed":
        upd.pop("cash", None)
    token = None
    if not p.get("claim_token_hash") or p.get("claim_revoked_at") or (p.get("claim_expires_at") or "") <= _now().isoformat():
        token = secrets.token_urlsafe(32)
        upd.update({"claim_token_hash": hashlib.sha256(token.encode()).hexdigest(), "claim_expires_at": (_now() + timedelta(days=CLAIM_TTL_DAYS)).isoformat(), "claim_revoked_at": None, "claim_url": f"{_frontend()}/paquete/{token}"})
    await db.packages.update_one({"id": pkg_id}, {"$set": upd})
    await _hist(pkg_id, "finalized", user.id, market=body.market, payment_method=body.payment_method, advisor_handle=mine)
    p2 = await _get(pkg_id)
    return {**_view(p2), "claim_url": p2.get("claim_url")}


@router.post("/{pkg_id}/claim-link")
async def regenerate_link(pkg_id: str, revoke_only: bool = False, user: User = Depends(get_current_user)):
    p = await _get(pkg_id); _owner_or_admin(p, user)
    if p.get("delivery_status") == "activated":
        raise HTTPException(status_code=409, detail="Paquete ya entregado")
    upd = {"claim_revoked_at": _now().isoformat()}
    if not revoke_only:
        token = secrets.token_urlsafe(32)
        upd = {"claim_token_hash": hashlib.sha256(token.encode()).hexdigest(), "claim_expires_at": (_now() + timedelta(days=CLAIM_TTL_DAYS)).isoformat(), "claim_revoked_at": None, "claim_url": f"{_frontend()}/paquete/{token}"}
    else:
        upd["claim_url"] = None
    await db.packages.update_one({"id": pkg_id}, {"$set": upd})
    await _hist(pkg_id, "link:revoked" if revoke_only else "link:regenerated", user.id)
    return {"claim_url": upd.get("claim_url"), "expires_at": upd.get("claim_expires_at")}


class ReassignBody(BaseModel):
    advisor_email: str
    reason: str


@router.post("/{pkg_id}/reassign")
async def reassign(pkg_id: str, body: ReassignBody, user: User = Depends(get_current_user)):
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Solo administradores reasignan ventas")
    p = await _get(pkg_id)
    target = await db.users.find_one({"email": body.advisor_email.strip().lower()}, {"_id": 0, "id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Asesor no encontrado")
    await db.packages.update_one({"id": pkg_id}, {"$set": {"advisor_id": target["id"], "advisor_handle": await _advisor_handle(target["id"])}})
    if p.get("delivery_status") != "activated":
        await db.cards.update_many({"package_id": pkg_id, "production_hidden": True}, {"$set": {"user_id": target["id"]}})
    await _hist(pkg_id, "reassigned", user.id, from_advisor=p["advisor_id"], to_advisor=target["id"], reason=_clean(body.reason, 300))
    return {"ok": True}


class CashBody(BaseModel):
    amount_received: float
    currency: str
    receipt_ref: str
    note: Optional[str] = None


@router.post("/{pkg_id}/cash-confirm")
async def cash_confirm(pkg_id: str, body: CashBody, user: User = Depends(get_current_user)):
    """Solo asesor con permiso de cobro o administrador. El cliente nunca confirma su propio efectivo."""
    if not await can_collect_cash(user):
        raise HTTPException(status_code=403, detail="Sin permiso de cobro en efectivo")
    p = await _get(pkg_id)
    if not is_admin(user):
        _owner_or_admin(p, user)
    if p.get("prep_status") != "ready":
        raise HTTPException(status_code=409, detail="El paquete aún no está listo para entregar")
    if p.get("payment_status") == "confirmed":
        return {"ok": True, "already": True}
    if body.currency != p["currency"] or round(body.amount_received, 2) != round(float(p["amount"]), 2) or len(body.receipt_ref.strip()) < 3:
        raise HTTPException(status_code=400, detail=f"Importe/moneda deben coincidir con {p['currency']} {p['amount']} y la referencia del recibo es obligatoria")
    receipt = {"id": f"RC-{secrets.token_hex(3).upper()}", "amount": body.amount_received, "currency": body.currency, "method": "cash", "receipt_ref": body.receipt_ref.strip(), "confirmed_by": user.id, "confirmed_by_handle": await _advisor_handle(user.id), "at": _now().isoformat(), "note": _clean(body.note, 300)}
    r = await db.packages.find_one_and_update({"id": pkg_id, "payment_status": {"$ne": "confirmed"}}, {"$set": {"payment_status": "confirmed", "payment_method": "cash", "payment_confirmed_at": receipt["at"], "receipt": receipt, "cash": {"expected_amount": p["amount"], "currency": p["currency"], "status": "confirmed"}}})
    if not r:
        return {"ok": True, "already": True}
    await _hist(pkg_id, "payment:confirmed", user.id, method="cash", receipt=receipt["id"], amount=body.amount_received, currency=body.currency)
    await transfer_package(pkg_id, by=user.id)
    return {"ok": True, "receipt": receipt, **_view(await _get(pkg_id))}


# ---------- cliente: enlace de activación ----------
async def _resolve(token: str) -> dict:
    p = await db.packages.find_one({"claim_token_hash": hashlib.sha256(token.encode()).hexdigest()}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail={"state": "invalid"})
    if p.get("claim_revoked_at"):
        raise HTTPException(status_code=410, detail={"state": "revoked"})
    if (p.get("claim_expires_at") or "") <= _now().isoformat() and p.get("delivery_status") != "activated":
        raise HTTPException(status_code=410, detail={"state": "expired"})
    return p


@router.get("/claim/{token}")
async def claim_preview(token: str, user: Optional[User] = Depends(get_current_user_optional)):
    p = await _resolve(token)
    out = {"state": "preview", **_public_preview(p)}
    if p.get("claimed_by") and (not user or user.id != p["claimed_by"]):
        out["state"] = "claimed_by_other"  # un solo uso: otra cuenta ya lo reclamó
        return out
    if not user:
        return out
    u = await db.users.find_one({"id": user.id}, {"_id": 0, "id": 1, "name": 1, "username": 1, "email": 1})
    prof = await db.user_profiles.find_one({"user_id": user.id}, {"_id": 0}) or {}
    current = {"name": u.get("name"), "display_name": prof.get("display_name"), "bio": prof.get("bio"), "avatar_url": prof.get("avatar_url") or u.get("avatar_url"), "location": prof.get("location"), "website": prof.get("website"), "profession": prof.get("profession"), "company": prof.get("company"), "social_links": prof.get("social_links") or [], "phone": prof.get("phone")}
    c = p["client"]
    incoming = {"name": c.get("name"), "display_name": c.get("name"), "bio": c.get("bio"), "avatar_url": c.get("avatar_url"), "location": c.get("location"), "website": c.get("website"), "profession": c.get("profession"), "company": c.get("company"), "social_links": c.get("social_links") or [], "phone": c.get("phone")}
    diff = [{"field": k, "current": current.get(k), "incoming": incoming.get(k), "changes": bool(current.get(k)) and current.get(k) != incoming.get(k)} for k in PROFILE_FIELDS if incoming.get(k)]
    cards = await db.cards.find({"id": {"$in": p["card_ids"]}}, {"_id": 0}).sort("package_slot", 1).to_list(3)
    from utils.card_design import ensure_design
    cards = [ensure_design(cd)[0] for cd in cards]
    existing_cards = await db.cards.count_documents({"user_id": user.id, "production_hidden": {"$ne": True}})
    out.update({"state": "review", "account": {"id": u["id"], "handle": _handle(u), "email_masked": _mask(u.get("email", ""))}, "client": c, "cards": cards, "profile_diff": diff, "existing_cards": existing_cards,
                "accepted": bool(p.get("accepted_at")) and p.get("claimed_by") == user.id, "package_id": p["id"], "provider_ready": _provider_ready(p["market"]) if p.get("market") else False})
    return out


class AcceptBody(BaseModel):
    profile_fields: list = []
    confirm_handle: str


@router.post("/claim/{token}/accept")
async def claim_accept(token: str, body: AcceptBody, user: User = Depends(get_current_user)):
    """Acepta la entrega hacia la cuenta autenticada (un solo uso). No activa nada hasta que el pago esté confirmado."""
    p = await _resolve(token)
    if p.get("claimed_by") and p["claimed_by"] != user.id:
        raise _err("Este paquete ya fue reclamado por otra cuenta.", "This package was already claimed by another account.", 409)
    u = await db.users.find_one({"id": user.id}, {"_id": 0, "id": 1, "name": 1, "username": 1, "email": 1})
    if body.confirm_handle.lstrip("@").lower() != _handle(u).lower():
        raise _err("Confirma el @ de la cuenta que recibirá el paquete.", "Confirm the @ of the account that will receive the package.")
    if p.get("prep_status") != "ready":
        raise _err("El paquete aún no está listo para entregar.", "The package is not ready for delivery yet.", 409)
    fields = [f for f in body.profile_fields if f in PROFILE_FIELDS]
    r = await db.packages.find_one_and_update({"id": p["id"], "$or": [{"claimed_by": None}, {"claimed_by": user.id}]},
                                              {"$set": {"claimed_by": user.id, "accepted_at": p.get("accepted_at") or _now().isoformat(), "acceptance": {"profile_fields": fields, "handle": _handle(u), "at": _now().isoformat()}}})
    if not r:
        raise _err("Este paquete ya fue reclamado por otra cuenta.", "This package was already claimed by another account.", 409)
    if not p.get("claimed_by"):
        await _hist(p["id"], "accepted", user.id, handle=_handle(u), fields=fields)
    p2 = await _get(p["id"])
    if p2.get("payment_status") == "confirmed":
        await transfer_package(p["id"], by=user.id)
        p2 = await _get(p["id"])
    return {"ok": True, "package_id": p2["id"], "payment_status": p2["payment_status"], "delivery_status": p2["delivery_status"], "payment_method": p2.get("payment_method"), "provider_ready": _provider_ready(p2["market"]), "price_label": OFFERS[p2["market"]]["label"]}


# ---------- pago virtual del cliente ----------
@router.post("/{pkg_id}/checkout")
async def checkout(pkg_id: str, request: Request, user: User = Depends(get_current_user)):
    if not _origin_ok(request):
        raise _err("Origen no permitido.", "Origin not allowed.", 403)
    p = await _get(pkg_id)
    if p.get("claimed_by") != user.id:
        raise _err("Primero acepta el paquete con tu cuenta.", "Accept the package with your account first.", 403)
    if p.get("payment_status") == "confirmed":
        raise _err("Este paquete ya está pagado.", "This package is already paid.", 409)
    if not _provider_ready(p["market"]):
        raise _err("El pago virtual no está disponible para este país. Puedes pagar en efectivo con tu asesor.", "Virtual payment is not available for this country. You can pay cash with your advisor.", 503)
    if p.get("payment_method") != "virtual":
        await db.packages.update_one({"id": pkg_id}, {"$set": {"payment_method": "virtual"}})
        await _hist(pkg_id, "payment:method_changed", user.id, method="virtual")
    offer = OFFERS[p["market"]]
    n = await db.service_payments.count_documents({"package_id": pkg_id}) + 1
    provider = "wompi" if p["market"] == "CO" else "stripe"
    att = {"id": str(uuid.uuid4()), "package_id": pkg_id, "order_id": None, "provider": provider, "amount": offer["amount"], "currency": offer["currency"], "status": "initiated", "attempt": n, "created_at": _now().isoformat()}
    await db.service_payments.insert_one(dict(att))
    base = f"{_frontend()}/paquete/{pkg_id}/pago"
    if provider == "stripe":
        _stripe()
        session = await asyncio.to_thread(stripe.checkout.Session.create, mode="payment", line_items=[{"quantity": 1, "price_data": {"currency": "usd", "unit_amount": offer["amount"] * 100, "product_data": {"name": f"BRUNO · {PACKAGE_LABEL['es']}", "description": f"Paquete {p['ref']} · Octopus Vision Company"}}}],
                                          customer_email=user.email, client_reference_id=pkg_id, metadata={"order_id": pkg_id, "attempt_id": att["id"], "kind": "bruno_package"}, payment_intent_data={"metadata": {"order_id": pkg_id, "kind": "bruno_package"}},
                                          success_url=f"{base}?session_id={{CHECKOUT_SESSION_ID}}", cancel_url=f"{base}?cancel=1", expires_at=int(_now().timestamp()) + 3600)
        await db.service_payments.update_one({"id": att["id"]}, {"$set": {"provider_ref": session.id, "status": "created"}})
        url = session.url
    else:
        reference = f"BP-{pkg_id[:8].upper()}-{n}-{secrets.token_hex(3).upper()}"
        cents = offer["amount"] * 100
        sig = hashlib.sha256(f"{reference}{cents}COP{os.environ['WOMPI_INTEGRITY_SECRET']}".encode()).hexdigest()
        params = {"public-key": os.environ["WOMPI_PUBLIC_KEY"], "currency": "COP", "amount-in-cents": str(cents), "reference": reference, "signature:integrity": sig, "redirect-url": base, "customer-data:email": user.email, "customer-data:full-name": (user.name or "")[:60]}
        await db.service_payments.update_one({"id": att["id"]}, {"$set": {"provider_ref": reference, "status": "created"}})
        url = "https://checkout.wompi.co/p/?" + urlencode(params)
    await db.packages.update_one({"id": pkg_id, "payment_status": {"$in": ["pending", "failed"]}}, {"$set": {"payment_status": "processing"}})
    await _hist(pkg_id, "payment:checkout_started", user.id, provider=provider, attempt=n)
    return {"url": url, "provider": provider, "label": offer["label"], "merchant": "Octopus Vision Company (OVC)"}


async def _mark_paid_pkg(pkg_id: str, provider: str, tx_id: str, amount: int, currency: str, by: Optional[str]):
    r = await db.packages.find_one_and_update({"id": pkg_id, "payment_status": {"$ne": "confirmed"}}, {"$set": {"payment_status": "confirmed", "payment_confirmed_at": _now().isoformat(), "receipt": {"id": f"RC-{secrets.token_hex(3).upper()}", "method": provider, "transaction_id": tx_id, "amount": amount / 100, "currency": currency, "at": _now().isoformat()}}})
    if not r:
        return False
    await _hist(pkg_id, "payment:confirmed", by, provider=provider, transaction_id=tx_id, amount=amount, currency=currency)
    await transfer_package(pkg_id, by=by or "system:payment")
    return True


async def apply_stripe_pkg(att: dict, s: dict, by: Optional[str]):
    p = await _get(att["package_id"])
    expected = OFFERS["US"]["amount"] * 100
    ok = s["paid"] and s["amount"] == expected and s["currency"] == "USD" and s["order_id"] == p["id"]
    st = "paid" if ok else ("expired" if s["status"] == "expired" else ("mismatch" if s["paid"] else "pending"))
    await db.service_payments.update_one({"id": att["id"]}, {"$set": {"status": st, "payment_intent": s["payment_intent"], "verified_at": _now().isoformat()}})
    if ok:
        await _mark_paid_pkg(p["id"], "stripe", s["id"], s["amount"], "USD", by)
    return {"attempt": st}


async def apply_wompi_pkg(att: dict, tx: dict, by: Optional[str]):
    p = await _get(att["package_id"])
    expected = OFFERS["CO"]["amount"] * 100
    status = tx.get("status")
    ok = status == "APPROVED" and tx.get("amount_in_cents") == expected and tx.get("currency") == "COP"
    st = "paid" if ok else {"PENDING": "pending", "DECLINED": "failed", "VOIDED": "voided", "ERROR": "failed"}.get(status, "pending")
    await db.service_payments.update_one({"id": att["id"]}, {"$set": {"status": st, "transaction_id": tx.get("id"), "verified_at": _now().isoformat(), "provider_status": status}})
    if ok:
        await _mark_paid_pkg(p["id"], "wompi", tx["id"], tx["amount_in_cents"], "COP", by)
    elif p.get("payment_status") != "confirmed" and st in ("failed", "voided"):
        await db.packages.update_one({"id": p["id"]}, {"$set": {"payment_status": "failed"}})
        await _hist(p["id"], f"payment:{st}", by, provider="wompi")
    return {"attempt": st}


@router.get("/{pkg_id}/payment-status")
async def payment_status(pkg_id: str, session_id: Optional[str] = None, id: Optional[str] = None, cancel: Optional[int] = None, user: User = Depends(get_current_user)):
    p = await _get(pkg_id)
    if p.get("claimed_by") != user.id and not is_admin(user):
        raise HTTPException(status_code=403, detail="Sin acceso")
    if p.get("payment_status") != "confirmed":
        try:
            if session_id:
                s = await _stripe_verify(session_id)
                att = await db.service_payments.find_one({"provider": "stripe", "provider_ref": session_id, "package_id": pkg_id}, {"_id": 0})
                if att:
                    await apply_stripe_pkg(att, s, user.id)
            elif id and _provider_ready("CO"):
                tx = await _wompi_transaction(id)
                att = await db.service_payments.find_one({"provider": "wompi", "provider_ref": tx.get("reference"), "package_id": pkg_id}, {"_id": 0})
                if att:
                    await apply_wompi_pkg(att, tx, user.id)
            elif cancel:
                await db.packages.update_one({"id": pkg_id, "payment_status": "processing"}, {"$set": {"payment_status": "pending"}})
                await _hist(pkg_id, "payment:cancelled", user.id)
        except HTTPException as e:
            logger.info(f"package payment verify: {e.detail}")
        except Exception as e:
            logger.warning(f"package payment verify error: {e}")
    p = await _get(pkg_id)
    return {"id": p["id"], "ref": p["ref"], "payment_status": p["payment_status"], "delivery_status": p["delivery_status"], "payment_method": p.get("payment_method"), "price_label": OFFERS[p["market"]]["label"], "card_ids": p["card_ids"] if p["delivery_status"] == "activated" else []}


# ---------- transferencia (atómica, reintentable) ----------
async def transfer_package(pkg_id: str, by: Optional[str] = None) -> bool:
    p = await db.packages.find_one_and_update({"id": pkg_id, "payment_status": "confirmed", "claimed_by": {"$ne": None}, "accepted_at": {"$ne": None}, "delivery_status": {"$in": ["pending_acceptance", "error"]}},
                                              {"$set": {"delivery_status": "transferring"}}, projection={"_id": 0})
    if not p:
        return False
    uid = p["claimed_by"]
    try:
        await db.cards.update_many({"id": {"$in": p["card_ids"]}}, {"$set": {"user_id": uid, "is_draft": False, "is_public": False, "show_in_feed": False, "updated_at": _now().isoformat(), "delivered_from_package": pkg_id}, "$unset": {"production_hidden": ""}})
        fields = (p.get("acceptance") or {}).get("profile_fields") or []
        c = p["client"]
        prof = {}
        for f in fields:
            if f == "name" and c.get("name"):
                await db.users.update_one({"id": uid}, {"$set": {"name": c["name"]}})
            elif f == "display_name" and c.get("name"):
                prof["display_name"] = c["name"]
            elif f in ("bio", "avatar_url", "location", "website", "profession", "company", "social_links", "phone") and c.get(f):
                prof[f] = c[f]
        if prof:
            prof["updated_at"] = _now().isoformat()
            await db.user_profiles.update_one({"user_id": uid}, {"$set": prof}, upsert=True)
            if "avatar_url" in prof:
                await db.users.update_one({"id": uid}, {"$set": {"avatar_url": prof["avatar_url"]}})
        moved = await db.cards.count_documents({"id": {"$in": p["card_ids"]}, "user_id": uid})
        if moved != len(p["card_ids"]):
            raise RuntimeError(f"transferidas {moved}/{len(p['card_ids'])}")
        await db.packages.update_one({"id": pkg_id}, {"$set": {"delivery_status": "activated", "activated_at": _now().isoformat(), "transfer_error": None}})
        await _hist(pkg_id, "delivery:activated", by, user_id=uid, cards=p["card_ids"], profile_fields=fields)
        try:
            from utils import search_sync
            for cid in p["card_ids"]:
                await search_sync.index_card(await db.cards.find_one({"id": cid}, {"_id": 0}))
        except Exception:
            pass
        await _notify_user(uid, "package_activated", "Tu paquete BRUNO está activo: perfil y 3 tarjetas ya están en tu cuenta.", pkg_id, "/my-profile?tab=cards", "BRUNO")
        return True
    except Exception as e:
        logger.error(f"transfer failed {pkg_id}: {e}")
        await db.packages.update_one({"id": pkg_id}, {"$set": {"delivery_status": "error", "transfer_error": str(e)[:200]}})
        await _hist(pkg_id, "delivery:error", by, error=str(e)[:200])
        return False


@router.post("/{pkg_id}/retry-transfer")
async def retry_transfer(pkg_id: str, user: User = Depends(get_current_user)):
    p = await _get(pkg_id)
    if not (is_admin(user) or p["advisor_id"] == user.id or p.get("claimed_by") == user.id):
        raise HTTPException(status_code=403, detail="Sin acceso")
    ok = await transfer_package(pkg_id, by=user.id)
    p2 = await _get(pkg_id)
    return {"ok": ok, "delivery_status": p2["delivery_status"], "payment_status": p2["payment_status"], "error": p2.get("transfer_error")}


@router.get("/mine/active")
async def my_packages(user: User = Depends(get_current_user)):
    rows = await db.packages.find({"claimed_by": user.id}, {"_id": 0, "id": 1, "ref": 1, "payment_status": 1, "delivery_status": 1, "payment_method": 1, "market": 1, "claim_url": 1}).to_list(20)
    return rows
