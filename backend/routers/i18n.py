"""Internationalization & multi-currency support.

This module powers:
  • IP-based country & currency auto-detection
  • Exchange-rate cache (refreshed daily from exchangerate.host)
  • User-preferred currency/country overrides
  • Tax rate hints per region (initial defaults — actual tax engine lives in Phase B)

Schemas:
  fx_rates:    { id: "USD", rates: {EUR: 0.92, COP: 4200.0, ...}, fetched_at: ISO }
  user_profiles add: preferred_currency, preferred_country, preferred_locale
"""
import os
import sys
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel, Field

sys.path.insert(0, "/app/backend")

from utils.database import db
from utils.security import get_current_user, get_current_user_optional
from models.user import User


router = APIRouter(prefix="/i18n", tags=["i18n"])

# Countries we explicitly support — others fall back to USD / English.
SUPPORTED_COUNTRIES = {
    # Latin-America
    "CO": {"currency": "COP", "locale": "es-CO", "name": "Colombia", "tax_kind": "iva", "tax_default": 0.19},
    "MX": {"currency": "MXN", "locale": "es-MX", "name": "México", "tax_kind": "iva", "tax_default": 0.16},
    "AR": {"currency": "ARS", "locale": "es-AR", "name": "Argentina", "tax_kind": "iva", "tax_default": 0.21},
    "PE": {"currency": "PEN", "locale": "es-PE", "name": "Perú", "tax_kind": "igv", "tax_default": 0.18},
    "CL": {"currency": "CLP", "locale": "es-CL", "name": "Chile", "tax_kind": "iva", "tax_default": 0.19},
    # USA / Canada
    "US": {"currency": "USD", "locale": "en-US", "name": "United States", "tax_kind": "sales_tax", "tax_default": 0.0},
    "CA": {"currency": "CAD", "locale": "en-CA", "name": "Canada", "tax_kind": "gst_hst", "tax_default": 0.05},
    # EU 27 — all use EUR except a few; we still record the locale for proper formatting
    "AT": {"currency": "EUR", "locale": "de-AT", "name": "Österreich", "tax_kind": "vat", "tax_default": 0.20},
    "BE": {"currency": "EUR", "locale": "nl-BE", "name": "België", "tax_kind": "vat", "tax_default": 0.21},
    "BG": {"currency": "BGN", "locale": "bg-BG", "name": "България", "tax_kind": "vat", "tax_default": 0.20},
    "HR": {"currency": "EUR", "locale": "hr-HR", "name": "Hrvatska", "tax_kind": "vat", "tax_default": 0.25},
    "CY": {"currency": "EUR", "locale": "el-CY", "name": "Κύπρος", "tax_kind": "vat", "tax_default": 0.19},
    "CZ": {"currency": "CZK", "locale": "cs-CZ", "name": "Česko", "tax_kind": "vat", "tax_default": 0.21},
    "DK": {"currency": "DKK", "locale": "da-DK", "name": "Danmark", "tax_kind": "vat", "tax_default": 0.25},
    "EE": {"currency": "EUR", "locale": "et-EE", "name": "Eesti", "tax_kind": "vat", "tax_default": 0.22},
    "FI": {"currency": "EUR", "locale": "fi-FI", "name": "Suomi", "tax_kind": "vat", "tax_default": 0.255},
    "FR": {"currency": "EUR", "locale": "fr-FR", "name": "France", "tax_kind": "vat", "tax_default": 0.20},
    "DE": {"currency": "EUR", "locale": "de-DE", "name": "Deutschland", "tax_kind": "vat", "tax_default": 0.19},
    "GR": {"currency": "EUR", "locale": "el-GR", "name": "Ελλάδα", "tax_kind": "vat", "tax_default": 0.24},
    "HU": {"currency": "HUF", "locale": "hu-HU", "name": "Magyarország", "tax_kind": "vat", "tax_default": 0.27},
    "IE": {"currency": "EUR", "locale": "en-IE", "name": "Ireland", "tax_kind": "vat", "tax_default": 0.23},
    "IT": {"currency": "EUR", "locale": "it-IT", "name": "Italia", "tax_kind": "vat", "tax_default": 0.22},
    "LV": {"currency": "EUR", "locale": "lv-LV", "name": "Latvija", "tax_kind": "vat", "tax_default": 0.21},
    "LT": {"currency": "EUR", "locale": "lt-LT", "name": "Lietuva", "tax_kind": "vat", "tax_default": 0.21},
    "LU": {"currency": "EUR", "locale": "fr-LU", "name": "Luxembourg", "tax_kind": "vat", "tax_default": 0.17},
    "MT": {"currency": "EUR", "locale": "en-MT", "name": "Malta", "tax_kind": "vat", "tax_default": 0.18},
    "NL": {"currency": "EUR", "locale": "nl-NL", "name": "Nederland", "tax_kind": "vat", "tax_default": 0.21},
    "PL": {"currency": "PLN", "locale": "pl-PL", "name": "Polska", "tax_kind": "vat", "tax_default": 0.23},
    "PT": {"currency": "EUR", "locale": "pt-PT", "name": "Portugal", "tax_kind": "vat", "tax_default": 0.23},
    "RO": {"currency": "RON", "locale": "ro-RO", "name": "România", "tax_kind": "vat", "tax_default": 0.19},
    "SK": {"currency": "EUR", "locale": "sk-SK", "name": "Slovensko", "tax_kind": "vat", "tax_default": 0.23},
    "SI": {"currency": "EUR", "locale": "sl-SI", "name": "Slovenija", "tax_kind": "vat", "tax_default": 0.22},
    "ES": {"currency": "EUR", "locale": "es-ES", "name": "España", "tax_kind": "vat", "tax_default": 0.21},
    "SE": {"currency": "SEK", "locale": "sv-SE", "name": "Sverige", "tax_kind": "vat", "tax_default": 0.25},
    # UK (post-Brexit, kept for completeness)
    "GB": {"currency": "GBP", "locale": "en-GB", "name": "United Kingdom", "tax_kind": "vat", "tax_default": 0.20},
}

