# ============================================
# FILE: backend/auth/security.py
# PURPOSE: JWT creation/verification and bcrypt password hashing
# ============================================

import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
import logging

logger = logging.getLogger(__name__)

# ============ CONFIGURATION ============
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_DAYS = int(os.environ.get("JWT_EXPIRE_DAYS", 7))

if not JWT_SECRET:
    raise ValueError("JWT_SECRET must be set in environment variables")

# ============ PASSWORD HASHING ============
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_otp(otp: str) -> str:
    """Hash OTP using bcrypt"""
    return pwd_context.hash(otp)


def verify_otp(plain_otp: str, hashed_otp: str) -> bool:
    """Verify OTP against hashed version"""
    return pwd_context.verify(plain_otp, hashed_otp)


# ============ JWT TOKEN MANAGEMENT ============
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token
    
    Args:
        data: Payload data to encode in token
        expires_delta: Optional custom expiry time
        
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    })
    
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and verify JWT token
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============ AUTHENTICATION DEPENDENCY ============
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    Dependency to extract and validate current user from JWT token
    
    Usage:
        @app.get("/protected")
        async def protected_route(current_user: dict = Depends(get_current_user)):
            return {"user": current_user}
    
    Returns:
        User data from token payload
        
    Raises:
        HTTPException: If authentication fails
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    
    # Extract user information from token
    phone_number = payload.get("sub")
    if not phone_number:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    return {
        "phoneNumber": phone_number,
        "clinicianName": payload.get("clinicianName", "Unknown"),
        "exp": payload.get("exp"),
        "iat": payload.get("iat")
    }


# ============ OPTIONAL AUTHENTICATION (FOR DEVELOPMENT) ============
security_optional = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional)
) -> Optional[Dict[str, Any]]:
    """
    Optional authentication dependency - allows both authenticated and unauthenticated access
    Useful during frontend integration development
    
    Returns:
        User data if token provided and valid, None otherwise
    """
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        phone_number = payload.get("sub")
        
        if not phone_number:
            return None
        
        return {
            "phoneNumber": phone_number,
            "clinicianName": payload.get("clinicianName", "Unknown"),
            "exp": payload.get("exp"),
            "iat": payload.get("iat")
        }
    except HTTPException:
        return None


# ============ UTILITY FUNCTIONS ============
def get_token_expiry_seconds() -> int:
    """Get JWT token expiry time in seconds"""
    return JWT_EXPIRE_DAYS * 24 * 60 * 60
