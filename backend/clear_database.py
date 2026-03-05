"""
Script to clear all data from MongoDB database
This will delete all collections: users, clinics, team_members, cases, otp_requests
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def clear_database():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'implantflow')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Get all collection names
    collections = await db.list_collection_names()
    
    print(f"Found {len(collections)} collections in database")
    print(f"Collections: {', '.join(collections)}\n")
    
    # Clear each collection
    for collection_name in collections:
        collection = db[collection_name]
        count_before = await collection.count_documents({})
        
        if count_before > 0:
            result = await collection.delete_many({})
            print(f"✅ {collection_name}: Deleted {result.deleted_count} documents")
        else:
            print(f"⚪ {collection_name}: Already empty")
    
    print(f"\n🎉 Database cleared successfully!")
    print(f"All {len(collections)} collections are now empty.\n")
    
    client.close()

if __name__ == "__main__":
    print("=" * 60)
    print("DATABASE CLEAR SCRIPT")
    print("=" * 60)
    print("\nThis will delete ALL data from the database.")
    print("Collections that will be cleared:")
    print("  - users")
    print("  - clinics") 
    print("  - team_members")
    print("  - cases")
    print("  - otp_requests")
    print("\n" + "=" * 60 + "\n")
    
    asyncio.run(clear_database())
