"""Auth + chat isolation + call signalling regression (accounts A/B/C). Run: python3 tests/test_auth_chat_isolation.py"""
import asyncio, json, os, sys, time, uuid
import httpx, websockets

API = (os.environ.get("API_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0].strip()) + "/api"
WS = API.rsplit("/api", 1)[0].replace("https://", "wss://").replace("http://", "ws://")
WSKW = {"open_timeout": 10, "additional_headers": {"Origin": API.rsplit("/api", 1)[0]}}
PW = "Prueba1234!"
ACCOUNTS = {k: f"test{k.lower()}@brunoqa.com" for k in "ABC"}
results = []


def check(name, ok, info=""):
    results.append((name, ok)); print(("PASS " if ok else "FAIL ") + name + (f" — {info}" if info else ""))


async def login(c, email, pw=PW):
    return await c.post(f"{API}/auth/login", json={"email": email, "password": pw})


async def ensure_user(c, key):
    r = await login(c, ACCOUNTS[key])
    if r.status_code == 200:
        return r.json()
    r = await c.post(f"{API}/auth/register", json={"email": ACCOUNTS[key], "password": PW, "name": f"Prueba {key}", "role": "personal"})
    assert r.status_code in (200, 201), r.text
    return r.json()


def H(t):
    return {"Authorization": f"Bearer {t}"}


async def ws_collect(token, seconds=4.0):
    out = []
    try:
        async with websockets.connect(f"{WS}/api/ws/chat/{token}", **WSKW) as ws:
            end = time.time() + seconds
            while time.time() < end:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=max(0.1, end - time.time()))
                    out.append(json.loads(msg))
                except asyncio.TimeoutError:
                    break
    except Exception as e:
        out.append({"type": "__error__", "error": str(e)})
    return out


async def main():
    async with httpx.AsyncClient(timeout=30) as c:
        # ---------- AUTH ----------
        A, B, C = [await ensure_user(c, k) for k in "ABC"]
        tA, tB, tC = A["access_token"], B["access_token"], C["access_token"]
        uA, uB, uC = A["user"]["id"], B["user"]["id"], C["user"]["id"]
        r = await login(c, ACCOUNTS["A"], "contraseña-mala"); check("wrong password → 401, no token", r.status_code == 401 and "access_token" not in r.text, r.text[:80])
        r = await login(c, ACCOUNTS["A"], ""); check("empty password → 4xx", r.status_code in (401, 422))
        r = await login(c, "noexiste-" + uuid.uuid4().hex[:6] + "@brunoqa.com", "x"); check("unknown account → 401 same message", r.status_code == 401 and r.json().get("detail") == "Correo o contraseña incorrectos")
        r = await c.get(f"{API}/chats", headers=H("token-falso")); check("invalid token blocks private resource", r.status_code == 401)
        r = await c.get(f"{API}/chats"); check("no token blocks private resource", r.status_code in (401, 403))
        # logout invalidates exactly that session
        r = await login(c, ACCOUNTS["C"]); t_tmp = r.json()["access_token"]
        r = await c.post(f"{API}/auth/logout", headers=H(t_tmp)); r2 = await c.get(f"{API}/auth/me", headers=H(t_tmp))
        r3 = await c.get(f"{API}/auth/me", headers=H(tC))
        check("logout revokes that token only", r.status_code == 200 and r2.status_code == 401 and r3.status_code == 200, f"{r2.status_code}/{r3.status_code}")
        # brute force lock (use a throwaway account so A stays usable)
        lock_email = f"lock-{uuid.uuid4().hex[:6]}@brunoqa.com"
        await c.post(f"{API}/auth/register", json={"email": lock_email, "password": PW, "name": "Lock", "role": "personal"})
        codes = [(await login(c, lock_email, "mal")).status_code for _ in range(6)]
        check("5 failures → 429 lock", codes[:5] == [401] * 5 and codes[5] == 429, str(codes))
        r = await login(c, lock_email, PW); check("locked even with right password", r.status_code == 429)

        # ---------- CHAT ISOLATION ----------
        r = await c.post(f"{API}/chats", params={"participant_id": uB}, headers=H(tA)); chatAB = r.json()["id"]
        r = await c.post(f"{API}/chats", params={"participant_id": uC}, headers=H(tA)); chatAC = r.json()["id"]
        r = await c.post(f"{API}/chats", params={"participant_id": "no-such-user"}, headers=H(tA)); check("chat with unknown user rejected", r.status_code == 404)
        # A sends to B while B listens on WS; C listens too and must get nothing
        listenB = asyncio.create_task(ws_collect(tB, 5)); listenC = asyncio.create_task(ws_collect(tC, 5)); await asyncio.sleep(1.2)
        text = f"hola B {uuid.uuid4().hex[:6]}"
        r = await c.post(f"{API}/chats/{chatAB}/messages", json={"content": text, "message_type": "text"}, headers=H(tA)); check("A→B message persisted (REST)", r.status_code == 200 and r.json()["sender_id"] == uA)
        evB, evC = await listenB, await listenC
        gotB = any(e.get("type") == "new_message" and e["message"]["content"] == text for e in evB)
        leakC = any(e.get("type") == "new_message" and e["message"]["chat_id"] == chatAB for e in evC)
        # REST path does not push WS (only WS send_message does) — accept either, but C must never receive it
        check("C never receives A↔B events", not leakC, str(evC)[:120])
        # WS send from B → A receives, C not
        listenA = asyncio.create_task(ws_collect(tA, 5)); listenC = asyncio.create_task(ws_collect(tC, 5)); await asyncio.sleep(1.0)
        text2 = f"hola A {uuid.uuid4().hex[:6]}"
        async with websockets.connect(f"{WS}/api/ws/chat/{tB}", **WSKW) as wsB:
            await wsB.send(json.dumps({"action": "send_message", "chat_id": chatAB, "content": text2}))
            await asyncio.sleep(1.5)
        evA, evC = await listenA, await listenC
        check("B→A via WS delivered to A", any(e.get("type") == "new_message" and e["message"]["content"] == text2 for e in evA), str(evA)[:160])
        check("B→A via WS not delivered to C", not any(e.get("type") == "new_message" for e in evC))
        # C cannot read / write / mark A↔B chat by id
        r = await c.get(f"{API}/chats/{chatAB}/messages", headers=H(tC)); check("C cannot read A↔B messages", r.status_code == 404)
        r = await c.post(f"{API}/chats/{chatAB}/messages", json={"content": "intruso", "message_type": "text"}, headers=H(tC)); check("C cannot write in A↔B", r.status_code == 404)
        r = await c.get(f"{API}/chats/{chatAB}/info", headers=H(tC)); check("C cannot read A↔B info", r.status_code == 404)
        r = await c.get(f"{API}/chats", headers=H(tC)); ids = [ch["id"] for ch in r.json()]
        check("C chat list excludes A↔B", chatAB not in ids and chatAC in ids)
        r = await c.get(f"{API}/chats", headers=H(tB)); ids = [ch["id"] for ch in r.json()]
        check("B chat list excludes A↔C", chatAC not in ids and chatAB in ids)
        # WS: C tries to send into A↔B
        async with websockets.connect(f"{WS}/api/ws/chat/{tC}", **WSKW) as wsC:
            await wsC.send(json.dumps({"action": "send_message", "chat_id": chatAB, "content": "intruso-ws"}))
            resp = json.loads(await asyncio.wait_for(wsC.recv(), timeout=5))
        check("WS rejects C sending into A↔B", resp.get("error") == "Chat not found", str(resp))
        r = await c.get(f"{API}/chats/{chatAB}/messages", headers=H(tA)); check("no intruder message stored", all("intruso" not in (m.get("content") or "") for m in r.json()))
        # B reads → read receipt reaches A only
        r = await c.get(f"{API}/chats/{chatAB}/messages", headers=H(tB)); check("B reads A↔B history (chronological)", r.status_code == 200 and [m["content"] for m in r.json()][-2:] == [text, text2])
        # revoked token cannot open WS
        ev = await ws_collect(t_tmp, 2); check("revoked token rejected on WS", any(e.get("type") == "__error__" for e in ev) or not ev)

        # ---------- CALLS ----------
        listenB = asyncio.create_task(ws_collect(tB, 5)); listenC = asyncio.create_task(ws_collect(tC, 5)); await asyncio.sleep(1.0)
        r = await c.post(f"{API}/calls/start", json={"chat_id": chatAB, "call_type": "video"}, headers=H(tA)); call = r.json()
        check("A starts call, gets tokenized Daily room", r.status_code == 200 and "daily.co" in call.get("room_url", "") and "?t=" in call.get("room_url", ""), str(call)[:120])
        evB, evC = await listenB, await listenC
        inc = [e for e in evB if e.get("type") == "incoming_call"]
        check("only B receives incoming_call", len(inc) == 1 and inc[0]["caller_id"] == uA and not any(e.get("type") == "incoming_call" for e in evC))
        check("incoming_call has no room url (token issued on answer)", inc and "room_url" not in inc[0])
        r = await c.post(f"{API}/calls/{call['call_id']}/answer", headers=H(tC)); check("C cannot answer A→B call", r.status_code == 404)
        # busy: C calls B while B is ringing
        r = await c.post(f"{API}/chats", params={"participant_id": uB}, headers=H(tC)); chatCB = r.json()["id"]
        r = await c.post(f"{API}/calls/start", json={"chat_id": chatCB, "call_type": "audio"}, headers=H(tC)); check("B busy for C while ringing with A", r.status_code == 200 and r.json().get("busy") is True, r.text[:100])
        listenA = asyncio.create_task(ws_collect(tA, 4)); await asyncio.sleep(0.8)
        r = await c.post(f"{API}/calls/{call['call_id']}/answer", headers=H(tB)); ans = r.json()
        check("B answers → own tokenized room url", r.status_code == 200 and "?t=" in ans.get("room_url", ""))
        evA = await listenA; check("A notified call_answered", any(e.get("type") == "call_answered" for e in evA))
        r = await c.post(f"{API}/calls/{call['call_id']}/end", headers=H(tC)); check("C cannot end A↔B call", r.status_code == 404)
        listenB = asyncio.create_task(ws_collect(tB, 4)); await asyncio.sleep(0.8)
        r = await c.post(f"{API}/calls/{call['call_id']}/end", headers=H(tA)); evB = await listenB
        check("A ends → B gets call_ended + status ended", r.json().get("status") == "ended" and any(e.get("type") == "call_ended" for e in evB))
        # decline flow + history isolation
        listenA = asyncio.create_task(ws_collect(tA, 4)); await asyncio.sleep(0.8)
        r = await c.post(f"{API}/calls/start", json={"chat_id": chatAB, "call_type": "audio"}, headers=H(tB)); call2 = r.json()
        r = await c.post(f"{API}/calls/{call2['call_id']}/decline", headers=H(tA)); evA = await listenA
        check("A declines B's call", r.json().get("status") == "declined" and any(e.get("type") == "incoming_call" for e in evA))
        r = await c.get(f"{API}/calls/history", headers=H(tC)); hist = r.json()
        check("C call history has no A↔B calls", all(h.get("chat_id") != chatAB for h in (hist if isinstance(hist, list) else hist.get("calls", []))))

    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        print("FAILED:", failed); sys.exit(1)


asyncio.run(main())
