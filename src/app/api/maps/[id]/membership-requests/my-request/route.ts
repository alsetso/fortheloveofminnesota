import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * GET /api/maps/[id]/membership-requests/my-request
 * Get current user's pending membership request for a map
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Users can only view their own requests
 */
const mapIdPathSchema = z.object({
  id: z.string().min(1).max(200),
});

function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const pathValidation = validatePathParams({ id }, mapIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        const supabase = await createServerClientWithAuth(cookies());

        // Resolve identifier to map_id
        let mapQuery = supabase
          .from('map')
          .select('id');
        
        if (isUUID(identifier)) {
          mapQuery = mapQuery.eq('id', identifier);
        } else {
          mapQuery = mapQuery.eq('slug', identifier);
        }

        const { data: map } = await mapQuery.single();
        if (!map) {
          return createErrorResponse('Map not found', 404);
        }

        const mapId = (map as any).id;

        // Get user's pending request
        const { data: request, error } = await supabase
          .from('map_membership_requests')
          .select('id, status, created_at')
          .eq('map_id', mapId)
          .eq('account_id', accountId)
          .eq('status', 'pending')
          .maybeSingle();

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error fetching user request:', error);
          }
          return createErrorResponse('Failed to fetch request', 500);
        }

        return createSuccessResponse({ request: request || null });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Maps API] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

/**
 * DELETE /api/maps/[id]/membership-requests/my-request
 * Revoke current user's pending membership request
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Users can only revoke their own requests
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const pathValidation = validatePathParams({ id }, mapIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        const supabase = await createServerClientWithAuth(cookies());

        // Resolve identifier to map_id
        let mapQuery = supabase
          .from('map')
          .select('id');
        
        if (isUUID(identifier)) {
          mapQuery = mapQuery.eq('id', identifier);
        } else {
          mapQuery = mapQuery.eq('slug', identifier);
        }

        const { data: map } = await mapQuery.single();
        if (!map) {
          return createErrorResponse('Map not found', 404);
        }

        const mapId = (map as any).id;

        // Get user's pending request
        const { data: userRequest } = await supabase
          .from('map_membership_requests')
          .select('id, status')
          .eq('map_id', mapId)
          .eq('account_id', accountId)
          .eq('status', 'pending')
          .maybeSingle();

        if (!userRequest) {
          return createErrorResponse('No pending request found', 404);
        }

        // Delete the request (user can revoke their own request)
        const requestId = (userRequest as { id: string; status: string }).id;
        const { error } = await supabase
          .from('map_membership_requests')
          .delete()
          .eq('id', requestId);

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error revoking request:', error);
          }
          return createErrorResponse('Failed to revoke request', 500);
        }

        return createSuccessResponse({ success: true });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Maps API] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
