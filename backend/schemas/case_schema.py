from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime

class CreateCaseRequest(BaseModel):
    patientName: str = Field(..., min_length=2, max_length=200, description="Patient name")
    caseTitle: str = Field(..., min_length=5, max_length=500, description="Case title/description")
    assignedImplantologistId: Optional[str] = Field(None, description="Assigned implantologist ID")
    assignedProsthodontistId: Optional[str] = Field(None, description="Assigned prosthodontist ID")
    assignedAssistantId: Optional[str] = Field(None, description="Assigned assistant ID")
    
    class Config:
        json_schema_extra = {
            "example": {
                "patientName": "Ramesh Kumar",
                "caseTitle": "Dental Implant - Tooth 36",
                "assignedImplantologistId": "impl-123",
                "assignedProsthodontistId": "pros-456",
                "assignedAssistantId": "asst-789"
            }
        }

class TeamMemberInfo(BaseModel):
    id: str
    name: str
    role: str

class CaseResponse(BaseModel):
    id: str
    clinicId: str
    patientName: str
    caseTitle: str
    caseStatus: str
    
    # Team assignments
    clinician: Optional[TeamMemberInfo] = None
    implantologist: Optional[TeamMemberInfo] = None
    prosthodontist: Optional[TeamMemberInfo] = None
    assistant: Optional[TeamMemberInfo] = None
    
    createdAt: datetime
    updatedAt: datetime

class CaseListResponse(BaseModel):
    cases: List[CaseResponse]