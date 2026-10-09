"""Iteration 101 extended: Decline, Busy, Recovery, Profile-call tests.
Runs after primary test proved B incoming now works."""
import asyncio
import os
import sys
import json
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://premium-launch-13.preview.emergentagent.com"

A = {"email": "testa@brunoqa.com", "password": "Prueba1234!"}
B = {"email": "testb@brunoqa.com", "password": "Prueba1234!"}
C = {"email": "testc@brunoqa.com", "password": "Prueba1234!"}

CHROMIUM = "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell"


async def login(page, cred):
    await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
    await page.wait_for_selector('[data-testid="login-email-input"]', timeout=15000)
    await page.fill('[data-testid="login-email-input"]', cred["email"])
    await page.fill('[data-testid="login-password-input"]', cred["password"])
    await page.click('[data-testid="login-submit"]')
    await page.wait_for_timeout(4000)
    for sel in ['button:has-text("Omitir tour")', 'button:has-text("Omitir")']:
        try:
            btn = await page.query_selector(sel)
            if btn: await btn.click(); await page.wait_for_timeout(300); break
        except Exception: pass


async def goto_chat_with(page, peer):
    await page.goto(f"{BASE_URL}/chat", wait_until="domcontentloaded")
    await page.wait_for_timeout(2000)
    items = await page.query_selector_all(f'text={peer}')
    if items:
        await items[0].click()
        await page.wait_for_timeout(1500)
        return True
    return False


async def wait_visible(page, sel, timeout_s=10):
    for _ in range(timeout_s * 2):
        try:
            if await page.is_visible(sel): return True
        except Exception: pass
        await page.wait_for_timeout(500)
    return False


async def wait_hidden(page, sel, timeout_s=10):
    for _ in range(timeout_s * 2):
        try:
            if not await page.is_visible(sel): return True
        except Exception: return True
        await page.wait_for_timeout(500)
    return False


async def end_pending_calls(page_a, token_a):
    """Try to end any pending call from A side via API"""
    try:
        await page_a.evaluate(f"""async () => {{
            const r = await fetch('{BASE_URL}/api/calls/pending', {{headers:{{'Authorization':'Bearer {token_a}'}}}});
            const d = await r.json();
            if (d && d.call && d.call.call_id) {{
                await fetch('{BASE_URL}/api/calls/'+d.call.call_id+'/end', {{method:'POST', headers:{{'Authorization':'Bearer {token_a}'}}}});
            }}
        }}""")
    except Exception as e:
        print(f"end_pending err: {e}")


