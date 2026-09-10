"""
Iteration 74 — end-to-end retest:
  1. Private LIVE with two contexts (host + viewer) — WebRTC media over fake camera.
  2. Remix publish (Stitch + Duet) — fake media.
  3. Chat WS regression: /api/ws/chat opens and stays connected.

Runs Playwright with real chromium + fake-media flags so we can exercise
getUserMedia / MediaRecorder without a real device.
"""
import asyncio, os, re, time, json, uuid, sys, traceback

from playwright.async_api import async_playwright

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
HOST_EMAIL = "newtest@bruno.com"
HOST_PWD = "Test1234!"
VIEWER_EMAIL = "viewer2@bruno.com"
VIEWER_PWD = "Test1234!"

CHROMIUM_ARGS = [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
    "--no-sandbox",
    "--disable-dev-shm-usage",
]

VIEWPORT = {"width": 390, "height": 844}
RESULTS = {"live": {}, "remix": {}, "chat_ws": {}}


def log(*a):
    print("[test]", *a, flush=True)


async def dismiss_tour(page):
    try:
        btn = page.get_by_text("Omitir tour", exact=True)
        if await btn.count() > 0:
            await btn.first.click(timeout=1500)
            await page.wait_for_timeout(400)
    except Exception:
        pass


async def login(page, email, pwd, next_url=None):
    url = f"{BASE}/login" + (f"?next={next_url}" if next_url else "")
    await page.goto(url, wait_until="domcontentloaded")
    await page.wait_for_selector('input[type="email"]', timeout=10000)
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', pwd)
    # locate submit
    btn = page.locator('button[type="submit"]').first
    await btn.click()
    # wait for redirect away from login
    try:
        await page.wait_for_url(lambda u: "/login" not in u, timeout=15000)
    except Exception:
        pass
    await page.wait_for_timeout(800)
    await dismiss_tour(page)


async def _api_login_via_page(page, email, pwd):
    """Login via page.request (uses browser UA, bypasses WAF)."""
    for path in ["/api/auth/login", "/api/auth/token", "/api/login"]:
        try:
            resp = await page.request.post(f"{BASE}{path}", data={"email": email, "password": pwd})
            if resp.ok:
                body = await resp.json()
                tok = body.get("access_token") or body.get("token")
                if tok:
                    return tok
        except Exception as e:
            log(f"page login {path}:", e)
    return None


async def _api_get_active_live(page, token):
    try:
        resp = await page.request.get(f"{BASE}/api/lives/mine/active",
                                      headers={"Authorization": f"Bearer {token}"})
        if not resp.ok:
            return None
        d = await resp.json()
        if not d:
            return None
        return d.get("id") or (d.get("live") or {}).get("id")
    except Exception as e:
        log("mine/active err:", e); return None


async def _api_end_live(page, token, live_id):
    try:
        await page.request.post(f"{BASE}/api/lives/{live_id}/end",
                                headers={"Authorization": f"Bearer {token}"})
        log("ended existing live:", live_id)
    except Exception as e:
        log("end err:", e)


