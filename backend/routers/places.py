"""Lugares cercanos (restaurantes, negocios, servicios). Proveedor: Google Places si hay GOOGLE_PLACES_API_KEY
en el servidor; si no, OpenStreetMap/Nominatim (datos reales, uso moderado: 1 req/s, caché 10 min)."""
import asyncio
import logging
import math
import os
import time
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/places", tags=["places"])
logger = logging.getLogger("bruno.places")

UA = "BRUNO.APP/1.0 (Octopus Vision Company; soporte@brunocard.app)"
NOMINATIM = "https://nominatim.openstreetmap.org"
CACHE_TTL = 600
_cache: dict = {}
_nominatim_lock = asyncio.Lock()
_last_nominatim = 0.0

CATEGORIES = [
    {"id": "restaurant", "label": "Restaurantes", "osm": "restaurant", "google": "restaurant", "icon": "🍽️"},
    {"id": "fast_food", "label": "Comida rápida", "osm": "fast food", "google": "fast_food_restaurant", "icon": "🍔"},
    {"id": "cafe", "label": "Cafeterías", "osm": "cafe", "google": "cafe", "icon": "☕"},
    {"id": "bakery", "label": "Panaderías", "osm": "bakery", "google": "bakery", "icon": "🥐"},
    {"id": "bar", "label": "Bares", "osm": "bar", "google": "bar", "icon": "🍻"},
    {"id": "supermarket", "label": "Supermercados", "osm": "supermarket", "google": "supermarket", "icon": "🛒"},
    {"id": "pharmacy", "label": "Farmacias", "osm": "pharmacy", "google": "pharmacy", "icon": "💊"},
    {"id": "hospital", "label": "Salud", "osm": "hospital", "google": "hospital", "icon": "🏥"},
    {"id": "bank", "label": "Bancos y cajeros", "osm": "bank", "google": "bank", "icon": "🏦"},
    {"id": "fuel", "label": "Gasolineras", "osm": "fuel", "google": "gas_station", "icon": "⛽"},
    {"id": "hotel", "label": "Hoteles", "osm": "hotel", "google": "lodging", "icon": "🏨"},
    {"id": "gym", "label": "Gimnasios", "osm": "gym", "google": "gym", "icon": "🏋️"},
    {"id": "hairdresser", "label": "Belleza", "osm": "hairdresser", "google": "hair_salon", "icon": "💇"},
    {"id": "car_repair", "label": "Talleres", "osm": "car repair", "google": "car_repair", "icon": "🔧"},
    {"id": "shop", "label": "Tiendas", "osm": "shop", "google": "store", "icon": "🛍️"},
    {"id": "parking", "label": "Parqueaderos", "osm": "parking", "google": "parking", "icon": "🅿️"},
]
CAT_BY_ID = {c["id"]: c for c in CATEGORIES}
TYPE_LABEL = {"restaurant": "Restaurante", "fast_food": "Comida rápida", "cafe": "Cafetería", "bakery": "Panadería", "bar": "Bar", "pub": "Bar", "supermarket": "Supermercado", "convenience": "Tienda", "pharmacy": "Farmacia", "chemist": "Farmacia", "hospital": "Hospital", "clinic": "Clínica", "doctors": "Consultorio", "dentist": "Odontología", "bank": "Banco", "atm": "Cajero", "fuel": "Gasolinera", "hotel": "Hotel", "hostel": "Hostal", "guest_house": "Hospedaje", "gym": "Gimnasio", "fitness_centre": "Gimnasio", "hairdresser": "Peluquería", "beauty": "Belleza", "car_repair": "Taller", "parking": "Parqueadero", "marketplace": "Mercado", "ice_cream": "Heladería", "bicycle": "Bicicletería", "clothes": "Ropa", "mall": "Centro comercial"}


def _haversine_m(lat1, lng1, lat2, lng2) -> int:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return int(2 * r * math.asin(math.sqrt(a)))


def _cached(key):
    hit = _cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    return None


def _store(key, value):
    if len(_cache) > 500:
        for k in [k for k, v in _cache.items() if v[0] < time.time()][:200] or list(_cache)[:100]:
            _cache.pop(k, None)
    _cache[key] = (time.time() + CACHE_TTL, value)
    return value


async def _nominatim(path: str, params: dict):
    global _last_nominatim
    async with _nominatim_lock:
        wait = 1.1 - (time.time() - _last_nominatim)
        if wait > 0:
            await asyncio.sleep(wait)
        _last_nominatim = time.time()
        async with httpx.AsyncClient(timeout=12, headers={"User-Agent": UA, "Accept-Language": "es"}) as client:
            r = await client.get(f"{NOMINATIM}{path}", params=params)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="El servicio de lugares no respondió. Intenta de nuevo en unos segundos.")
    return r.json()


def _osm_item(x, lat, lng):
    addr = x.get("address") or {}
    extra = x.get("extratags") or {}
    plat, plng = float(x["lat"]), float(x["lon"])
    typ = x.get("type") or ""
    name = x.get("name") or (x.get("display_name") or "").split(",")[0]
    if not name:
        return None
    street = " ".join(filter(None, [addr.get("road"), addr.get("house_number")]))
    area = addr.get("neighbourhood") or addr.get("suburb") or addr.get("city_district") or addr.get("city") or addr.get("town") or ""
    return {
        "id": f"osm-{x.get('osm_type', 'n')[0]}{x.get('osm_id')}",
        "name": name,
        "category": typ,
        "category_label": TYPE_LABEL.get(typ, (x.get("category") or typ or "Lugar").replace("_", " ").capitalize()),
        "address": ", ".join(filter(None, [street, area])) or None,
        "lat": plat,
        "lng": plng,
        "distance_m": _haversine_m(lat, lng, plat, plng),
        "phone": extra.get("phone") or extra.get("contact:phone"),
        "website": extra.get("website") or extra.get("contact:website"),
        "opening_hours": extra.get("opening_hours"),
        "cuisine": (extra.get("cuisine") or "").replace(";", ", ").replace("_", " ") or None,
    }