EU_COUNTRY_CODES = {
    "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE",
    "IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"
}

PRIMARY_CURRENCIES = ["COP", "USD", "EUR", "MXN", "ARS", "GBP", "CAD"]


def _country_to_compliance(country_code: str) -> dict:
    """Return which legal framework applies to a given country."""
    if country_code in EU_COUNTRY_CODES:
        return {"framework": "gdpr", "framework_label": "RGPD/GDPR", "consent_required": True}
    if country_code == "US":
        return {"framework": "ccpa", "framework_label": "CCPA / CPRA", "consent_required": True}
    if country_code == "CO":
        return {"framework": "habeas_data_co", "framework_label": "Ley 1581 (Colombia)", "consent_required": True}
    if country_code == "GB":
        return {"framework": "uk_gdpr", "framework_label": "UK GDPR", "consent_required": True}
    return {"framework": "generic", "framework_label": "Standard", "consent_required": False}


def _is_eu(country_code: str) -> bool:
    return country_code in EU_COUNTRY_CODES


def _request_country(request: Request) -> Optional[str]:
    """Detect country in priority order: CF header → X-Country header → Accept-Language hint."""
    cf = request.headers.get("CF-IPCountry") or request.headers.get("cf-ipcountry")
    if cf and cf.upper() not in ("XX", "T1") and len(cf) == 2:
        return cf.upper()
    x_country = request.headers.get("X-Country-Code")
    if x_country and len(x_country) == 2:
        return x_country.upper()
    al = (request.headers.get("Accept-Language") or "").split(",")[0]
    if "-" in al and len(al.split("-")[1].split(";")[0]) == 2:
        return al.split("-")[1].split(";")[0].upper()
    return None


# ─── Models ──────────────────────────────────────────────────────────────────

class CurrencyPreferenceInput(BaseModel):
    currency: str = Field(..., min_length=3, max_length=3)
    country: Optional[str] = Field(default=None, min_length=2, max_length=2)
    locale: Optional[str] = None


# ─── FX Rates ────────────────────────────────────────────────────────────────

