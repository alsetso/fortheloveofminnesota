import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.string().regex(/^\d+$/).optional().transform((val) => val ? parseInt(val, 10) : 10),
});

/**
 * GET /api/search
 * Search for cities and towns
 * 
 * Returns:
 * - cities: Array of cities/towns matching the search query (by feature_name, county_name)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Optional authentication (RLS handles permissions)
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        const validation = validateQueryParams(searchParams, searchQuerySchema);
        
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid query parameters' },
            { status: 400 }
          );
        }

        const { q, limit = 20 } = validation.data;
        const query = q.trim();
        
        if (!query || query.length < 2) {
          return NextResponse.json({
            cities: [],
          });
        }

        const auth = await getServerAuth();
        const supabase = auth 
          ? await createServerClientWithAuth()
          : createServerClient();

        // Escape special characters for ILIKE
        const qEscaped = query
          .replaceAll('\\', '\\\\')
          .replaceAll('%', '\\%')
          .replaceAll('_', '\\_');
        const pattern = `%${qEscaped}%`;

        // Search cities and towns from layers schema
        // Search by feature_name or county_name
        const { data: cities, error: citiesError } = await (supabase as any)
          .schema('layers')
          .from('cities_and_towns')
          .select('id, ctu_class, feature_name, county_name, county_code, population, geometry')
          .or(`feature_name.ilike.${pattern},county_name.ilike.${pattern}`)
          .order('ctu_class', { ascending: true })
          .order('feature_name', { ascending: true })
          .limit(limit);

        if (citiesError) {
          console.error('[Search API] Error searching cities:', citiesError);
        }

        return NextResponse.json({
          cities: cities || [],
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Search API] Error:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: false,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
