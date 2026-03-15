from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import Optional, Dict, Any, List
import logging
import uuid

logger = logging.getLogger(__name__)

class CaseService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.cases = db.cases
        self.users = db.users
        self.team_members = db.team_members
    
    async def get_user_role_and_clinic(self, user_id: str) -> tuple[Optional[str], Optional[str]]:
        """Get user's role and clinic ID from team_members collection"""
        # First check if user is the clinic owner (Clinician)
        user = await self.users.find_one({"id": user_id}, {"_id": 0})
        if user:
            # Check if this user has a team member record
            team_member = await self.team_members.find_one({"clinic_id": user_id}, {"_id": 0})
            if team_member and team_member.get("role") == "Clinician":
                return "Clinician", user_id
        
        # Check if user is a team member
        team_member = await self.team_members.find_one({"mobile_number": user.get("mobile_number")}, {"_id": 0}) if user else None
        if team_member:
            return team_member.get("role"), team_member.get("clinic_id")
        
        return None, None
    
    async def validate_team_member(self, member_id: str, expected_role: str, clinic_id: str) -> bool:
        """Validate that team member exists, has correct role, and belongs to clinic"""
        if not member_id:
            return True  # Optional field
        
        member = await self.team_members.find_one({"id": member_id}, {"_id": 0})
        if not member:
            return False
        
        if member.get("role") != expected_role:
            return False
        
        if member.get("clinic_id") != clinic_id:
            return False
        
        return True
    
    async def create_case(
        self,
        clinic_id: str,
        clinician_id: str,
        patient_name: str,
        case_title: str,
        assigned_implantologist_id: Optional[str],
        assigned_prosthodontist_id: Optional[str],
        assigned_assistant_id: Optional[str],
        assigned_periodontist_id: Optional[str]
    ) -> Dict[str, Any]:
        """Create a new case with role validation"""
        
        # Validate assigned team members
        if assigned_implantologist_id:
            if not await self.validate_team_member(assigned_implantologist_id, "Implantologist", clinic_id):
                raise ValueError("Invalid implantologist assignment")
        
        if assigned_prosthodontist_id:
            if not await self.validate_team_member(assigned_prosthodontist_id, "Prosthodontist", clinic_id):
                raise ValueError("Invalid prosthodontist assignment")
        
        if assigned_assistant_id:
            if not await self.validate_team_member(assigned_assistant_id, "Assistant", clinic_id):
                raise ValueError("Invalid assistant assignment")

        if assigned_periodontist_id:
            if not await self.validate_team_member(assigned_periodontist_id, "Periodontist", clinic_id):
                raise ValueError("Invalid periodontist assignment")
        
        # Create case
        case = {
            "id": str(uuid.uuid4()),
            "clinic_id": clinic_id,
            "created_by_clinician_id": clinician_id,
            "patient_name": patient_name,
            "case_title": case_title,
            "case_status": "active",
            "assigned_implantologist_id": assigned_implantologist_id,
            "assigned_prosthodontist_id": assigned_prosthodontist_id,
            "assigned_assistant_id": assigned_assistant_id,
            "assigned_periodontist_id": assigned_periodontist_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await self.cases.insert_one(case)
        logger.info(f"Created case {case['id']} for clinic {clinic_id}")
        return case
    
    async def get_user_cases(self, user_id: str, clinic_id: str) -> List[Dict[str, Any]]:
        """Get all cases where user is assigned"""
        query = {
            "$and": [
                {"clinic_id": clinic_id},
                {
                    "$or": [
                        {"created_by_clinician_id": user_id},
                        {"assigned_implantologist_id": user_id},
                        {"assigned_prosthodontist_id": user_id},
                        {"assigned_assistant_id": user_id},
                        {"assigned_periodontist_id": user_id}
                    ]
                }
            ]
        }
        
        cursor = self.cases.find(query, {"_id": 0}).sort("created_at", -1)
        cases = await cursor.to_list(length=100)
        return cases
    
    async def get_team_member_info(self, member_id: Optional[str]) -> Optional[Dict[str, Any]]:
        """Get team member basic info"""
        if not member_id:
            return None
        
        # Check if it's the clinic owner (clinician)
        user = await self.users.find_one({"id": member_id}, {"_id": 0})
        if user:
            return {
                "id": user["id"],
                "name": user.get("name", "Clinician"),
                "role": "Clinician"
            }
        
        # Check team members
        member = await self.team_members.find_one({"id": member_id}, {"_id": 0})
        if member:
            return {
                "id": member["id"],
                "name": member["name"],
                "role": member["role"]
            }
        
        return None
    
    async def ensure_indexes(self):
        """Ensure database indexes exist"""
        await self.cases.create_index("clinic_id")
        await self.cases.create_index("created_by_clinician_id")
        await self.cases.create_index("id", unique=True)
        logger.info("Case indexes created")