"""Iteration 109: Card examples gallery (/api/card-examples/*, /api/cards/example-*, QR, analytics no-op, search exclusion, images)."""
import os
import re
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
EMAIL = "newtest@bruno.com"
PASS = "Test1234!"

EXPECTED_TYPES = {"personal", "empresarial", "negocio", "servicios", "lugares", "guardian",
                  "curriculum", "mascotas", "oferta_trabajo", "busqueda_personal", "solicitud_servicio"}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json", "X-Platform": "native"})
    return sess


@pytest.fixture(scope="module")
def auth(s):
    r = s.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASS})
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:120]}")
    tok = r.json().get("access_token") or r.json().get("token")
    s.headers["Authorization"] = f"Bearer {tok}"
    return tok


# ---------- list / coverage ----------
class TestList:
    def test_list_en(self, s):
        r = s.get(f"{API}/card-examples", params={"lang": "en"})
        assert r.status_code == 200
        data = r.json()
        assert data["lang"] == "en"
        items = data["items"]
        assert len(items) == 11
        assert {i["type"] for i in items} == EXPECTED_TYPES
        by = {i["type"]: i for i in items}
        for i in items:
            for k in ("name", "description", "cover", "avatar", "presets"):
                assert i.get(k), f"missing {k} in {i['type']}"
        # preset counts
        assert len(by["personal"]["presets"]) == 11
        for t in ("guardian", "oferta_trabajo", "busqueda_personal", "solicitud_servicio"):
            assert len(by[t]["presets"]) == 7, f"{t} expected 7 presets, got {len(by[t]['presets'])}"
        assert len(by["curriculum"]["presets"]) == 8

    def test_list_es(self, s):
        r = s.get(f"{API}/card-examples", params={"lang": "es"})
        assert r.status_code == 200
        assert r.json()["lang"] == "es"

    def test_coverage(self, s):
        r = s.get(f"{API}/card-examples/coverage/report")
        assert r.status_code == 200
        d = r.json()
        assert d["missing_types"] == []
        assert d["missing_presets"] == []


# ---------- get specific example ----------
class TestGetExample:
    def test_negocio_glass_en(self, s):
        r = s.get(f"{API}/card-examples/negocio", params={"template": "glass", "lang": "en"})
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "Café Luma"
        assert d["card_design"]["preset"] == "glass"
        assert len(d["gallery_photos"]) == 5
        assert len(d["custom_fields"]["products"]) == 4
        assert d["is_example"] is True
        assert d["example_lang"] == "en"
        assert "Specialty" in d["subtitle"] or "specialty" in d["subtitle"].lower()

    def test_negocio_es(self, s):
        r = s.get(f"{API}/card-examples/negocio", params={"template": "glass", "lang": "es"})
        assert r.status_code == 200
        d = r.json()
        assert "especialidad" in d["subtitle"].lower()

    def test_invalid_template_fallback(self, s):
        r = s.get(f"{API}/card-examples/negocio", params={"template": "zzz", "lang": "en"})
        assert r.status_code == 200
        d = r.json()
        # falls back to first preset for negocio (classic)
        assert d["card_design"]["preset"] == "classic"

    def test_guardian_glamour_falls_back(self, s):
        r = s.get(f"{API}/card-examples/guardian", params={"template": "glamour", "lang": "es"})
        assert r.status_code == 200
        d = r.json()
        assert d["card_design"]["preset"] != "glamour"
        assert d["card_design"]["preset"] in {"classic", "minimal", "modern", "glass", "formal", "photo", "animated"}

    def test_404(self, s):
        r = s.get(f"{API}/card-examples/nope")
        assert r.status_code == 404


# ---------- /api/cards/example-* ----------
class TestCardsExampleRoute:
    def test_get_example_personal(self, s):
        r1 = s.get(f"{API}/cards/example-personal", params={"template": "noir", "lang": "es"})
        assert r1.status_code == 200
        assert r1.json()["is_example"] is True
        v1 = r1.json().get("views", 0)
        r2 = s.get(f"{API}/cards/example-personal", params={"template": "noir", "lang": "es"})
        assert r2.json().get("views", 0) == v1  # no view increments

    def test_qr(self, s):
        r = s.get(f"{API}/cards/example-personal/qr", params={"template": "noir", "lang": "en"})
        assert r.status_code == 200
        d = r.json()
        assert "qr_code" in d
        assert d["qr_code"].startswith("data:image/")

    def test_cannot_edit(self, s, auth):
        r = s.put(f"{API}/cards/example-personal", json={"title": "hack"})
        assert r.status_code in (403, 404, 422)

    def test_cannot_delete(self, s, auth):
        r = s.delete(f"{API}/cards/example-personal")
        assert r.status_code in (403, 404)

    def test_analytics_noop(self, s):
        r = s.post(f"{API}/analytics/cards/example-personal/view", json={})
        assert r.status_code == 200
        d = r.json()
        assert d.get("example") is True


# ---------- search exclusion ----------
class TestSearchExclusion:
    def test_search_luma_no_example(self, s, auth):
        r = s.get(f"{API}/search", params={"q": "Luma", "type": "cards"})
        assert r.status_code == 200
        data = r.json()
        items = data.get("items") or data.get("results") or data.get("cards") or []
        if isinstance(data, dict) and "items" not in data:
            # try flattened
            for v in data.values():
                if isinstance(v, list):
                    items = v
                    break
        for it in items:
            cid = (it.get("id") or "") if isinstance(it, dict) else ""
            assert not cid.startswith("example-"), f"example leaked into search: {cid}"


# ---------- images ----------
class TestImages:
    @pytest.mark.parametrize("path", [
        "/examples/personal-banner.jpg",
        "/examples/personal-avatar.jpg",
        "/examples/personal-g1.jpg",
        "/examples/negocio-banner.jpg",
        "/examples/negocio-g5.jpg",
        "/examples/empresarial-g3.jpg",
        "/examples/servicios-avatar.jpg",
        "/examples/mascotas-g2.jpg",
        "/examples/lugares-g4.jpg",
        "/examples/guardian-banner.jpg",
        "/examples/jobs-avatar.jpg",
        "/examples/curriculum-banner.jpg",
    ])
    def test_image_ok(self, path):
        r = requests.get(f"{BASE}{path}", timeout=15)
        assert r.status_code == 200, f"{path} -> {r.status_code}"
        assert int(r.headers.get("content-length", "1")) > 100 or len(r.content) > 100
