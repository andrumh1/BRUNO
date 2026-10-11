"""Iteration 106 regression: Global search (privacy/pagination/fuzzy/handle/suggest/trending/history/ask/admin reindex/status),
admin users lookup + moderation timeline, lives delegated moderators (add/remove, is_moderator, mod action auth)."""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://premium-launch-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
HDR = {"Content-Type": "application/json", "X-Platform": "native"}


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, headers=HDR, timeout=20)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text[:200]}"
    tok = r.json()["access_token"]
    uid = r.json()["user"]["id"]
    return tok, uid


@pytest.fixture(scope="session")
def users():
    return {
        "newtest": login("newtest@bruno.com", "Test1234!"),
        "admin": login("testc@brunoqa.com", "Prueba1234!"),
        "host": login("testb@brunoqa.com", "Prueba1234!"),
        "viewer2": login("viewer2@bruno.com", "Test1234!"),
        "viewer4": login("viewer4@bruno.com", "Test1234!"),
    }


def auth(tok):
    return {**HDR, "Authorization": f"Bearer {tok}"}


# --------------- SEARCH ---------------
class TestSearchCore:
    def test_accent_case_insensitive(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/search", params={"q": "DISEÑADOR", "type": "all"}, headers=auth(tok), timeout=20)
        assert r.status_code == 200
        total1 = r.json().get("total", 0)
        r2 = requests.get(f"{API}/search", params={"q": "disenador", "type": "all"}, headers=auth(tok), timeout=20)
        assert r2.status_code == 200
        total2 = r2.json().get("total", 0)
        assert total1 == total2, f"accent/case mismatch: {total1} vs {total2}"

    def test_fuzzy_typo(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/search", params={"q": "cansion", "type": "posts"}, headers=auth(tok), timeout=20)
        assert r.status_code == 200
        data = r.json()
        titles = " ".join(str(it.get("title") or it.get("snippet") or "") for it in data.get("items", [])).lower()
        assert "canción" in titles or "cancion" in titles or data.get("fuzzy_terms"), f"no fuzzy match: {data}"

    def test_handle_query(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/search", params={"q": "@viewer", "type": "people"}, headers=auth(tok), timeout=20)
        assert r.status_code == 200
        assert r.json().get("total", 0) >= 1

    def test_hashtag_search(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/search", params={"q": "#bruno", "type": "all"}, headers=auth(tok), timeout=20)
        assert r.status_code == 200
        kinds = {it.get("kind") for it in r.json().get("items", [])}
        assert "hashtag" in kinds or r.json().get("total", 0) >= 1

    def test_old_post_findable(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/search", params={"q": "magdalena", "type": "posts"}, headers=auth(tok), timeout=20)
        assert r.status_code == 200
        titles = " ".join(str(it.get("title") or "") for it in r.json().get("items", [])).lower()
        assert "magdalena" in titles or "canción" in titles or "cancion" in titles

    def test_pagination_no_duplicates(self, users):
        tok, _ = users["newtest"]
        p0 = requests.get(f"{API}/search", params={"q": "bruno", "type": "posts", "limit": 2, "page": 0}, headers=auth(tok), timeout=20).json()
        p1 = requests.get(f"{API}/search", params={"q": "bruno", "type": "posts", "limit": 2, "page": 1}, headers=auth(tok), timeout=20).json()
        ids0 = {it.get("ref_id") or it.get("id") for it in p0.get("items", [])}
        ids1 = {it.get("ref_id") or it.get("id") for it in p1.get("items", [])}
        assert not (ids0 & ids1) or not ids0, f"duplicates across pages: {ids0 & ids1}"
        assert "has_more" in p0

    def test_sort_newest_oldest(self, users):
        tok, _ = users["newtest"]
        n = requests.get(f"{API}/search", params={"q": "bruno", "type": "posts", "sort": "newest", "limit": 5}, headers=auth(tok), timeout=20).json()
        o = requests.get(f"{API}/search", params={"q": "bruno", "type": "posts", "sort": "oldest", "limit": 5}, headers=auth(tok), timeout=20).json()
        assert n.get("items") is not None and o.get("items") is not None

    def test_q_too_long_400(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/search", params={"q": "x" * 101}, headers=auth(tok), timeout=20)
        assert r.status_code == 400

    def test_invalid_type_400(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/search", params={"q": "bruno", "type": "banana"}, headers=auth(tok), timeout=20)
        assert r.status_code == 400


class TestSearchPrivacy:
    def test_private_card_hidden_even_to_owner(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/search", params={"q": "zanahoria", "type": "cards"}, headers=auth(tok), timeout=20)
        assert r.status_code == 200
        titles = " ".join(str(it.get("title") or "") for it in r.json().get("items", [])).lower()
        assert "zanahoria" not in titles, f"private card appeared: {r.json()}"

    def test_private_account_post_hidden_from_nonfollower(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/search", params={"q": "xilofono", "type": "posts"}, headers=auth(tok), timeout=20)
        assert r.status_code == 200
        titles = " ".join(str(it.get("title") or it.get("snippet") or "") for it in r.json().get("items", [])).lower()
        assert "xilófono" not in titles and "xilofono" not in titles

    def test_private_account_post_visible_to_self(self, users):
        tok, _ = users["viewer4"]
        r = requests.get(f"{API}/search", params={"q": "xilofono", "type": "posts"}, headers=auth(tok), timeout=20)
        assert r.status_code == 200
        titles = " ".join(str(it.get("title") or it.get("snippet") or "") for it in r.json().get("items", [])).lower()
        assert "xilófono" in titles or "xilofono" in titles, f"owner can't see own private post: {r.json()}"

    def test_ai_anon_zero(self):
        r = requests.get(f"{API}/search", params={"q": "bruno", "type": "ai"}, headers=HDR, timeout=20)
        assert r.status_code == 200
        assert r.json().get("total", 0) == 0

    def test_ai_isolation_between_users(self, users):
        tok_n, _ = users["newtest"]
        tok_v, _ = users["viewer2"]
        rn = requests.get(f"{API}/search", params={"q": "bruno", "type": "ai"}, headers=auth(tok_n), timeout=20).json()
        rv = requests.get(f"{API}/search", params={"q": "bruno", "type": "ai"}, headers=auth(tok_v), timeout=20).json()
        qn = {it.get("question") for it in rn.get("items", [])}
        qv = {it.get("question") for it in rv.get("items", [])}
        assert not (qn & qv & {x for x in qn if x}), "AI conversations leaked across users"


class TestSearchAux:
    def test_suggest(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/search/suggest", params={"q": "te"}, headers=auth(tok), timeout=20)
        assert r.status_code == 200
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        assert len(items) <= 8

    def test_trending(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/search/trending", headers=auth(tok), timeout=20)
        assert r.status_code == 200

    def test_history_crud(self, users):
        tok, _ = users["newtest"]
        # ensure enabled
        requests.put(f"{API}/search/history/settings", json={"enabled": True}, headers=auth(tok), timeout=20)
        # populate
        requests.get(f"{API}/search", params={"q": "bruno"}, headers=auth(tok), timeout=20)
        h = requests.get(f"{API}/search/history", headers=auth(tok), timeout=20)
        assert h.status_code == 200
        rows = h.json() if isinstance(h.json(), list) else h.json().get("items", [])
        # disable → clears
        d = requests.put(f"{API}/search/history/settings", json={"enabled": False}, headers=auth(tok), timeout=20)
        assert d.status_code == 200
        h2 = requests.get(f"{API}/search/history", headers=auth(tok), timeout=20)
        rows2 = h2.json() if isinstance(h2.json(), list) else h2.json().get("items", [])
        assert len(rows2) == 0
        # re-enable
        requests.put(f"{API}/search/history/settings", json={"enabled": True}, headers=auth(tok), timeout=20)

    def test_ask(self, users):
        tok, _ = users["newtest"]
        r = requests.post(f"{API}/search/ask", json={"q": "bruno"}, headers=auth(tok), timeout=45)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "answer" in data and "sources" in data
        assert data.get("generated") is True

    def test_admin_reindex_forbidden_for_normal(self, users):
        tok, _ = users["newtest"]
        r = requests.post(f"{API}/search/admin/reindex", headers=auth(tok), timeout=20)
        assert r.status_code == 403

    def test_admin_reindex_admin(self, users):
        tok, _ = users["admin"]
        r = requests.post(f"{API}/search/admin/reindex", headers=auth(tok), timeout=60)
        assert r.status_code == 200

    def test_status(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/search/status", headers=auth(tok), timeout=20)
        assert r.status_code == 200
        assert "indexed" in r.json()


# --------------- ADMIN MODERATION TIMELINE ---------------
class TestAdminModeration:
    def test_lookup_forbidden_for_normal(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/admin/users/lookup", params={"q": "viewer"}, headers=auth(tok), timeout=20)
        assert r.status_code == 403

    def test_lookup_admin(self, users):
        tok, _ = users["admin"]
        r = requests.get(f"{API}/admin/users/lookup", params={"q": "viewer"}, headers=auth(tok), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 1

    def test_timeline_forbidden_for_normal(self, users):
        tok, _ = users["newtest"]
        r = requests.get(f"{API}/admin/users/b1838f61-9fcf-4f4f-b4cb-2da82280dada/moderation-timeline", headers=auth(tok), timeout=20)
        assert r.status_code == 403

    def test_timeline_admin(self, users):
        tok, _ = users["admin"]
        r = requests.get(f"{API}/admin/users/b1838f61-9fcf-4f4f-b4cb-2da82280dada/moderation-timeline", headers=auth(tok), timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "user" in data and "events" in data and "strikes" in data and "reports_received" in data
        if data["events"]:
            e = data["events"][0]
            assert "at" in e and "action" in e and "by" in e


# --------------- LIVES DELEGATED MODERATORS ---------------
class TestLivesDelegatedMods:
    @pytest.fixture(scope="class")
    def live_ctx(self):
        host_tok, host_id = login("testb@brunoqa.com", "Prueba1234!")
        v2_tok, v2_id = login("viewer2@bruno.com", "Test1234!")
        v4_tok, v4_id = login("viewer4@bruno.com", "Test1234!")
        # create live
        r = requests.post(f"{API}/lives", json={"title": "QA iter106 mods", "is_private": False}, headers=auth(host_tok), timeout=20)
        assert r.status_code == 200, r.text[:200]
        lid = r.json()["id"]
        requests.post(f"{API}/lives/{lid}/start", headers=auth(host_tok), timeout=20)
        requests.post(f"{API}/lives/{lid}/join", headers=auth(v2_tok), timeout=20)
        requests.post(f"{API}/lives/{lid}/join", headers=auth(v4_tok), timeout=20)
        yield {"lid": lid, "host_tok": host_tok, "host_id": host_id, "v2_tok": v2_tok, "v2_id": v2_id, "v4_tok": v4_tok, "v4_id": v4_id}
        try:
            requests.post(f"{API}/lives/{lid}/end", headers=auth(host_tok), timeout=20)
        except Exception:
            pass

    def test_add_mod(self, live_ctx):
        c = live_ctx
        r = requests.post(f"{API}/lives/{c['lid']}/moderation", json={"action": "add_mod", "user_id": c["v2_id"]}, headers=auth(c["host_tok"]), timeout=20)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert c["v2_id"] in (data.get("moderators") or [])
        info = data.get("moderators_info") or []
        assert any(m.get("id") == c["v2_id"] and m.get("name") for m in info), f"moderators_info missing name: {info}"

    def test_is_moderator_flag(self, live_ctx):
        c = live_ctx
        r = requests.get(f"{API}/lives/{c['lid']}", headers=auth(c["v2_tok"]), timeout=20)
        assert r.status_code == 200
        assert r.json().get("is_moderator") is True

    def test_mod_can_mute(self, live_ctx):
        c = live_ctx
        r = requests.post(f"{API}/lives/{c['lid']}/moderation", json={"action": "mute", "user_id": c["v4_id"]}, headers=auth(c["v2_tok"]), timeout=20)
        assert r.status_code == 200, r.text[:300]

    def test_mod_cannot_add_mod(self, live_ctx):
        c = live_ctx
        r = requests.post(f"{API}/lives/{c['lid']}/moderation", json={"action": "add_mod", "user_id": c["v4_id"]}, headers=auth(c["v2_tok"]), timeout=20)
        assert r.status_code == 403

    def test_remove_mod(self, live_ctx):
        c = live_ctx
        r = requests.post(f"{API}/lives/{c['lid']}/moderation", json={"action": "remove_mod", "user_id": c["v2_id"]}, headers=auth(c["host_tok"]), timeout=20)
        assert r.status_code == 200
        assert c["v2_id"] not in (r.json().get("moderators") or [])
