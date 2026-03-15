from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging
import uuid

logger = logging.getLogger(__name__)

class TeamService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.team_members = db.team_members
    
    async def add_team_member(self, clinic_id: str, name: str, role: str, mobile_number: str) -> Dict[str, Any]:
        """Add a team member to a clinic"""
        # Validate: Only one Clinician per clinic
        if role == "Clinician":
            raise ValueError("Cannot add Clinician role. Only clinic owner is Clinician.")
        
        team_member = {
            "id": str(uuid.uuid4()),
            "clinic_id": clinic_id,
            "name": name,
            "role": role,
            "mobile_number": mobile_number,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await self.team_members.insert_one(team_member)
        logger.info(f"Added team member {name} to clinic {clinic_id}")
        return team_member
    
    async def get_team_members(self, clinic_id: str) -> List[Dict[str, Any]]:
        """Get all team members for a clinic"""
        cursor = self.team_members.find({"clinic_id": clinic_id}, {"_id": 0})
        members = await cursor.to_list(length=100)
        return members
    
    async def get_team_member_by_id(self, member_id: str) -> Optional[Dict[str, Any]]:
        """Get a team member by ID"""
        return await self.team_members.find_one({"id": member_id}, {"_id": 0})
    
    async def update_team_member(self, member_id: str, clinic_id: str, name: str, role: str, mobile_number: str) -> Dict[str, Any]:
        """Update a team member"""
        # Validate: Cannot change role to Clinician
        if role == "Clinician":
            raise ValueError("Cannot set role to Clinician")
        
        update_data = {
            "name": name,
            "role": role,
            "mobile_number": mobile_number,
            "updated_at": datetime.utcnow()
        }
        
        result = await self.team_members.update_one(
            {"id": member_id, "clinic_id": clinic_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise ValueError("Team member not found")
        
        logger.info(f"Updated team member {member_id}")
        return await self.get_team_member_by_id(member_id)
    
    async def remove_team_member(self, member_id: str, clinic_id: str) -> bool:
        """Remove a team member"""
        result = await self.team_members.delete_one({
            "id": member_id,
            "clinic_id": clinic_id
        })
        return result.deleted_count > 0
    
    async def ensure_indexes(self):
        """Ensure database indexes exist"""
        await self.team_members.create_index("clinic_id")
        await self.team_members.create_index("id", unique=True)
        logger.info("Team member indexes created")