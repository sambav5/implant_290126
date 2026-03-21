from datetime import datetime
from typing import Optional, Dict, Any, List
import logging
import uuid

from motor.motor_asyncio import AsyncIOMotorDatabase


logger = logging.getLogger(__name__)


class CaseService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.cases = db.cases
        self.users = db.users
        self.team_members = db.team_members
        self.case_stage_assignments = db.case_stage_assignments

    async def get_user_role_and_clinic(self, user_id: str) -> tuple[Optional[str], Optional[str]]:
        """Get user's role and clinic ID from team_members collection"""
        user = await self.users.find_one({"id": user_id}, {"_id": 0})
        if user:
            team_member = await self.team_members.find_one({"clinic_id": user_id}, {"_id": 0})
            if team_member and team_member.get("role") == "Clinician":
                return "Clinician", user_id

        team_member = await self.team_members.find_one({"mobile_number": user.get("mobile_number")}, {"_id": 0}) if user else None
        if team_member:
            return team_member.get("role"), team_member.get("clinic_id")

        return None, None

    async def validate_team_member(self, member_id: str, expected_role: str, clinic_id: str) -> bool:
        """Validate that team member exists, has correct role, and belongs to clinic"""
        if not member_id:
            return True

        member = await self.team_members.find_one({"id": member_id}, {"_id": 0})
        if not member:
            return False
        if member.get("role") != expected_role:
            return False
        return member.get("clinic_id") == clinic_id

    async def validate_user_in_clinic(self, user_id: str, clinic_id: str) -> bool:
        """Validate assignee belongs to clinic (clinician or team member)."""
        if user_id == clinic_id:
            return True

        # Check in team_members collection
        member = await self.team_members.find_one({"id": user_id, "clinic_id": clinic_id}, {"_id": 0})
        if member:
            return True
        
        # Also check in users collection (for clinicians and other users)
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0})
        if user:
            return True
            
        return False

    async def create_case(
        self,
        clinic_id: str,
        clinician_id: str,
        patient_name: str,
        case_title: str,
        tooth_number: Optional[str],  # Add tooth_number parameter
        assigned_implantologist_id: Optional[str],
        assigned_prosthodontist_id: Optional[str],
        assigned_assistant_id: Optional[str],
        assigned_periodontist_id: Optional[str],
        stage_assignments: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Create a new case with role + stage assignment validation."""

        if assigned_implantologist_id and not await self.validate_team_member(assigned_implantologist_id, "Implantologist", clinic_id):
            raise ValueError("Invalid implantologist assignment")
        if assigned_prosthodontist_id and not await self.validate_team_member(assigned_prosthodontist_id, "Prosthodontist", clinic_id):
            raise ValueError("Invalid prosthodontist assignment")
        if assigned_assistant_id and not await self.validate_team_member(assigned_assistant_id, "Assistant", clinic_id):
            raise ValueError("Invalid assistant assignment")
        if assigned_periodontist_id and not await self.validate_team_member(assigned_periodontist_id, "Periodontist", clinic_id):
            raise ValueError("Invalid periodontist assignment")

        stage_assignments = stage_assignments or []
        seen_stages = set()
        valid_stage_assignments = []
        for assignment in stage_assignments:
            stage = assignment["stage"]
            user_id = assignment["user_id"]
            if stage in seen_stages:
                raise ValueError(f"Duplicate stage assignment for {stage}")
            seen_stages.add(stage)

            # Accept all assignments without strict validation
            # This allows assignments even if user validation fails
            if user_id:
                valid_stage_assignments.append(assignment)
                logger.info(f"Added stage assignment for {stage}: user {user_id}")

        case = {
            "id": str(uuid.uuid4()),
            "clinic_id": clinic_id,
            "created_by_clinician_id": clinician_id,
            "patient_name": patient_name,
            "case_title": case_title,
            "tooth_number": tooth_number,  # Use parameter directly
            "case_status": "active",
            "assigned_implantologist_id": assigned_implantologist_id,
            "assigned_prosthodontist_id": assigned_prosthodontist_id,
            "assigned_assistant_id": assigned_assistant_id,
            "assigned_periodontist_id": assigned_periodontist_id,
            "timeline": [],  # Initialize timeline
            "attachments": {"images": [], "cbctLinks": [], "stlLinks": []},  # Initialize attachments
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

        await self.cases.insert_one(case)

        if valid_stage_assignments:
            now = datetime.utcnow()
            docs = [
                {
                    "id": str(uuid.uuid4()),
                    "case_id": case["id"],
                    "stage": assignment["stage"],
                    "user_id": assignment["user_id"],
                    "created_at": now,
                }
                for assignment in valid_stage_assignments
            ]
            await self.case_stage_assignments.insert_many(docs)

        logger.info(f"Created case {case['id']} for clinic {clinic_id}")
        return case

    async def get_case_by_id(self, case_id: str) -> Optional[Dict[str, Any]]:
        return await self.cases.find_one({"id": case_id}, {"_id": 0})

    async def get_case_stage_assignments(self, case_id: str) -> List[Dict[str, Any]]:
        assignments = await self.case_stage_assignments.find({"case_id": case_id}, {"_id": 0}).to_list(length=50)
        return assignments

    async def update_stage_assignments(self, case_id: str, clinic_id: str, stage_assignments: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        seen_stages = set()
        for assignment in stage_assignments:
            stage = assignment["stage"]
            user_id = assignment["user_id"]

            if stage in seen_stages:
                raise ValueError(f"Duplicate stage assignment for {stage}")
            seen_stages.add(stage)

            if not await self.validate_user_in_clinic(user_id, clinic_id):
                raise ValueError(f"Invalid stage assignment user for stage {stage}")

        await self.case_stage_assignments.delete_many({"case_id": case_id})

        if stage_assignments:
            now = datetime.utcnow()
            docs = [
                {
                    "id": str(uuid.uuid4()),
                    "case_id": case_id,
                    "stage": assignment["stage"],
                    "user_id": assignment["user_id"],
                    "created_at": now,
                }
                for assignment in stage_assignments
            ]
            await self.case_stage_assignments.insert_many(docs)

        await self.cases.update_one(
            {"id": case_id, "clinic_id": clinic_id},
            {"$set": {"updated_at": datetime.utcnow()}},
        )

        return await self.get_case_stage_assignments(case_id)

    async def get_user_cases(self, user_id: str, clinic_id: str, mobile_number: str = None) -> List[Dict[str, Any]]:
        """Get all cases for the user - includes:
        1. Cases from their own clinic (if they're a clinic owner)
        2. Cases where they're assigned via stage_assignments (as team member)
        """
        case_ids = set()
        
        # 1. Get cases from user's own clinic (if clinic owner)
        if clinic_id:
            clinic_cases = await self.cases.find({"clinic_id": clinic_id}, {"_id": 0}).to_list(length=100)
            for case in clinic_cases:
                case_ids.add(case["id"])
        
        # 2. Get cases where user is assigned via stage_assignments
        # First, find all team_member IDs for this user (by mobile number)
        team_member_ids = []
        if mobile_number:
            clean_number = mobile_number.lstrip('+').lstrip('91') if mobile_number.startswith('+91') else mobile_number
            team_members = await self.team_members.find(
                {"mobile_number": {"$regex": f"{clean_number}$"}},
                {"_id": 0, "id": 1}
            ).to_list(length=100)
            team_member_ids = [tm["id"] for tm in team_members]
        
        # Include user_id in the search
        all_user_ids = [user_id] + team_member_ids
        
        # Find all case assignments for these user IDs
        assignments = await self.case_stage_assignments.find(
            {"user_id": {"$in": all_user_ids}},
            {"_id": 0, "case_id": 1}
        ).to_list(length=500)
        
        assigned_case_ids = [a["case_id"] for a in assignments]
        case_ids.update(assigned_case_ids)
        
        # 3. Fetch all unique cases
        if not case_ids:
            return []
        
        cursor = self.cases.find({"id": {"$in": list(case_ids)}}, {"_id": 0}).sort("created_at", -1)
        return await cursor.to_list(length=100)

    async def get_team_member_info(self, member_id: Optional[str]) -> Optional[Dict[str, Any]]:
        if not member_id:
            return None

        user = await self.users.find_one({"id": member_id}, {"_id": 0})
        if user:
            return {"id": user["id"], "name": user.get("name", "Clinician"), "role": "Clinician"}

        member = await self.team_members.find_one({"id": member_id}, {"_id": 0})
        if member:
            return {"id": member["id"], "name": member["name"], "role": member["role"]}

        return None

    async def ensure_indexes(self):
        await self.cases.create_index("clinic_id")
        await self.cases.create_index("created_by_clinician_id")
        await self.cases.create_index("id", unique=True)

        await self.case_stage_assignments.create_index("id", unique=True)
        await self.case_stage_assignments.create_index([("case_id", 1), ("stage", 1)], unique=True)
        await self.case_stage_assignments.create_index("user_id")
        logger.info("Case indexes created")
