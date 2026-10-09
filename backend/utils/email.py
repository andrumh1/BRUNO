"""Emergent managed email (Resend). Templates are server-side only; callers pass IDs, never markup."""
import ipaddress
import logging
import os
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()
logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "BRUNO")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: str | None = None) -> str | None:
    _assert_safe_email(subject, html)
    if not EMAIL_KEY:
        raise HTTPException(status_code=503, detail="Email no configurado")
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        try:
            code = e.response.json().get("code", "")
        except ValueError:
            code = ""
        if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
            logger.warning(f"Email paused: {code} ({e.response.status_code}): {e.response.text[:200]}")
            raise HTTPException(status_code=503, detail="El envío de correos no está disponible ahora mismo")
        if code == "undeliverable_recipient":
            raise HTTPException(status_code=400, detail="No pudimos verificar que ese correo pueda recibir mensajes. Revisa la dirección de tu cuenta.")
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="No se pudo enviar el correo")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(status_code=500, detail="No se pudo enviar el correo")


def _row(label: str, value: str, bold: bool = False) -> str:
    w = "font-weight:700;" if bold else ""
    return (f'<tr><td style="padding:6px 0;color:#6b6b6b;font-size:14px">{escape(label)}</td>'
            f'<td style="padding:6px 0;text-align:right;font-size:14px;{w}">{escape(value)}</td></tr>')


def receipt_html(*, buyer_name: str, item_name: str, kind_label: str, date_label: str, receipt_no: str,
                 subtotal: str, discount: str | None, discount_code: str | None, shipping: str | None, total: str,
                 seller_name: str | None, app_url: str | None) -> str:
    rows = _row("Importe", subtotal)
    if discount:
        rows += _row(f"Descuento ({discount_code})", f"−{discount}")
    if shipping:
        rows += _row("Envío", shipping)
    rows += _row("Total pagado", total, bold=True)
    seller = f'<p style="margin:0 0 6px;font-size:13px;color:#6b6b6b">Vendedor/creador: {escape(seller_name)}</p>' if seller_name else ""
    link = (f'<p style="margin:18px 0 0"><a href="{escape(app_url)}/earnings" style="display:inline-block;background:#F26A1B;color:#fff;text-decoration:none;'
            f'padding:10px 18px;border-radius:999px;font-weight:700;font-size:14px">Abrir BRUNO</a></p>') if app_url and app_url.startswith("https://") else ""
    brand = escape(EMAIL_FROM_NAME)
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#1c1c1c">'
        '<tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;padding:28px">'
        f'<tr><td><p style="margin:0 0 4px;font-size:12px;letter-spacing:.18em;color:#F26A1B;font-weight:700">{brand}</p>'
        f'<h1 style="margin:0 0 16px;font-size:22px">Recibo de tu compra</h1>'
        f'<p style="margin:0 0 6px;font-size:15px">Hola {escape(buyer_name)}, gracias por tu compra en {brand}.</p>'
        f'<p style="margin:0 0 6px;font-size:13px;color:#6b6b6b">{escape(kind_label)} · {escape(date_label)}</p>'
        f'<p style="margin:0 0 14px;font-size:13px;color:#6b6b6b">N.º de recibo: {escape(receipt_no)}</p>'
        f'<p style="margin:0 0 10px;font-size:16px;font-weight:700">{escape(item_name)}</p>{seller}'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin:10px 0">{rows}</table>'
        f'{link}'
        f'<p style="margin:22px 0 0;font-size:12px;color:#888">Pago procesado de forma segura por Stripe. Enviado por {brand}. '
        'Nunca te pediremos tu contraseña ni los datos de tu tarjeta por correo.</p>'
        '</td></tr></table></td></tr></table>'
    )


def sale_html(*, seller_name: str, item_name: str, buyer_name: str, kind_label: str, total: str, fee: str, net: str, app_url: str | None) -> str:
    rows = _row("Pagó el comprador", total) + _row("Comisión BRUNO", f"−{fee}") + _row("Tu parte", net, bold=True)
    brand = escape(EMAIL_FROM_NAME)
    link = (f'<p style="margin:18px 0 0"><a href="{escape(app_url)}/earnings" style="display:inline-block;background:#F26A1B;color:#fff;text-decoration:none;'
            f'padding:10px 18px;border-radius:999px;font-weight:700;font-size:14px">Ver mis ingresos</a></p>') if app_url and app_url.startswith("https://") else ""
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#1c1c1c">'
        '<tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;padding:28px">'
        f'<tr><td><p style="margin:0 0 4px;font-size:12px;letter-spacing:.18em;color:#F26A1B;font-weight:700">{brand}</p>'
        f'<h1 style="margin:0 0 16px;font-size:22px">¡Nueva venta!</h1>'
        f'<p style="margin:0 0 6px;font-size:15px">Hola {escape(seller_name)}, {escape(buyer_name)} acaba de comprar:</p>'
        f'<p style="margin:0 0 4px;font-size:16px;font-weight:700">{escape(item_name)}</p>'
        f'<p style="margin:0 0 14px;font-size:13px;color:#6b6b6b">{escape(kind_label)}</p>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin:10px 0">{rows}</table>'
        f'{link}'
        f'<p style="margin:22px 0 0;font-size:12px;color:#888">Tu parte queda en tu cuenta de cobros y la retiras cuando quieras desde Mis ingresos. Enviado por {brand}.</p>'
        '</td></tr></table></td></tr></table>'
    )
