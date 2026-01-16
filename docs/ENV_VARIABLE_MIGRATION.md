# Environment Variable Migration Guide

**Date:** 2025-01-27  
**Purpose:** Migrate API keys from client-exposed (`NEXT_PUBLIC_*`) to server-only variables

## Overview

This migration moves sensitive API keys from `NEXT_PUBLIC_*` environment variables (which are exposed to client-side code) to server-only environment variables for improved security.

## Changes Required

### 1. OpenAI API Key ✅

**Status:** ✅ **COMPLETED**

- **Old:** `NEXT_PUBLIC_OPENAI_API_KEY`
- **New:** `OPENAI_API_KEY`
- **Updated Files:**
  - `src/app/api/intelligence/chat/route.ts` ✅

**Action Required:**
1. Update `.env.local`:
   ```bash
   # Remove or comment out
   # NEXT_PUBLIC_OPENAI_API_KEY=your_key_here
   
   # Add new server-only key
   OPENAI_API_KEY=your_key_here
   ```

2. Update production environment variables (Vercel, etc.):
   - Remove `NEXT_PUBLIC_OPENAI_API_KEY`
   - Add `OPENAI_API_KEY` with the same value

### 2. RapidAPI Key ⚠️

**Status:** ⚠️ **PARTIAL** - Server-side routes updated, client-side needs proxy routes

- **Old:** `NEXT_PUBLIC_RAPIDAPI_KEY`
- **New:** `RAPIDAPI_KEY` (server-only)
- **Updated Files:**
  - `src/app/api/news/route.ts` ✅
  - `src/features/news/services/newsApiService.ts` ✅

**Client-Side Usage:**
The following files still use `NEXT_PUBLIC_RAPIDAPI_KEY` because they run client-side:
- `src/features/api/services/skipTraceService.ts` - Used in browser
- `src/features/api/config/apiConfig.ts` - Used in browser

**Solution:** Create API proxy routes for client-side operations (see below).

**Action Required:**

1. **Update `.env.local`:**
   ```bash
   # Add new server-only key
   RAPIDAPI_KEY=your_rapidapi_key_here
   
   # Keep NEXT_PUBLIC_RAPIDAPI_KEY temporarily for client-side code
   # Remove after creating proxy routes
   NEXT_PUBLIC_RAPIDAPI_KEY=your_rapidapi_key_here
   ```

2. **Update production environment variables:**
   - Add `RAPIDAPI_KEY` with the same value as `NEXT_PUBLIC_RAPIDAPI_KEY`
   - Keep `NEXT_PUBLIC_RAPIDAPI_KEY` until proxy routes are created

3. **Create API proxy routes** (next step):
   - `/api/skip-trace/search` - Proxy for skip trace API
   - `/api/zillow/search` - Proxy for Zillow API
   - Update client-side code to use proxy routes instead of direct API calls

## Migration Steps

### Step 1: Update Environment Variables

#### Local Development (.env.local)

```bash
# Server-only API keys (new)
OPENAI_API_KEY=your_openai_api_key_here
RAPIDAPI_KEY=your_rapidapi_key_here

# Legacy keys (remove after migration)
# NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here  # REMOVE
# NEXT_PUBLIC_RAPIDAPI_KEY=your_rapidapi_key_here      # Keep temporarily
```

#### Production (Vercel/Dashboard)

1. Go to your project settings → Environment Variables
2. Add new variables:
   - `OPENAI_API_KEY` = (copy value from `NEXT_PUBLIC_OPENAI_API_KEY`)
   - `RAPIDAPI_KEY` = (copy value from `NEXT_PUBLIC_RAPIDAPI_KEY`)
3. Remove `NEXT_PUBLIC_OPENAI_API_KEY` (after verifying migration)
4. Keep `NEXT_PUBLIC_RAPIDAPI_KEY` until proxy routes are created

### Step 2: Verify Server-Side Routes

All server-side routes now use secure API key access:

```typescript
import { getApiKey } from '@/lib/security/apiKeys';

// ✅ Secure - server-only
const apiKey = getApiKey('OPENAI'); // or 'RAPIDAPI'
```

