from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ClinicResponse(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    ownerId: str
    createdAt: datetime
    updatedAt: datetime

class UpdateClinicRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200, description="Clinic name")
    address: Optional[str] = Field(None, max_length=500, description="Clinic address")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Dental Care Center",
                "address": "123 Main St, City"
            }
        }
