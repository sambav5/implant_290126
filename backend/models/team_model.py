from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime
import uuid

class TeamMemberModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    clinic_id: str = Field(..., description="User ID of clinic owner")
    name: str = Field(..., description="Team member name")
    role: Literal["Dentist", "Assistant", "Receptionist", "Hygienist", "Manager", "Other"]
    mobile_number: str = Field(..., description="Team member mobile number")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Jane Smith",
                "role": "Assistant",
                "mobile_number": "+919876543211"
            }
        }