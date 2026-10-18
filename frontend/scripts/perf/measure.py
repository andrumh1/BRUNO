"""Mide carga real con Chromium emulando red/CPU típicos por país. Uso: python measure.py <base_url> <etiqueta> [rutas...]"""
import asyncio, json, os, sys, time
from playwright.async_api import async_playwright

BASE, LABEL = sys.argv[1], sys.argv[2]
ROUTES = sys.argv[3:] or ["/login", "/reels"]
MB = 1024 * 1024 / 8

# (nombre, bajada bps, subida bps, latencia ms, factor CPU, móvil)
PROFILES = [
    ("CO · 3G (Claro/Tigo rural)", 1.6 * MB, 0.75 * MB, 300, 4, True),
    ("CO · 4G gama media", 9 * MB, 3 * MB, 170, 4, True),
    ("MX · 4G gama media", 12 * MB, 4 * MB, 130, 4, True),
    ("US · LTE", 25 * MB, 10 * MB, 70, 2, True),
    ("US · WiFi escritorio", 50 * MB, 20 * MB, 30, 1, False),
]
MOBILE = {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True, "user_agent": "Mozilla/5.0 (Linux; Android 12; SM-A325F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"}
INIT = """
window.__lcp = 0; window.__fcp = 0;
new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__fcp = e.startTime; }).observe({ type: 'paint', buffered: true });
"""
READY = {"/login": "input[type=email], input[name=email], [data-testid*=login]", "/reels": "video, [data-testid*=reel], [data-testid*=story], main"}


async def measure(browser, profile, route):
    name, down, up, lat, cpu, mobile = profile
    ctx = await browser.new_context(**(MOBILE if mobile else {"viewport": {"width": 1366, "height": 768}}))
    page = await ctx.new_page()
    cdp = await ctx.new_cdp_session(page)
    await cdp.send("Network.enable")
    await cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": lat, "downloadThroughput": down, "uploadThroughput": up})
    await cdp.send("Emulation.setCPUThrottlingRate", {"rate": cpu})
    await page.add_init_script(INIT)
    t0 = time.perf_counter()
    try:
        await page.goto(BASE + route, wait_until="domcontentloaded", timeout=120000)
        try:
            await page.wait_for_selector(READY.get(route, "main, #root > *"), timeout=90000, state="visible")
        except Exception:
            pass
        interactive_ms = (time.perf_counter() - t0) * 1000
        await page.wait_for_timeout(1500)
        m = await page.evaluate("""() => {
          const nav = performance.getEntriesByType('navigation')[0] || {};
          const res = performance.getEntriesByType('resource');
          const js = res.filter(r => r.initiatorType === 'script');
          const sum = (a, k) => a.reduce((s, r) => s + (r[k] || 0), 0);
          return { ttfb: nav.responseStart, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd, fcp: window.__fcp, lcp: window.__lcp,
                   js_files: js.length, js_transfer_kb: Math.round(sum(js, 'transferSize') / 1024), js_decoded_kb: Math.round(sum(js, 'decodedBodySize') / 1024),
                   total_transfer_kb: Math.round(sum(res, 'transferSize') / 1024) };
        }""")
        m.update({"interactive_ms": round(interactive_ms), "ok": True})
    except Exception as e:
        m = {"ok": False, "error": str(e)[:160]}
    await ctx.close()
    return {"profile": name, "route": route, **{k: (round(v) if isinstance(v, float) else v) for k, v in m.items()}}


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        rows = []
        for prof in PROFILES:
            for route in ROUTES:
                r = await measure(browser, prof, route)
                rows.append(r)
                print(f"{r['profile']:<28} {route:<8} interactivo={r.get('interactive_ms')}ms FCP={r.get('fcp')} LCP={r.get('lcp')} JS={r.get('js_transfer_kb')}KB/{r.get('js_files')}f total={r.get('total_transfer_kb')}KB {'' if r['ok'] else r.get('error')}")
        await browser.close()
    out = os.path.join(os.path.dirname(__file__), "..", "..", "..", "test_reports", "perf", f"web_{LABEL}.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump({"label": LABEL, "base": BASE, "rows": rows}, open(out, "w"), indent=2)

asyncio.run(main())
