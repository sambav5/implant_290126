# ============================================
# FILE: backend/routes/case_routes.py
# PURPOSE: Case management endpoints
# ============================================

import logging
from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import Dict, Any

from schemas.case_schema import CreateCaseRequest, CaseResponse, CaseListResponse, TeamMemberInfo
from services.case_service import CaseService
from services.user_service import UserService
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
            assigned_assistant_id=case_data.assignedAssistantId
        )
        
        # Build response with team member info
        clinician_info = await case_service.get_team_member_info(clinic_id)
        implantologist_info = await case_service.get_team_member_info(case_data.assignedImplantologistId)
        prosthodontist_info = await case_service.get_team_member_info(case_data.assignedProsthodontistId)
        assistant_info = await case_service.get_team_member_info(case_data.assignedAssistantId)
        
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