import { NextRequest, NextResponse } from 'next/server';
import { getVisibleAtlasTypes } from '@/features/atlas/services/atlasTypesService';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

export const revalidate = 3600;

/**
 * GET /api/atlas/types
 * Get all visible atlas types
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Public endpoint - no authentication required
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async () => {
      try {
        const types = await getVisibleAtlasTypes();
        return NextResponse.json({ types });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[AtlasTypesAPI] Error:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public',
      requireAuth: false,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

