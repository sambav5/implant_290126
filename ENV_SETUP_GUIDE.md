# 🔒 Environment Variables Setup Guide

## ⚠️ Security Notice

**The actual `.env` files are NOT in the repository for security reasons.**

Your local `.env` files contain sensitive credentials that should NEVER be committed to git.

## 📋 Setup Instructions

### 1. Backend Environment Variables

Copy the example file and add your credentials:

```bash
cd backend
cp .env.example .env
```

Then edit `backend/.env` and fill in:

- **JWT_SECRET**: Generate with `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`
- **TWILIO_ACCOUNT_SID**: From [Twilio Console](https://console.twilio.com)
- **TWILIO_AUTH_TOKEN**: From Twilio Console
- **TWILIO_TEMPLATE_SID**: Your approved WhatsApp template SID
- **MONGO_URL**: Your MongoDB connection string

### 2. Frontend Environment Variables

Copy the example file:

```bash
cd frontend
cp .env.example .env
```

Then edit `frontend/.env` and set:

- **REACT_APP_BACKEND_URL**: Your backend API URL (production or local)
- **VITE_POSTHOG_KEY** (optional): For analytics

## 🔐 Getting Credentials

### Twilio WhatsApp
1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to WhatsApp Sandbox
3. Copy your:
   - Account SID
   - Auth Token
   - Approved Template SID

### JWT Secret
Generate a secure random key:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### MongoDB
- Local: `mongodb://localhost:27017`
- Cloud: Get connection string from MongoDB Atlas

## ✅ Verification

After setup, verify your environment:

```bash
# Check backend
cd backend
cat .env | grep -v "SECRET\|TOKEN\|SID"

# Check frontend
cd frontend
cat .env | grep "BACKEND_URL"
```

## 🚨 Important Security Notes

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Never share credentials** in chat/email/screenshots
3. **Rotate secrets** if accidentally exposed
4. **Use different credentials** for dev/staging/production

## 📝 Required Variables Checklist

### Backend (.env)
- [ ] MONGO_URL
- [ ] DB_NAME
- [ ] JWT_SECRET
- [ ] JWT_ALGORITHM
- [ ] JWT_EXPIRE_DAYS
- [ ] TWILIO_ACCOUNT_SID
- [ ] TWILIO_AUTH_TOKEN
- [ ] TWILIO_WHATSAPP_FROM
- [ ] TWILIO_TEMPLATE_SID

### Frontend (.env)
- [ ] REACT_APP_BACKEND_URL
- [ ] WDS_SOCKET_PORT (optional)
- [ ] PostHog keys (optional)

## 🔄 Deployment

For production deployment, set environment variables through your hosting platform's dashboard (not via .env files):

- Vercel: Project Settings → Environment Variables
- Heroku: Config Vars
- AWS: Parameter Store / Secrets Manager
- Docker: Use secrets management

Never deploy with `.env` files in production!
