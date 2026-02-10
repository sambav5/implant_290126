# PostHog Environment Variables Fix - Create React App

## Issue
PostHog was showing error:
```
[PostHog.js] No `apiKey` or `client` were provided to `PostHogProvider`
[PostHog.js] PostHog was initialized without a token
```

## Root Cause
Using **Vite** environment variable syntax (`import.meta.env.VITE_*`) in a **Create React App** project.

---

## ✅ Solution

### **Create React App vs Vite - Environment Variables**

| Framework | Prefix | Access |
|-----------|--------|--------|
| **Create React App** | `REACT_APP_*` | `process.env.REACT_APP_*` |
| **Vite** | `VITE_*` | `import.meta.env.VITE_*` |

**This app uses Create React App**, so we need `REACT_APP_` prefix!

---

## Changes Made

### **1. Updated .env File**

**File:** `/app/frontend/.env`

**Added:**
```env
REACT_APP_POSTHOG_KEY=phc_LjAL1j3sYSRoaTffey38ZC2q7ohLayy3KWP6uc594kZ
REACT_APP_POSTHOG_HOST=https://us.i.posthog.com
```

**Kept (for backward compatibility):**
```env
VITE_POSTHOG_KEY=phc_LjAL1j3sYSRoaTffey38ZC2q7ohLayy3KWP6uc594kZ
VITE_PUBLIC_POSTHOG_KEY=phc_LjAL1j3sYSRoaTffey38ZC2q7ohLayy3KWP6uc594kZ
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

---

### **2. Updated index.js**

**File:** `/app/frontend/src/index.js`

**Before (Incorrect - Vite syntax):**
```javascript
const options = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
};

<PostHogProvider 
  apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
  options={options}
>
```

**After (Correct - CRA syntax):**
```javascript
const options = {
  api_host: process.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com',
};

<PostHogProvider 
  apiKey={process.env.REACT_APP_POSTHOG_KEY}
  options={options}
>
```

---

## Complete .env Configuration

```env
# Backend URL
REACT_APP_BACKEND_URL=https://emergent-bug-fix.preview.emergentagent.com

# WebSocket
WDS_SOCKET_PORT=443

# Health Check
ENABLE_HEALTH_CHECK=false

# PostHog - Vite (kept for compatibility)
VITE_POSTHOG_KEY=phc_LjAL1j3sYSRoaTffey38ZC2q7ohLayy3KWP6uc594kZ
VITE_PUBLIC_POSTHOG_KEY=phc_LjAL1j3sYSRoaTffey38ZC2q7ohLayy3KWP6uc594kZ
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# PostHog - Create React App (CORRECT)
REACT_APP_POSTHOG_KEY=phc_LjAL1j3sYSRoaTffey38ZC2q7ohLayy3KWP6uc594kZ
REACT_APP_POSTHOG_HOST=https://us.i.posthog.com
```

---

## Verification Steps

### **1. Check Environment Variables in Browser Console:**

```javascript
// Should return the PostHog key
process.env.REACT_APP_POSTHOG_KEY

// Should return undefined (Vite variables don't work in CRA)
import.meta.env.VITE_PUBLIC_POSTHOG_KEY
```

### **2. Check PostHog Instance:**

```javascript
// Should return PostHog object with proper config
window.posthog

// Check if initialized
window.posthog.get_config()
```

### **3. Enable Debug Mode:**

```javascript
window.posthog.debug()
```

### **4. Test Event Capture:**

```javascript
window.posthog.capture('test_event', { test: true })
```

Check browser console - should see event logged.

### **5. Check PostHog Dashboard:**

- Open PostHog dashboard
- Go to "Live Events"
- Perform actions in app
- Events should appear within 1-2 minutes

---

## Testing Clinical Workflow Events

### **Test Each Event:**

1. **Create Case:**
   - Navigate to New Case
   - Fill form and create case
   - Check PostHog for `case_created` event

2. **Complete Planning:**
   - Complete all planning steps
   - Click "Analyze"
   - Check for `planning_completed` event

3. **Run Risk Analysis:**
   - After planning, click analyze
   - Check for `risk_analysis_run` event

4. **Complete Blueprint:**
   - Check all items in Treatment Blueprint
   - When 100% reached
   - Check for `treatment_blueprint_completed` event

5. **Submit Feedback:**
   - Fill learning reflections
   - Click save
   - Check for `feedback_submitted` event

---

## Files Modified

1. ✅ `/app/frontend/.env` - Added REACT_APP_POSTHOG_* variables
2. ✅ `/app/frontend/src/index.js` - Changed to process.env.REACT_APP_*

---

## Validation

✅ **Environment Variables:** Added with correct prefix  
✅ **Syntax Updated:** Changed to process.env  
✅ **Frontend Compiled:** Successfully  
✅ **Services Running:** All operational  
✅ **No Console Errors:** PostHog warnings gone  

---

## Why This Fixes the Issue

**Problem:**
```javascript
// This returns undefined in Create React App
import.meta.env.VITE_PUBLIC_POSTHOG_KEY
```

**Solution:**
```javascript
// This works in Create React App
process.env.REACT_APP_POSTHOG_KEY
```

**Key Points:**
- Create React App only reads `REACT_APP_*` prefixed variables
- `import.meta.env` is a Vite-specific API, not available in CRA
- `process.env` is the standard Node.js API used by CRA
- Environment variables must be set before `yarn start`

---

## Common Mistakes to Avoid

### ❌ **Wrong (Vite syntax in CRA):**
```javascript
import.meta.env.VITE_PUBLIC_POSTHOG_KEY
```

### ✅ **Correct (CRA syntax):**
```javascript
process.env.REACT_APP_POSTHOG_KEY
```

### ❌ **Wrong (Missing prefix):**
```env
POSTHOG_KEY=xxx
```

### ✅ **Correct (With REACT_APP prefix):**
```env
REACT_APP_POSTHOG_KEY=xxx
```

---

## Summary

✅ **Added** REACT_APP_POSTHOG_KEY and REACT_APP_POSTHOG_HOST to .env  
✅ **Updated** index.js to use process.env instead of import.meta.env  
✅ **Fixed** PostHog initialization error  
✅ **Compiled** successfully without errors  
✅ **All services** running properly  

**PostHog should now initialize correctly and capture events!** 📊✨

The key issue was using Vite's environment variable syntax in a Create React App project. Now using the correct CRA syntax with `process.env.REACT_APP_*`.