async def run_live_flow(pw):
    result = RESULTS["live"]

    host_browser = await pw.chromium.launch(headless=True, args=CHROMIUM_ARGS)
    viewer_browser = await pw.chromium.launch(headless=True, args=CHROMIUM_ARGS)

    host_ctx = await host_browser.new_context(
        viewport=VIEWPORT, permissions=["camera", "microphone"], base_url=BASE)
    viewer_ctx = await viewer_browser.new_context(
        viewport=VIEWPORT, permissions=["camera", "microphone"], base_url=BASE)
    await host_ctx.grant_permissions(["camera", "microphone"], origin=BASE)
    await viewer_ctx.grant_permissions(["camera", "microphone"], origin=BASE)

    host_page = await host_ctx.new_page()
    viewer_page = await viewer_ctx.new_page()

    # capture ws for both
    ws_host = []
    ws_viewer = []
    host_page.on("websocket", lambda ws: ws_host.append(ws.url))
    viewer_page.on("websocket", lambda ws: ws_viewer.append(ws.url))
    host_page.on("pageerror", lambda e: log("HOST pageerror:", e))
    viewer_page.on("pageerror", lambda e: log("VIEWER pageerror:", e))

    try:
        # 0) Pre-clean via REST: end any active live BEFORE UI login
        host_api_token = await _api_login_via_page(host_page, HOST_EMAIL, HOST_PWD)
        result["host_api_token_ok"] = bool(host_api_token)
        if host_api_token:
            existing = await _api_get_active_live(host_page, host_api_token)
            if existing:
                await _api_end_live(host_page, host_api_token, existing)
                await asyncio.sleep(1)

        # 1) Host login (UI)
        await login(host_page, HOST_EMAIL, HOST_PWD)

        # 2) Start live
        await host_page.goto(f"{BASE}/lives/start", wait_until="domcontentloaded")
        await host_page.wait_for_timeout(4000)
        await dismiss_tour(host_page)
        await host_page.wait_for_selector('[data-testid="live-title-input"]', timeout=15000)
        await host_page.wait_for_timeout(1500)
        # Retry fill (component re-renders when camera preview initializes)
        for _ in range(4):
            try:
                await host_page.fill('[data-testid="live-title-input"]', "TEST private live", timeout=5000)
                break
            except Exception:
                await host_page.wait_for_timeout(1000)
        await host_page.wait_for_timeout(1500)
        # Private toggle
        for _ in range(4):
            try:
                await host_page.click('[data-testid="live-visibility-private"]', force=True, timeout=5000)
                break
            except Exception:
                await host_page.wait_for_timeout(1000)
        await host_page.wait_for_timeout(1000)
        for _ in range(4):
            try:
                await host_page.click('[data-testid="live-go-btn"]', force=True, timeout=5000)
                break
            except Exception:
                await host_page.wait_for_timeout(1000)
        await host_page.wait_for_selector('[data-testid="live-host-page"]', timeout=25000)
        log("HOST live-host-page loaded")

        # Read 6-char code
        code_el = host_page.locator('[data-testid="live-access-code"]').first
        await code_el.wait_for(state="visible", timeout=10000)
        code_text = (await code_el.inner_text()).strip()
        access_code = re.sub(r"[^A-Z0-9]", "", code_text.upper())[:6]
        result["access_code"] = access_code
        log("access_code:", access_code)
        assert len(access_code) == 6, f"code={code_text!r}"

        # Read live_id via API /api/lives/mine/active (URL may still be /lives/start)
        live_id = await _api_get_active_live(host_page, host_api_token)
        result["live_id"] = live_id
        log("live_id:", live_id, "host_url:", host_page.url)
        assert live_id, "no live_id from /api/lives/mine/active"

        # video width
        vw = await host_page.evaluate(
            "() => { const v = document.querySelector('[data-testid=live-host-video]'); return v ? v.videoWidth : -1; }")
        result["host_videoWidth"] = vw
        log("host video width:", vw)

        # 3) Viewer flow
        # 3a) Logged-out visit -> /login?next=
        anon_ctx = await viewer_browser.new_context(viewport=VIEWPORT, base_url=BASE)
        anon_page = await anon_ctx.new_page()
        await anon_page.goto(f"{BASE}/lives/{live_id}", wait_until="domcontentloaded")
        await anon_page.wait_for_timeout(2500)
        anon_url = anon_page.url
        result["anon_redirected_to_login"] = "/login" in anon_url and "next=" in anon_url
        log("anon url:", anon_url)
        await anon_ctx.close()

        # 3b) Viewer login
        await login(viewer_page, VIEWER_EMAIL, VIEWER_PWD)

        # 3c) Navigate to live with WRONG code
        await viewer_page.goto(f"{BASE}/lives/{live_id}", wait_until="domcontentloaded")
        try:
            await viewer_page.wait_for_selector('[data-testid="live-code-gate"]', timeout=10000)
            await viewer_page.fill('[data-testid="live-gate-code-input"]', "ZZZZZZ")
            await viewer_page.click('[data-testid="live-gate-join-btn"]', force=True)
            await viewer_page.wait_for_timeout(2000)
            still_gated = await viewer_page.locator('[data-testid="live-code-gate"]').count() > 0
            result["wrong_code_still_gated"] = still_gated
            log("wrong code gated:", still_gated)
        except Exception as e:
            log("wrong-code step error:", e)
            result["wrong_code_still_gated"] = False

        # 3d) Correct code — reload with ?code=<CODE> to trigger auto-join
        await viewer_page.goto(f"{BASE}/lives/{live_id}?code={access_code}",
                               wait_until="domcontentloaded")
        try:
            await viewer_page.wait_for_selector('[data-testid="live-viewer-page"]', timeout=20000)
        except Exception:
            gate = await viewer_page.locator('[data-testid="live-code-gate"]').count()
            url = viewer_page.url
            result["viewer_stuck_state"] = {"gate_visible": gate, "url": url}
            log("viewer stuck; gate=", gate, "url=", url)
            raise
        log("viewer-page visible")

        # 4) Wait for host to see the viewer + WebRTC to establish
        deadline = time.time() + 25
        host_count = 0; viewer_srcObject = False; viewer_status_live = False
        while time.time() < deadline:
            await asyncio.sleep(1)
            host_count = int(await host_page.evaluate(
                "() => { const el = document.querySelector('[data-testid=live-viewer-count]'); return el ? parseInt((el.textContent||'0').replace(/\\D/g,'')||'0',10) : 0; }") or 0)
            v_state = await viewer_page.evaluate("""() => {
              const v = document.querySelector('[data-testid=live-remote-video]');
              const badge = document.querySelector('[data-testid=live-status-badge]');
              return { has: !!(v && v.srcObject), vw: v?v.videoWidth:0, rs: v?v.readyState:0, badge: badge?badge.textContent:'' };
            }""")
            viewer_srcObject = v_state["has"]
            viewer_status_live = "VIVO" in (v_state["badge"] or "")
            log(f"host_count={host_count} viewer_srcObject={viewer_srcObject} vw={v_state['vw']} rs={v_state['rs']} badge={v_state['badge']!r}")
            if host_count >= 1 and viewer_srcObject and v_state["vw"] > 0 and v_state["rs"] >= 2 and viewer_status_live:
                break

        result["host_viewer_count"] = host_count
        result["viewer_srcObject_set"] = viewer_srcObject
        result["viewer_video_ready"] = bool(v_state.get("vw", 0) > 0 and v_state.get("rs", 0) >= 2)
        result["viewer_status_live_badge"] = viewer_status_live

        # host events "se unió"
        host_events_text = await host_page.evaluate(
            "() => { const el = document.querySelector('[data-testid=live-events]'); return el ? el.textContent : ''; }") or ""
        result["host_events_join"] = ("se unió" in host_events_text or "unio" in host_events_text.lower())
        log("host_events_text:", host_events_text[:200])

        # 5) Viewer comment  (use type() so React onChange fires reliably)
        try:
            await viewer_page.click('[data-testid="live-comment-input"]', force=True)
            await viewer_page.type('[data-testid="live-comment-input"]', "hola desde viewer", delay=25)
            await viewer_page.wait_for_timeout(400)
            await viewer_page.click('[data-testid="live-comment-send"]', force=True)
        except Exception as e:
            log("viewer comment err:", e)
        await asyncio.sleep(3)
        host_events_text2 = await host_page.evaluate(
            "() => { const el = document.querySelector('[data-testid=live-events]'); return el ? el.textContent : ''; }") or ""
        viewer_events_text = await viewer_page.evaluate(
            "() => { const el = document.querySelector('[data-testid=live-events]'); return el ? el.textContent : ''; }") or ""
        result["viewer_comment_on_host"] = "hola desde viewer" in host_events_text2
        result["viewer_comment_on_viewer"] = "hola desde viewer" in viewer_events_text
        log("host_events2:", host_events_text2[-300:])

        # 6) Viewer heart -> host .live-heart (transient, poll)
        max_hearts = 0
        try:
            await viewer_page.click('[data-testid="live-heart-btn"]', force=True)
            await viewer_page.click('[data-testid="live-heart-btn"]', force=True)
        except Exception as e:
            log("heart err:", e)
        for _ in range(6):
            await asyncio.sleep(0.4)
            n = await host_page.evaluate("() => document.querySelectorAll('.live-heart').length")
            if n > max_hearts:
                max_hearts = n
        result["host_hearts_count"] = max_hearts

        # 7) Host comment -> viewer  (type() for reliable React state)
        try:
            await host_page.click('[data-testid="live-comment-input"]', force=True)
            await host_page.type('[data-testid="live-comment-input"]', "hola desde host", delay=25)
            await host_page.wait_for_timeout(400)
            await host_page.click('[data-testid="live-comment-send"]', force=True)
        except Exception as e:
            log("host comment err:", e)
        await asyncio.sleep(3)
        viewer_events_text2 = await viewer_page.evaluate(
            "() => { const el = document.querySelector('[data-testid=live-events]'); return el ? el.textContent : ''; }") or ""
        result["host_comment_on_viewer"] = "hola desde host" in viewer_events_text2

        # 8) /lives/join?code=CODE  auto redirect (fresh viewer page)
        join_page = await viewer_ctx.new_page()
        await join_page.goto(f"{BASE}/lives/join?code={access_code}", wait_until="domcontentloaded")
        await join_page.wait_for_timeout(5000)
        join_url = join_page.url
        result["join_route_redirected"] = live_id in join_url and f"code={access_code}" in join_url
        result["join_route_auto_joined"] = await join_page.locator('[data-testid="live-viewer-page"]').count() > 0
        await join_page.close()

        # 9) Direct navigation to /lives/<id>?code= must not bounce to login (fresh page, still logged-in)
        direct_page = await viewer_ctx.new_page()
        await direct_page.goto(f"{BASE}/lives/{live_id}?code={access_code}", wait_until="domcontentloaded")
        await direct_page.wait_for_timeout(4000)
        result["direct_url_no_login_bounce"] = "/login" not in direct_page.url
        await direct_page.close()

        # 10) Privacy shield
        priv = await viewer_page.evaluate("""() => ({
          shield: !!document.querySelector('[data-testid=privacy-shield]'),
          watermark: !!document.querySelector('[data-testid=privacy-watermark]'),
          badge: !!document.querySelector('[data-testid=privacy-badge]'),
        })""")
        result["privacy"] = priv

        # blur -> blackout
        await viewer_page.evaluate("""() => {
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new Event('blur'));
        }""")
        await asyncio.sleep(1)
        blackout = await viewer_page.locator('[data-testid="privacy-blackout"]').count() > 0
        result["privacy_blackout_on_hidden"] = blackout
        await viewer_page.evaluate("""() => {
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new Event('focus'));
        }""")
        await asyncio.sleep(1)
        blackout_after = await viewer_page.locator('[data-testid="privacy-blackout"]').count() > 0
        result["privacy_blackout_cleared_on_focus"] = not blackout_after

        # 11) Host closes -> viewer navigates to /lives
        try:
            await host_page.click('[data-testid="live-close-btn"]', force=True)
            # confirm modal maybe
            for label in ["Terminar", "Finalizar", "Sí", "Confirmar", "OK"]:
                try:
                    b = host_page.get_by_role("button", name=re.compile(label, re.I))
                    if await b.count() > 0:
                        await b.first.click(timeout=1500, force=True)
                        break
                except Exception:
                    pass
        except Exception as e:
            log("close err:", e)

        deadline2 = time.time() + 10
        viewer_navigated = False
        while time.time() < deadline2:
            await asyncio.sleep(0.7)
            if viewer_page.url.endswith("/lives") or viewer_page.url.rstrip("/").endswith("/lives"):
                viewer_navigated = True
                break
        result["viewer_navigated_on_close"] = viewer_navigated
        log("final viewer url:", viewer_page.url)

        # ws captures
        result["viewer_ws_urls"] = ws_viewer
        result["host_ws_urls"] = ws_host
        result["viewer_opened_live_ws"] = any("/api/lives/" in u and "/ws" in u for u in ws_viewer)
        result["viewer_opened_chat_ws_api"] = any("/api/ws/chat" in u for u in ws_viewer)
        # Final cleanup — force-end live via API
        try:
            if host_api_token and live_id:
                await _api_end_live(host_page, host_api_token, live_id)
        except Exception:
            pass
    except Exception as e:
        result["exception"] = f"{type(e).__name__}: {e}\n{traceback.format_exc()}"
        log("LIVE ERR:", result["exception"])
    finally:
        try: await host_browser.close()
        except: pass
        try: await viewer_browser.close()
        except: pass