async def _google_nearby(lat, lng, q, category, radius_m, limit, key):
    body = {"maxResultCount": min(limit, 20), "languageCode": "es", "locationRestriction": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": float(radius_m)}}}
    if category and category in CAT_BY_ID:
        body["includedTypes"] = [CAT_BY_ID[category]["google"]]
    url = "https://places.googleapis.com/v1/places:searchNearby"
    if q:
        url = "https://places.googleapis.com/v1/places:searchText"
        body = {"textQuery": q, "maxResultCount": min(limit, 20), "languageCode": "es", "locationBias": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": float(radius_m)}}}
    headers = {"X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.primaryType,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.currentOpeningHours.openNow"}
    async with httpx.AsyncClient(timeout=12) as client:
        r = await client.post(url, json=body, headers=headers)
    if r.status_code != 200:
        logger.warning("google places %s %s", r.status_code, r.text[:200])
        raise HTTPException(status_code=502, detail="Google Places no respondió")
    items = []
    for p in r.json().get("places", []):
        loc = p.get("location") or {}
        items.append({"id": f"g-{p.get('id')}", "name": (p.get("displayName") or {}).get("text"), "category": p.get("primaryType"), "category_label": (p.get("primaryTypeDisplayName") or {}).get("text") or "Lugar", "address": p.get("formattedAddress"), "lat": loc.get("latitude"), "lng": loc.get("longitude"), "distance_m": _haversine_m(lat, lng, loc.get("latitude", lat), loc.get("longitude", lng)), "phone": p.get("nationalPhoneNumber"), "website": p.get("websiteUri"), "rating": p.get("rating"), "rating_count": p.get("userRatingCount"), "open_now": (p.get("currentOpeningHours") or {}).get("openNow")})
    return items


@router.get("/categories")
async def categories():
    return {"categories": [{"id": c["id"], "label": c["label"], "icon": c["icon"]} for c in CATEGORIES]}


@router.get("/nearby")
async def nearby(lat: float = Query(..., ge=-90, le=90), lng: float = Query(..., ge=-180, le=180), q: Optional[str] = Query(None, max_length=80), category: Optional[str] = Query(None, max_length=32), radius_m: int = Query(1500, ge=200, le=10000), limit: int = Query(20, ge=1, le=40)):
    q = (q or "").strip()
    if not q and not category:
        raise HTTPException(status_code=400, detail="Indica una categoría o un nombre para buscar")
    key = ("nearby", round(lat, 3), round(lng, 3), q.lower(), category, radius_m, limit)
    hit = _cached(key)
    if hit:
        return hit
    gkey = os.environ.get("GOOGLE_PLACES_API_KEY")
    if gkey:
        items = await _google_nearby(lat, lng, q, category, radius_m, limit, gkey)
        provider, attribution = "google", "Datos de Google"
    else:
        dlat = radius_m / 111_320
        dlng = radius_m / (111_320 * max(0.2, math.cos(math.radians(lat))))
        term = q or CAT_BY_ID.get(category, {}).get("osm", category)
        if q and category and category in CAT_BY_ID:
            term = f"{q} {CAT_BY_ID[category]['osm']}"
        rows = await _nominatim("/search", {"q": term, "format": "jsonv2", "limit": limit, "viewbox": f"{lng - dlng},{lat + dlat},{lng + dlng},{lat - dlat}", "bounded": 1, "addressdetails": 1, "extratags": 1})
        items = [i for i in (_osm_item(x, lat, lng) for x in rows) if i and i["distance_m"] <= radius_m * 1.3]
        provider, attribution = "openstreetmap", "Datos © OpenStreetMap contributors (ODbL)"
    items.sort(key=lambda i: i["distance_m"])
    return _store(key, {"provider": provider, "attribution": attribution, "center": {"lat": lat, "lng": lng}, "radius_m": radius_m, "items": items[:limit], "count": len(items[:limit])})


@router.get("/geocode")
async def geocode(q: str = Query(..., min_length=2, max_length=120), limit: int = Query(5, ge=1, le=8)):
    key = ("geo", q.strip().lower(), limit)
    hit = _cached(key)
    if hit:
        return hit
    rows = await _nominatim("/search", {"q": q.strip(), "format": "jsonv2", "limit": limit, "addressdetails": 1})
    out = []
    for x in rows:
        addr = x.get("address") or {}
        out.append({"id": f"{x.get('osm_type', 'n')[0]}{x.get('osm_id')}", "name": x.get("name") or (x.get("display_name") or "").split(",")[0], "display_name": x.get("display_name"), "lat": float(x["lat"]), "lng": float(x["lon"]), "city": addr.get("city") or addr.get("town") or addr.get("village") or addr.get("state"), "country": addr.get("country")})
    return _store(key, {"results": out, "attribution": "Datos © OpenStreetMap contributors (ODbL)"})
