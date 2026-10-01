"""One-off, idempotent backfill: add card_design v2 to legacy cards (keeps template_id + legacy_template)."""
import asyncio
import os
import sys

sys.path.insert(0, '/app/backend')
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
from motor.motor_asyncio import AsyncIOMotorClient

from utils.card_design import DESIGN_VERSION, ensure_design


async def main():
    db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    migrated = 0
    async for card in db.cards.find({"card_design.version": {"$exists": False}}):
        card, changed = ensure_design(card)
        if changed:
            await db.cards.update_one({"_id": card["_id"]}, {"$set": {
                "card_design": card["card_design"],
                "card_design_version": DESIGN_VERSION,
                "legacy_template": card["legacy_template"],
            }})
            migrated += 1
    print(f"migrated={migrated} total={await db.cards.count_documents({})}")


if __name__ == "__main__":
    asyncio.run(main())
