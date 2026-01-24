/**
 * Security middleware utilities for API routes
 * Combines rate limiting, validation, and access control
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, RATE_LIMITS } from './rateLimit';
import { optionalAuth } from './accessControl';

/**
 * Request size limits (in bytes)
 */
export const REQUEST_SIZE_LIMITS = {
  json: 1024 * 1024, // 1MB
  formData: 10 * 1024 * 1024, // 10MB
  fileUpload: 50 * 1024 * 1024, // 50MB
} as const;

/**
 * Check request size
 */
export async function checkRequestSize(
  request: NextRequest,
  maxSize: number = REQUEST_SIZE_LIMITS.json
): Promise<{ allowed: boolean; error?: Response }> {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSize) {
      return {
        allowed: false,
        error: NextResponse.json(
          {
            error: 'Request too large',
            message: `Request body exceeds maximum size of ${maxSize / 1024 / 1024}MB`,
          },
          { status: 413 }
        ),
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Security middleware wrapper for API routes
 * Applies rate limiting, request size checks, and optional auth
 */
export async function withSecurity<T>(
  request: NextRequest,
  handler: (req: NextRequest, context: {
    userId?: string;
    accountId?: string;
  }) => Promise<T>,
  options: {
    rateLimit?: keyof typeof RATE_LIMITS | 'none' | { windowMs: number; maxRequests: number };
    requireAuth?: boolean;
    requireAdmin?: boolean;
    maxRequestSize?: number;
  } = {}
): Promise<T | NextResponse> {
  const {
    rateLimit = 'public',
    requireAuth: requireAuthFlag = false,
    requireAdmin: requireAdminFlag = false,
    maxRequestSize = REQUEST_SIZE_LIMITS.json,
  } = options;
  
  // Check request size
  const sizeCheck = await checkRequestSize(request, maxRequestSize);
  if (!sizeCheck.allowed && sizeCheck.error) {
    return NextResponse.json(
      JSON.parse(await sizeCheck.error.text()),
      { status: sizeCheck.error.status }
    );
  }
  
  // Get auth context
  const auth = await optionalAuth();
  
  // Apply rate limiting
  if (rateLimit !== 'none') {
    const config = typeof rateLimit === 'string' ? RATE_LIMITS[rateLimit] : rateLimit;
    const rateLimitCheck = await withRateLimit(config, auth.userId || undefined)(request);
    
    if (!rateLimitCheck.allowed && rateLimitCheck.response) {
      return NextResponse.json(
        JSON.parse(await rateLimitCheck.response.text()),
        {
          status: 429,
          headers: Object.fromEntries(rateLimitCheck.headers.entries()),
        }
      );
    }
  }
  
  // Check authentication requirements
  if (requireAdminFlag) {
    const { requireAdmin } = await import('./accessControl');
    // For API routes, use request cookies directly
    const adminCheck = await requireAdmin(request.cookies as any);
    if (!adminCheck.success) {
      const errorData = JSON.parse(await adminCheck.error.text());
      return NextResponse.json(
        errorData,
        { status: adminCheck.error.status }
      );
    }
    return handler(request, {
      userId: adminCheck.userId,
      accountId: adminCheck.accountId,
    });
  }
  
  if (requireAuthFlag) {
    const { requireAuth } = await import('./accessControl');
    // For API routes, use request cookies directly
    const authCheck = await requireAuth(request.cookies as any);
    if (!authCheck.success) {
      return NextResponse.json(
        JSON.parse(await authCheck.error.text()),
        { status: authCheck.error.status }
      );
    }
    return handler(request, {
      userId: authCheck.userId,
      accountId: authCheck.accountId,
    });
  }
  
  // No auth required
  return handler(request, {
    userId: auth.userId || undefined,
    accountId: auth.accountId || undefined,
  });
}