async def _ensure_fx_rates(base: str = "USD") -> dict:
    """Ensure we have fresh FX rates for `base`. Refresh once a day."""
    base = base.upper()
    doc = await db.fx_rates.find_one({"id": base})
    now = datetime.now(timezone.utc)
    if doc and doc.get("fetched_at"):
        age = now - datetime.fromisoformat(doc["fetched_at"].replace("Z", "+00:00"))
        if age < timedelta(hours=24) and doc.get("rates"):
            return doc

    # Fetch from exchangerate.host (free, no key required)
    url = f"https://api.exchangerate.host/latest?base={base}"
    rates = {}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(url)
            data = r.json() if r.status_code == 200 else {}
            rates = data.get("rates") or {}
    except Exception as e:
        logging.warning(f"exchangerate.host failed: {e}")

    # Fallback / minimum set — keeps the app usable even if the FX API is down
    rates.setdefault("USD", 1.0 if base == "USD" else None)
    if base == "USD":
        rates.setdefault("EUR", 0.93)
        rates.setdefault("COP", 4100.0)
        rates.setdefault("MXN", 17.0)
        rates.setdefault("ARS", 1000.0)
        rates.setdefault("GBP", 0.79)
        rates.setdefault("CAD", 1.36)

    new_doc = {
        "id": base,
        "rates": rates,
        "fetched_at": now.isoformat(),
        "source": "exchangerate.host",
    }
    await db.fx_rates.update_one({"id": base}, {"$set": new_doc}, upsert=True)
    return new_doc


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/detect")
async def detect_locale(
    request: Request,
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Return country/currency/locale recommendation.

    Priority:
      1. Authenticated user's explicit preference
      2. IP/header detection
      3. USD / en-US fallback
    """
    # 1. User preference
    if current_user:
        prof = await db.user_profiles.find_one({"user_id": current_user.id}, {"_id": 0}) or {}
        pref_country = prof.get("preferred_country")
        pref_currency = prof.get("preferred_currency")
        pref_locale = prof.get("preferred_locale")
        if pref_country or pref_currency:
            cfg = SUPPORTED_COUNTRIES.get((pref_country or "US").upper(), SUPPORTED_COUNTRIES["US"])
            return {
                "country": (pref_country or "US").upper(),
                "currency": (pref_currency or cfg["currency"]).upper(),
                "locale": pref_locale or cfg["locale"],
                "source": "profile",
                "is_eu": _is_eu((pref_country or "").upper()),
                "compliance": _country_to_compliance((pref_country or "").upper()),
                "tax_kind": cfg["tax_kind"],
                "tax_rate_default": cfg["tax_default"],
                "country_name": cfg["name"],
            }

    # 2. Header / IP detection
    cc = _request_country(request)
    cfg = SUPPORTED_COUNTRIES.get(cc or "", SUPPORTED_COUNTRIES["US"])
    cc = cc or "US"
    return {
        "country": cc,
        "currency": cfg["currency"],
        "locale": cfg["locale"],
        "source": "ip" if cc != "US" else "fallback",
        "is_eu": _is_eu(cc),
        "compliance": _country_to_compliance(cc),
        "tax_kind": cfg["tax_kind"],
        "tax_rate_default": cfg["tax_default"],
        "country_name": cfg["name"],
    }


@router.get("/countries")
async def list_countries():
    """Return all supported countries — used by the country selector."""
    countries = [
        {
            "code": code,
            "name": cfg["name"],
            "currency": cfg["currency"],
            "locale": cfg["locale"],
            "is_eu": code in EU_COUNTRY_CODES,
            "tax_kind": cfg["tax_kind"],
            "tax_rate_default": cfg["tax_default"],
        }
        for code, cfg in SUPPORTED_COUNTRIES.items()
    ]
    return {"countries": sorted(countries, key=lambda c: c["name"]), "eu_codes": sorted(list(EU_COUNTRY_CODES))}


@router.get("/currencies")
async def list_currencies():
    """Return all currencies we natively support, with current FX rates vs USD."""
    fx = await _ensure_fx_rates("USD")
    rates = fx.get("rates", {}) or {}
    # Build deduped, ordered list — primaries first
    seen = set()
    items = []
    for code in PRIMARY_CURRENCIES:
        items.append({"code": code, "rate_vs_usd": rates.get(code, 1.0 if code == "USD" else None)})
        seen.add(code)
    # Add the rest sorted alphabetically
    for code in sorted(rates.keys()):
        if code in seen:
            continue
        items.append({"code": code, "rate_vs_usd": rates[code]})
    return {"currencies": items, "fetched_at": fx.get("fetched_at"), "base": "USD"}


@router.get("/rates")
async def get_rates(base: str = "USD"):
    """Return FX rates with `base` as the unit."""
    doc = await _ensure_fx_rates(base.upper())
    return {"base": doc["id"], "rates": doc["rates"], "fetched_at": doc["fetched_at"]}


@router.post("/preference")
async def set_currency_preference(
    payload: CurrencyPreferenceInput,
    current_user: User = Depends(get_current_user),
):
    """Persist the user's preferred currency/country/locale."""
    currency = payload.currency.upper()
    country = (payload.country or "").upper() or None
    locale = payload.locale or (SUPPORTED_COUNTRIES.get(country or "", {}).get("locale") if country else None)
    update = {
        "preferred_currency": currency,
        "preferred_country": country,
        "preferred_locale": locale,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.user_profiles.update_one(
        {"user_id": current_user.id},
        {"$set": update, "$setOnInsert": {"user_id": current_user.id}},
        upsert=True,
    )
    return {"status": "updated", **update}


@router.get("/compliance")
async def get_compliance(
    request: Request,
    country: Optional[str] = None,
):
    """Return the data-protection framework applicable to a given country."""
    cc = (country or _request_country(request) or "US").upper()
    cfg = SUPPORTED_COUNTRIES.get(cc, SUPPORTED_COUNTRIES["US"])
    return {
        "country": cc,
        "country_name": cfg["name"],
        "is_eu": _is_eu(cc),
        **_country_to_compliance(cc),
        "tax_kind": cfg["tax_kind"],
        "tax_rate_default": cfg["tax_default"],
    }
