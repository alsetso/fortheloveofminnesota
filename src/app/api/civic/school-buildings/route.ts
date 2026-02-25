import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/civic/school-buildings
 *
 *   ?school_district_id=UUID  → buildings within a district
 *   ?id=UUID                  → single building
 */

const querySchema = z.object({
  id: commonSchemas.uuid.optional(),
  school_district_id: commonSchemas.uuid.optional(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, querySchema);
        if (!validation.success) return validation.error;

        const { id, school_district_id } = validation.data;

        const { createSupabaseClient } = await import('@/lib/supabase/unified');
        const supabase = await createSupabaseClient();

        if (school_district_id) {
          const { data, error } = await (supabase as any).rpc('get_school_buildings_by_district', {
            p_district_id: school_district_id,
          });

          if (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('[School Buildings API] Error:', error);
            }
            return NextResponse.json({ error: 'Failed to fetch school buildings' }, { status: 500 });
          }

          return NextResponse.json(data || []);
        }

        // Single building by id — also fetch linked atlas school profile
        if (id) {
          const [buildingRes, atlasRes] = await Promise.all([
            (supabase as any).rpc('get_school_building_by_id', { p_id: id }),
            (supabase as any).rpc('get_atlas_school_by_building_id', { p_building_id: id }),
          ]);

          if (buildingRes.error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('[School Buildings API] Error:', buildingRes.error);
            }
            return NextResponse.json({ error: 'Failed to fetch school building' }, { status: 500 });
          }

          const building = Array.isArray(buildingRes.data) && (buildingRes.data as unknown[]).length > 0
            ? (buildingRes.data as unknown[])[0]
            : null;

          if (building) {
            const atlas = Array.isArray(atlasRes.data) && (atlasRes.data as unknown[]).length > 0
              ? (atlasRes.data as unknown[])[0]
              : null;
            if (atlas && typeof atlas === 'object' && atlas !== null && 'slug' in atlas && 'id' in atlas) {
              (building as Record<string, unknown>).atlas_school_slug = (atlas as { slug: string }).slug;
              (building as Record<string, unknown>).atlas_school_id = (atlas as { id: string }).id;
            }
          }

          return NextResponse.json(building);
        }

        return NextResponse.json([]);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[School Buildings API] Error:', err);
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { rateLimit: 'public', requireAuth: false }
  );
}
