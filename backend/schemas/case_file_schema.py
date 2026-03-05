from datetime import datetime
from enum import Enum
from typing import Dict, List

from pydantic import BaseModel, Field


class CaseFileCategory(str, Enum):
    XRAY = "XRAY"
    CBCT = "CBCT"
    MEDICAL_RECORD = "MEDICAL_RECORD"
    LAB_FILE = "LAB_FILE"
    OTHER = "OTHER"


class CaseFileUploadResponse(BaseModel):
    fileId: str
    fileName: str
    url: str
    category: CaseFileCategory
    uploadedBy: str
    uploadedAt: datetime


class CaseFileItemResponse(BaseModel):
    id: str
    caseId: str
    fileName: str
    fileType: str
    fileSize: int
    storageUrl: str
    category: CaseFileCategory
    uploadedBy: str
    uploadedByName: str
    uploadedAt: datetime


class CaseFilesGroupedResponse(BaseModel):
    files: Dict[CaseFileCategory, List[CaseFileItemResponse]] = Field(default_factory=dict)