async def run():
    results = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            executable_path=CHROMIUM,
            args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--autoplay-policy=no-user-gesture-required"],
        )
        ctx_a = await browser.new_context(viewport={"width":390,"height":844})
        await ctx_a.grant_permissions(["camera","microphone"], origin=BASE_URL)
        ctx_b = await browser.new_context(viewport={"width":390,"height":844})
        await ctx_b.grant_permissions(["camera","microphone"], origin=BASE_URL)
        ctx_c = await browser.new_context(viewport={"width":390,"height":844})
        await ctx_c.grant_permissions(["camera","microphone"], origin=BASE_URL)

        page_a = await ctx_a.new_page()
        page_b = await ctx_b.new_page()
        page_c = await ctx_c.new_page()

        toasts_a = []
        toasts_c = []
        page_a.on("console", lambda m: toasts_a.append(m.text) if m.type!="warning" else None)
        page_c.on("console", lambda m: toasts_c.append(m.text) if m.type!="warning" else None)

        print(f"=== Login A/B/C ===")
        await login(page_a, A); await login(page_b, B); await login(page_c, C)

        # Get token A for cleanup
        token_a = await page_a.evaluate("() => localStorage.getItem('token') || localStorage.getItem('bruno_token') || ''")
        print(f"token_a prefix={token_a[:20]}")

        await goto_chat_with(page_b, "Prueba A")
        await goto_chat_with(page_a, "Prueba B")

        # ---------- DECLINE ----------
        print("\n=== DECLINE: A starts audio call → B declines ===")
        try:
            await page_a.click('[data-testid="start-audio-call-btn"]', force=True, timeout=5000)
        except Exception as e:
            print(f"no audio btn, falling back video: {e}")
            await page_a.click('[data-testid="start-video-call-btn"]', force=True)
        b_in = await wait_visible(page_b, '[data-testid="incoming-call-screen"]', 10)
        print(f"DECLINE: B incoming visible={b_in}")
        if b_in:
            await page_b.click('[data-testid="call-decline-btn"]', force=True)
            a_closed = await wait_hidden(page_a, '[data-testid="in-call-screen"]', 10)
            # Check for toast with "rechazó"
            await page_a.wait_for_timeout(1500)
            toast_text = ""
            try:
                toast_text = await page_a.evaluate("""() => Array.from(document.querySelectorAll('[class*=\"toast\"], [data-sonner-toast], [role=\"status\"], [role=\"alert\"]')).map(e=>e.innerText).join(' | ')""")
            except Exception: pass
            print(f"DECLINE: A closed={a_closed}; toast_text={toast_text[:200]!r}")
            results["decline"] = {"B_incoming":b_in,"A_closed":a_closed,"toast_has_rechazo":"rechaz" in toast_text.lower()}
        else:
            results["decline"] = {"B_incoming": False}
        await page_a.wait_for_timeout(1500)
        await end_pending_calls(page_a, token_a)
        await page_a.wait_for_timeout(1000)

        # ---------- BUSY ----------
        print("\n=== BUSY: A calls B, then C tries to call B ===")
        await goto_chat_with(page_c, "Prueba B")
        try:
            await page_a.click('[data-testid="start-video-call-btn"]', force=True, timeout=5000)
        except Exception as e:
            print(f"start video err: {e}")
        b_in2 = await wait_visible(page_b, '[data-testid="incoming-call-screen"]', 10)
        print(f"BUSY: B incoming visible (while A ringing)={b_in2}")
        # C tries audio call
        try:
            await page_c.click('[data-testid="start-audio-call-btn"]', force=True, timeout=5000)
        except Exception:
            try: await page_c.click('[data-testid="start-video-call-btn"]', force=True, timeout=5000)
            except Exception as e: print(f"C start err: {e}")
        await page_c.wait_for_timeout(3000)
        c_in_call = False
        try: c_in_call = await page_c.is_visible('[data-testid="in-call-screen"]')
        except Exception: pass
        c_toast = ""
        try:
            c_toast = await page_c.evaluate("""() => Array.from(document.querySelectorAll('[class*=\"toast\"], [data-sonner-toast], [role=\"status\"], [role=\"alert\"]')).map(e=>e.innerText).join(' | ')""")
        except Exception: pass
        print(f"BUSY: C in-call={c_in_call}; toast={c_toast[:200]!r}")
        results["busy"] = {"B_ringing":b_in2,"C_no_in_call": not c_in_call,"C_toast_has_otra_llamada":"otra llamada" in c_toast.lower()}
        # Clean up: B declines
        if b_in2:
            try: await page_b.click('[data-testid="call-decline-btn"]', force=True)
            except Exception: pass
        await page_a.wait_for_timeout(2000)
        await end_pending_calls(page_a, token_a)
        await page_a.wait_for_timeout(1000)

        # ---------- RECOVERY ----------
        print("\n=== RECOVERY: reload B, A calls within 3s ===")
        # Reload B
        await page_b.reload(wait_until="domcontentloaded")
        # Immediately A calls
        try:
            await page_a.click('[data-testid="start-video-call-btn"]', force=True, timeout=5000)
            print("Recovery: A clicked start-video-call-btn")
        except Exception as e:
            print(f"recovery A click err: {e}")
        b_in3 = await wait_visible(page_b, '[data-testid="incoming-call-screen"]', 10)
        print(f"RECOVERY: B incoming visible after reload={b_in3}")
        results["recovery"] = {"B_incoming_after_reload": b_in3}
        if b_in3:
            try: await page_b.click('[data-testid="call-decline-btn"]', force=True)
            except Exception: pass
        await page_a.wait_for_timeout(2000)
        await end_pending_calls(page_a, token_a)
        await page_a.wait_for_timeout(1000)

        # ---------- PROFILE CALL ----------
        print("\n=== PROFILE CALL: A visits B's profile ===")
        # Get B id via /api/auth/me from B page
        token_b = await page_b.evaluate("() => localStorage.getItem('token') || localStorage.getItem('bruno_token') || ''")
        b_id = await page_b.evaluate(f"""async () => {{
            const r = await fetch('{BASE_URL}/api/auth/me', {{headers:{{'Authorization':'Bearer {token_b}'}}}});
            const d = await r.json(); return d.id || d._id || d.user_id || null;
        }}""")
        print(f"B id = {b_id}")
        if b_id:
            await page_a.goto(f"{BASE_URL}/profile/{b_id}", wait_until="domcontentloaded")
            await page_a.wait_for_timeout(2500)
            profile_btn_visible = False
            try: profile_btn_visible = await page_a.is_visible('[data-testid="profile-call-video-btn"]')
            except Exception: pass
            print(f"profile-call-video-btn visible={profile_btn_visible}")
            if profile_btn_visible:
                await page_a.click('[data-testid="profile-call-video-btn"]', force=True)
                b_in4 = await wait_visible(page_b, '[data-testid="incoming-call-screen"]', 10)
                print(f"PROFILE: B incoming={b_in4}")
                results["profile_call"] = {"btn_visible":True,"B_incoming":b_in4}
                if b_in4:
                    try: await page_b.click('[data-testid="call-decline-btn"]', force=True)
                    except Exception: pass
            else:
                results["profile_call"] = {"btn_visible":False}

        print("\n==== SUMMARY ====")
        print(json.dumps(results, indent=2, default=str))
        await browser.close()
    return results


if __name__ == "__main__":
    asyncio.run(run())
