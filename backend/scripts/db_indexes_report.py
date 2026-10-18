"""Lista colecciones, tamaño e índices actuales; cronometra consultas críticas."""
import asyncio, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
from utils.database import db


async def timed(label, coro):
    t = time.perf_counter(); await coro; print(f"  {label}: {(time.perf_counter()-t)*1000:.1f} ms")


async def main():
    names = sorted(await db.list_collection_names())
    for n in names:
        count = await db[n].estimated_document_count()
        idx = [k for k in (await db[n].index_information()).keys() if k != "_id_"]
        if count > 50 or idx:
            print(f"{n:<28} docs={count:<7} idx={idx}")
    print("\nconsultas:")
    await timed("users by email", db.users.find_one({"email": "newtest@bruno.com"}))
    await timed("users by id", db.users.find_one({"id": "x"}))
    await timed("posts by user", db.posts.find({"user_id": "x"}).to_list(20))
    await timed("posts feed sort", db.posts.find({}).sort("created_at", -1).to_list(20))
    await timed("notifications by user", db.notifications.find({"user_id": "x"}).sort("created_at", -1).to_list(20))
    await timed("cards by user", db.cards.find({"user_id": "x"}).to_list(20))
    await timed("revoked jti", db.revoked_tokens.find_one({"jti": "x"}))
    await timed("follows", db.follows.find({"follower_id": "x"}).to_list(100))

asyncio.run(main())
