import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/atlas/[table]
 *
 * Generic endpoint for any atlas schema table.
 *   ?id=UUID          → single record by id
 *   ?slug=SLUG        → single record by slug
 *   ?limit=N&offset=N → paginated list
 *   ?search=TEXT      → name filter (ILIKE)
 */

const ALLOWED_TABLES = new Set([
  'schools',
  'parks',
  'hospitals',
  'churches',
  'airports',
  'cemeteries',
  'golf_courses',
  'watertowers',
  'neighborhoods',
  'municipals',
  'roads',
  'radio_and_news',
  'lakes',
]);

const querySchema = z.object({
  id: commonSchemas.uuid.optional(),
  slug: z.string().max(300).optional(),
  limit: z.coerce.number().int().positive().max(1500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  search: z.string().max(200).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;

  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: 'Unknown atlas table' }, { status: 404 });
  }

  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, querySchema);
        if (!validation.success) return validation.error;

        const { id, slug, limit = 100, offset = 0, search } = validation.data;

        const { createSupabaseClient } = await import('@/lib/supabase/unified');
        const supabase = await createSupabaseClient();

        const { data, error } = await (supabase as any).rpc('get_atlas_records', {
          p_table: table,
          p_id: id ?? null,
          p_slug: slug ?? null,
          p_limit: limit,
          p_offset: offset,
          p_search: search ?? null,
        });

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[Atlas ${table} API] Error:`, error);
          }
          return NextResponse.json(
            { error: `Failed to fetch atlas ${table}` },
            { status: 500 }
          );
        }

        // Single-record lookups return the record directly (or null)
        if (id || slug) {
          return NextResponse.json(data);
        }

        // Paginated list: { data, total, limit, offset }
        return NextResponse.json(data);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`[Atlas ${table} API] Error:`, err);
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { rateLimit: 'public', requireAuth: false }
  );
}
