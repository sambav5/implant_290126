# ============================================
# FILE: backend/models/auth_models.py
# PURPOSE: Pydantic models for WhatsApp OTP authentication
# ============================================

from pydantic import BaseModel, Field
from typing import Optional


class OTPRequest(BaseModel):
    """Request model for OTP generation"""
    phoneNumber: str = Field(..., description="Phone number in international format (e.g., +919876543210)")


class OTPVerifyRequest(BaseModel):
    """Request model for OTP verification"""
    phoneNumber: str = Field(..., description="Phone number in international format")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit OTP code")


class AuthSessionResponse(BaseModel):
    """Response model after successful authentication"""
    token: str = Field(..., description="JWT access token")
    tokenType: str = Field(default="bearer", description="Token type")
    onboardingStage: str = Field(..., description="User onboarding stage: PROFILE | TEAM | COMPLETED")
    expiresIn: int = Field(..., description="Token expiry in seconds")


class OTPResponse(BaseModel):
    """Response model after OTP request"""
    message: str = Field(..., description="Status message")
    expiresIn: int = Field(..., description="OTP expiry time in seconds")
