# ============================================
# FILE: backend/routes/case_routes.py
# PURPOSE: Case management endpoints
# ============================================

import logging
from fastapi import APIRouter, HTTPException, status, Request, Depends, UploadFile, File, Form
from typing import Dict, Any

from schemas.case_schema import CreateCaseRequest, CaseResponse, CaseListResponse, TeamMemberInfo, StageAssignmentInfo
from services.case_service import CaseService
from services.user_service import UserService
from services.case_file_service import CaseFileService
from schemas.case_file_schema import CaseFileUploadResponse, CaseFilesGroupedResponse, CaseFileCategory
from auth.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/cases",
    tags=["Case Management"]
)

def get_db(request: Request):
    """Get database instance from app state"""
    return request.app.state.db

@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    case_data: CreateCaseRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create a new case (Clinician only)
    
    Security:
    - Only Clinician role can create cases
    - Clinician is auto-assigned
    - Team members must belong to same clinic
    - Role validation enforced
    """
    try:
        db = get_db(request)
        case_service = CaseService(db)
        user_service = UserService(db)
        
        phone_number = current_user.get("phoneNumber")
        user_id = current_user.get("userId")
        
        # Get user details
        user = await user_service.get_user_by_mobile(phone_number)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        clinic_id = user["id"]
        
        # Verify user is Clinician (only clinic owner can create cases)
        if user_id != clinic_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only clinicians can create cases"
            )
        
        # Create case with validation
        case = await case_service.create_case(
            clinic_id=clinic_id,
            clinician_id=clinic_id,
            patient_name=case_data.patientName,
            case_title=case_data.caseTitle,
            assigned_implantologist_id=case_data.assignedImplantologistId,
            assigned_prosthodontist_id=case_data.assignedProsthodontistId,
            assigned_assistant_id=case_data.assignedAssistantId,
            assigned_periodontist_id=case_data.assignedPeriodontistId,
            stage_assignments=[assignment.model_dump() for assignment in case_data.stageAssignments]
        )
        
        # Build response with team member info
        clinician_info = await case_service.get_team_member_info(clinic_id)
        implantologist_info = await case_service.get_team_member_info(case_data.assignedImplantologistId)
        prosthodontist_info = await case_service.get_team_member_info(case_data.assignedProsthodontistId)
        assistant_info = await case_service.get_team_member_info(case_data.assignedAssistantId)
        periodontist_info = await case_service.get_team_member_info(case_data.assignedPeriodontistId)
        stage_assignments_info = []
        for assignment in case_data.stageAssignments:
            member_info = await case_service.get_team_member_info(assignment.userId)
            stage_assignments_info.append(
                StageAssignmentInfo(
                    stage=assignment.stage,
                    userId=assignment.userId,
                    userName=(member_info or {}).get("name")
                )
            )
        
        return CaseResponse(
            id=case["id"],
            clinicId=case["clinic_id"],
            patientName=case["patient_name"],
            caseTitle=case["case_title"],
            caseStatus=case["case_status"],
            clinician=TeamMemberInfo(**clinician_info) if clinician_info else None,
            implantologist=TeamMemberInfo(**implantologist_info) if implantologist_info else None,
            prosthodontist=TeamMemberInfo(**prosthodontist_info) if prosthodontist_info else None,
            assistant=TeamMemberInfo(**assistant_info) if assistant_info else None,
            periodontist=TeamMemberInfo(**periodontist_info) if periodontist_info else None,
            stageAssignments=stage_assignments_info,
            createdAt=case["created_at"],
            updatedAt=case["updated_at"]
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating case: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create case"
        )

@router.get("/my", response_model=CaseListResponse)
async def get_my_cases(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all cases where current user is assigned
    
    Returns cases where user is:
    - Clinician (created_by)
    - Implantologist (assigned)
    - Prosthodontist (assigned)
    - Assistant (assigned)
    - Periodontist (assigned)
    """
    try:
        db = get_db(request)
        case_service = CaseService(db)
        user_service = UserService(db)
        
        phone_number = current_user.get("phoneNumber")
        user_id = current_user.get("userId")
        
        # Get user details
        user = await user_service.get_user_by_mobile(phone_number)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        clinic_id = user["id"]
        
        # Get cases
        cases = await case_service.get_user_cases(user_id, clinic_id)
        
        # Build response with team member info
        case_responses = []
        for case in cases:
            clinician_info = await case_service.get_team_member_info(case["created_by_clinician_id"])
            implantologist_info = await case_service.get_team_member_info(case.get("assigned_implantologist_id"))
            prosthodontist_info = await case_service.get_team_member_info(case.get("assigned_prosthodontist_id"))
            assistant_info = await case_service.get_team_member_info(case.get("assigned_assistant_id"))
            periodontist_info = await case_service.get_team_member_info(case.get("assigned_periodontist_id"))

            stage_assignments_info = []
            for assignment in case.get("stage_assignments", []):
                member_info = await case_service.get_team_member_info(assignment.get("userId"))
                stage_assignments_info.append(
                    StageAssignmentInfo(
                        stage=assignment.get("stage"),
                        userId=assignment.get("userId"),
                        userName=(member_info or {}).get("name")
                    )
                )
            
            case_responses.append(
                CaseResponse(
                    id=case["id"],
                    clinicId=case["clinic_id"],
                    patientName=case["patient_name"],
                    caseTitle=case["case_title"],
                    caseStatus=case["case_status"],
                    clinician=TeamMemberInfo(**clinician_info) if clinician_info else None,
                    implantologist=TeamMemberInfo(**implantologist_info) if implantologist_info else None,
                    prosthodontist=TeamMemberInfo(**prosthodontist_info) if prosthodontist_info else None,
                    assistant=TeamMemberInfo(**assistant_info) if assistant_info else None,
                    periodontist=TeamMemberInfo(**periodontist_info) if periodontist_info else None,
                    stageAssignments=stage_assignments_info,
                    createdAt=case["created_at"],
                    updatedAt=case["updated_at"]
                )
            )
        
        return CaseListResponse(cases=case_responses)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user cases: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch cases"
        )


