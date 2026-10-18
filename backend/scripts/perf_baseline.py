"""Mide latencia de los endpoints clave de BRUNO (local y externo). Uso: python scripts/perf_baseline.py [label]"""
import asyncio, json, os, sys, time, statistics
import httpx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

LABEL = sys.argv[1] if len(sys.argv) > 1 else "baseline"
BASE = os.environ.get("PERF_BASE", "http://localhost:8001")
CREDS = {"email": os.environ.get("PERF_EMAIL", "newtest@bruno.com"), "password": os.environ.get("PERF_PASSWORD", "Test1234!")}

ENDPOINTS = [
    ("GET", "/api/auth/me"),
    ("GET", "/api/posts/feed?limit=10"),
    ("GET", "/api/posts/reels?limit=10"),
    ("GET", "/api/users/me/profile"),
    ("GET", "/api/cards"),
    ("GET", "/api/notifications?limit=20"),
    ("GET", "/api/chats"),
    ("GET", "/api/search?q=bruno"),
    ("GET", "/api/marketplace/products?limit=12"),
    ("GET", "/api/piup/catalog"),
    ("GET", "/api/stories/feed"),
    ("GET", "/api/series"),
]


async def time_call(client, method, path, n=5):
    samples, status, size = [], None, 0
    for _ in range(n):
        t = time.perf_counter()
        r = await client.request(method, path)
        samples.append((time.perf_counter() - t) * 1000)
        status, size = r.status_code, len(r.content)
    return {"path": path, "status": status, "bytes": size, "p50_ms": round(statistics.median(samples), 1), "max_ms": round(max(samples), 1), "encoding": r.headers.get("content-encoding", "none"), "cache": r.headers.get("cache-control", "none")}


async def main():
    async with httpx.AsyncClient(base_url=BASE, timeout=30, headers={"Accept-Encoding": "gzip, br"}) as client:
        r = await client.post("/api/auth/login", json=CREDS)
        if r.status_code != 200:
            print("login failed", r.status_code, r.text[:200]); return
        tok = r.json().get("access_token") or r.json().get("token")
        if tok:
            client.headers["Authorization"] = f"Bearer {tok}"
        results = [await time_call(client, m, p) for m, p in ENDPOINTS]
    out = {"label": LABEL, "base": BASE, "results": results}
    os.makedirs(os.path.join(ROOT, "..", "test_reports", "perf"), exist_ok=True)
    with open(os.path.join(ROOT, "..", "test_reports", "perf", f"{LABEL}.json"), "w") as f:
        json.dump(out, f, indent=2)
    for x in results:
        print(f"{x['status']} {x['p50_ms']:>8} ms  max {x['max_ms']:>8} ms  {x['bytes']:>8} B  {x['encoding']:>5}  {x['cache']:<20} {x['path']}")

asyncio.run(main())
