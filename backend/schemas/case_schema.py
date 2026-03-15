from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class WorkflowStage(str, Enum):
    DIAGNOSIS = "DIAGNOSIS"
    IMPLANT_PLANNING = "IMPLANT_PLANNING"
    SURGERY = "SURGERY"
    PROSTHETIC_DESIGN = "PROSTHETIC_DESIGN"
    ASSISTANT_SUPPORT = "ASSISTANT_SUPPORT"


class StageAssignmentRequest(BaseModel):
    stage: WorkflowStage
    userId: str


class TeamMemberInfo(BaseModel):
    id: str
    name: str
    role: str


class StageAssignmentResponse(BaseModel):
    stage: WorkflowStage
    user: TeamMemberInfo


class CreateCaseRequest(BaseModel):
    patientName: str = Field(..., min_length=2, max_length=200, description="Patient name")
    caseTitle: str = Field(..., min_length=5, max_length=500, description="Case title/description")
    # Backward-compatible fields
    assignedImplantologistId: Optional[str] = Field(None, description="Assigned implantologist ID")
    assignedProsthodontistId: Optional[str] = Field(None, description="Assigned prosthodontist ID")
    assignedAssistantId: Optional[str] = Field(None, description="Assigned assistant ID")
    assignedPeriodontistId: Optional[str] = Field(None, description="Assigned periodontist ID")
    # New stage-based assignments
    stageAssignments: List[StageAssignmentRequest] = Field(default_factory=list, description="Stage based assignees")

    class Config:
        json_schema_extra = {
            "example": {
                "patientName": "Ramesh Kumar",
                "caseTitle": "Dental Implant - Tooth 36",
                "stageAssignments": [
                    {"stage": "DIAGNOSIS", "userId": "clinician-1"},
                    {"stage": "IMPLANT_PLANNING", "userId": "impl-123"}
                ]
            }
        }


class CaseResponse(BaseModel):
    id: str
    clinicId: str
    patientName: str
    caseTitle: str
    caseStatus: str

    clinician: Optional[TeamMemberInfo] = None
    implantologist: Optional[TeamMemberInfo] = None
    prosthodontist: Optional[TeamMemberInfo] = None
    assistant: Optional[TeamMemberInfo] = None
    periodontist: Optional[TeamMemberInfo] = None
    stageAssignments: List[StageAssignmentResponse] = Field(default_factory=list)

    createdAt: datetime
    updatedAt: datetime


class CaseListResponse(BaseModel):
    cases: List[CaseResponse]
