# Probe: partial PUT semantics + invitation public on draft event
import os, requests
B = os.environ["REACT_APP_BACKEND_URL"].rstrip("/"); API = f"{B}/api/smart"
def lg(e, p): return {"Authorization": "Bearer " + requests.post(f"{B}/api/auth/login", json={"email": e, "password": p}).json()["access_token"]}
o = lg("newtest@bruno.com", "Test1234!")
e = requests.post(f"{API}/events", json={"title": "QA probe draft", "location": "X", "organizer_card_id": "d16c2745-e082-4b22-84f8-749beb5e33fd", "allow_guest_uploads": False}, headers=o).json()
r = requests.put(f"{API}/events/{e['id']}", json={"title": "QA probe draft2"}, headers=o).json()
print("after partial PUT: location", r.get("location"), "org card", r.get("organizer_card_id"), "allow_guest_uploads", r.get("allow_guest_uploads"))
i = requests.post(f"{API}/events/{e['id']}/invitations", json={"guest_name": "TEST_probe"}, headers=o).json()
pr = requests.get(f"{API}/invitations/{i['id']}/public")
print("anon invitation on DRAFT event:", pr.status_code, pr.json().get("event", {}).get("status") if pr.ok else pr.text[:80])
requests.delete(f"{API}/events/{e['id']}/invitations/{i['id']}", headers=o)
v = lg("viewer3@bruno.com", "Test1234!")
c = requests.get(f"{B}/api/cards", headers=v); print("viewer3 cards", c.status_code, str(c.json())[:150])
print("probe event id", e["id"])
