from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import Optional, Dict, Any
import logging
import uuid

logger = logging.getLogger(__name__)

class ClinicService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.clinics = db.clinics
    
    async def create_clinic(self, name: str, address: Optional[str], owner_id: str) -> Dict[str, Any]:
        """Create a new clinic"""
        clinic = {
            "id": str(uuid.uuid4()),
            "name": name,
            "address": address,
            "owner_id": owner_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await self.clinics.insert_one(clinic)
        logger.info(f"Created clinic: {clinic['id']} for owner: {owner_id}")
        return clinic
    
    async def get_clinic_by_id(self, clinic_id: str) -> Optional[Dict[str, Any]]:
        """Get clinic by ID"""
        return await self.clinics.find_one({"id": clinic_id}, {"_id": 0})
    
    async def get_clinic_by_owner(self, owner_id: str) -> Optional[Dict[str, Any]]:
        """Get clinic by owner ID"""
        return await self.clinics.find_one({"owner_id": owner_id}, {"_id": 0})
    
    async def update_clinic(self, clinic_id: str, name: str, address: Optional[str]) -> Dict[str, Any]:
        """Update clinic details"""
        update_data = {
            "name": name,
            "address": address,
            "updated_at": datetime.utcnow()
        }
        
        await self.clinics.update_one(
            {"id": clinic_id},
            {"$set": update_data}
        )
        
        logger.info(f"Updated clinic: {clinic_id}")
        return await self.get_clinic_by_id(clinic_id)
    
    async def ensure_indexes(self):
        """Ensure database indexes exist"""
        await self.clinics.create_index("id", unique=True)
        await self.clinics.create_index("owner_id")
        logger.info("Clinic indexes created")
