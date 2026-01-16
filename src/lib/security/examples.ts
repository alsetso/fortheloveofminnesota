/**
 * Example implementations showing how to use security utilities
 * These are reference implementations for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, REQUEST_SIZE_LIMITS } from './middleware';
import { validateRequestBody, validateQueryParams, validatePathParams } from './validation';
import { requireAuth, requireAdmin, requireOwnership } from './accessControl';
import { z } from 'zod';
import { commonSchemas } from './validation';

// ============================================================================
// Example 1: Public Route with Rate Limiting
// ============================================================================

const getNewsQuerySchema = z.object({
  limit: commonSchemas.positiveInt.default(10),
  offset: commonSchemas.nonNegativeInt.default(0),
  date: z.string().optional(),
});

export async function examplePublicRoute(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      // Validate query parameters
      const url = new URL(req.url);
      const queryValidation = validateQueryParams(url.searchParams, getNewsQuerySchema);
      if (!queryValidation.success) {
        return queryValidation.error;
      }
      
      const { limit, offset, date } = queryValidation.data;
      
      // Your route logic here
      return NextResponse.json({ data: [] });
    },
    {
      rateLimit: 'public', // 100 requests/minute per IP
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

// ============================================================================
// Example 2: Authenticated Route with Input Validation
// ============================================================================

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  visibility: z.enum(['public', 'private', 'members_only', 'only_me']),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export async function exampleAuthenticatedRoute(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      // Validate request body
      const validation = await validateRequestBody(req, createPostSchema);
      if (!validation.success) {
        return validation.error;
      }
      
      const { title, content, visibility, tags } = validation.data;
      
      // userId and accountId are guaranteed to be present
      // Your route logic here
      
      return NextResponse.json({ success: true }, { status: 201 });
    },
    {
      rateLimit: 'authenticated', // 200 requests/minute per user
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

// ============================================================================
// Example 3: Admin Route
// ============================================================================

const createAtlasEntitySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['city', 'county', 'school', 'park']),
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

export async function exampleAdminRoute(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      // Validate request body
      const validation = await validateRequestBody(req, createAtlasEntitySchema);
      if (!validation.success) {
        return validation.error;
      }
      
      // userId and accountId are guaranteed to be present (admin check passed)
      // Your admin logic here
      
      return NextResponse.json({ success: true }, { status: 201 });
    },
    {
      rateLimit: 'admin', // 500 requests/minute per admin
      requireAdmin: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

// ============================================================================
// Example 4: Resource Ownership Route
// ============================================================================

const updateMapSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  visibility: z.enum(['public', 'private', 'shared']).optional(),
});

export async function exampleOwnershipRoute(
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
      
      // Validate request body
      const validation = await validateRequestBody(req, updateMapSchema);
      if (!validation.success) {
        return validation.error;
      }
      
      // Ownership verified, proceed with update
      // Your update logic here
      
      return NextResponse.json({ success: true });
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

// ============================================================================
// Example 5: Manual Security Checks (for complex logic)
// ============================================================================

export async function exampleManualChecks(request: NextRequest) {
  // Manual auth check
  const authCheck = await requireAuth();
  if (!authCheck.success && authCheck.error) {
    return authCheck.error;
  }
  
  // Manual validation
  const body = await request.json();
  const validation = createPostSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validation.error.issues },
      { status: 400 }
    );
  }
  
  // Your logic here
  
  return NextResponse.json({ success: true });
}

// ============================================================================
// Example 6: Webhook Route (No Rate Limiting, Signature Verified)
// ============================================================================

export async function exampleWebhookRoute(request: NextRequest) {
  // Webhooks don't use withSecurity (they have their own verification)
  // But we can still validate request size
  
  const sizeCheck = await import('./middleware').then(m => 
    m.checkRequestSize(request, REQUEST_SIZE_LIMITS.json)
  );
  if (!sizeCheck.allowed && sizeCheck.error) {
    return sizeCheck.error;
  }
  
  // Verify webhook signature (Stripe example)
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }
  
  // Your webhook logic here
  
  return NextResponse.json({ received: true });
}

