"""Seed helper: posts a TEST_ audio message into an existing chat so the
BrunoAudioWaveform component can be exercised in the UI. Prints chat id."""
import os
import requests
from dotenv import dotenv_values

env = dotenv_values("/app/frontend/.env")
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or env.get("REACT_APP_BACKEND_URL")).rstrip("/")

s = requests.Session()
r = s.post(f"{BASE}/api/auth/login", json={"email": "newtest@bruno.com", "password": "Test1234!"})
r.raise_for_status()
token = r.json().get("access_token") or r.json().get("token")
s.headers.update({"Authorization": f"Bearer {token}"})

chats = s.get(f"{BASE}/api/chats")
print("GET /chats", chats.status_code)
data = chats.json()
items = data if isinstance(data, list) else data.get("chats", [])
print("chat count", len(items))
if not items:
    raise SystemExit("no chats available")
chat = items[0]
chat_id = chat["id"]
print("using chat", chat_id, chat.get("participants") or chat.get("participant_ids"))

payload = {
    "content": "TEST_audio",
    "message_type": "audio",
    "attachments": [{
        "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        "mp3_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        "type": "audio/mpeg",
        "filename": "TEST_audio.mp3",
    }],
}
r = s.post(f"{BASE}/api/chats/{chat_id}/messages", json=payload)
print("POST message", r.status_code, r.text[:400])
r.raise_for_status()

msgs = s.get(f"{BASE}/api/chats/{chat_id}/messages")
m = msgs.json()
lst = m if isinstance(m, list) else m.get("messages", [])
audio = [x for x in lst if x.get("message_type") == "audio"]
print("audio messages persisted:", len(audio))
print("CHAT_ID", chat_id)
