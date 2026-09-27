"""Iteration 85: group chats, mute per chat, call history, card transfer."""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MAIN_EMAIL = "newtest@bruno.com"
MAIN_PASS = "Test1234!"
V2_EMAIL = "viewer2@bruno.com"
V3_EMAIL = "viewer3@bruno.com"
V4_EMAIL = "viewer4@bruno.com"
V_PASS = "Test1234!"
OWNED_CARD_ID = "d16c2745-e082-4b22-84f8-749beb5e33fd"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    tok = r.json()["access_token"]
    uid = r.json()["user"]["id"]
    return tok, uid


@pytest.fixture(scope="module")
def main_auth():
    tok, uid = _login(MAIN_EMAIL, MAIN_PASS)
    return {"token": tok, "uid": uid, "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def v2_auth():
    tok, uid = _login(V2_EMAIL, V_PASS)
    return {"token": tok, "uid": uid, "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def v3_auth():
    tok, uid = _login(V3_EMAIL, V_PASS)
    return {"token": tok, "uid": uid, "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def v4_auth():
    tok, uid = _login(V4_EMAIL, V_PASS)
    return {"token": tok, "uid": uid, "headers": {"Authorization": f"Bearer {tok}"}}


# ============ Group chats ============

class TestGroupChats:
    def test_create_group_validation(self, main_auth, v2_auth):
        # empty name
        r = requests.post(f"{API}/chats/group", json={"name": "", "participant_ids": [v2_auth["uid"]]}, headers=main_auth["headers"])
        assert r.status_code == 400
        # no participants
        r = requests.post(f"{API}/chats/group", json={"name": "TEST_G", "participant_ids": []}, headers=main_auth["headers"])
        assert r.status_code == 400

    def test_create_group_ok(self, main_auth, v2_auth, v3_auth):
        name = f"TEST_G_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/chats/group",
                          json={"name": name, "participant_ids": [v2_auth["uid"], v3_auth["uid"]]},
                          headers=main_auth["headers"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["is_group"] is True
        assert data["admin_id"] == main_auth["uid"]
        assert main_auth["uid"] in data["participants"]
        assert v2_auth["uid"] in data["participants"]
        assert data["name"] == name
        pytest.chat_id = data["id"]
        pytest.group_name = name

    def test_list_chats_includes_group(self, main_auth):
        r = requests.get(f"{API}/chats", headers=main_auth["headers"])
        assert r.status_code == 200
        chats = r.json()
        grp = next((c for c in chats if c.get("id") == pytest.chat_id), None)
        assert grp is not None
        assert grp.get("is_group") is True
        assert "members_count" in grp
        assert "is_muted" in grp
        assert "muted_until" in grp
        lm = grp.get("last_message") or {}
        assert "creó el grupo" in (lm.get("content") or "")

    def test_group_info(self, main_auth):
        r = requests.get(f"{API}/chats/{pytest.chat_id}/info", headers=main_auth["headers"])
        assert r.status_code == 200
        info = r.json()
        assert info["is_admin"] is True
        assert any(m.get("is_admin") and m["id"] == main_auth["uid"] for m in info["members"])

    def test_group_info_as_member(self, v2_auth):
        r = requests.get(f"{API}/chats/{pytest.chat_id}/info", headers=v2_auth["headers"])
        assert r.status_code == 200
        assert r.json()["is_admin"] is False

    def test_rename_forbidden_for_member(self, v2_auth):
        r = requests.put(f"{API}/chats/{pytest.chat_id}/group",
                         json={"name": "NOPE"}, headers=v2_auth["headers"])
        assert r.status_code == 403

    def test_rename_ok_by_admin(self, main_auth):
        new_name = pytest.group_name + "_R"
        r = requests.put(f"{API}/chats/{pytest.chat_id}/group",
                         json={"name": new_name}, headers=main_auth["headers"])
        assert r.status_code == 200
        # system message added
        m = requests.get(f"{API}/chats/{pytest.chat_id}/messages", headers=main_auth["headers"])
        assert m.status_code == 200
        msgs = m.json()
        assert any("cambió el nombre" in (x.get("content") or "") for x in msgs)

    def test_add_members(self, main_auth, v4_auth):
        r = requests.post(f"{API}/chats/{pytest.chat_id}/members",
                          json={"user_ids": [v4_auth["uid"]]}, headers=main_auth["headers"])
        assert r.status_code == 200
        assert len(r.json().get("added", [])) == 1

    def test_admin_removes_member(self, main_auth, v3_auth):
        r = requests.delete(f"{API}/chats/{pytest.chat_id}/members/{v3_auth['uid']}",
                            headers=main_auth["headers"])
        assert r.status_code == 200
        assert r.json().get("removed") == v3_auth["uid"]

    def test_member_leaves(self, v2_auth):
        r = requests.delete(f"{API}/chats/{pytest.chat_id}/members/{v2_auth['uid']}",
                            headers=v2_auth["headers"])
        assert r.status_code == 200
        assert r.json().get("left") is True

    def test_last_member_leaves_deletes_chat(self, main_auth, v4_auth):
        # currently main + v4 in the chat; main leaves, then v4 leaves -> deleted
        r = requests.delete(f"{API}/chats/{pytest.chat_id}/members/{main_auth['uid']}",
                            headers=main_auth["headers"])
        assert r.status_code == 200
        r = requests.delete(f"{API}/chats/{pytest.chat_id}/members/{v4_auth['uid']}",
                            headers=v4_auth["headers"])
        assert r.status_code == 200
        assert r.json().get("deleted") is True


# ============ Mute chat ============

class TestMuteChat:
    def _get_direct_chat(self, a, b):
        r = requests.post(f"{API}/chats?participant_id={b['uid']}", headers=a["headers"])
        assert r.status_code in (200, 201), r.text
        return r.json()["id"]

    def test_mute_durations(self, main_auth, v2_auth):
        chat_id = self._get_direct_chat(main_auth, v2_auth)
        pytest.mute_chat_id = chat_id
        for dur in ("1h", "8h", "1w"):
            r = requests.post(f"{API}/chats/{chat_id}/mute",
                              json={"duration": dur}, headers=main_auth["headers"])
            assert r.status_code == 200, f"{dur} -> {r.text}"
            body = r.json()
            assert body.get("muted") is True
            assert body.get("muted_until")

    def test_mute_forever(self, main_auth):
        r = requests.post(f"{API}/chats/{pytest.mute_chat_id}/mute",
                          json={"duration": "forever"}, headers=main_auth["headers"])
        assert r.status_code == 200
        body = r.json()
        assert body.get("muted") is True
        assert body.get("muted_until") in (None, "")

    def test_mute_invalid(self, main_auth):
        r = requests.post(f"{API}/chats/{pytest.mute_chat_id}/mute",
                          json={"duration": "banana"}, headers=main_auth["headers"])
        assert r.status_code == 400

    def test_unmute_explicit(self, main_auth):
        r = requests.post(f"{API}/chats/{pytest.mute_chat_id}/mute",
                          json={"duration": "unmute"}, headers=main_auth["headers"])
        assert r.status_code == 200
        assert r.json().get("muted") is False

    def test_mute_toggle_empty_body(self, main_auth):
        r = requests.post(f"{API}/chats/{pytest.mute_chat_id}/mute",
                          json={}, headers=main_auth["headers"])
        assert r.status_code == 200
        s1 = r.json().get("muted")
        r2 = requests.post(f"{API}/chats/{pytest.mute_chat_id}/mute",
                           json={}, headers=main_auth["headers"])
        assert r2.json().get("muted") != s1

    def test_mute_suppresses_notifications(self, main_auth, v2_auth):
        chat_id = pytest.mute_chat_id
        # ensure unmuted for v2 first, then mute for v2
        requests.post(f"{API}/chats/{chat_id}/mute", json={"duration": "unmute"}, headers=v2_auth["headers"])
        # baseline notifications count for v2
        r = requests.get(f"{API}/notifications?group=false&type=message", headers=v2_auth["headers"])
        base = len(r.json()) if r.status_code == 200 else 0
        # mute v2's side
        requests.post(f"{API}/chats/{chat_id}/mute", json={"duration": "1h"}, headers=v2_auth["headers"])
        # main sends a message
        requests.post(f"{API}/chats/{chat_id}/messages", json={"content": "TEST muted", "message_type": "text"},
                      headers=main_auth["headers"])
        time.sleep(1.2)
        r2 = requests.get(f"{API}/notifications?group=false&type=message", headers=v2_auth["headers"])
        after_mute = len(r2.json()) if r2.status_code == 200 else 0
        # unmute and send again
        requests.post(f"{API}/chats/{chat_id}/mute", json={"duration": "unmute"}, headers=v2_auth["headers"])
        requests.post(f"{API}/chats/{chat_id}/messages", json={"content": "TEST unmuted", "message_type": "text"},
                      headers=main_auth["headers"])
        time.sleep(1.2)
        r3 = requests.get(f"{API}/notifications?group=false&type=message", headers=v2_auth["headers"])
        after_unmute = len(r3.json()) if r3.status_code == 200 else 0
        assert after_mute == base, f"expected no new notifs when muted (base {base}, after mute {after_mute})"
        assert after_unmute > after_mute, f"expected new notif after unmute ({after_mute} -> {after_unmute})"


# ============ Calls history ============

def _calls(headers, filt="all", q=None):
    url = f"{API}/calls/history?filter={filt}"
    if q:
        url += f"&q={q}"
    r = requests.get(url, headers=headers)
    assert r.status_code == 200, r.text
    b = r.json()
    return b.get("calls", b) if isinstance(b, dict) else b


class TestCallsHistory:
    def test_history_all(self, main_auth):
        items = _calls(main_auth["headers"], "all")
        assert isinstance(items, list)
        if items:
            it = items[0]
            for k in ("direction", "missed", "duration_sec", "peer", "is_group", "call_type", "started_at"):
                assert k in it, f"missing key {k}"

    def test_history_missed_filter(self, main_auth):
        for it in _calls(main_auth["headers"], "missed"):
            assert it.get("direction") in ("in", "incoming"), it.get("direction")
            assert it.get("missed") is True

    def test_history_search(self, main_auth):
        items = _calls(main_auth["headers"], "all", q="zzznoresultZZZ")
        assert items == [] or all("zzznoresult" in (i.get("peer", {}).get("name", "").lower()) for i in items)

    def test_group_call_start_and_end_appears_in_history(self, main_auth, v2_auth):
        name = f"TEST_CALL_G_{uuid.uuid4().hex[:4]}"
        r = requests.post(f"{API}/chats/group",
                          json={"name": name, "participant_ids": [v2_auth["uid"]]},
                          headers=main_auth["headers"])
        assert r.status_code == 200
        chat_id = r.json()["id"]
        r = requests.post(f"{API}/calls/start",
                         json={"chat_id": chat_id, "call_type": "audio"},
                         headers=main_auth["headers"])
        assert r.status_code == 200, r.text
        call_id = r.json().get("call_id") or r.json().get("id")
        assert call_id
        e = requests.post(f"{API}/calls/{call_id}/end", headers=main_auth["headers"])
        assert e.status_code in (200, 204)
        time.sleep(0.6)
        items = _calls(main_auth["headers"], "all")
        assert any(it.get("is_group") for it in items), "no group call found"
        pytest.hist_call_id = call_id
        requests.delete(f"{API}/chats/{chat_id}/members/{main_auth['uid']}", headers=main_auth["headers"])
        requests.delete(f"{API}/chats/{chat_id}/members/{v2_auth['uid']}", headers=v2_auth["headers"])

    def test_delete_single_call(self, main_auth):
        cid = getattr(pytest, "hist_call_id", None)
        if not cid:
            pytest.skip("no call id")
        r = requests.delete(f"{API}/calls/history?call_id={cid}", headers=main_auth["headers"])
        assert r.status_code in (200, 204)
        items = _calls(main_auth["headers"], "all")
        assert not any(it.get("id") == cid or it.get("call_id") == cid for it in items)

    def test_clear_all_isolated_per_user(self, main_auth, v2_auth):
        v2_before = len(_calls(v2_auth["headers"], "all"))
        r = requests.delete(f"{API}/calls/history", headers=main_auth["headers"])
        assert r.status_code in (200, 204)
        main_after = _calls(main_auth["headers"], "all")
        assert len(main_after) == 0
        v2_after = len(_calls(v2_auth["headers"], "all"))
        assert v2_after == v2_before, f"main clear affected v2 ({v2_before}->{v2_after})"


# ============ Card transfer ============

class TestCardTransfer:
    def test_transfer_token_only_by_owner(self, main_auth, v2_auth):
        # non-owner
        r = requests.post(f"{API}/cards/{OWNED_CARD_ID}/transfer-token", headers=v2_auth["headers"])
        assert r.status_code == 404
        # owner
        r = requests.post(f"{API}/cards/{OWNED_CARD_ID}/transfer-token", headers=main_auth["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and "url" in body and "qr_code" in body and "expires_at" in body
        assert body["url"].endswith(f"/t/{body['token']}")
        assert body["qr_code"].startswith("data:image")
        pytest.tr_token = body["token"]

    def test_public_get_transfer(self, main_auth):
        r = requests.get(f"{API}/transfer/{pytest.tr_token}")
        assert r.status_code == 200
        d = r.json()
        assert d.get("expired") is False
        assert d.get("accepted_count") == 0
        assert d.get("card") and d.get("sender")

    def test_unknown_token_404(self):
        r = requests.get(f"{API}/transfer/nope-nope-nope")
        assert r.status_code == 404

    def test_owner_cannot_accept_own(self, main_auth):
        r = requests.post(f"{API}/transfer/{pytest.tr_token}/accept", headers=main_auth["headers"])
        assert r.status_code == 400

    def test_other_user_accept(self, v2_auth):
        r = requests.post(f"{API}/transfer/{pytest.tr_token}/accept", headers=v2_auth["headers"])
        assert r.status_code == 200, r.text
        assert r.json().get("saved") is True

    def test_received_listed_for_recipient(self, v2_auth):
        r = requests.get(f"{API}/transfer/received/mine", headers=v2_auth["headers"])
        assert r.status_code == 200
        items = r.json()
        assert any(
            (it.get("card", {}).get("id") if isinstance(it.get("card"), dict) else None) == OWNED_CARD_ID
            or it.get("card_id") == OWNED_CARD_ID
            or it.get("id") == OWNED_CARD_ID
            for it in items
        ), f"received not listed: {items}"

    def test_owner_sees_receivers(self, main_auth, v2_auth):
        r = requests.get(f"{API}/transfer/{pytest.tr_token}", headers=main_auth["headers"])
        assert r.status_code == 200
        d = r.json()
        assert d.get("accepted_count") == 1
        recs = d.get("receivers", [])
        assert any(rec.get("id") == v2_auth["uid"] or rec.get("user_id") == v2_auth["uid"] for rec in recs), f"receivers={recs}"

    def test_delete_received(self, v2_auth):
        r = requests.delete(f"{API}/transfer/received/{OWNED_CARD_ID}", headers=v2_auth["headers"])
        assert r.status_code in (200, 204)
        r2 = requests.get(f"{API}/transfer/received/mine", headers=v2_auth["headers"])
        assert not any(it.get("card", {}).get("id") == OWNED_CARD_ID or it.get("card_id") == OWNED_CARD_ID for it in r2.json())
