from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class UserModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mobile_number: str = Field(..., description="User's mobile number with country code")
    name: Optional[str] = None
    clinic_name: Optional[str] = None
    clinic_address: Optional[str] = None
    onboarding_stage: Literal["PROFILE", "TEAM", "COMPLETED"] = "PROFILE"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "mobile_number": "+919876543210",
                "name": "Dr. John Doe",
                "clinic_name": "Dental Care Center",
                "clinic_address": "123 Main St, City",
                "onboarding_stage": "COMPLETED"
            }
        }

import uuid