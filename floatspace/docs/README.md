# FloatSpace — Study Helper Platform

**Status:** Built & Ready (OAuth blocker pending)

## What is FloatSpace?

A collaborative messaging platform designed for students with:
- 📚 Study rooms (general, study, math, bio, help)
- 💬 Direct messages (1-on-1 chats)
- 🔢 Built-in calculator
- ⚡ Auto-delete messages for privacy
- 🚨 Panic button (AC double-tap)
- 📊 Freemium model (10 free contacts, unlimited pro)

## Architecture

```
Frontend (Vanilla JS) 
    ↓
Google Apps Script Backend 
    ↓
Google Sheets Database
```

## Deployment Status

✅ **Frontend deployed:** https://static-assets-sync.github.io/core-dependencies/  
✅ **Backend deployed:** Google Apps Script endpoint active  
✅ **Database:** Google Sheets with 8 auto-created tables  
⚠️ **BLOCKED:** OAuth redirect URI misconfiguration  

## Current Blocker: OAuth 401 Error

**Problem:** Google OAuth returning `invalid_client` — redirect URIs not configured in Google Cloud Console.

**To Fix (Lead needs to do this):**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your FloatSpace project
3. Go to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID
5. Add these Redirect URIs:
   - `https://static-assets-sync.github.io/core-dependencies/callback`
   - `https://localhost:3000/callback` (for local testing)
6. Save & test

## How to Use

### As a Web App
1. Visit: https://static-assets-sync.github.io/core-dependencies/
2. Click "Sign in with Google"
3. Authorize with `6d7.6d7@gmail.com`
4. Start chatting!

### As a Bookmarklet
1. Copy the script from `/v2-bookmarklet/Calc.js`
2. Create a bookmark in your browser
3. Paste as URL (prefix with `javascript:`)
4. Visit any website and click the bookmark to inject FloatSpace

## Code Organization

- `/current/` — Production version (merged best features)
- `/legacy/` — Original modular version (reference)
- `/v2-bookmarklet/` — Minified bookmarklet injection
- `/docs/` — Documentation

## Next Steps

1. **Lead:** Fix OAuth redirect URIs (blocking launch)
2. **HAL:** Test end-to-end auth flow
3. **Lead:** Distribution strategy (email + social)
4. **Both:** Freemium tier implementation

## Quick Links

- **GitHub Repo:** https://github.com/static-assets-sync/static-assets-sync
- **Live Site:** https://static-assets-sync.github.io/core-dependencies/
- **Backend Email:** 6d7.6d7@gmail.com
- **OAuth Provider:** Google Cloud Console

---

*Last updated: 2026-03-06 — HAL (Haiku)*
