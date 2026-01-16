# Security Baseline Implementation Guide

**Date:** 2025-01-27  
**Purpose:** Guide for implementing security baseline across all API routes

## Overview

The security baseline includes:
1. **Rate Limiting** - Prevent abuse and DoS attacks
2. **Input Validation** - Strict validation with Zod schemas
3. **Secure API Key Handling** - Server-only keys, never exposed to client
4. **Request Size Limits** - Prevent DoS via large payloads
5. **Least-Privilege Access Control** - Verify auth, roles, and ownership

## Installation

Security utilities are installed in `src/lib/security/`:
- `rateLimit.ts` - Rate limiting middleware
- `validation.ts` - Input validation with Zod
- `apiKeys.ts` - Secure API key handling
- `accessControl.ts` - Authentication and authorization
- `middleware.ts` - Combined security middleware

## Quick Start

### 1. Public Route (No Auth)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      const url = new URL(req.url);
      const validation = validateQueryParams(url.searchParams, querySchema);
      if (!validation.success) {
        return validation.error;
      }
      
      // Your logic here
      return NextResponse.json({ data: [] });
    },
    {
      rateLimit: 'public', // 100 requests/minute per IP
    }
  );
}
```

### 2. Authenticated Route

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      const validation = await validateRequestBody(req, createSchema);
      if (!validation.success) {
        return validation.error;
      }
      
      // userId and accountId are guaranteed to be present
      // Your logic here
      
      return NextResponse.json({ success: true }, { status: 201 });
    },
    {
      rateLimit: 'authenticated', // 200 requests/minute per user
      requireAuth: true,
    }
  );
}
```

### 3. Admin Route

```typescript
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      // Admin check passed, proceed
      return NextResponse.json({ success: true });
    },
    {
      rateLimit: 'admin', // 500 requests/minute per admin
      requireAdmin: true,
    }
  );
}
```

### 4. Resource Ownership Route

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      const { id } = await params;
      
      // Check ownership
      const { requireOwnership } = await import('@/lib/security/accessControl');
      const ownershipCheck = await requireOwnership('map', id, 'account_id');
      if (!ownershipCheck.success && ownershipCheck.error) {
        return ownershipCheck.error;
      }
      
      // Ownership verified, proceed
      return NextResponse.json({ success: true });
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
    }
  );
}
```

## Rate Limit Configurations

```typescript
// Available rate limit presets:
'public'        // 100 requests/minute per IP
'authenticated' // 200 requests/minute per user
'admin'         // 500 requests/minute per admin
'strict'         // 10 requests/minute (for sensitive operations)
'webhook'       // No rate limiting (signature verified)
'none'          // Disable rate limiting
```

## Input Validation

### Request Body

```typescript
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
});

const validation = await validateRequestBody(request, schema);
if (!validation.success) {
  return validation.error; // Returns 400 with error details
}

const { name, email, age } = validation.data; // Type-safe!
```

### Query Parameters

```typescript
import { validateQueryParams } from '@/lib/security/validation';

const url = new URL(request.url);
const validation = validateQueryParams(url.searchParams, schema);
if (!validation.success) {
  return validation.error;
}
```

### Path Parameters

```typescript
import { validatePathParams } from '@/lib/security/validation';

const { id } = await params;
const validation = validatePathParams({ id }, z.object({ id: z.string().uuid() }));
if (!validation.success) {
  return validation.error;
}
```

## Secure API Key Handling

### Before (Insecure)

```typescript
// ❌ BAD: Exposed to client
const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
```

### After (Secure)

```typescript
// ✅ GOOD: Server-only
import { getApiKey } from '@/lib/security/apiKeys';

