import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from services.case_service import CaseService
from services.file_storage import get_file_storage


ALLOWED_EXTENSIONS = {
    "jpg", "jpeg", "png", "pdf", "doc", "docx", "stl", "zip", "dcm"
}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024


class CaseFileService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.case_files = db.case_files
        self.cases = db.cases
        self.case_service = CaseService(db)
        self.storage = get_file_storage()

    async def ensure_case_access(self, case_id: str, user_id: str) -> Dict[str, Any]:
        case = await self.cases.find_one({"id": case_id}, {"_id": 0})
        if not case:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

        assigned_ids = {
            case.get("created_by_clinician_id"),
            case.get("assigned_implantologist_id"),
            case.get("assigned_prosthodontist_id"),
            case.get("assigned_assistant_id"),
        }
        assigned_ids.discard(None)

        # Backward compatibility: legacy cases may not carry assignment metadata.
        if assigned_ids and user_id not in assigned_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this case")

        return case

    async def resolve_user_role_for_case(self, case: Dict[str, Any], user_id: str) -> str:
        if case.get("created_by_clinician_id") == user_id:
            return "Clinician"
        if case.get("assigned_implantologist_id") == user_id:
            return "Implantologist"
        if case.get("assigned_prosthodontist_id") == user_id:
            return "Prosthodontist"
        if case.get("assigned_assistant_id") == user_id:
            return "Assistant"

        # Legacy case fallback: owner of the legacy case can act as clinician.
        return "Clinician"

    def _validate_upload(self, file_name: str, file_size: int) -> str:
        suffix = Path(file_name).suffix.lower().replace(".", "")
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        if file_size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="File exceeds 50MB limit")
        return suffix

    async def create_case_file(
        self,
        case_id: str,
        category: str,
        file_name: str,
        file_content: bytes,
        content_type: Optional[str],
        uploaded_by: str,
    ) -> Dict[str, Any]:
        file_size = len(file_content)
        file_ext = self._validate_upload(file_name, file_size)
        safe_name = f"{uuid.uuid4()}_{Path(file_name).name}"
        storage_key = f"cases/{case_id}/{category.lower()}/{safe_name}"

        storage_url = await self.storage.save_file(storage_key, file_content, content_type)

        payload = {
            "id": str(uuid.uuid4()),
            "case_id": case_id,
            "file_name": file_name,
            "file_type": file_ext,
            "file_size": file_size,
            "storage_url": storage_url,
            "storage_key": storage_key,
            "category": category,
            "uploaded_by": uploaded_by,
            "uploaded_at": datetime.utcnow(),
        }
        await self.case_files.insert_one(payload)
        return payload

    async def list_case_files_grouped(self, case_id: str) -> Dict[str, list[Dict[str, Any]]]:
        cursor = self.case_files.find({"case_id": case_id}, {"_id": 0}).sort("uploaded_at", -1)
        files = await cursor.to_list(length=500)
        grouped = {"PRE_OP": [], "POST_OP": [], "XRAY": [], "CBCT": [], "MEDICAL_RECORD": [], "LAB_FILE": [], "OTHER": []}

        for item in files:
            uploader = await self.case_service.get_team_member_info(item.get("uploaded_by"))
            grouped[item["category"]].append({
                "id": item["id"],
                "caseId": item["case_id"],
                "fileName": item["file_name"],
                "fileType": item["file_type"],
                "fileSize": item["file_size"],
                "storageUrl": item["storage_url"],
                "category": item["category"],
                "uploadedBy": item["uploaded_by"],
                "uploadedByName": uploader["name"] if uploader else "Unknown",
                "uploadedAt": item["uploaded_at"],
            })

        return grouped

    async def delete_case_file(self, file_id: str) -> None:
        existing = await self.case_files.find_one({"id": file_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="File not found")

        await self.storage.delete_file(existing.get("storage_key", ""))
        await self.case_files.delete_one({"id": file_id})

    async def ensure_indexes(self) -> None:
        await self.case_files.create_index("id", unique=True)
        await self.case_files.create_index("case_id")
        await self.case_files.create_index("uploaded_at")