@router.post("/{case_id}/files", response_model=CaseFileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_case_file(
    case_id: str,
    request: Request,
    file: UploadFile = File(...),
    category: CaseFileCategory = Form(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    db = get_db(request)
    service = CaseFileService(db)

    case = await service.ensure_case_access(case_id, current_user["userId"])
    role = await service.resolve_user_role_for_case(case, current_user["userId"])
    if role not in {"Clinician", "Implantologist", "Prosthodontist", "Assistant", "Periodontist"}:
        raise HTTPException(status_code=403, detail="You cannot upload files for this case")

    content = await file.read()
    created = await service.create_case_file(
        case_id=case_id,
        category=category.value,
        file_name=file.filename,
        file_content=content,
        content_type=file.content_type,
        uploaded_by=current_user["userId"],
    )

    return CaseFileUploadResponse(
        fileId=created["id"],
        fileName=created["file_name"],
        url=created["storage_url"],
        category=created["category"],
        uploadedBy=created["uploaded_by"],
        uploadedAt=created["uploaded_at"],
    )


@router.get("/{case_id}/files", response_model=CaseFilesGroupedResponse)
async def get_case_files(
    case_id: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    db = get_db(request)
    service = CaseFileService(db)
    await service.ensure_case_access(case_id, current_user["userId"])
    files = await service.list_case_files_grouped(case_id)
    return CaseFilesGroupedResponse(files=files)


@router.delete("/files/{file_id}")
async def delete_case_file(
    file_id: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    db = get_db(request)
    service = CaseFileService(db)

    file_doc = await db.case_files.find_one({"id": file_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    case = await service.ensure_case_access(file_doc["case_id"], current_user["userId"])
    role = await service.resolve_user_role_for_case(case, current_user["userId"])
    if role != "Clinician":
        raise HTTPException(status_code=403, detail="Only Clinician can delete files")

    await service.delete_case_file(file_id)
    return {"message": "File deleted successfully"}
