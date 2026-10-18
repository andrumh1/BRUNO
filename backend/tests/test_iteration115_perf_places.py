"""Iteration 115: places/geocode/nearby + telemetry/perf + perf middleware headers + recommended-videos regression."""
import gzip
import os
import time

import pytest
import requests

from pathlib import Path
if "REACT_APP_BACKEND_URL" not in os.environ:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip()
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
# Internal backend URL used for infra-sensitive header checks (ingress may rewrite Cache-Control)
BACKEND_INTERNAL = "http://localhost:8001"
API = f"{BASE}/api"

ADMIN = ("testc@brunoqa.com", "Prueba1234!")
USER = ("newtest@bruno.com", "Test1234!")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text[:300]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def user_token():
    return _login(*USER)


# ---------------- Places ----------------
class TestPlaces:
    def test_categories_returns_16(self):
        r = requests.get(f"{API}/places/categories", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "categories" in data
        assert len(data["categories"]) == 16
        ids = {c["id"] for c in data["categories"]}
        for required in ("cafe", "pharmacy", "restaurant", "bar"):
            assert required in ids

    def test_nearby_bogota_cafe(self):
        r = requests.get(f"{API}/places/nearby",
                         params={"lat": 4.6097, "lng": -74.0817, "category": "cafe", "radius_m": 1500},
                         timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["provider"] == "openstreetmap"
        assert "items" in data and isinstance(data["items"], list)
        if data["items"]:
            # sorted ascending
            dists = [i["distance_m"] for i in data["items"]]
            assert dists == sorted(dists)
            first = data["items"][0]
            for key in ("name", "lat", "lng", "distance_m"):
                assert key in first

    def test_nearby_q_pizza(self):
        time.sleep(1.5)
        r = requests.get(f"{API}/places/nearby",
                         params={"lat": 4.6097, "lng": -74.0817, "q": "pizza", "radius_m": 2000},
                         timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data

    def test_nearby_missing_q_and_category_400(self):
        r = requests.get(f"{API}/places/nearby",
                         params={"lat": 4.6097, "lng": -74.0817},
                         timeout=15)
        assert r.status_code == 400

    def test_geocode_chapinero(self):
        time.sleep(1.5)
        r = requests.get(f"{API}/places/geocode", params={"q": "Chapinero, Bogota"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "results" in data and len(data["results"]) >= 1
        first = data["results"][0]
        assert "lat" in first and "lng" in first
        assert isinstance(first["lat"], (int, float))


# ---------------- Perf middleware headers ----------------
class TestPerfHeaders:
    def test_server_timing_header_present(self):
        r = requests.get(f"{API}/places/categories", timeout=10)
        assert r.status_code == 200
        assert "server-timing" in {k.lower() for k in r.headers.keys()}, dict(r.headers)

    def test_public_cache_on_piup_catalog(self):
        # Must hit backend directly: ingress overrides Cache-Control to no-store on external URL
        r = requests.get(f"{BACKEND_INTERNAL}/api/piup/catalog", timeout=15)
        assert r.status_code == 200, r.text[:200]
        cc = r.headers.get("cache-control", "").lower()
        assert "public" in cc, cc
        assert "max-age=120" in cc, cc

    def test_private_no_cache_on_auth_me(self, user_token):
        r = requests.get(f"{BACKEND_INTERNAL}/api/auth/me",
                         headers={"Authorization": f"Bearer {user_token}"}, timeout=15)
        assert r.status_code == 200
        cc = r.headers.get("cache-control", "").lower()
        assert "private" in cc and "no-cache" in cc, cc

    def test_gzip_when_body_large(self, user_token):
        # /api/posts/recommended-videos should be large JSON — ask gzip
        r = requests.get(f"{API}/posts/recommended-videos",
                         params={"kind": "all", "limit": 8, "mode": "for_you"},
                         headers={"Authorization": f"Bearer {user_token}",
                                  "Accept-Encoding": "gzip"},
                         timeout=30)
        assert r.status_code == 200, r.text[:200]
        # Check gzip when body >1KB
        # requests may auto-decode; inspect raw
        if len(r.content) > 1024:
            ce = r.headers.get("content-encoding", "").lower()
            # Starlette gzip middleware threshold default is 500 bytes
            assert "gzip" in ce, f"expected gzip, got {ce}, len={len(r.content)}"


# ---------------- recommended-videos regression ----------------
class TestRecommendedVideos:
    def test_full_posts_with_user_and_media(self, user_token):
        r = requests.get(f"{API}/posts/recommended-videos",
                         params={"kind": "all", "limit": 8, "mode": "for_you"},
                         headers={"Authorization": f"Bearer {user_token}"},
                         timeout=30)
        assert r.status_code == 200
        data = r.json()
        # Response could be {posts:[...]} or a list
        posts = data.get("posts") if isinstance(data, dict) else data
        if isinstance(data, dict) and "items" in data and posts is None:
            posts = data["items"]
        assert isinstance(posts, list)
        if posts:
            p = posts[0]
            # Should have user and media fields hydrated
            assert "user" in p or "author" in p or "user_id" in p
            assert "media" in p or "video_url" in p or "media_url" in p


# ---------------- Telemetry ----------------
class TestTelemetry:
    def test_post_perf_beacon(self):
        beacon = {
            "route": "/reels",
            "timezone": "America/Bogota",
            "device": "móvil",
            "net_type": "4g",
            "lcp_ms": 2400,
            "api_calls": 5,
            "api_failures": [],
        }
        r = requests.post(f"{API}/telemetry/perf", json=beacon, timeout=15)
        assert r.status_code == 202, r.text[:300]
        assert r.json() == {"ok": True}

    def test_perf_summary_admin(self, admin_token):
        # ensure at least one row exists
        requests.post(f"{API}/telemetry/perf",
                      json={"route": "/reels", "timezone": "America/Bogota", "device": "móvil",
                            "net_type": "4g", "lcp_ms": 2000, "api_calls": 3, "api_failures": []},
                      timeout=15)
        r = requests.get(f"{API}/telemetry/perf/summary",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        for key in ("by_country", "by_device", "by_network", "server_routes"):
            assert key in data, f"missing {key}"
        countries = {row["country"] for row in data["by_country"]}
        assert "CO" in countries, countries

    def test_perf_summary_forbidden_for_non_admin(self, user_token):
        r = requests.get(f"{API}/telemetry/perf/summary",
                         headers={"Authorization": f"Bearer {user_token}"}, timeout=15)
        assert r.status_code == 403
