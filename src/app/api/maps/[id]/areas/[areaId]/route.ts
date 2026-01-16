import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/maps/[id]/areas/[areaId]
 * Get a single area (accessible if map is accessible)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication (RLS handles permissions)
 */
const mapAreaPathSchema = z.object({
  id: commonSchemas.uuid,
  areaId: commonSchemas.uuid,
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id: mapId, areaId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id: mapId, areaId }, mapAreaPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedMapId, areaId: validatedAreaId } = pathValidation.data;
        const auth = await getServerAuth();
        const supabase = auth 
          ? await createServerClientWithAuth(cookies())
          : createServerClient();

        // Verify map exists (RLS will handle access permissions)
        const { data: map, error: mapError } = await supabase
          .from('map')
          .select('id, account_id, visibility')
          .eq('id', validatedMapId)
          .single();

        if (mapError || !map) {
          if (mapError?.code === 'PGRST116' || mapError?.message?.includes('row-level security')) {
            return createErrorResponse('You do not have access to this map', 403);
          }
          return createErrorResponse('Map not found', 404);
        }

        // Fetch area (RLS will handle permissions)
        const { data: area, error } = await supabase
          .from('map_areas')
          .select('id, map_id, name, description, geometry, created_at, updated_at')
          .eq('id', validatedAreaId)
          .eq('map_id', validatedMapId)
          .single();

        if (error || !area) {
          if (error?.code === 'PGRST116') {
            return createErrorResponse('Area not found', 404);
          }
          return createErrorResponse('Failed to fetch area', 500);
        }

        return createSuccessResponse(area);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Map Areas API] Error:', error);
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

/**
 * DELETE /api/maps/[id]/areas/[areaId]
 * Delete an area (owner only)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Path parameter validation
 * - Requires authentication
 * - Ownership check required
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id: mapId, areaId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id: mapId, areaId }, mapAreaPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedMapId, areaId: validatedAreaId } = pathValidation.data;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());

        // Verify map exists and user owns it
        const { data: map, error: mapError } = await supabase
          .from('map')
          .select('id, account_id')
          .eq('id', validatedMapId)
          .single();

        if (mapError || !map) {
          return createErrorResponse('Map not found', 404);
        }

        // Verify user owns the map
        const mapData = map as { id: string; account_id: string };
        if (mapData.account_id !== accountId) {
          return createErrorResponse('Forbidden - only the map owner can delete areas', 403);
        }

        // Verify area exists and belongs to this map
        const { data: area, error: areaError } = await supabase
          .from('map_areas')
          .select('id, map_id')
          .eq('id', validatedAreaId)
          .eq('map_id', validatedMapId)
          .single();

        if (areaError || !area) {
          return createErrorResponse('Area not found', 404);
        }

        // Delete area
        const { error: deleteError } = await supabase
          .from('map_areas')
          .delete()
          .eq('id', validatedAreaId);

        if (deleteError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Map Areas API] Error deleting area:', deleteError);
          }
          return createErrorResponse('Failed to delete area', 500);
        }

        return createSuccessResponse({ success: true });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Map Areas API] Error:', error);
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


