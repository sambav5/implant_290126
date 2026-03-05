"""
Migration script to update existing users to new clinic-centric schema
This will:
1. Find all users without clinic_id
2. Create a clinic for each user
3. Update user with clinic_id and role
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import uuid

async def migrate_users():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/dental_app')
    client = AsyncIOMotorClient(mongo_url)
    db = client.get_default_database()
    
    users_collection = db.users
    clinics_collection = db.clinics
    
    # Find all users without clinic_id
    users_without_clinic = await users_collection.find(
        {"clinic_id": {"$exists": False}}
    ).to_list(length=None)
    
    print(f"Found {len(users_without_clinic)} users without clinic_id")
    
    for user in users_without_clinic:
        print(f"\nMigrating user: {user.get('name', 'Unknown')} ({user['mobile_number']})")
        
        # Create clinic for this user
        clinic = {
            "id": str(uuid.uuid4()),
            "name": user.get("clinic_name", f"{user.get('name', 'Unnamed')}'s Clinic"),
            "address": user.get("clinic_address"),
            "owner_id": user["id"],
            "created_at": user.get("created_at", datetime.utcnow()),
            "updated_at": datetime.utcnow()
        }
        
        await clinics_collection.insert_one(clinic)
        print(f"  Created clinic: {clinic['name']} (ID: {clinic['id']})")
        
        # Update user with clinic_id and role
        await users_collection.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "clinic_id": clinic["id"],
                    "role": "Clinician",
                    "updated_at": datetime.utcnow()
                },
                "$unset": {
                    "clinic_name": "",
                    "clinic_address": ""
                }
            }
        )
        print(f"  Updated user with clinic_id and role=Clinician")
        
        # Migrate team members (if they exist with old schema)
        old_team_members = await db.team_members.find(
            {"clinic_id": user["id"]}  # Old schema used user_id as clinic_id
        ).to_list(length=None)
        
        if old_team_members:
            print(f"  Found {len(old_team_members)} team members to migrate")
            for member in old_team_members:
                await db.team_members.update_one(
                    {"id": member["id"]},
                    {"$set": {"clinic_id": clinic["id"]}}
                )
            print(f"  Migrated {len(old_team_members)} team members")
    
    print(f"\n✅ Migration complete! Updated {len(users_without_clinic)} users")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_users())
