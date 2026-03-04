from pydantic import BaseModel, Field
from typing import Literal, List
from datetime import datetime

class AddTeamMemberRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Team member name")
    role: Literal["Dentist", "Assistant", "Receptionist", "Hygienist", "Manager", "Other"]
    mobileNumber: str = Field(..., description="Mobile number with country code")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Jane Smith",
                "role": "Assistant",
                "mobileNumber": "+919876543211"
            }
        }

class TeamMemberResponse(BaseModel):
    id: str
    name: str
    role: str
    mobileNumber: str
    createdAt: datetime

class TeamListResponse(BaseModel):
    members: List[TeamMemberResponse]