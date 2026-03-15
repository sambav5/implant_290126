# ============================================
# FILE: backend/auth/twilio_service.py
# PURPOSE: WhatsApp OTP delivery via Twilio Sandbox
# ============================================

import os
import logging
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

logger = logging.getLogger(__name__)

# ============ TWILIO CONFIGURATION ============
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_FROM = os.environ.get("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
TWILIO_TEMPLATE_SID = os.environ.get("TWILIO_TEMPLATE_SID")

# Make Twilio optional - only fail when actually trying to use it
TWILIO_ENABLED = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_TEMPLATE_SID)

if TWILIO_ENABLED:
    # Initialize Twilio client
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    logger.info("Twilio integration enabled")
else:
    twilio_client = None
    logger.warning("Twilio credentials not configured - WhatsApp OTP features will be disabled")


def send_whatsapp_otp(phone_number: str, otp: str) -> bool:
    """
    Send OTP via WhatsApp using Twilio Content Template
    
    Args:
        phone_number: Recipient phone number in international format (e.g., +919876543210)
        otp: 6-digit OTP code
        
    Returns:
        True if message sent successfully, False otherwise
        
    Raises:
        Exception: If Twilio API call fails
    """
    if not TWILIO_ENABLED:
        logger.error("Twilio not configured - cannot send WhatsApp OTP")
        raise ValueError("WhatsApp OTP service is not configured. Please contact administrator.")
    
    try:
        # Ensure phone number is in WhatsApp format
        if not phone_number.startswith("whatsapp:"):
            to_number = f"whatsapp:{phone_number}"
        else:
            to_number = phone_number
        
        logger.info(f"Sending WhatsApp OTP to {to_number}")
        
        # Send message using Content Template
        # Twilio Sandbox requires approved Content Templates
        message = twilio_client.messages.create(
            content_sid=TWILIO_TEMPLATE_SID,
            from_=TWILIO_WHATSAPP_FROM,
            to=to_number,
            content_variables=f'{{"1": "{otp}"}}',  # Template variable for OTP
        )
        
        logger.info(f"WhatsApp OTP sent successfully. SID: {message.sid}, Status: {message.status}")
        return True
        
    except TwilioRestException as e:
        logger.error(f"Twilio API error: {e.code} - {e.msg}")
        
        if e.code == 21211:
            raise Exception(
                f"WhatsApp Sandbox Error: Please join our sandbox first. "
                f"Send 'join <sandbox-keyword>' to {TWILIO_WHATSAPP_FROM} on WhatsApp, then try again."
            )
        
        raise Exception(f"Failed to send WhatsApp OTP: {e.msg}")
    
    except Exception as e:
        logger.error(f"Unexpected error sending WhatsApp OTP: {str(e)}")
        raise Exception(f"Failed to send WhatsApp OTP: {str(e)}")


def validate_phone_number(phone_number: str) -> str:
    """
    Validate and sanitize phone number
    
    Args:
        phone_number: Phone number string
        
    Returns:
        Sanitized phone number in international format (+XXXXXXXXXXX)
        
    Raises:
        ValueError: If phone number is invalid
    """
    # Remove common separators and spaces
    cleaned = phone_number.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    
    # Ensure it starts with +
    if not cleaned.startswith("+"):
        raise ValueError("Phone number must be in international format starting with +")
    
    # Remove + for digit validation
    digits_only = cleaned[1:]
    
    # Validate it contains only digits after +
    if not digits_only.isdigit():
        raise ValueError("Phone number must contain only digits after +")
    
    # Validate length (most international numbers are 10-15 digits)
    if len(digits_only) < 10 or len(digits_only) > 15:
        raise ValueError("Phone number must be between 10 and 15 digits")
    
    return cleaned
