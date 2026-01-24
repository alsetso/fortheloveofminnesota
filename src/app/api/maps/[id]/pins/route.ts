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
 * GET /api/maps/[id]/pins
 * List pins on a map (supports both UUID and custom_slug)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Path parameter validation
 * - Optional authentication (RLS handles permissions)
 */
const mapIdPathSchema = z.object({
  id: z.string().min(1).max(200), // Accept both UUID and slug
});

// Helper to check if string is a valid UUID
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
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id }, mapIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        
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

        // Fetch pins (RLS will filter based on permissions)
        const { data: pins, error } = await supabase
          .from('map_pins')
          .select('*')
          .eq('map_id', mapId)
          .order('created_at', { ascending: false });

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error fetching pins:', error);
          }
          return createErrorResponse('Failed to fetch pins', 500);
        }

        return createSuccessResponse({ pins: pins || [] });
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
 * POST /api/maps/[id]/pins
 * Create a pin on a map
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 * - Ownership/access check required
 */
const createPinSchema = z.object({
  emoji: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  video_url: z.string().url().nullable().optional(),
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
        const { id } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id }, mapIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: identifier } = pathValidation.data;
        
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized - authentication required', 401);
        }

        const supabase = await createServerClientWithAuth(cookies());
        
        // Resolve identifier to map_id (handle both UUID and slug)
        let mapId: string;
        let mapQuery = supabase
          .from('map')
          .select('id, account_id, visibility');
        
        if (isUUID(identifier)) {
          mapQuery = mapQuery.eq('id', identifier);
        } else {
          mapQuery = mapQuery.eq('custom_slug', identifier);
        }
        
        const { data: map, error: mapError } = await mapQuery.single();

        if (mapError || !map) {
          return createErrorResponse('Map not found', 404);
        }

        // Check access: owner or public map
        const isOwner = (map as any).account_id === accountId;
        if (!isOwner && (map as any).visibility !== 'public') {
          return createErrorResponse('Forbidden - you do not have access to this map', 403);
        }
        
        // Validate request body
        const validation = await validateRequestBody(req, createPinSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const body = validation.data;

        // Create pin
        const { data: pin, error: pinError } = await supabase
          .from('map_pins')
          .insert({
            map_id: (map as any).id,
            emoji: body.emoji || null,
            caption: body.caption || null,
            image_url: body.image_url || null,
            video_url: body.video_url || null,
            lat: body.lat,
            lng: body.lng,
          } as any)
          .select()
          .single();

        if (pinError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Maps API] Error creating pin:', pinError);
          }
          return createErrorResponse('Failed to create pin', 500);
        }

        return createSuccessResponse(pin, 201);
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
