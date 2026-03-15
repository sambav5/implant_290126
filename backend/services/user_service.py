from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class UserService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.users = db.users
    
    async def get_user_by_mobile(self, mobile_number: str) -> Optional[Dict[str, Any]]:
        """Get user by mobile number"""
        return await self.users.find_one({"mobile_number": mobile_number}, {"_id": 0})
    
    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        return await self.users.find_one({"id": user_id}, {"_id": 0})
    
    async def create_user(self, mobile_number: str) -> Dict[str, Any]:
        """Create new user with PROFILE onboarding stage (will become Clinician)"""
        import uuid
        
        user = {
            "id": str(uuid.uuid4()),
            "mobile_number": mobile_number,
            "name": None,
            "role": "Clinician",  # New users are clinic owners
            "clinic_id": None,  # Will be set after clinic creation
            "onboarding_stage": "PROFILE",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await self.users.insert_one(user)
        logger.info(f"Created new user (Clinician): {mobile_number}")
        return user
    
    async def update_profile(self, user_id: str, name: str, clinic_id: str) -> Dict[str, Any]:
        """Update user profile and move to TEAM stage"""
        update_data = {
            "name": name,
            "clinic_id": clinic_id,
            "onboarding_stage": "TEAM",
            "updated_at": datetime.utcnow()
        }
        
        await self.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
        
        logger.info(f"Updated profile for user: {user_id}")
        return await self.get_user_by_id(user_id)
    
    async def update_user_name(self, user_id: str, name: str) -> Dict[str, Any]:
        """Update user name only"""
        await self.users.update_one(
            {"id": user_id},
            {"$set": {
                "name": name,
                "updated_at": datetime.utcnow()
            }}
        )
        
        logger.info(f"Updated name for user: {user_id}")
        return await self.get_user_by_id(user_id)
    
    async def complete_onboarding(self, user_id: str) -> Dict[str, Any]:
        """Mark onboarding as completed"""
        await self.users.update_one(
            {"id": user_id},
            {"$set": {
                "onboarding_stage": "COMPLETED",
                "updated_at": datetime.utcnow()
            }}
        )
        
        logger.info(f"Completed onboarding for user: {user_id}")
        return await self.get_user_by_id(user_id)
    
    async def get_users_by_clinic(self, clinic_id: str) -> list:
        """Get all users in a clinic"""
        cursor = self.users.find({"clinic_id": clinic_id}, {"_id": 0})
        return await cursor.to_list(length=None)
    
    async def ensure_indexes(self):
        """Ensure database indexes exist"""
        await self.users.create_index("mobile_number", unique=True)
        await self.users.create_index("id", unique=True)
        await self.users.create_index("clinic_id")
        logger.info("User indexes created")