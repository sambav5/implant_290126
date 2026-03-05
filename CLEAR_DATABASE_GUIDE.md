# Database Clear Guide

## Method 1: Using Python Script (Easiest)

```bash
cd /app/backend
python clear_database.py
```

This will clear all collections:
- users
- clinics
- team_members
- cases
- otp_requests

---

## Method 2: Manual MongoDB Commands

### Connect to MongoDB:
```bash
# Using mongosh (if installed)
mongosh "mongodb://localhost:27017/dental_app"

# OR using mongo shell
mongo "mongodb://localhost:27017/dental_app"
```

### Clear Individual Collections:
```javascript
// Clear users
db.users.deleteMany({})

// Clear clinics
db.clinics.deleteMany({})

// Clear team members
db.team_members.deleteMany({})

// Clear cases
db.cases.deleteMany({})

// Clear OTP requests
db.otp_requests.deleteMany({})
```

### Clear ALL Collections at Once:
```javascript
// Get all collection names
db.getCollectionNames().forEach(function(collName) {
    db[collName].deleteMany({});
    print("Cleared: " + collName);
});
```

### Drop Entire Database (Nuclear Option):
```javascript
db.dropDatabase()
```

---

## Method 3: Using Docker (if MongoDB is in container)

```bash
# Find MongoDB container
docker ps | grep mongo

# Execute commands in container
docker exec -it <container_name> mongosh dental_app --eval "db.dropDatabase()"
```

---

## Method 4: Quick One-Liner (Current Setup)

```bash
cd /app/backend && python -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def clear():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client.get_default_database()
    for coll in await db.list_collection_names():
        await db[coll].delete_many({})
        print(f'Cleared: {coll}')
    client.close()

asyncio.run(clear())
"
```

---

## Verify Database is Empty

```bash
cd /app/backend && python -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def check():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client.get_default_database()
    for coll in await db.list_collection_names():
        count = await db[coll].count_documents({})
        print(f'{coll}: {count} documents')
    client.close()

asyncio.run(check())
"
```

---

## After Clearing Data

1. **Restart Backend** (to clear any cached data):
   ```bash
   sudo supervisorctl restart backend
   ```

2. **Logout from Frontend**:
   - Click profile menu → Logout
   - Or clear browser localStorage

3. **Test Fresh Start**:
   - Login with WhatsApp OTP
   - Complete profile setup
   - Add team members
   - Create cases

---

## Common Issues After Clear

**Issue**: "User not found" error
**Fix**: Logout and login again

**Issue**: Old data still showing
**Fix**: Clear browser cache or use incognito mode

**Issue**: OTP not working
**Fix**: Request new OTP (old ones are also cleared)

---

## Backup Before Clearing (Optional)

```bash
# Backup entire database
mongodump --uri="mongodb://localhost:27017/dental_app" --out=/tmp/backup

# Restore if needed
mongorestore --uri="mongodb://localhost:27017/dental_app" /tmp/backup/dental_app
```
