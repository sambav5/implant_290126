from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class ClinicModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(..., description="Clinic name")
    address: Optional[str] = Field(None, description="Clinic address")
    owner_id: str = Field(..., description="User ID of clinic owner (Clinician)")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "clinic-123",
                "name": "Dental Care Center",
                "address": "123 Main St, City",
                "owner_id": "user-123"
            }
        }
