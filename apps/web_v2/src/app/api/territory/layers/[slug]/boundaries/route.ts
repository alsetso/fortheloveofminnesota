import { NextResponse } from 'next/server';
import { getTerritoryLayer } from '@/features/map/territory/territoryLayers';
import {
  districtOutlinesToFeatureCollection,
  rowsToFeatureCollection,
} from '@/features/map/territory/geojson';
import { fetchAllSupabaseRows } from '@/lib/supabase/fetchAllRows';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

const LEGISLATIVE_SEAT_TYPE: Record<string, string> = {
  'senate-districts': 'state_senator',
  'house-districts': 'state_representative',
};

/** unit_id → current officeholder full_name for legislative layers. */
async function officeholderNamesByUnitId(
  seatType: string,
): Promise<Map<string, string>> {
  const db = createTerritoryServerClient();
  const { data, error } = await db
    .from('officeholders')
    .select('full_name, seats!inner(unit_id, seat_type, is_active)')
    .eq('is_current', true)
    .eq('seats.is_active', true)
    .eq('seats.seat_type', seatType);

  const map = new Map<string, string>();
  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[territory officeholder labels ${seatType}]`, error);
    }
    return map;
  }

  for (const row of data ?? []) {
    const seats = row.seats as
      | { unit_id?: string; seat_type?: string; is_active?: boolean }
      | { unit_id?: string; seat_type?: string; is_active?: boolean }[]
      | null;
    const seat = Array.isArray(seats) ? seats[0] : seats;
    const unitId = seat?.unit_id != null ? String(seat.unit_id) : null;
    const name = typeof row.full_name === 'string' ? row.full_name.trim() : '';
    if (unitId && name) map.set(unitId, name);
  }
  return map;
}

/**
 * GET /api/territory/layers/[slug]/boundaries
 * Statewide simplified GeoJSON FeatureCollection from territory.*.
 * Districts: precomputed geometry_simplified outlines (precincts via /districts/[id]/parts).
 * Senate/house: properties include officeholder_name for map labels.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const config = getTerritoryLayer(slug);
    if (!config) {
      return NextResponse.json({ error: 'Unknown layer' }, { status: 404 });
    }

    const db = createTerritoryServerClient();
    // Paginate past Supabase's default 1000-row cap (CTUs are ~2693).
    let rows: Record<string, unknown>[];
    try {
      rows = await fetchAllSupabaseRows<Record<string, unknown>>(async (from, to) => {
        const { data, error } = await db
          .from(config.table)
          .select(config.boundarySelect)
          .order(config.nameColumn, { ascending: true })
          .range(from, to);
        return {
          data: (data ?? null) as Record<string, unknown>[] | null,
          error,
        };
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[territory boundaries ${slug}]`, error);
      }
      return NextResponse.json({ error: 'Failed to load boundaries' }, { status: 500 });
    }

    const seatType = LEGISLATIVE_SEAT_TYPE[slug];
    if (seatType) {
      const names = await officeholderNamesByUnitId(seatType);
      rows = rows.map((row) => {
        const id = row.id != null ? String(row.id) : '';
        const officeholder_name = id ? names.get(id) : undefined;
        return officeholder_name ? { ...row, officeholder_name } : row;
      });
    }

    const fc =
      slug === 'districts'
        ? districtOutlinesToFeatureCollection(rows)
        : rowsToFeatureCollection(config, rows);

    return NextResponse.json(fc, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory boundaries]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
