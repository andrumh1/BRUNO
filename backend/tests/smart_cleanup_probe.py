# Cleanup + owner-RSVP probe
import os, requests
B = os.environ["REACT_APP_BACKEND_URL"].rstrip("/"); API = f"{B}/api/smart"
def lg(e, p): return {"Authorization": "Bearer " + requests.post(f"{B}/api/auth/login", json={"email": e, "password": p}).json()["access_token"]}
o = lg("newtest@bruno.com", "Test1234!")
EID = "446e6b94-62b1-45aa-b81b-9d2d9440d703"
print("del UI invite", requests.delete(f"{API}/events/{EID}/invitations/e0a45a18-304b-4a73-8fd8-6479a9ead43b", headers=o).status_code)
i = requests.post(f"{API}/events/{EID}/invitations", json={"guest_name": "TEST_owner_probe"}, headers=o).json()
pub = requests.get(f"{API}/invitations/{i['id']}/public", headers=o).json()
print("owner can_respond on own invitation:", pub["viewer"]["can_respond"])
r = requests.post(f"{API}/invitations/{i['id']}/respond", json={"rsvp": "yes"}, headers=o)
print("owner RSVP status:", r.status_code, "linked_user is owner:", r.json().get("linked_user_id") is not None)
v = lg("viewer3@bruno.com", "Test1234!")
print("real guest after owner RSVP:", requests.post(f"{API}/invitations/{i['id']}/respond", json={"rsvp": "yes"}, headers=v).status_code)
print("del probe invite", requests.delete(f"{API}/events/{EID}/invitations/{i['id']}", headers=o).status_code)
print("payments_enabled:", requests.get(f"{API}/settings").json()["activation"]["payments_enabled"], "packs:", [p["id"] for p in requests.get(f"{API}/settings").json()["packs"]])
m = requests.get(f"{API}/events/{EID}/manage", headers=o).json()
print("UI event invites left:", len(m["invitations"]), "photos:", m["storage"]["photo_count"], m["storage"]["used_bytes"])
print("my QA events:", [(e["title"], e["id"][:8], e["status"]) for e in requests.get(f"{API}/events/mine", headers=o).json() if e["title"].startswith("QA")])
