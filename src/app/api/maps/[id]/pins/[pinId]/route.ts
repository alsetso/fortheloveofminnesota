import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getAccountIdForUser } from '@/lib/server/getAccountId';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { Database } from '@/types/supabase';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/maps/[id]/pins/[pinId]
 * Get a single pin (accessible if map is accessible)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication (RLS handles permissions)
 */
const mapPinPathSchema = z.object({
  id: commonSchemas.uuid,
  pinId: commonSchemas.uuid,
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pinId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id: mapId, pinId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id: mapId, pinId }, mapPinPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedMapId, pinId: validatedPinId } = pathValidation.data;
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

        // Fetch pin (RLS will handle permissions)
        const { data: pin, error } = await supabase
          .from('map_pins')
          .select('id, map_id, emoji, caption, image_url, video_url, lat, lng, created_at, updated_at')
          .eq('id', validatedPinId)
          .eq('map_id', validatedMapId)
          .single();

        if (error || !pin) {
          if (error?.code === 'PGRST116') {
            return createErrorResponse('Pin not found', 404);
          }
          return createErrorResponse('Failed to fetch pin', 500);
        }

        return createSuccessResponse(pin);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Map Pins API] Error:', error);
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
 * PUT /api/maps/[id]/pins/[pinId]
 * Update a pin (owner only)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 * - Ownership check required
 */
const updatePinSchema = z.object({
  emoji: z.string().max(10).optional().nullable(),
  caption: z.string().max(500).optional().nullable(),
  image_url: z.string().url().max(2000).optional().nullable(),
  video_url: z.string().url().max(2000).optional().nullable(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pinId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id: mapId, pinId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id: mapId, pinId }, mapPinPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedMapId, pinId: validatedPinId } = pathValidation.data;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());
        
        // Validate request body
        const validation = await validateRequestBody(req, updatePinSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;

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
          return createErrorResponse('Forbidden - only the map owner can update pins', 403);
        }

        // Verify pin exists and belongs to this map
        const { data: pin, error: pinError } = await supabase
          .from('map_pins')
          .select('id, map_id')
          .eq('id', validatedPinId)
          .eq('map_id', validatedMapId)
          .single();

        if (pinError || !pin) {
          return createErrorResponse('Pin not found', 404);
        }

        // Build update data
        const updateData: Partial<Database['public']['Tables']['map_pins']['Update']> = {};

        if (body.emoji !== undefined) {
          updateData.emoji = body.emoji?.trim() || null;
        }
        if (body.caption !== undefined) {
          updateData.caption = body.caption?.trim() || null;
        }
        if (body.image_url !== undefined) {
          updateData.image_url = body.image_url?.trim() || null;
        }
        if (body.video_url !== undefined) {
          updateData.video_url = body.video_url?.trim() || null;
        }
        if (body.lat !== undefined) {
          updateData.lat = body.lat;
        }
        if (body.lng !== undefined) {
          updateData.lng = body.lng;
        }

        // Update pin
        const { data: updatedPin, error: updateError } = await (supabase
          .from('map_pins') as any)
          .update(updateData)
          .eq('id', validatedPinId)
          .select('id, map_id, emoji, caption, image_url, video_url, lat, lng, created_at, updated_at')
          .single();

        if (updateError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Map Pins API] Error updating pin:', updateError);
          }
          return createErrorResponse('Failed to update pin', 500);
        }

        return createSuccessResponse(updatedPin);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Map Pins API] Error:', error);
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
 * DELETE /api/maps/[id]/pins/[pinId]
 * Delete a pin (owner only)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Path parameter validation
 * - Requires authentication
 * - Ownership check required
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pinId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id: mapId, pinId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id: mapId, pinId }, mapPinPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedMapId, pinId: validatedPinId } = pathValidation.data;
        
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
          return createErrorResponse('Forbidden - only the map owner can delete pins', 403);
        }

        // Verify pin exists and belongs to this map
        const { data: pin, error: pinError } = await supabase
          .from('map_pins')
          .select('id, map_id')
          .eq('id', validatedPinId)
          .eq('map_id', validatedMapId)
          .single();

        if (pinError || !pin) {
          return createErrorResponse('Pin not found', 404);
        }

        // Delete pin
        const { error: deleteError } = await supabase
          .from('map_pins')
          .delete()
          .eq('id', validatedPinId);

        if (deleteError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Map Pins API] Error deleting pin:', deleteError);
          }
          return createErrorResponse('Failed to delete pin', 500);
        }

        return createSuccessResponse({ success: true });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Map Pins API] Error:', error);
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

