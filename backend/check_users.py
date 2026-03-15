import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def check_users():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/dental_app')
    client = AsyncIOMotorClient(mongo_url)
    db = client.get_default_database()
    
    users = await db.users.find({}, {"_id": 0}).to_list(length=10)
    
    print(f"Total users: {len(users)}\n")
    for user in users:
        print(f"User: {user.get('name', 'No name')}")
        print(f"  Mobile: {user['mobile_number']}")
        print(f"  Has clinic_id: {user.get('clinic_id') is not None}")
        print(f"  Clinic ID: {user.get('clinic_id', 'None')}")
        print(f"  Role: {user.get('role', 'None')}")
        print(f"  Onboarding: {user.get('onboarding_stage')}")
        print()
    
    client.close()

asyncio.run(check_users())
