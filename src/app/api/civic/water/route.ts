import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/civic/water
 * Water bodies from layers.water (NHD). Minnesota only.
 *
 * - id: single record (UUID)
 * - bbox: minLng,minLat,maxLng,maxLat for map view (returns features in viewport)
 * - limit + offset: paginated list; response is { data, total }
 * - limit only (no offset): legacy list, returns array
 */
const waterQuerySchema = z.object({
  id: commonSchemas.uuid.optional(),
  limit: z.coerce.number().int().positive().max(10000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  bbox: z
    .string()
    .optional()
    .refine(
      (s) => {
        if (!s) return true;
        const parts = s.split(',');
        return parts.length === 4 && parts.every((p) => !Number.isNaN(Number(p)));
      },
      { message: 'bbox must be minLng,minLat,maxLng,maxLat' }
    ),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, waterQuerySchema);
        if (!validation.success) {
          return validation.error;
        }

        const { id, limit, offset, bbox } = validation.data;

        const { createSupabaseClient } = await import('@/lib/supabase/unified');
        const supabase = await createSupabaseClient();

        // Single record by id
        if (id) {
          const { data, error } = await (supabase as any).rpc('get_water', {
            p_id: id,
            p_limit: 1,
          });
          if (error) {
            if (process.env.NODE_ENV === 'development') console.error('[Water API] Error:', error);
            return NextResponse.json({ error: 'Failed to fetch water body' }, { status: 500 });
          }
          return NextResponse.json(
            Array.isArray(data) && data.length > 0 ? data[0] : null
          );
        }

        // Map view: bbox
        if (bbox) {
          const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
          const { data, error } = await (supabase as any).rpc('get_water_bbox', {
            p_min_lng: minLng,
            p_min_lat: minLat,
            p_max_lng: maxLng,
            p_max_lat: maxLat,
            p_limit: Math.min(limit ?? 2000, 2000),
          });
          if (error) {
            if (process.env.NODE_ENV === 'development') console.error('[Water API] bbox Error:', error);
            return NextResponse.json({ error: 'Failed to fetch water bodies' }, { status: 500 });
          }
          return NextResponse.json(data ?? []);
        }

        // List: paginated (returns { data, total })
        if (offset !== undefined || (limit && limit <= 500)) {
          const pageLimit = Math.min(limit ?? 100, 500);
          const pageOffset = offset ?? 0;
          const [countRes, dataRes] = await Promise.all([
            (supabase as any).rpc('get_water_count'),
            (supabase as any).rpc('get_water_paginated', {
              p_limit: pageLimit,
              p_offset: pageOffset,
            }),
          ]);
          if (countRes.error || dataRes.error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('[Water API] paginated Error:', countRes.error ?? dataRes.error);
            }
            return NextResponse.json({ error: 'Failed to fetch water bodies' }, { status: 500 });
          }
          const total = typeof countRes.data === 'number' ? countRes.data : Number(countRes.data ?? 0);
          return NextResponse.json({
            data: dataRes.data ?? [],
            total,
          });
        }

        // Legacy: plain list with limit
        const { data, error } = await (supabase as any).rpc('get_water', {
          p_id: null,
          p_limit: limit ?? 5000,
        });
        if (error) {
          if (process.env.NODE_ENV === 'development') console.error('[Water API] Error:', error);
          return NextResponse.json({ error: 'Failed to fetch water bodies' }, { status: 500 });
        }
        return NextResponse.json(data ?? []);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') console.error('[Water API] Error:', err);
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
