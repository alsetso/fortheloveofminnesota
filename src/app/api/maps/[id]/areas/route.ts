import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/maps/[id]/areas
 * Get all areas for a map (accessible if map is accessible)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication (RLS handles permissions)
 */
const mapAreasPathSchema = z.object({
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
        const pathValidation = validatePathParams({ id: mapId }, mapAreasPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedMapId } = pathValidation.data;
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

        // Fetch areas (RLS will handle permissions)
        const { data: areas, error } = await supabase
          .from('map_areas')
          .select('id, map_id, name, description, geometry, created_at, updated_at')
          .eq('map_id', validatedMapId)
          .order('created_at', { ascending: false });

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Map Areas API] Error fetching areas:', error);
          }
          return createErrorResponse('Failed to fetch areas', 500);
        }

        return createSuccessResponse({ areas: areas || [] });
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
 * POST /api/maps/[id]/areas
 * Create a new area on a map (owner only)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 * - Ownership check required
 */
const createAreaSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  geometry: z.object({
    type: z.enum(['Polygon', 'MultiPolygon']),
    coordinates: z.array(z.unknown()),
  }),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id: mapId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id: mapId }, mapAreasPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedMapId } = pathValidation.data;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());
        
        // Validate request body
        const validation = await validateRequestBody(req, createAreaSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const {
          name,
          description,
          geometry,
        } = validation.data;

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
          return createErrorResponse('Forbidden - only the map owner can add areas', 403);
        }

        // Create area
        const insertData = {
          map_id: validatedMapId,
          name: name.trim(),
          description: description?.trim() || null,
          geometry,
        };

        const { data: area, error: insertError } = await supabase
          .from('map_areas')
          .insert(insertData as any)
          .select()
          .single();

        if (insertError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Map Areas API] Error creating area:', insertError);
          }
          return createErrorResponse('Failed to create area', 500);
        }

        return createSuccessResponse(area, 201);
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


