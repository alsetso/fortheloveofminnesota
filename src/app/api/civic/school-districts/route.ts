import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/civic/school-districts
 * School district boundaries from layers.school_districts (328 districts).
 *
 * - id: single record (UUID)
 * - sd_number: district by number
 * - limit + offset: paginated list; response is { data, total }
 * - limit only (no offset): legacy list, returns array
 */
const querySchema = z.object({
  id: commonSchemas.uuid.optional(),
  sd_number: z.string().max(10).optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, querySchema);
        if (!validation.success) {
          return validation.error;
        }

        const { id, sd_number, limit, offset } = validation.data;

        const { createSupabaseClient } = await import('@/lib/supabase/unified');
        const supabase = await createSupabaseClient();

        // Single record by id
        if (id) {
          const { data, error } = await supabase.rpc('get_school_districts', {
            p_id: id,
            p_sd_number: null,
            p_limit: 1,
          });
          if (error) {
            if (process.env.NODE_ENV === 'development') console.error('[SchoolDistricts API] Error:', error);
            return NextResponse.json({ error: 'Failed to fetch school district' }, { status: 500 });
          }
          return NextResponse.json(
            Array.isArray(data) && data.length > 0 ? data[0] : null
          );
        }

        // All attendance areas for a specific district
        if (sd_number) {
          const { data, error } = await supabase.rpc('get_school_districts', {
            p_id: null,
            p_sd_number: sd_number,
            p_limit: limit ?? 100,
          });
          if (error) {
            if (process.env.NODE_ENV === 'development') console.error('[SchoolDistricts API] Error:', error);
            return NextResponse.json({ error: 'Failed to fetch school districts' }, { status: 500 });
          }
          return NextResponse.json(data ?? []);
        }

        // Paginated list (returns { data, total })
        if (offset !== undefined || (limit && limit <= 500)) {
          const pageLimit = Math.min(limit ?? 100, 500);
          const pageOffset = offset ?? 0;
          const [countRes, dataRes] = await Promise.all([
            supabase.rpc('get_school_districts_count'),
            supabase.rpc('get_school_districts_paginated', {
              p_limit: pageLimit,
              p_offset: pageOffset,
            }),
          ]);
          if (countRes.error || dataRes.error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('[SchoolDistricts API] paginated Error:', countRes.error ?? dataRes.error);
            }
            return NextResponse.json({ error: 'Failed to fetch school districts' }, { status: 500 });
          }
          const total = typeof countRes.data === 'number' ? countRes.data : Number(countRes.data ?? 0);
          return NextResponse.json({
            data: dataRes.data ?? [],
            total,
          });
        }

        // Legacy: plain list
        const { data, error } = await supabase.rpc('get_school_districts', {
          p_id: null,
          p_sd_number: null,
          p_limit: limit ?? 1000,
        });
        if (error) {
          if (process.env.NODE_ENV === 'development') console.error('[SchoolDistricts API] Error:', error);
          return NextResponse.json({ error: 'Failed to fetch school districts' }, { status: 500 });
        }
        return NextResponse.json(data ?? []);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') console.error('[SchoolDistricts API] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    {
      rateLimit: 'public',
      requireAuth: false,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
