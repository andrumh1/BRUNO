"""
Iteration 101 — retest 1:1 call UI after fixes for the B-does-not-show-incoming bug.
Primary scenario: B sits on /chat with the 'Prueba A' chat selected (previous failing
position) and A starts a video call from the chat with 'Prueba B'. B must render
exactly one incoming-call-screen within ~8s.
"""
import asyncio
import os
import sys
import time
import json
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://premium-launch-13.preview.emergentagent.com"
if not BASE_URL.startswith("http"):
    BASE_URL = "https://" + BASE_URL

A = {"email": "testa@brunoqa.com", "password": "Prueba1234!", "label": "A"}
B = {"email": "testb@brunoqa.com", "password": "Prueba1234!", "label": "B"}
C = {"email": "testc@brunoqa.com", "password": "Prueba1234!", "label": "C"}


async def login(page, cred):
    await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
    await page.wait_for_selector('[data-testid="login-email-input"]', timeout=15000)
    await page.fill('[data-testid="login-email-input"]', cred["email"])
    await page.fill('[data-testid="login-password-input"]', cred["password"])
    await page.click('[data-testid="login-submit"]')
    try:
        await page.wait_for_url("**/home**", timeout=15000)
    except Exception:
        # Any logged-in landing is OK
        await page.wait_for_load_state("domcontentloaded")
    # Dismiss onboarding tour if shown
    for sel in ['button:has-text("Omitir tour")', 'button:has-text("Omitir")']:
        try:
            btn = await page.query_selector(sel)
            if btn:
                await btn.click()
                await page.wait_for_timeout(400)
                break
        except Exception:
            pass


