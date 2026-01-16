import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * GET /api/civic/buildings
 * Get civic buildings with optional bounding box filter
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query parameter validation
 * - Public endpoint - no authentication required
 */
const civicBuildingsQuerySchema = z.object({
  minLng: z.string().regex(/^-?\d+\.?\d*$/).transform(Number).pipe(z.number().min(-180).max(180)).optional(),
  maxLng: z.string().regex(/^-?\d+\.?\d*$/).transform(Number).pipe(z.number().min(-180).max(180)).optional(),
  minLat: z.string().regex(/^-?\d+\.?\d*$/).transform(Number).pipe(z.number().min(-90).max(90)).optional(),
  maxLat: z.string().regex(/^-?\d+\.?\d*$/).transform(Number).pipe(z.number().min(-90).max(90)).optional(),
}).refine(
  (data) => {
    // If any bounding box param is provided, all must be provided
    const hasAny = data.minLng !== undefined || data.maxLng !== undefined || data.minLat !== undefined || data.maxLat !== undefined;
    const hasAll = data.minLng !== undefined && data.maxLng !== undefined && data.minLat !== undefined && data.maxLat !== undefined;
    return !hasAny || hasAll;
  },
  { message: 'All bounding box parameters (minLng, maxLng, minLat, maxLat) must be provided together' }
);

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, civicBuildingsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { minLng, maxLng, minLat, maxLat } = validation.data;
    
    const supabase = createServerClient();
    
    let query = (supabase as any)
      .schema('civic')
      .from('buildings')
      .select('id, type, name, description, lat, lng, full_address, website, cover_images, created_at, updated_at');
    
        // Apply bounding box filter if provided (spatial query)
        if (minLng !== undefined && maxLng !== undefined && minLat !== undefined && maxLat !== undefined) {
          query = query
            .gte('lng', minLng)
            .lte('lng', maxLng)
            .gte('lat', minLat)
            .lte('lat', maxLat);
        }
        
        query = query.order('created_at', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Civic Buildings API] Error fetching:', error);
          }
          return NextResponse.json(
            { error: 'Failed to fetch buildings' },
            { status: 500 }
          );
        }
        
        return NextResponse.json(data || []);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Civic Buildings API] Error:', error);
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

