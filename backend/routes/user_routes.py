# ============================================
# FILE: backend/routes/user_routes.py
# PURPOSE: User profile and onboarding endpoints
# ============================================

import logging
from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import Dict, Any

from schemas.user_schema import ProfileSetupRequest, UserProfileResponse, SkipTeamSetupRequest, UpdateProfileRequest
from services.user_service import UserService
from services.clinic_service import ClinicService
from auth.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/user",
    tags=["User Management"]
)

def get_db(request: Request):
    """Get database instance from app state"""
    return request.app.state.db

@router.post("/profile", status_code=status.HTTP_200_OK)
async def setup_profile(
    profile_data: ProfileSetupRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Setup user profile, create clinic, and move to TEAM onboarding stage
    
    Args:
        profile_data: User's name, clinic name, and address
        current_user: Authenticated user from JWT token
        
    Returns:
        Updated user profile with onboardingStage = TEAM
    """
    try:
        db = get_db(request)
        user_service = UserService(db)
        clinic_service = ClinicService(db)
        
        phone_number = current_user.get("phoneNumber")
        
        # Get user by phone number
        user = await user_service.get_user_by_mobile(phone_number)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Create clinic
        clinic = await clinic_service.create_clinic(
            name=profile_data.clinicName,
            address=profile_data.clinicAddress,
            owner_id=user["id"]
        )
        
        # Update user profile with clinic_id
        updated_user = await user_service.update_profile(
            user_id=user["id"],
            name=profile_data.name,
            clinic_id=clinic["id"]
        )
        
        return {
            "message": "Profile updated successfully",
            "onboardingStage": updated_user["onboarding_stage"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting up profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to setup profile"
        )

@router.post("/skip-team", status_code=status.HTTP_200_OK)
async def skip_team_setup(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Skip team setup and complete onboarding
    
    Args:
        current_user: Authenticated user from JWT token
        
    Returns:
        Success message with onboardingStage = COMPLETED
    """
    try:
        db = get_db(request)
        user_service = UserService(db)
        
        phone_number = current_user.get("phoneNumber")
        
        # Get user by phone number
        user = await user_service.get_user_by_mobile(phone_number)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Complete onboarding
        updated_user = await user_service.complete_onboarding(user["id"])
        
        return {
            "message": "Onboarding completed successfully",
            "onboardingStage": updated_user["onboarding_stage"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error skipping team setup: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to skip team setup"
        )

@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get current user's profile
    
    Args:
        current_user: Authenticated user from JWT token
        
    Returns:
        User profile with onboarding stage
    """
    try:
        db = get_db(request)
        user_service = UserService(db)
        clinic_service = ClinicService(db)
        
        phone_number = current_user.get("phoneNumber")
        
        # Get user by phone number
        user = await user_service.get_user_by_mobile(phone_number)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get clinic if user has one
        clinic_name = None
        clinic_address = None
        if user.get("clinic_id"):
            clinic = await clinic_service.get_clinic_by_id(user["clinic_id"])
            if clinic:
                clinic_name = clinic.get("name")
                clinic_address = clinic.get("address")
        
        return UserProfileResponse(
            id=user["id"],
            mobileNumber=user["mobile_number"],
            name=user.get("name"),
            role=user.get("role", "Clinician"),
            clinicName=clinic_name,
            clinicAddress=clinic_address,
            onboardingStage=user["onboarding_stage"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user profile"
        )

@router.put("/profile", status_code=status.HTTP_200_OK)
async def update_user_profile(
    profile_data: UpdateProfileRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update user's name (mobile number cannot be changed)
    
    Args:
        profile_data: User's name
        current_user: Authenticated user from JWT token
        
    Returns:
        Success message
    """
    try:
        db = get_db(request)
        user_service = UserService(db)
        
        phone_number = current_user.get("phoneNumber")
        
        # Get user by phone number
        user = await user_service.get_user_by_mobile(phone_number)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update name only
        await user_service.update_user_name(user["id"], profile_data.name)
        
        return {
            "message": "Profile updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )