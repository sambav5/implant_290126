from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import List, Dict, Any
import logging
import uuid

logger = logging.getLogger(__name__)

class TeamService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.team_members = db.team_members
    
    async def add_team_member(self, clinic_id: str, name: str, role: str, mobile_number: str) -> Dict[str, Any]:
        """Add a team member to a clinic"""
        team_member = {
            "id": str(uuid.uuid4()),
            "clinic_id": clinic_id,
            "name": name,
            "role": role,
            "mobile_number": mobile_number,
            "created_at": datetime.utcnow()
        }
        
        await self.team_members.insert_one(team_member)
        logger.info(f"Added team member {name} to clinic {clinic_id}")
        return team_member
    
    async def get_team_members(self, clinic_id: str) -> List[Dict[str, Any]]:
        """Get all team members for a clinic"""
        cursor = self.team_members.find({"clinic_id": clinic_id})
        members = await cursor.to_list(length=100)
        return members
    
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