const apiKey = getApiKey('OPENAI'); // Throws if not found
// or
const apiKey = getServerApiKeyOptional('OPENAI_API_KEY'); // Returns null if not found
```

### Environment Variable Migration

**Critical:** Move these keys from `NEXT_PUBLIC_*` to server-only:

1. **OpenAI API Key**
   - Old: `NEXT_PUBLIC_OPENAI_API_KEY`
   - New: `OPENAI_API_KEY`
   - Update: `src/app/api/intelligence/chat/route.ts` ✅ (already fixed)

2. **RapidAPI Key**
   - Old: `NEXT_PUBLIC_RAPIDAPI_KEY`
   - New: `RAPIDAPI_KEY`
   - **Note:** This is complex because SkipTraceService is used client-side
   - **Solution:** Create API proxy routes for skip trace operations

## Request Size Limits

```typescript
import { REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

// Default limits:
REQUEST_SIZE_LIMITS.json      // 1MB
REQUEST_SIZE_LIMITS.formData  // 10MB
REQUEST_SIZE_LIMITS.fileUpload // 50MB

// Custom limit:
{
  maxRequestSize: 2 * 1024 * 1024, // 2MB
}
```

## Access Control

### Require Authentication

```typescript
import { requireAuth } from '@/lib/security/accessControl';

const authCheck = await requireAuth();
if (!authCheck.success && authCheck.error) {
  return authCheck.error; // Returns 401
}

const { userId, accountId } = authCheck;
```

### Require Admin

```typescript
import { requireAdmin } from '@/lib/security/accessControl';

const adminCheck = await requireAdmin();
if (!adminCheck.success && adminCheck.error) {
  return adminCheck.error; // Returns 403 if not admin
}
```

### Require Ownership

```typescript
import { requireOwnership } from '@/lib/security/accessControl';

const ownershipCheck = await requireOwnership('map', mapId, 'account_id');
if (!ownershipCheck.success && ownershipCheck.error) {
  return ownershipCheck.error; // Returns 403 if not owner
}
```

## Migration Checklist

### For Each API Route:

- [ ] Add rate limiting (choose appropriate preset)
- [ ] Add input validation (Zod schemas for body/query/path)
- [ ] Add request size limits (if needed)
- [ ] Verify authentication requirements
- [ ] Verify authorization (admin/ownership checks)
- [ ] Replace `NEXT_PUBLIC_*` API keys with server-only keys
- [ ] Test rate limiting (verify 429 responses)
- [ ] Test validation (verify 400 responses for invalid input)
- [ ] Test access control (verify 401/403 responses)

## Common Patterns

### Pattern 1: List with Pagination

```typescript
const querySchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  search: z.string().max(200).optional(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      const url = new URL(req.url);
      const validation = validateQueryParams(url.searchParams, querySchema);
      if (!validation.success) {
        return validation.error;
      }
      
      const { limit, offset, search } = validation.data;
      // Your logic here
    },
    { rateLimit: 'public' }
  );
}
```

### Pattern 2: Create with Validation

```typescript
const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      const validation = await validateRequestBody(req, createSchema);
      if (!validation.success) {
        return validation.error;
      }
      
      // Create resource with userId/accountId
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
    }
  );
}
```

### Pattern 3: Update with Ownership

```typescript
const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      const { id } = await params;
      
      // Check ownership
      const ownershipCheck = await requireOwnership('map', id, 'account_id');
      if (!ownershipCheck.success && ownershipCheck.error) {
        return ownershipCheck.error;
      }
      
      // Validate update data
      const validation = await validateRequestBody(req, updateSchema);
      if (!validation.success) {
        return validation.error;
      }
      
      // Update resource
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
    }
  );
}
```

## Testing

### Test Rate Limiting

```bash
# Send 101 requests in 1 minute
for i in {1..101}; do
  curl http://localhost:3000/api/your-route
done
# Should get 429 on 101st request
```

### Test Validation

```bash
# Send invalid data
curl -X POST http://localhost:3000/api/your-route \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'
# Should get 400 with validation errors
```

### Test Access Control

```bash
# Request without auth
curl http://localhost:3000/api/protected-route
# Should get 401

# Request with non-admin user
curl http://localhost:3000/api/admin-route \
  -H "Authorization: Bearer $TOKEN"
# Should get 403 if not admin
```

## Next Steps

1. **Apply to all routes** - Start with high-traffic routes, then work through all routes
2. **Monitor rate limits** - Watch for false positives, adjust limits as needed
3. **Upgrade to Redis** - For production scale, replace in-memory cache with Redis
4. **Add monitoring** - Track rate limit hits, validation failures, auth failures
5. **Create API proxy routes** - For RapidAPI services used client-side

## See Also

- `src/lib/security/examples.ts` - Complete example implementations
- `docs/API_SURFACE_INVENTORY.md` - Complete API surface inventory

