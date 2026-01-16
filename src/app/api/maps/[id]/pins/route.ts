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
 * GET /api/maps/[id]/pins
 * Get all pins for a map (accessible if map is accessible)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication (RLS handles permissions)
 */
const mapPinsPathSchema = z.object({
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
        const pathValidation = validatePathParams({ id: mapId }, mapPinsPathSchema);
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
          // RLS will return error if user doesn't have access
          if (mapError?.code === 'PGRST116' || mapError?.message?.includes('row-level security')) {
            return createErrorResponse('You do not have access to this map', 403);
          }
          return createErrorResponse('Map not found', 404);
        }

        // Fetch pins (RLS will handle permissions)
        const { data: pins, error } = await supabase
          .from('map_pins')
          .select('id, map_id, emoji, caption, image_url, video_url, lat, lng, created_at, updated_at')
          .eq('map_id', validatedMapId)
          .order('created_at', { ascending: false });

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Map Pins API] Error fetching pins:', error);
          }
          return createErrorResponse('Failed to fetch pins', 500);
        }

        return createSuccessResponse({ pins: pins || [] });
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
 * POST /api/maps/[id]/pins
 * Create a new pin on a map (owner only)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 * - Ownership check required
 */
const createPinSchema = z.object({
  emoji: z.string().max(10).optional().nullable(),
  caption: z.string().max(500).optional().nullable(),
  image_url: z.string().url().max(2000).optional().nullable(),
  video_url: z.string().url().max(2000).optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
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
        const pathValidation = validatePathParams({ id: mapId }, mapPinsPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedMapId } = pathValidation.data;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());
        
        // Validate request body
        const validation = await validateRequestBody(req, createPinSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const {
          emoji,
          caption,
          image_url,
          video_url,
          lat,
          lng,
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
          return createErrorResponse('Forbidden - only the map owner can add pins', 403);
        }

        // Create pin
        const insertData = {
          map_id: validatedMapId,
          emoji: emoji?.trim() || null,
          caption: caption?.trim() || null,
          image_url: image_url?.trim() || null,
          video_url: video_url?.trim() || null,
          lat,
          lng,
        };

        const { data: pin, error: insertError } = await supabase
          .from('map_pins')
          .insert(insertData as any)
          .select('id, map_id, emoji, caption, image_url, video_url, lat, lng, created_at, updated_at')
          .single();

        if (insertError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Map Pins API] Error creating pin:', insertError);
          }
          return createErrorResponse('Failed to create pin', 500);
        }

        return createSuccessResponse(pin, 201);
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

