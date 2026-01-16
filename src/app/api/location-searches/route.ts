import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

const locationSearchSchema = z.object({
  place_name: z.string().min(1).max(500),
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  mapbox_data: z.record(z.string(), z.unknown()),
  search_query: z.string().max(500).optional().nullable(),
  page_source: z.string().max(100).default('map'),
});

/**
 * POST /api/location-searches
 * Save a location search (simple, non-blocking operation)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires authentication
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        if (!userId || !accountId) {
          return createErrorResponse('Unauthorized', 401);
        }

        const cookieStore = await cookies();
        
        // Validate request body
        const validation = await validateRequestBody(req, locationSearchSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { place_name, coordinates, mapbox_data, search_query, page_source } = validation.data;
        
        const supabase = createServerClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll();
              },
              setAll() {
                // Route handlers can set cookies, but this endpoint doesn't need to
              },
            },
          }
        );
        
        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          return createErrorResponse('Unauthorized', 401);
        }

        // Insert search record
        const { error: insertError } = await supabase
          .from('location_searches')
          .insert({
            user_id: user.id,
            account_id: accountId,
            place_name,
            lat: coordinates.lat,
            lng: coordinates.lng,
            mapbox_data,
            search_query: search_query || null,
            page_source: page_source || 'map',
          } as any);

        if (insertError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error saving location search:', insertError);
          }
          // Still return success to not block the UI, but log the error
          return createSuccessResponse({ success: false, error: insertError.message }, 201);
        }

        return createSuccessResponse({ success: true }, 201);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Location search API error:', error);
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

