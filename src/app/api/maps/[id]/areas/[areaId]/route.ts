import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/maps/[id]/areas/[areaId]
 * Get a single area (supports both UUID and custom_slug for map)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication (RLS handles permissions)
 */
const areaPathSchema = z.object({
  id: z.string().min(1).max(200), // Accept both UUID and slug
  areaId: commonSchemas.uuid,
});

// Helper to check if string is a valid UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id, areaId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id, areaId }, areaPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier, areaId: validatedAreaId } = pathValidation.data;
        
        const auth = await getServerAuth();
        const supabase = auth 
          ? await createServerClientWithAuth(cookies())
          : createServerClient();

        // Resolve identifier to map_id (handle both UUID and slug)
        let mapId: string;
        if (isUUID(identifier)) {
          mapId = identifier;
        } else {
          // Look up map by custom_slug
          const { data: map, error: mapError } = await supabase
            .from('map')
            .select('id')
            .eq('custom_slug', identifier)
            .single();
          
          if (mapError || !map) {
            return createErrorResponse('Map not found', 404);
          }
          mapId = map.id;
        }

        // Fetch area (RLS will filter based on permissions)
        const { data: area, error } = await supabase
          .from('map_areas')
          .select('*')
          .eq('id', validatedAreaId)
          .eq('map_id', mapId)
          .single();

        if (error || !area) {
          return createErrorResponse('Area not found', 404);
        }

        return createSuccessResponse(area as any);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Maps API] Error:', error);
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
 * PUT /api/maps/[id]/areas/[areaId]
 * Update an area (map owner only)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 * - Ownership check required
 */
const updateAreaSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  geometry: z.object({
    type: z.enum(['Polygon', 'MultiPolygon']),
    coordinates: z.array(z.any()),
  }).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id, areaId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id, areaId }, areaPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier, areaId: validatedAreaId } = pathValidation.data;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());
        
        // Resolve identifier to map_id (handle both UUID and slug)
        let mapId: string;
        if (isUUID(identifier)) {
          mapId = identifier;
        } else {
          // Look up map by custom_slug
          const { data: map, error: mapError } = await supabase
            .from('map')
            .select('id')
            .eq('custom_slug', identifier)
            .single();
          
          if (mapError || !map) {
            return createErrorResponse('Map not found', 404);
          }
          mapId = map.id;
        }
        
        // Check if area exists
        const { data: area, error: areaError } = await supabase
          .from('map_areas')
          .select('map_id')
          .eq('id', validatedAreaId)
          .eq('map_id', mapId)
          .single();

        if (areaError || !area) {
          return createErrorResponse('Area not found', 404);
        }

        // Check if user owns the map
        const { data: map, error: mapError } = await supabase
          .from('map')
          .select('account_id')
          .eq('id', mapId)
          .single();

        if (mapError || !map) {
          return createErrorResponse('Map not found', 404);
        }

        if ((map as any).account_id !== accountId) {
          return createErrorResponse('Forbidden - you do not own this map', 403);
        }
        
        // Validate request body
        const validation = await validateRequestBody(req, updateAreaSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;

        // Build update data
        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name.trim();
        if (body.description !== undefined) updateData.description = body.description?.trim() || null;
        if (body.geometry !== undefined) updateData.geometry = body.geometry;

        // Update area
        const { data: updatedArea, error: updateError } = await supabase
          .from('map_areas')
          .update(updateData as any)
          .eq('id', validatedAreaId)
          .select()
          .single();

        if (updateError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error updating area:', updateError);
          }
          return createErrorResponse('Failed to update area', 500);
        }

        return createSuccessResponse(updatedArea);
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
 * DELETE /api/maps/[id]/areas/[areaId]
 * Delete an area (map owner only)
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
        const { id, areaId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id, areaId }, areaPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId, areaId: validatedAreaId } = pathValidation.data;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());

        // Resolve identifier to map_id (handle both UUID and slug)
        let mapId: string;
        if (isUUID(validatedId)) {
          mapId = validatedId;
        } else {
          // Look up map by custom_slug
          const { data: mapLookup, error: mapLookupError } = await supabase
            .from('map')
            .select('id')
            .eq('custom_slug', validatedId)
            .single();
          
          if (mapLookupError || !mapLookup) {
            return createErrorResponse('Map not found', 404);
          }
          mapId = (mapLookup as any).id;
        }

        // Check if area exists
        const { data: area, error: areaError } = await supabase
          .from('map_areas')
          .select('map_id')
          .eq('id', validatedAreaId)
          .eq('map_id', mapId)
          .single();

        if (areaError || !area) {
          return createErrorResponse('Area not found', 404);
        }

        // Check if user owns the map
        const { data: map, error: mapError } = await supabase
          .from('map')
          .select('account_id')
          .eq('id', mapId)
          .single();

        if (mapError || !map) {
          return createErrorResponse('Map not found', 404);
        }

        if ((map as any).account_id !== accountId) {
          return createErrorResponse('Forbidden - you do not own this map', 403);
        }

        // Delete area
        const { error: deleteError } = await supabase
          .from('map_areas')
          .delete()
          .eq('id', validatedAreaId);

        if (deleteError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error deleting area:', deleteError);
          }
          return createErrorResponse('Failed to delete area', 500);
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
