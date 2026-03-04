from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
import uuid

class CaseModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    clinic_id: str = Field(..., description="Clinic ID (user ID of clinic owner)")
    
    # Clinician who created the case
    created_by_clinician_id: str = Field(..., description="Clinician who created this case")
    
    # Case details
    patient_name: str = Field(..., description="Patient name")
    case_title: str = Field(..., description="Case title/description")
    case_status: Literal["active", "in_progress", "completed", "archived"] = "active"
    
    # Role assignments (all optional except clinician)
    assigned_implantologist_id: Optional[str] = None
    assigned_prosthodontist_id: Optional[str] = None
    assigned_assistant_id: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "patient_name": "Ramesh Kumar",
                "case_title": "Dental Implant - Tooth 36",
                "case_status": "active",
                "assigned_implantologist_id": "impl-123",
                "assigned_prosthodontist_id": "pros-456",
                "assigned_assistant_id": "asst-789"
            }
        }