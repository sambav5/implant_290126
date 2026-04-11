# Test Credentials

## Authentication
- Auth method: WhatsApp OTP via Twilio
- Phone number format: 10-digit Indian mobile number (e.g., 9876543210)
- OTP is logged in backend logs: check /var/log/supervisor/backend.err.log for "Generated OTP for" message
- Twilio sandbox: Users must first send "join" to +1 415 523 8886 on WhatsApp

## Notes
- No hardcoded test accounts
- New users auto-provisioned on first OTP verification
- JWT token stored in localStorage as 'clinician_auth_session'
