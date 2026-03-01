# ============================================
# FILE: backend/auth/routes.py
# PURPOSE: WhatsApp OTP authentication endpoints
# ============================================

import os
import logging
import random
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.auth_models import (
    OTPRequest,
    OTPVerifyRequest,
    AuthSessionResponse,
    OTPResponse
)
from auth.security import (
    hash_otp,
    verify_otp,
    create_access_token,
    get_token_expiry_seconds
)
from auth.twilio_service import send_whatsapp_otp, validate_phone_number

logger = logging.getLogger(__name__)

# ============ ROUTER CONFIGURATION ============
router = APIRouter(
    prefix="/auth/whatsapp",
    tags=["WhatsApp Authentication"]
)

# ============ OTP CONFIGURATION ============
OTP_EXPIRY_MINUTES = 5
MAX_OTP_ATTEMPTS = 5
OTP_LENGTH = 6


# ============ HELPER FUNCTIONS ============
def generate_otp(length: int = OTP_LENGTH) -> str:
    """Generate random numeric OTP"""
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])


def get_db(request: Request) -> AsyncIOMotorDatabase:
    """Get database instance from app state"""
    return request.app.state.db


# ============ AUTHENTICATION ENDPOINTS ============

@router.post("/request-otp", response_model=OTPResponse, status_code=status.HTTP_200_OK)
async def request_otp(otp_request: OTPRequest, request: Request):
    """
    Request OTP for WhatsApp authentication
    
    Flow:
    1. Validate and sanitize phone number
    2. Generate 6-digit OTP
    3. Hash OTP with bcrypt
    4. Store in MongoDB with 5-minute TTL
    5. Send OTP via WhatsApp (Twilio)
    6. Return success response
    
    Args:
        otp_request: Contains phoneNumber
        
    Returns:
        OTPResponse with expiry time
        
    Raises:
        HTTPException: If validation or sending fails
    """
    try:
        # 1. Validate phone number
        phone_number = validate_phone_number(otp_request.phoneNumber)
        logger.info(f"OTP requested for {phone_number}")
        
        # 2. Generate OTP
        otp = generate_otp()
        logger.info(f"Generated OTP for {phone_number}: {otp}")  # Remove in production
        
        # 3. Hash OTP
        hashed_otp = hash_otp(otp)
        
        # 4. Store in MongoDB with TTL
        db = get_db(request)
        expiry_time = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
        
        otp_record = {
            "phoneNumber": phone_number,
            "hashedOtp": hashed_otp,
            "attempts": 0,
            "createdAt": datetime.now(timezone.utc),
            "expiresAt": expiry_time,
        }
        
        # Upsert: replace existing OTP if present
        await db.otp_requests.update_one(
            {"phoneNumber": phone_number},
            {"$set": otp_record},
            upsert=True
        )
        
        # Create TTL index on expiresAt field (MongoDB auto-deletes expired docs)
        await db.otp_requests.create_index("expiresAt", expireAfterSeconds=0)
        
        # 5. Send OTP via WhatsApp
        try:
            send_whatsapp_otp(phone_number, otp)
        except Exception as e:
            logger.error(f"Failed to send WhatsApp OTP: {str(e)}")
            # Clean up the OTP record if sending fails
            await db.otp_requests.delete_one({"phoneNumber": phone_number})
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Failed to send OTP via WhatsApp: {str(e)}"
            )
        
        # 6. Return success
        return OTPResponse(
            message="OTP sent successfully to your WhatsApp",
            expiresIn=OTP_EXPIRY_MINUTES * 60  # in seconds
        )
        
    except ValueError as e:
        logger.warning(f"Invalid phone number: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error in request_otp: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during OTP request"
        )


@router.post("/verify-otp", response_model=AuthSessionResponse, status_code=status.HTTP_200_OK)
async def verify_otp_endpoint(verify_request: OTPVerifyRequest, request: Request):
    """
    Verify OTP and issue JWT token
    
    Flow:
    1. Validate phone number
    2. Retrieve OTP record from MongoDB
    3. Check expiry
    4. Check max attempts
    5. Verify OTP with bcrypt
    6. Delete OTP record
    7. Auto-create/fetch user in users collection
    8. Generate JWT token
    9. Return token + user info
    
    Args:
        verify_request: Contains phoneNumber and otp
        
    Returns:
        AuthSessionResponse with JWT token and user details
        
    Raises:
        HTTPException: If verification fails
    """
    try:
        # 1. Validate phone number
        phone_number = validate_phone_number(verify_request.phoneNumber)
        logger.info(f"OTP verification requested for {phone_number}")
        
        # 2. Retrieve OTP record
        db = get_db(request)
        otp_record = await db.otp_requests.find_one({"phoneNumber": phone_number})
        
        if not otp_record:
            logger.warning(f"No OTP record found for {phone_number}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No OTP request found. Please request a new OTP."
            )
        
        # 3. Check expiry
        expires_at = otp_record["expiresAt"]
        # Ensure both datetimes are timezone-aware for comparison
        if not expires_at.tzinfo:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            logger.warning(f"Expired OTP for {phone_number}")
            await db.otp_requests.delete_one({"phoneNumber": phone_number})
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP has expired. Please request a new one."
            )
        
        # 4. Check max attempts
        if otp_record["attempts"] >= MAX_OTP_ATTEMPTS:
            logger.warning(f"Max attempts exceeded for {phone_number}")
            await db.otp_requests.delete_one({"phoneNumber": phone_number})
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Maximum verification attempts exceeded. Please request a new OTP."
            )
        
        # 5. Verify OTP
        is_valid = verify_otp(verify_request.otp, otp_record["hashedOtp"])
        
        if not is_valid:
            # Increment attempts
            await db.otp_requests.update_one(
                {"phoneNumber": phone_number},
                {"$inc": {"attempts": 1}}
            )
            remaining_attempts = MAX_OTP_ATTEMPTS - otp_record["attempts"] - 1
            logger.warning(f"Invalid OTP for {phone_number}. Attempts remaining: {remaining_attempts}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid OTP. {remaining_attempts} attempts remaining."
            )
        
        # 6. Delete OTP record (successful verification)
        await db.otp_requests.delete_one({"phoneNumber": phone_number})
        logger.info(f"OTP verified successfully for {phone_number}")
        
        # 7. Auto-create or fetch user
        user = await db.users.find_one({"phoneNumber": phone_number})
        
        if not user:
            # Auto-provision new user
            user = {
                "phoneNumber": phone_number,
                "clinicianName": f"Dr. {phone_number[-4:]}",  # Default name
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "lastLogin": datetime.now(timezone.utc).isoformat(),
            }
            await db.users.insert_one(user)
            logger.info(f"New user created: {phone_number}")
        else:
            # Update last login
            await db.users.update_one(
                {"phoneNumber": phone_number},
                {"$set": {"lastLogin": datetime.now(timezone.utc).isoformat()}}
            )
            logger.info(f"Existing user logged in: {phone_number}")
        
        # 8. Generate JWT token
        token_data = {
            "sub": phone_number,  # Subject (standard JWT claim)
            "clinicianName": user.get("clinicianName", "Unknown"),
            "type": "access"
        }
        access_token = create_access_token(token_data)
        
        # 9. Return session response
        return AuthSessionResponse(
            token=access_token,
            tokenType="bearer",
            clinicianName=user.get("clinicianName", "Unknown"),
            phoneNumber=phone_number,
            expiresIn=get_token_expiry_seconds()
        )
        
    except ValueError as e:
        logger.warning(f"Invalid phone number in verify: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error in verify_otp: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during OTP verification"
        )
