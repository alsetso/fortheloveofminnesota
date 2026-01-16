import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/civic/events
 * Get civic events
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query parameter validation
 * - Public endpoint - no authentication required
 */
const civicEventsQuerySchema = z.object({
  building_id: commonSchemas.uuid.optional(),
  upcoming: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, civicEventsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { building_id: buildingId, upcoming } = validation.data;

    const supabase = createServerClient();
    
    let query = (supabase as any)
      .from('events')
      .select('*')
      .order('start_date', { ascending: true });

    if (buildingId) {
      query = query.eq('building_id', buildingId);
    }

        if (upcoming) {
          const now = new Date().toISOString();
          query = query.gte('start_date', now);
        }

        const { data, error } = await query;

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Civic Events API] Error fetching:', error);
          }
          return NextResponse.json(
            { error: 'Failed to fetch events' },
            { status: 500 }
          );
        }

        return NextResponse.json(data || []);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Civic Events API] Error:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public',
      requireAuth: false,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