### Step 3: Create API Proxy Routes (For Client-Side Usage)

For client-side code that needs RapidAPI access, create proxy routes:

**Example: `/api/skip-trace/search`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getApiKey } from '@/lib/security/apiKeys';
import { withSecurity } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

const searchSchema = z.object({
  type: z.enum(['name', 'address', 'phone', 'email']),
  query: z.string().min(1).max(500),
  // ... other params
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId }) => {
      const validation = await validateRequestBody(req, searchSchema);
      if (!validation.success) {
        return validation.error;
      }
      
      const apiKey = getApiKey('RAPIDAPI');
      // Proxy request to RapidAPI
      // ...
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
    }
  );
}
```

### Step 4: Update Client-Side Code

After creating proxy routes, update client-side code:

**Before:**
```typescript
// ❌ Client-side - exposes API key
const apiKey = process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
const response = await fetch('https://api.rapidapi.com/...', {
  headers: { 'x-rapidapi-key': apiKey }
});
```

**After:**
```typescript
// ✅ Client-side - uses proxy route
const response = await fetch('/api/skip-trace/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'address', query: '...' })
});
```

### Step 5: Remove Legacy Variables

After all client-side code is migrated to proxy routes:

1. Remove `NEXT_PUBLIC_RAPIDAPI_KEY` from `.env.local`
2. Remove `NEXT_PUBLIC_RAPIDAPI_KEY` from production environment
3. Update `env.example` to remove deprecated variables

## Files Updated

### ✅ Server-Side Routes (Completed)
- `src/app/api/intelligence/chat/route.ts` - Uses `OPENAI_API_KEY`
- `src/app/api/news/route.ts` - Uses `RAPIDAPI_KEY`
- `src/features/news/services/newsApiService.ts` - Uses `RAPIDAPI_KEY`

### ⚠️ Client-Side Code (Needs Proxy Routes)
- `src/features/api/services/skipTraceService.ts` - Still uses `NEXT_PUBLIC_RAPIDAPI_KEY`
- `src/features/api/config/apiConfig.ts` - Still uses `NEXT_PUBLIC_RAPIDAPI_KEY`

## Verification Checklist

- [x] `OPENAI_API_KEY` added to `.env.local`
- [x] `RAPIDAPI_KEY` added to `.env.local`
- [x] Server-side routes updated to use secure keys
- [x] `env.example` updated with new variables
- [ ] Production environment variables updated
- [ ] API proxy routes created for client-side usage
- [ ] Client-side code updated to use proxy routes
- [ ] `NEXT_PUBLIC_RAPIDAPI_KEY` removed from all environments
- [ ] All tests passing

## Testing

### Test Server-Side Routes

```bash
# Test OpenAI route
curl -X POST http://localhost:3000/api/intelligence/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'

# Test News route
curl "http://localhost:3000/api/news?query=minnesota"
```

### Test Environment Variable Access

```typescript
// Server-side only - should work
import { getApiKey } from '@/lib/security/apiKeys';
const key = getApiKey('OPENAI'); // ✅

// Client-side - should fail
const key = process.env.OPENAI_API_KEY; // ❌ undefined (not exposed)
```

## Security Notes

1. **Never commit API keys** to version control
2. **Use different keys** for development and production
3. **Rotate keys regularly** (every 90 days recommended)
4. **Monitor API usage** for suspicious activity
5. **Use rate limiting** on proxy routes to prevent abuse

## Rollback Plan

If issues occur, you can temporarily revert:

1. Keep both old and new env vars during migration
2. Add fallback logic in code:
   ```typescript
   const apiKey = getApiKey('OPENAI') || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
   ```
3. Remove fallback after verification

## Next Steps

1. ✅ Update environment variables (this document)
2. ⏭️ Create API proxy routes for client-side RapidAPI usage
3. ⏭️ Update client-side code to use proxy routes
4. ⏭️ Remove legacy `NEXT_PUBLIC_*` variables

## Support

- See `src/lib/security/apiKeys.ts` for API key utilities
- See `docs/SECURITY_BASELINE_IMPLEMENTATION.md` for security patterns
- See `src/lib/security/examples.ts` for example implementations
