from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime

class StageAssignmentRequest(BaseModel):
    stage: Literal["DIAGNOSIS", "IMPLANT_PLANNING", "SURGERY", "PROSTHETIC_DESIGN", "ASSISTANT_SUPPORT"]
    userId: str

class CreateCaseRequest(BaseModel):
    patientName: str = Field(..., min_length=2, max_length=200, description="Patient name")
    caseTitle: str = Field(..., min_length=5, max_length=500, description="Case title/description")
    assignedImplantologistId: Optional[str] = Field(None, description="Assigned implantologist ID")
    assignedProsthodontistId: Optional[str] = Field(None, description="Assigned prosthodontist ID")
    assignedAssistantId: Optional[str] = Field(None, description="Assigned assistant ID")
    assignedPeriodontistId: Optional[str] = Field(None, description="Assigned periodontist ID")
    stageAssignments: List[StageAssignmentRequest] = Field(default_factory=list, description="Stage-based workflow assignments")
    
    class Config:
        json_schema_extra = {
            "example": {
                "patientName": "Ramesh Kumar",
                "caseTitle": "Dental Implant - Tooth 36",
                "assignedImplantologistId": "impl-123",
                "assignedProsthodontistId": "pros-456",
                "assignedAssistantId": "asst-789",
                "assignedPeriodontistId": "perio-321",
                "stageAssignments": [{"stage": "DIAGNOSIS", "userId": "user-1"}]
            }
        }

class StageAssignmentInfo(BaseModel):
    stage: str
    userId: str
    userName: Optional[str] = None

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
    periodontist: Optional[TeamMemberInfo] = None
    stageAssignments: List[StageAssignmentInfo] = []
    
    createdAt: datetime
    updatedAt: datetime

class CaseListResponse(BaseModel):
    cases: List[CaseResponse]