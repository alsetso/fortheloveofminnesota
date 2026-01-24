import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams, validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/maps/[id]/pins/[pinId]
 * Get a single pin (supports both UUID and custom_slug for map)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication (RLS handles permissions)
 */
const pinPathSchema = z.object({
  id: z.string().min(1).max(200), // Accept both UUID and slug
  pinId: commonSchemas.uuid,
});

// Helper to check if string is a valid UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pinId: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id, pinId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id, pinId }, pinPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier, pinId: validatedPinId } = pathValidation.data;
        
        const { createServerClient } = await import('@/lib/supabaseServer');
        const { getServerAuth } = await import('@/lib/authServer');
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
          mapId = (map as any).id;
        }

        // Fetch pin (RLS will filter based on permissions)
        const { data: pin, error } = await supabase
          .from('map_pins')
          .select('*')
          .eq('id', validatedPinId)
          .eq('map_id', mapId)
          .single();

        if (error || !pin) {
          return createErrorResponse('Pin not found', 404);
        }

        return createSuccessResponse(pin);
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
 * PUT /api/maps/[id]/pins/[pinId]
 * Update a pin (map owner only)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 * - Ownership check required
 */
const updatePinSchema = z.object({
  emoji: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  video_url: z.string().url().nullable().optional(),
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
        const { id, pinId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id, pinId }, pinPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier, pinId: validatedPinId } = pathValidation.data;
        
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
          mapId = (map as any).id;
        }
        
        // Check if pin exists
        const { data: pin, error: pinError } = await supabase
          .from('map_pins')
          .select('map_id')
          .eq('id', validatedPinId)
          .eq('map_id', mapId)
          .single();

        if (pinError || !pin) {
          return createErrorResponse('Pin not found', 404);
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
        const validation = await validateRequestBody(req, updatePinSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;

        // Build update data
        const updateData: any = {};
        if (body.emoji !== undefined) updateData.emoji = body.emoji;
        if (body.caption !== undefined) updateData.caption = body.caption;
        if (body.image_url !== undefined) updateData.image_url = body.image_url;
        if (body.video_url !== undefined) updateData.video_url = body.video_url;
        if (body.lat !== undefined) updateData.lat = body.lat;
        if (body.lng !== undefined) updateData.lng = body.lng;

        // Update pin
        const { data: updatedPin, error: updateError } = await supabase
          .from('map_pins')
          .update(updateData as never)
          .eq('id', validatedPinId)
          .select()
          .single();

        if (updateError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error updating pin:', updateError);
          }
          return createErrorResponse('Failed to update pin', 500);
        }

        return createSuccessResponse(updatedPin);
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
 * DELETE /api/maps/[id]/pins/[pinId]
 * Delete a pin (map owner only)
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
        const { id, pinId } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id, pinId }, pinPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId, pinId: validatedPinId } = pathValidation.data;
        
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

        // Check if pin exists
        const { data: pin, error: pinError } = await supabase
          .from('map_pins')
          .select('map_id')
          .eq('id', validatedPinId)
          .eq('map_id', mapId)
          .single();

        if (pinError || !pin) {
          return createErrorResponse('Pin not found', 404);
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

        // Delete pin
        const { error: deleteError } = await supabase
          .from('map_pins')
          .delete()
          .eq('id', validatedPinId);

        if (deleteError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error deleting pin:', deleteError);
          }
          return createErrorResponse('Failed to delete pin', 500);
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
