import { NextRequest, NextResponse } from 'next/server';
import { getActiveMentionIcons } from '@/features/mentions/services/mentionIconsService';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

export const revalidate = 3600; // Revalidate every hour

/**
 * GET /api/mention-icons
 * Fetch all active mention icons for the icon selector
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Optional authentication
 */
export async function GET() {
  return withSecurity(
    {} as NextRequest,
    async () => {
      try {
        const icons = await getActiveMentionIcons();
        return createSuccessResponse(icons);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[MentionIcons API] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: false,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