async def run_chat_ws_regression(pw):
    result = RESULTS["chat_ws"]
    browser = await pw.chromium.launch(headless=True, args=CHROMIUM_ARGS)
    ctx = await browser.new_context(viewport=VIEWPORT, base_url=BASE)
    page = await ctx.new_page()
    ws_events = []  # list of dicts {url, opened, closed, close_code}
    def on_ws(ws):
        entry = {"url": ws.url, "opened": True, "closed": False, "close_code": None}
        ws_events.append(entry)
        ws.on("close", lambda: entry.update({"closed": True}))
    page.on("websocket", on_ws)
    try:
        await login(page, HOST_EMAIL, HOST_PWD)
        await page.goto(f"{BASE}/chat", wait_until="domcontentloaded")
        await asyncio.sleep(6)
        api_chat = [e for e in ws_events if "/api/ws/chat" in e["url"]]
        # Check we don't have a reconnect loop of /ws/chat (bad path)
        bad_ws_chat = [e for e in ws_events if re.search(r"/ws/chat/", e["url"]) and "/api/ws/chat" not in e["url"]]
        result["api_ws_chat_opened"] = len(api_chat) >= 1
        result["api_ws_chat_still_open"] = any(not e["closed"] for e in api_chat)
        result["bad_ws_chat_count"] = len(bad_ws_chat)
        result["all_ws_urls"] = [e["url"] for e in ws_events]
        log("chat ws:", result)
    except Exception as e:
        result["exception"] = f"{type(e).__name__}: {e}"
        log("CHAT WS err:", e)
    finally:
        await browser.close()


