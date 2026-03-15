# ============================================
# FILE: backend/routes/team_routes.py
# PURPOSE: Team member management endpoints
# ============================================

import logging
from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import Dict, Any

from schemas.team_schema import AddTeamMemberRequest, UpdateTeamMemberRequest, TeamMemberResponse, TeamListResponse
from services.team_service import TeamService
from services.user_service import UserService
from auth.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/team",
    tags=["Team Management"]
)

def get_db(request: Request):
    """Get database instance from app state"""
    return request.app.state.db

@router.get("", status_code=status.HTTP_200_OK)
async def get_team(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all team members for current user's clinic
    
    Returns list of team members (excluding clinician for role assignment)
    """
    try:
        db = get_db(request)
        team_service = TeamService(db)
        user_service = UserService(db)
        
        phone_number = current_user.get("phoneNumber")
        
        # Get user (clinic owner)
        user = await user_service.get_user_by_mobile(phone_number)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if user has clinic_id (new schema)
        if not user.get("clinic_id"):
            # Check onboarding stage
            if user.get("onboarding_stage") == "PROFILE":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Please complete your profile setup first"
                )
            elif user.get("onboarding_stage") == "TEAM":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Please complete team setup or skip to continue"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Please complete onboarding first"
                )
        
        # Get team members
        members = await team_service.get_team_members(user["clinic_id"])
        
        # Return team members (clinicians will be filtered on frontend)
        return [
            {
                "id": m["id"],
                "name": m["name"],
                "role": m["role"],
                "mobileNumber": m["mobile_number"]
            }
            for m in members
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching team: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch team"
        )

@router.post("/member", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    member_data: AddTeamMemberRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Add a team member to the clinic
    
    Args:
        member_data: Team member details (name, role, mobile)
        current_user: Authenticated user from JWT token
        
    Returns:
        Created team member details
    """
    try:
        db = get_db(request)
        team_service = TeamService(db)
        user_service = UserService(db)
        
        phone_number = current_user.get("phoneNumber")
        
        # Get user (clinic owner)
        user = await user_service.get_user_by_mobile(phone_number)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if user has clinic_id (new schema)
        if not user.get("clinic_id"):
            # Check onboarding stage
            if user.get("onboarding_stage") == "PROFILE":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Please complete your profile setup first"
                )
            elif user.get("onboarding_stage") == "TEAM":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Please complete team setup or skip to continue"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Please complete onboarding first"
                )
        
        # Add team member
        team_member = await team_service.add_team_member(
            clinic_id=user["clinic_id"],
            name=member_data.name,
            role=member_data.role,
            mobile_number=member_data.mobileNumber
        )
        
        # If this is the first team member added, complete onboarding
        if user["onboarding_stage"] == "TEAM":
            await user_service.complete_onboarding(user["id"])
            logger.info(f"Completed onboarding for user {user['id']} after adding first team member")
        
        return TeamMemberResponse(
            id=team_member["id"],
            name=team_member["name"],
            role=team_member["role"],
            mobileNumber=team_member["mobile_number"],
            createdAt=team_member["created_at"]
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error adding team member: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add team member"
        )

@router.put("/member/{member_id}", response_model=TeamMemberResponse, status_code=status.HTTP_200_OK)
async def update_team_member(
    member_id: str,
    member_data: UpdateTeamMemberRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update a team member (Clinician only)
    
    Args:
        member_id: ID of the team member to update
        member_data: Updated team member details (name, role, mobile)
        current_user: Authenticated user from JWT token
        
    Returns:
        Updated team member details
    """
    try:
        db = get_db(request)
        team_service = TeamService(db)
        user_service = UserService(db)
        
        phone_number = current_user.get("phoneNumber")
        
        # Get user (clinic owner)
        user = await user_service.get_user_by_mobile(phone_number)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if user has clinic_id
        if not user.get("clinic_id"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please complete onboarding first"
            )
        
        # Verify user is Clinician
        if user.get("role") != "Clinician":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only clinic owner can update team members"
            )
        
        # Update team member
        updated_member = await team_service.update_team_member(
            member_id=member_id,
            clinic_id=user["clinic_id"],
            name=member_data.name,
            role=member_data.role,
            mobile_number=member_data.mobileNumber
        )
        
        return TeamMemberResponse(
            id=updated_member["id"],
            name=updated_member["name"],
            role=updated_member["role"],
            mobileNumber=updated_member["mobile_number"],
            createdAt=updated_member["created_at"]
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating team member: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update team member"
        )

@router.get("/members", response_model=TeamListResponse)
async def get_team_members(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all team members for the current user's clinic
    
    Args:
        current_user: Authenticated user from JWT token
        
    Returns:
        List of team members
    """
    try:
        db = get_db(request)
        team_service = TeamService(db)
        user_service = UserService(db)
        
        phone_number = current_user.get("phoneNumber")
        
        # Get user (clinic owner)
        user = await user_service.get_user_by_mobile(phone_number)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if user has clinic_id
        if not user.get("clinic_id"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please complete onboarding first"
            )
        
        # Get team members
        members = await team_service.get_team_members(user["clinic_id"])
        
        return TeamListResponse(
            members=[
                TeamMemberResponse(
                    id=m["id"],
                    name=m["name"],
                    role=m["role"],
                    mobileNumber=m["mobile_number"],
                    createdAt=m["created_at"]
                )
                for m in members
            ]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching team members: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch team members"
        )

@router.delete("/member/{member_id}", status_code=status.HTTP_200_OK)
async def remove_team_member(
    member_id: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Remove a team member from the clinic
    
    Args:
        member_id: ID of the team member to remove
        current_user: Authenticated user from JWT token
        
    Returns:
        Success message
    """
    try:
        db = get_db(request)
        team_service = TeamService(db)
        user_service = UserService(db)
        
        phone_number = current_user.get("phoneNumber")
        
        # Get user (clinic owner)
        user = await user_service.get_user_by_mobile(phone_number)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if user has clinic_id
        if not user.get("clinic_id"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please complete onboarding first"
            )
        
        # Remove team member
        deleted = await team_service.remove_team_member(member_id, user["clinic_id"])
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Team member not found"
            )
        
        return {"message": "Team member removed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing team member: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove team member"
        )