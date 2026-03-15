from pydantic import BaseModel, Field
from typing import Optional, Literal

class ProfileSetupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full name")
    clinicName: str = Field(..., min_length=2, max_length=200, description="Clinic name")
    clinicAddress: str = Field(..., min_length=5, max_length=500, description="Clinic address")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Dr. John Doe",
                "clinicName": "Dental Care Center",
                "clinicAddress": "123 Main Street, City, State - 12345"
            }
        }

class UpdateProfileRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full name")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Dr. John Doe"
            }
        }

class UserProfileResponse(BaseModel):
    id: str
    mobileNumber: str
    name: Optional[str] = None
    role: Optional[str] = "Clinician"
    clinicName: Optional[str] = None
    clinicAddress: Optional[str] = None
    onboardingStage: Literal["PROFILE", "TEAM", "COMPLETED"]
    
class SkipTeamSetupRequest(BaseModel):
    skip: bool = True