async def open_chat_with(page, peer_name):
    """Navigate to /chat and open the chat with peer_name."""
    await page.goto(f"{BASE_URL}/chat", wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    # Try clicking the chat list item containing peer_name
    try:
        await page.wait_for_selector(f'text=Prueba', timeout=10000)
    except Exception:
        pass
    item = await page.query_selector(f'text="{peer_name}"')
    if not item:
        # fallback: any element containing peer_name
        items = await page.query_selector_all(f'text={peer_name}')
        item = items[0] if items else None
    if item:
        await item.click()
        await page.wait_for_timeout(1500)
    return item is not None


async def run():
    results = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            executable_path="/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell",
            args=[
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--autoplay-policy=no-user-gesture-required",
            ],
        )
        try:
            ctx_a = await browser.new_context(
                viewport={"width": 390, "height": 844},
                permissions=["camera", "microphone"],
                permissions_origin=BASE_URL,
            )
        except TypeError:
            ctx_a = await browser.new_context(viewport={"width": 390, "height": 844})
            await ctx_a.grant_permissions(["camera", "microphone"], origin=BASE_URL)
        ctx_b = await browser.new_context(viewport={"width": 390, "height": 844})
        await ctx_b.grant_permissions(["camera", "microphone"], origin=BASE_URL)
        ctx_c = await browser.new_context(viewport={"width": 390, "height": 844})
        await ctx_c.grant_permissions(["camera", "microphone"], origin=BASE_URL)

        page_a = await ctx_a.new_page()
        page_b = await ctx_b.new_page()
        page_c = await ctx_c.new_page()

        page_a.on("console", lambda m: print(f"[A console {m.type}] {m.text[:200]}") if m.type in ("error", "warning") else None)
        page_b.on("console", lambda m: print(f"[B console {m.type}] {m.text[:200]}") if m.type in ("error", "warning") else None)

        # Capture B WS frames
        b_ws_frames = []
        def _attach_ws(page, store):
            def on_ws(ws):
                def on_frame(payload):
                    try:
                        if "incoming_call" in payload or "call_ended" in payload or "call_answered" in payload or "call_declined" in payload:
                            store.append(payload[:300])
                    except Exception:
                        pass
                ws.on("framereceived", on_frame)
            page.on("websocket", on_ws)
        _attach_ws(page_b, b_ws_frames)

        print(f"=== Login A/B/C @ {BASE_URL} ===")
        await login(page_a, A)
        await login(page_b, B)
        await login(page_c, C)
        print("Logged in all three")

        # B navigates to /chat and selects "Prueba A" chat
        print("=== B opens /chat and selects 'Prueba A' ===")
        ok_b = await open_chat_with(page_b, "Prueba A")
        print(f"B selected 'Prueba A' chat: {ok_b}")
        await page_b.wait_for_timeout(1500)

        # C navigates to /chat (no particular chat)
        await page_c.goto(f"{BASE_URL}/chat", wait_until="domcontentloaded")

        # A opens /chat and selects "Prueba B"
        print("=== A opens /chat and selects 'Prueba B' ===")
        ok_a = await open_chat_with(page_a, "Prueba B")
        print(f"A selected 'Prueba B' chat: {ok_a}")
        await page_a.wait_for_timeout(1500)

        # ---------- TEST 1: INCOMING ring on B ----------
        print("=== TEST 1: A clicks start-video-call-btn ===")
        try:
            await page_a.wait_for_selector('[data-testid="start-video-call-btn"]', timeout=8000)
            await page_a.click('[data-testid="start-video-call-btn"]', force=True)
        except Exception as e:
            print(f"ERROR clicking start-video-call-btn on A: {e}")
            results["T1_start_video_call"] = f"FAIL: cannot click start-video-call-btn: {e}"

        # Wait up to 8s for B incoming screen
        b_incoming = False
        for i in range(16):
            await page_b.wait_for_timeout(500)
            try:
                visible = await page_b.is_visible('[data-testid="incoming-call-screen"]')
                if visible:
                    b_incoming = True
                    break
            except Exception:
                pass
        caller_name_text = None
        if b_incoming:
            try:
                caller_name_text = await page_b.text_content('[data-testid="incoming-caller-name"]')
            except Exception:
                pass
        print(f"T1: B incoming-call-screen visible = {b_incoming}; caller name text = {caller_name_text!r}")
        print(f"T1: B WS frames captured so far = {len(b_ws_frames)}")
        if b_ws_frames:
            print(f"    sample: {b_ws_frames[0]}")

        # A should show in-call-screen + outgoing-ringing-overlay
        a_incall = await page_a.is_visible('[data-testid="in-call-screen"]')
        a_ringing = False
        try:
            a_ringing = await page_a.is_visible('[data-testid="outgoing-ringing-overlay"]')
        except Exception:
            pass
        print(f"T1: A in-call-screen={a_incall} outgoing-ringing-overlay={a_ringing}")

        # C should NOT show incoming
        c_incoming = False
        try:
            c_incoming = await page_c.is_visible('[data-testid="incoming-call-screen"]')
        except Exception:
            pass
        print(f"T1: C incoming-call-screen (should be False) = {c_incoming}")

        results["T1_B_incoming_shown"] = b_incoming
        results["T1_caller_name"] = caller_name_text
        results["T1_A_in_call"] = a_incall
        results["T1_A_outgoing_ringing"] = a_ringing
        results["T1_C_not_notified"] = (not c_incoming)
        results["T1_B_ws_frames"] = len(b_ws_frames)

        if not b_incoming:
            # Collect dom info for RCA
            try:
                html_snippet = await page_b.evaluate("() => document.body.innerText.slice(0,500)")
                print(f"[B DOM text first 500] {html_snippet}")
            except Exception:
                pass

        # ---------- TEST 2: Cancel (A hangs up while ringing) ----------
        print("=== TEST 2: Cancel from A while ringing ===")
        try:
            # If B is showing incoming, we still want to test cancel from A side
            # A should still have in-call-screen & call-hangup-btn or call-cancel-btn
            cancel_sel = None
            for sel in ['[data-testid="call-cancel-btn"]', '[data-testid="call-hangup-btn"]']:
                if await page_a.is_visible(sel):
                    cancel_sel = sel
                    break
            if cancel_sel:
                await page_a.click(cancel_sel, force=True)
                print(f"T2: A clicked {cancel_sel}")
            else:
                print("T2: no hangup/cancel visible on A")
        except Exception as e:
            print(f"T2 cancel error: {e}")

        # B should close within 5s
        b_closed = False
        for i in range(12):
            await page_b.wait_for_timeout(500)
            try:
                v = await page_b.is_visible('[data-testid="incoming-call-screen"]')
                if not v:
                    b_closed = True
                    break
            except Exception:
                b_closed = True
                break
        print(f"T2: B incoming closed after A cancel = {b_closed}")
        results["T2_B_closed_after_cancel"] = b_closed

        await page_a.wait_for_timeout(1000)

        # Save results
        print("\n==== SUMMARY ====")
        print(json.dumps(results, indent=2, default=str))

        await browser.close()
    return results


if __name__ == "__main__":
    r = asyncio.run(run())
    # Exit code: 0 if primary test passed
    sys.exit(0 if r.get("T1_B_incoming_shown") else 2)
