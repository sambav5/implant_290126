from datetime import datetime
from pydantic import BaseModel, Field
from typing import Literal
import uuid


class CaseFileModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_id: str
    file_name: str
    file_type: str
    file_size: int
    storage_url: str
    storage_key: str  # Path to file in storage system
    category: Literal[
        "PRE_OP",
        "POST_OP",
        "XRAY",
        "CBCT",
        "MEDICAL_RECORD",
        "LAB_FILE",
        "OTHER"
    ]
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)