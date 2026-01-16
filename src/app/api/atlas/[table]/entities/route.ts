import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { getAtlasTypeBySlug } from '@/features/atlas/services/atlasTypesService';
import { handleQueryError } from '@/lib/utils/errorHandling';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams, validatePathParams } from '@/lib/security/validation';
import { z } from 'zod';

export const revalidate = 3600;

/**
 * GET /api/atlas/[table]/entities
 * Get entities for an atlas table
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query and path parameter validation
 * - Public endpoint - no authentication required
 */
const atlasEntitiesQuerySchema = z.object({
  search: z.string().max(200).optional(),
  stats: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
});

const atlasEntitiesPathSchema = z.object({
  table: z.string().min(1).max(100),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const { table } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ table }, atlasEntitiesPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        // Validate query parameters
        const url = new URL(req.url);
        const queryValidation = validateQueryParams(url.searchParams, atlasEntitiesQuerySchema);
        if (!queryValidation.success) {
          return queryValidation.error;
        }
        
        const { search, stats: statsOnly } = queryValidation.data;

    // Validate table exists
    const atlasType = await getAtlasTypeBySlug(table);
    if (!atlasType) {
      return NextResponse.json(
        { error: 'Atlas type not found' },
        { status: 404 }
      );
    }

    const supabase = createServerClient();

    // Build query
    let query = (supabase as any)
      .schema('atlas')
      .from(table)
      .select('id, name, lat, lng, city_id');

    // Apply search filter if provided (by name only - city filtering happens after city names are fetched)
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      query = query.ilike('name', `%${searchTerm}%`);
    }

    // Execute query
    const result = await query.order('name', { ascending: true });
    const records = result.data || [];
    const error = result.error;

    const allRecords = handleQueryError(
      error,
      `AtlasEntitiesAPI: ${table}`,
      records as Array<{ id: string; name: string; lat: number | null; lng: number | null; city_id: string | null }>
    );

    // If stats only, return counts
    if (statsOnly) {
      const withCoords = allRecords.filter(r => r.lat && r.lng && !isNaN(parseFloat(String(r.lat))) && !isNaN(parseFloat(String(r.lng))));
      return NextResponse.json({
        total: allRecords.length,
        withCoords: withCoords.length,
      });
    }

    // Fetch city names for records with city_id
    const cityIds = [...new Set(allRecords.map(r => r.city_id).filter(Boolean))] as string[];
    const cityMap: Record<string, string> = {};
    
    if (cityIds.length > 0) {
      const cityResult = await (supabase as any)
        .schema('atlas')
        .from('cities')
        .select('id, name')
        .in('id', cityIds);
      
      const cities = handleQueryError(
        cityResult.error,
        `AtlasEntitiesAPI: cities for ${table}`,
        (cityResult.data || []) as Array<{ id: string; name: string }>
      );
      
      cities.forEach((city: { id: string; name: string }) => {
        cityMap[city.id] = city.name;
      });
    }

    // Add city names and filter to only records with coordinates
    let entities = allRecords
      .filter(r => r.lat && r.lng && !isNaN(parseFloat(String(r.lat))) && !isNaN(parseFloat(String(r.lng))))
      .map(record => ({
        id: record.id,
        name: record.name || '',
        city_name: record.city_id ? cityMap[record.city_id] || null : null,
        lat: parseFloat(String(record.lat)),
        lng: parseFloat(String(record.lng)),
      }));

    // Apply city name filtering if search was provided (after city names are added)
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      entities = entities.filter(entity => {
        const nameMatch = entity.name.toLowerCase().includes(searchTerm);
        const cityMatch = entity.city_name?.toLowerCase().includes(searchTerm);
        return nameMatch || cityMatch;
      });
    }

        return NextResponse.json({
          entities,
          total: allRecords.length,
          withCoords: entities.length,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[AtlasEntitiesAPI] Error:', error);
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

