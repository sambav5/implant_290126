"""Create indexes for case_files collection (MongoDB migration-style script)."""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient


async def run():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    collection = db.case_files

    await collection.create_index("id", unique=True)
    await collection.create_index("case_id")
    await collection.create_index("uploaded_at")
    print("case_files indexes ensured")


if __name__ == "__main__":
    asyncio.run(run())