async def run_remix(pw):
    result = RESULTS["remix"]
    browser = await pw.chromium.launch(headless=True, args=CHROMIUM_ARGS)
    ctx = await browser.new_context(viewport=VIEWPORT, base_url=BASE,
                                    permissions=["camera", "microphone"])
    await ctx.grant_permissions(["camera", "microphone"], origin=BASE)
    page = await ctx.new_page()
    posts_created = []
    page.on("response", lambda r: posts_created.append(r) if r.request.method == "POST" and "/api/posts" in r.url and r.url.endswith("/api/posts") else None)
    remix_errors = []
    async def check_error():
        c = await page.locator('[data-testid="remix-error"]').count()
        if c:
            try:
                t = await page.locator('[data-testid="remix-error"]').first.inner_text()
                remix_errors.append(t)
            except Exception:
                pass

    async def do_one(kind):
        r = {"kind": kind}
        try:
            await page.goto(f"{BASE}/reels?id=5d8c719e-3e47-44fc-ad46-a7b17b2629ed", wait_until="domcontentloaded")
            await page.wait_for_timeout(2500)
            await dismiss_tour(page)
            await page.wait_for_selector('[data-testid="reel-remix-btn"]', timeout=15000)
            await page.click('[data-testid="reel-remix-btn"]', force=True)
            await page.wait_for_timeout(600)
            if kind == "stitch":
                await page.click('[data-testid="reel-remix-stitch"]', force=True)
                await page.wait_for_selector('[data-testid="remix-studio-stitch"]', timeout=10000)
                # trim next
                await page.wait_for_selector('[data-testid="remix-trim-next"]', timeout=8000)
                await page.click('[data-testid="remix-trim-next"]', force=True)
            else:
                await page.click('[data-testid="reel-remix-duet"]', force=True)
                await page.wait_for_selector('[data-testid="remix-studio-duet"]', timeout=10000)
            await page.wait_for_timeout(500)
            await check_error()
            # shutter to start
            await page.wait_for_selector('[data-testid="remix-shutter"]', timeout=8000)
            await page.click('[data-testid="remix-shutter"]', force=True)
            # countdown (optional)
            try:
                await page.wait_for_selector('[data-testid="remix-countdown"]', timeout=4000)
            except Exception:
                pass
            try:
                await page.wait_for_selector('[data-testid="remix-rec-badge"]', timeout=8000)
                r["rec_badge"] = True
            except Exception:
                r["rec_badge"] = False
            # record ~3-4 s
            await asyncio.sleep(4 if kind == "stitch" else 3)
            # stop
            await page.click('[data-testid="remix-shutter"]', force=True)
            await page.wait_for_selector('[data-testid="remix-publish"]', timeout=10000)
            await page.wait_for_selector('[data-testid="remix-preview-video"]', timeout=10000)
            await page.fill('[data-testid="remix-caption"]', f"TEST {kind}")
            # capture URL response
            async with page.expect_response(lambda r: r.request.method == "POST" and r.url.rstrip("/").endswith("/api/posts"), timeout=45000) as rp:
                await page.click('[data-testid="remix-publish-btn"]', force=True)
            resp = await rp.value
            r["post_status"] = resp.status
            try:
                body = await resp.json()
                r["new_post_id"] = body.get("id")
            except Exception:
                pass
            await check_error()
            # Wait for URL update
            await page.wait_for_timeout(3000)
            r["final_url"] = page.url
            # remix label
            try:
                lbl = await page.locator('[data-testid="reel-remix-label"]').first.inner_text(timeout=5000)
                r["remix_label"] = lbl
            except Exception:
                r["remix_label"] = None
            r["remix_errors"] = list(remix_errors)
        except Exception as e:
            r["exception"] = f"{type(e).__name__}: {e}"
            log(f"remix {kind} error:", e)
        return r

    try:
        await login(page, HOST_EMAIL, HOST_PWD)
        result["stitch"] = await do_one("stitch")
        result["duet"] = await do_one("duet")
    finally:
        await browser.close()


async def main():
    only = os.environ.get("ONLY", "")
    async with async_playwright() as pw:
        if not only or "chat" in only:
            await run_chat_ws_regression(pw)
        if not only or "live" in only:
            await run_live_flow(pw)
        if not only or "remix" in only:
            await run_remix(pw)
    print("\n=== RESULTS JSON ===")
    print(json.dumps(RESULTS, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
