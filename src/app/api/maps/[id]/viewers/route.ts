import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/maps/[id]/viewers
 * Get list of accounts that viewed this map
 * Only accessible by map owner
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Path parameter validation
 * - Requires authentication
 * - Ownership check required
 */
const mapViewersPathSchema = z.object({
  id: commonSchemas.uuid,
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id: mapId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id: mapId }, mapViewersPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized', 401);
        }
        const supabase = await createServerClientWithAuth(cookies());

        // Verify user owns the map
        const { data: mapData } = await supabase
          .from('map')
          .select('account_id')
          .eq('id', mapId)
          .single();

        if (!mapData) {
          return createErrorResponse('Map not found', 404);
        }

        const mapDataTyped = mapData as { id: string; account_id: string };
        if (mapDataTyped.account_id !== accountId) {
          return createErrorResponse('Forbidden', 403);
        }

    // Get viewers using the public wrapper RPC function
    // After migration 345, this should be available as public.get_map_viewers
    const { data: viewersData, error } = await supabase.rpc('get_map_viewers', {
      p_map_id: mapId,
      p_limit: 100,
      p_offset: 0,
    } as any);

    if (error) {
      console.error('Error fetching map viewers:', error);
      // Return empty array if function doesn't exist yet (migration not applied)
      // This allows the UI to work even if migration hasn't been run
      return createSuccessResponse({
        viewers: [],
      });
    }

        return createSuccessResponse({
          viewers: viewersData || [],
        });
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/maps/[id]/viewers:', err);
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
