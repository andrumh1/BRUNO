"""
Iteration 75 — retest of two fixes from iteration 74:
  1) Viewer→Host and Host→Viewer floating hearts (.live-heart) fanout via WS.
  2) Host live-close-btn → viewer navigates to /lives (live_ended event).

Plus quick regression: /reels and /lives grid load.
"""
import asyncio, os, re, time, json, traceback
from playwright.async_api import async_playwright

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
HOST_EMAIL, HOST_PWD = "newtest@bruno.com", "Test1234!"
VIEWER_EMAIL, VIEWER_PWD = "viewer2@bruno.com", "Test1234!"

CHROMIUM_ARGS = [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
    "--no-sandbox",
    "--disable-dev-shm-usage",
]
VIEWPORT = {"width": 390, "height": 844}
RESULTS = {"live": {}, "regression": {}}


def log(*a): print("[t75]", *a, flush=True)


async def dismiss_tour(page):
    try:
        btn = page.get_by_text("Omitir tour", exact=True)
        if await btn.count() > 0:
            await btn.first.click(timeout=1500)
            await page.wait_for_timeout(300)
    except Exception:
        pass


async def login(page, email, pwd):
    await page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    await page.wait_for_selector('input[type="email"]', timeout=10000)
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', pwd)
    await page.locator('button[type="submit"]').first.click()
    try:
        await page.wait_for_url(lambda u: "/login" not in u, timeout=15000)
    except Exception:
        pass
    await page.wait_for_timeout(600)
    await dismiss_tour(page)


async def api_login(page, email, pwd):
    r = await page.request.post(f"{BASE}/api/auth/login", data={"email": email, "password": pwd})
    if r.ok:
        b = await r.json()
        return b.get("access_token") or b.get("token")
    return None


async def pre_end_active(page, token):
    r = await page.request.get(f"{BASE}/api/lives/mine/active",
                                headers={"Authorization": f"Bearer {token}"})
    if not r.ok:
        return
    d = await r.json()
    if not d: return
    lid = d.get("id") or (d.get("live") or {}).get("id")
    if lid:
        await page.request.post(f"{BASE}/api/lives/{lid}/end",
                                headers={"Authorization": f"Bearer {token}"})
        log("pre-ended active live", lid)


async def poll_hearts(target_page, seconds=4.0, interval=0.15, label=""):
    """Peak count of .live-heart DOM elements over the window."""
    peak = 0
    end = time.time() + seconds
    while time.time() < end:
        n = await target_page.evaluate("""() => {
          const a = document.querySelectorAll('.live-heart').length;
          const b = document.querySelectorAll('svg.live-heart').length;
          const c = document.querySelectorAll('[class*="live-heart"]').length;
          return Math.max(a,b,c);
        }""")
        if n > peak:
            peak = n
            print(f"[t75] {label} hearts peak now {peak}", flush=True)
        await asyncio.sleep(interval)
    return peak


