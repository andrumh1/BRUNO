"""Iteration 101 — Decline-only focused test."""
import asyncio, os, json
from playwright.async_api import async_playwright
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://premium-launch-13.preview.emergentagent.com"
CRED = {"A":{"email":"testa@brunoqa.com","password":"Prueba1234!"},
        "B":{"email":"testb@brunoqa.com","password":"Prueba1234!"}}
CHROMIUM = "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell"

async def login(page, c):
    await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
    await page.wait_for_selector('[data-testid="login-email-input"]', timeout=15000)
    await page.fill('[data-testid="login-email-input"]', c["email"])
    await page.fill('[data-testid="login-password-input"]', c["password"])
    await page.click('[data-testid="login-submit"]')
    await page.wait_for_timeout(4500)
    try: await page.click('button:has-text("Omitir")', timeout=1000)
    except Exception: pass

async def pick_chat(page, peer):
    await page.goto(f"{BASE_URL}/chat", wait_until="domcontentloaded")
    await page.wait_for_timeout(3500)
    items = await page.query_selector_all(f'text={peer}')
    print(f"pick_chat({peer}): {len(items)} matches, url={page.url}")
    if items: 
        await items[0].scroll_into_view_if_needed()
        await items[0].click()
        await page.wait_for_timeout(2500)
        print(f"  after click url={page.url}")
        return True
    return False

async def wait_visible(page, sel, s=10):
    for _ in range(s*2):
        try:
            if await page.is_visible(sel): return True
        except Exception: pass
        await page.wait_for_timeout(500)
    return False

async def wait_hidden(page, sel, s=10):
    for _ in range(s*2):
        try:
            if not await page.is_visible(sel): return True
        except Exception: return True
        await page.wait_for_timeout(500)
    return False

async def run():
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True, executable_path=CHROMIUM,
            args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"])
        ca = await br.new_context(viewport={"width":390,"height":844}); await ca.grant_permissions(["camera","microphone"], origin=BASE_URL)
        cb = await br.new_context(viewport={"width":390,"height":844}); await cb.grant_permissions(["camera","microphone"], origin=BASE_URL)
        pa = await ca.new_page(); pb = await cb.new_page()
        pa.on("pageerror", lambda e: print(f"[A pageerror] {e}"))
        await login(pa, CRED["A"]); await login(pb, CRED["B"])
        await pick_chat(pb, "Prueba A"); await pick_chat(pa, "Prueba B")

        # DECLINE via video (simpler, same signalling path)
        print("\n--- DECLINE video ---")
        await pa.wait_for_selector('[data-testid="start-video-call-btn"]', state="visible")
        await pa.wait_for_timeout(1500)
        await pa.click('[data-testid="start-video-call-btn"]', force=True)
        bi = await wait_visible(pb, '[data-testid="incoming-call-screen"]', 10)
        a_in = await pa.is_visible('[data-testid="in-call-screen"]')
        print(f"A in-call={a_in}; B incoming={bi}")
        bi = await wait_visible(pb, '[data-testid="incoming-call-screen"]', 10)
        a_in = await pa.is_visible('[data-testid="in-call-screen"]')
        print(f"A in-call={a_in}; B incoming={bi}")
        if bi:
            await pb.click('[data-testid="call-decline-btn"]', force=True)
            await pa.wait_for_timeout(3000)
            a_closed = await wait_hidden(pa, '[data-testid="in-call-screen"]', 10)
            toast = await pa.evaluate("""() => Array.from(document.querySelectorAll('[data-sonner-toast], [role=\"status\"], [role=\"alert\"], li[data-type]')).map(e=>e.innerText).join(' | ')""")
            print(f"A closed={a_closed}; A toast={toast!r}")
        await br.close()

asyncio.run(run())
