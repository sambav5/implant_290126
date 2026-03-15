# ============================================
# FILE: backend/routes/clinic_routes.py
# PURPOSE: Clinic settings management endpoints
# ============================================

import logging
from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import Dict, Any

from schemas.clinic_schema import ClinicResponse, UpdateClinicRequest
from services.clinic_service import ClinicService
from services.user_service import UserService
from auth.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/clinic",
    tags=["Clinic Management"]
)

def get_db(request: Request):
    """Get database instance from app state"""
    return request.app.state.db

@router.get("", response_model=ClinicResponse)
async def get_clinic(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get clinic details for current user
    
    Returns:
        Clinic information
    """
    try:
        db = get_db(request)
        clinic_service = ClinicService(db)
        user_service = UserService(db)
        
        phone_number = current_user.get("phoneNumber")
        
        # Get user
        user = await user_service.get_user_by_mobile(phone_number)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get clinic
        clinic = await clinic_service.get_clinic_by_id(user["clinic_id"])
        
        if not clinic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinic not found"
            )
        
        return ClinicResponse(
            id=clinic["id"],
            name=clinic["name"],
            address=clinic.get("address"),
            ownerId=clinic["owner_id"],
            createdAt=clinic["created_at"],
            updatedAt=clinic["updated_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching clinic: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch clinic"
        )

@router.put("", response_model=ClinicResponse)
async def update_clinic(
    clinic_data: UpdateClinicRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update clinic settings (Clinician only)
    
    Args:
        clinic_data: Clinic name and address
        current_user: Authenticated user from JWT token
        
    Returns:
        Updated clinic information
    """
    try:
        db = get_db(request)
        clinic_service = ClinicService(db)
        user_service = UserService(db)
        
        phone_number = current_user.get("phoneNumber")
        user_id = current_user.get("userId")
        
        # Get user
        user = await user_service.get_user_by_mobile(phone_number)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Verify user is Clinician (clinic owner)
        if user["role"] != "Clinician":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only clinic owner can update clinic settings"
            )
        
        # Get clinic
        clinic = await clinic_service.get_clinic_by_id(user["clinic_id"])
        
        if not clinic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinic not found"
            )
        
        # Verify user owns the clinic
        if clinic["owner_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only clinic owner can update clinic settings"
            )
        
        # Update clinic
        updated_clinic = await clinic_service.update_clinic(
            clinic["id"],
            clinic_data.name,
            clinic_data.address
        )
        
        return ClinicResponse(
            id=updated_clinic["id"],
            name=updated_clinic["name"],
            address=updated_clinic.get("address"),
            ownerId=updated_clinic["owner_id"],
            createdAt=updated_clinic["created_at"],
            updatedAt=updated_clinic["updated_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating clinic: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update clinic"
        )