async def run(pw):
    result = RESULTS["live"]
    host_b = await pw.chromium.launch(headless=True, args=CHROMIUM_ARGS)
    viewer_b = await pw.chromium.launch(headless=True, args=CHROMIUM_ARGS)
    host_ctx = await host_b.new_context(viewport=VIEWPORT, permissions=["camera","microphone"], base_url=BASE)
    viewer_ctx = await viewer_b.new_context(viewport=VIEWPORT, permissions=["camera","microphone"], base_url=BASE)
    await host_ctx.grant_permissions(["camera","microphone"], origin=BASE)
    await viewer_ctx.grant_permissions(["camera","microphone"], origin=BASE)
    host_page = await host_ctx.new_page()
    viewer_page = await viewer_ctx.new_page()

    ws_host, ws_viewer = [], []
    host_frames, viewer_frames = [], []
    def wrap(page_frames, ws_list):
        def _on(ws):
            ws_list.append(ws.url)
            if "/api/lives/" in ws.url and "/ws" in ws.url:
                ws.on("framereceived", lambda payload: page_frames.append(("recv", payload[:200] if isinstance(payload,str) else str(payload)[:200])))
                ws.on("framesent", lambda payload: page_frames.append(("sent", payload[:200] if isinstance(payload,str) else str(payload)[:200])))
        return _on
    host_page.on("websocket", wrap(host_frames, ws_host))
    viewer_page.on("websocket", wrap(viewer_frames, ws_viewer))
    host_page.on("pageerror", lambda e: log("HOST err:", e))
    viewer_page.on("pageerror", lambda e: log("VIEWER err:", e))

    try:
        # Pre-clean
        host_tok = await api_login(host_page, HOST_EMAIL, HOST_PWD)
        if host_tok:
            await pre_end_active(host_page, host_tok)
            await asyncio.sleep(1)

        # HOST UI login
        await login(host_page, HOST_EMAIL, HOST_PWD)
        await host_page.goto(f"{BASE}/lives/start", wait_until="domcontentloaded")
        await host_page.wait_for_timeout(3500)
        await dismiss_tour(host_page)
        await host_page.wait_for_selector('[data-testid="live-title-input"]', timeout=15000)
        await host_page.wait_for_timeout(1200)
        for _ in range(4):
            try:
                await host_page.fill('[data-testid="live-title-input"]', "TEST i75 hearts+end", timeout=4000); break
            except Exception:
                await host_page.wait_for_timeout(800)
        await host_page.click('[data-testid="live-visibility-private"]', force=True)
        await host_page.wait_for_timeout(700)
        await host_page.click('[data-testid="live-go-btn"]', force=True)
        await host_page.wait_for_selector('[data-testid="live-host-page"]', timeout=25000)
        code_text = (await host_page.locator('[data-testid="live-access-code"]').first.inner_text()).strip()
        code = re.sub(r"[^A-Z0-9]", "", code_text.upper())[:6]
        result["access_code"] = code

        # live id
        r = await host_page.request.get(f"{BASE}/api/lives/mine/active", headers={"Authorization": f"Bearer {host_tok}"})
        d = await r.json()
        live_id = d.get("id") or (d.get("live") or {}).get("id")
        result["live_id"] = live_id
        log("code:", code, "live_id:", live_id)

        # VIEWER login & join
        await login(viewer_page, VIEWER_EMAIL, VIEWER_PWD)
        await viewer_page.goto(f"{BASE}/lives/{live_id}?code={code}", wait_until="domcontentloaded")
        await viewer_page.wait_for_selector('[data-testid="live-viewer-page"]', timeout=20000)

        # (1) EN VIVO badge within ~5s
        deadline = time.time() + 7
        badge_live = False
        while time.time() < deadline:
            txt = await viewer_page.evaluate("()=>{const b=document.querySelector('[data-testid=live-status-badge]');return b?b.textContent:''}") or ""
            if "VIVO" in txt:
                badge_live = True; break
            await asyncio.sleep(0.4)
        result["viewer_status_live_within_5s"] = badge_live
        log("viewer badge live:", badge_live)

        # Wait a beat so host WS is fully stable, then verify host viewer_count
        await asyncio.sleep(2)
        host_count = int(await host_page.evaluate("()=>{const el=document.querySelector('[data-testid=live-viewer-count]');return el?parseInt((el.textContent||'0').replace(/\\D/g,'')||'0',10):0}") or 0)
        result["host_viewer_count"] = host_count

        # (2) Viewer clicks heart 3 times → host DOM shows .live-heart (poll 3s)
        # Fire clicks concurrently with polling
        async def click_hearts(page, times):
            for _ in range(times):
                try:
                    await page.click('[data-testid="live-heart-btn"]', force=True)
                except Exception as e:
                    log("heart click err:", e)
                await page.wait_for_timeout(150)

        poller = asyncio.create_task(poll_hearts(host_page, seconds=5.0, interval=0.1, label="host"))
        # Try button click first, then fallback JS click
        for i in range(3):
            try:
                await viewer_page.evaluate("() => document.querySelector('[data-testid=live-heart-btn]').click()")
            except Exception as e:
                log("v heart js click err", e)
            await viewer_page.wait_for_timeout(200)
        peak_host = await poller
        result["host_hearts_peak"] = peak_host
        log("host hearts peak:", peak_host)

        # (3) Host clicks heart → viewer DOM shows .live-heart
        poller2 = asyncio.create_task(poll_hearts(viewer_page, seconds=4.0, interval=0.1, label="viewer"))
        try:
            await host_page.evaluate("() => document.querySelector('[data-testid=live-heart-btn]').click()")
        except Exception as e:
            log("h heart js click err", e)
        peak_viewer = await poller2
        result["viewer_hearts_peak"] = peak_viewer
        log("viewer hearts peak:", peak_viewer)

        # (4) Comments both ways
        await viewer_page.click('[data-testid="live-comment-input"]', force=True)
        await viewer_page.type('[data-testid="live-comment-input"]', "hi from viewer", delay=20)
        await viewer_page.click('[data-testid="live-comment-send"]', force=True)
        await asyncio.sleep(2.5)
        host_ev = await host_page.evaluate("()=>{const el=document.querySelector('[data-testid=live-events]');return el?el.textContent:''}") or ""
        result["viewer_comment_on_host"] = "hi from viewer" in host_ev

        await host_page.click('[data-testid="live-comment-input"]', force=True)
        await host_page.type('[data-testid="live-comment-input"]', "hi from host", delay=20)
        await host_page.click('[data-testid="live-comment-send"]', force=True)
        await asyncio.sleep(2.5)
        viewer_ev = await viewer_page.evaluate("()=>{const el=document.querySelector('[data-testid=live-events]');return el?el.textContent:''}") or ""
        result["host_comment_on_viewer"] = "hi from host" in viewer_ev

        # (7) srcObject non-null on viewer
        vinfo = await viewer_page.evaluate("""()=>{const v=document.querySelector('[data-testid=live-remote-video]');return {has:!!(v&&v.srcObject),vw:v?v.videoWidth:0,rs:v?v.readyState:0}}""")
        result["viewer_srcObject_non_null"] = vinfo["has"]
        result["viewer_video_width"] = vinfo["vw"]
        result["viewer_video_readyState"] = vinfo["rs"]

        # (6) Host closes → viewer navigates to /lives within ~6s
        await host_page.click('[data-testid="live-close-btn"]', force=True)
        # confirmation buttons if any
        for label in ["Terminar","Finalizar","Sí","Confirmar","OK","Aceptar"]:
            try:
                b = host_page.get_by_role("button", name=re.compile(label, re.I))
                if await b.count() > 0:
                    await b.first.click(timeout=1200, force=True); break
            except Exception: pass

        deadline = time.time() + 8
        navigated = False
        while time.time() < deadline:
            u = viewer_page.url
            if u.rstrip("/").endswith("/lives"):
                navigated = True; break
            await asyncio.sleep(0.4)
        result["viewer_navigated_on_close_within_6s"] = navigated
        log("final viewer url:", viewer_page.url, "navigated:", navigated)

        # Cleanup
        try:
            if host_tok and live_id:
                await host_page.request.post(f"{BASE}/api/lives/{live_id}/end",
                                              headers={"Authorization": f"Bearer {host_tok}"})
        except Exception: pass

        result["viewer_ws_urls"] = ws_viewer
        result["viewer_opened_live_ws"] = any("/api/lives/" in u and "/ws" in u for u in ws_viewer)
        # Debug: dump only heart-related frames
        result["viewer_heart_frames"] = [f for f in viewer_frames if "heart" in f[1]]
        result["host_heart_frames"] = [f for f in host_frames if "heart" in f[1]]
        # Debug all viewer live-ws frames (limit)
        result["viewer_all_frames_sample"] = viewer_frames[-25:]
        result["host_all_frames_sample"] = host_frames[-25:]

    except Exception as e:
        result["exception"] = f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
        log("ERR:", result["exception"])
    finally:
        try: await host_b.close()
        except: pass
        try: await viewer_b.close()
        except: pass


async def run_regression(pw):
    r = RESULTS["regression"]
    b = await pw.chromium.launch(headless=True, args=CHROMIUM_ARGS)
    ctx = await b.new_context(viewport=VIEWPORT, base_url=BASE)
    p = await ctx.new_page()
    try:
        await login(p, HOST_EMAIL, HOST_PWD)
        # /reels
        await p.goto(f"{BASE}/reels", wait_until="domcontentloaded")
        await p.wait_for_timeout(3500)
        r["reels_url"] = p.url
        r["reels_loaded"] = "/reels" in p.url
        # /lives grid
        await p.goto(f"{BASE}/lives", wait_until="domcontentloaded")
        await p.wait_for_timeout(3500)
        r["lives_url"] = p.url
        r["lives_grid_loaded"] = "/lives" in p.url
    except Exception as e:
        r["exception"] = f"{type(e).__name__}: {e}"
    finally:
        await b.close()


async def main():
    async with async_playwright() as pw:
        await run(pw)
        await run_regression(pw)
    print("\n=== RESULTS ===")
    print(json.dumps(RESULTS, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
