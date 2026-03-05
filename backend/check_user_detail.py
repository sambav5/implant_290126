import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'implantflow')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    user = await db.users.find_one({"mobile_number": "+919489746324"}, {"_id": 0})
    
    if user:
        print("User found:")
        for key, value in user.items():
            print(f"  {key}: {value}")
    else:
        print("User not found")
    
    client.close()

asyncio.run(check())
