"""Galería de tarjetas de ejemplo: listado, ejemplo renderizable por plantilla/idioma, QR y siembra idempotente."""
import copy
import io
import os
from datetime import datetime, timezone
from typing import Optional

import qrcode
from fastapi import APIRouter, HTTPException, Response

from utils.card_design import DEFAULT_DESIGN, PRESETS, _deep_merge
from utils.card_examples_seed import CONTACT, EXAMPLES, EXAMPLE_USER_ID, LOC, PRESET_NAMES, SOCIAL, TYPE_NAMES
from utils.database import db

router = APIRouter(prefix="/card-examples", tags=["card-examples"])
LANGS = ("es", "en")


def _lang(l: Optional[str]) -> str:
    return l if l in LANGS else "es"


def _design_for(preset: str) -> dict:
    d = _deep_merge(copy.deepcopy(DEFAULT_DESIGN), PRESETS.get(preset) or {})
    d["version"] = 2
    d["preset"] = preset
    d["components"] = {**d.get("components", {}), "qr": True, "typeFields": True, "gallery": True, "links": True}
    return d


def build_card(ex: dict, preset: str, lang: str) -> dict:
    """Devuelve la misma forma que GET /cards/{id} para que el renderizador público la pinte sin adaptadores."""
    if preset not in ex["presets"]:
        preset = ex["presets"][0]
    txt = ex["i18n"][lang]
    design = _design_for(preset)
    if design["background"].get("type") == "fullimage":
        design["background"]["imageUrl"] = ex["banner"]
    return {
        "id": f"example-{ex['type']}", "user_id": EXAMPLE_USER_ID, "card_type": ex["type"], "title": ex["title"], "subtitle": txt["subtitle"], "description": txt["description"],
        "avatar_url": ex["avatar"], "banner_url": ex["banner"], "gallery_photos": ex["gallery"], "social_links": [dict(s) for s in SOCIAL],
        "contact_info": dict(CONTACT), "location": dict(LOC), "locations": [],
        "template_id": preset, "legacy_template": preset, "custom_fields": txt["custom_fields"], "links": [{"type": l["type"], "label": l["label"][lang], "url": l["url"]} for l in ex.get("links", [])],
        "is_public": True, "show_in_feed": False, "is_animated": preset == "animated", "is_draft": False, "card_design": design, "card_design_version": 2,
        "is_example": True, "example_lang": lang, "example_preset": preset, "example_presets": ex["presets"], "type_name": TYPE_NAMES[ex["type"]][lang], "preset_name": PRESET_NAMES[preset][lang],
        "views": 0, "created_at": "2026-01-01T00:00:00+00:00", "updated_at": "2026-01-01T00:00:00+00:00",
    }


def find_example(type_or_id: str) -> Optional[dict]:
    t = type_or_id.replace("example-", "")
    return next((e for e in EXAMPLES if e["type"] == t), None)


@router.get("")
async def list_examples(lang: str = "es"):
    lang = _lang(lang)
    return {"lang": lang, "items": [{"type": e["type"], "id": f"example-{e['type']}", "name": TYPE_NAMES[e["type"]][lang], "title": e["title"], "description": e["cover_desc"][lang], "cover": e["banner"], "avatar": e["avatar"],
                                     "presets": [{"id": p, "name": PRESET_NAMES[p][lang]} for p in e["presets"]], "modules": _modules(e)} for e in EXAMPLES],
            "presets": [{"id": p, "name": PRESET_NAMES[p][lang]} for p in PRESET_NAMES]}


def _modules(e: dict) -> list:
    cf = e["i18n"]["es"]["custom_fields"]
    mods = ["bio", "contact", "social", "location", "qr"]
    if e["gallery"]:
        mods.append("gallery")
    if e.get("links"):
        mods.append("links")
    mods += [k for k in ("services", "products", "team", "schedule", "experience", "education", "skills", "languages", "job_details", "attractions", "emergencyContacts", "ownerContacts") if cf.get(k)]
    return mods


@router.get("/{type}")
async def get_example(type: str, template: Optional[str] = None, lang: str = "es"):
    ex = find_example(type)
    if not ex:
        raise HTTPException(status_code=404, detail="Ejemplo no encontrado")
    return build_card(ex, template or ex["presets"][0], _lang(lang))


@router.get("/{type}/qr")
async def example_qr(type: str, template: Optional[str] = None, lang: str = "es"):
    ex = find_example(type)
    if not ex:
        raise HTTPException(status_code=404, detail="Ejemplo no encontrado")
    base = os.environ.get("PUBLIC_BASE_URL") or os.environ.get("FRONTEND_URL")
    if not base:
        raise HTTPException(status_code=503, detail="URL pública no configurada")
    url = f"{base.rstrip('/')}/c/example-{ex['type']}?template={template or ex['presets'][0]}&lang={_lang(lang)}"
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(url); qr.make(fit=True)
    buf = io.BytesIO(); qr.make_image(fill_color="#474747", back_color="white").save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png", headers={"X-Card-Url": url, "Cache-Control": "public, max-age=3600"})


async def seed_examples() -> dict:
    """Siembra idempotente en `card_examples` (separada de `cards`); detecta tipos/presets sin ejemplo."""
    now = datetime.now(timezone.utc).isoformat()
    for e in EXAMPLES:
        await db.card_examples.update_one({"id": f"example-{e['type']}"}, {"$set": {"id": f"example-{e['type']}", "card_type": e["type"], "title": e["title"], "presets": e["presets"], "is_example": True, "user_id": EXAMPLE_USER_ID, "updated_at": now}, "$setOnInsert": {"created_at": now}}, upsert=True)
    types = set(TYPE_NAMES)
    covered = {e["type"] for e in EXAMPLES}
    presets_covered = {p for e in EXAMPLES for p in e["presets"]}
    return {"examples": len(EXAMPLES), "missing_types": sorted(types - covered), "missing_presets": sorted(set(PRESETS) - presets_covered)}


@router.get("/coverage/report")
async def coverage():
    return await seed_examples()
