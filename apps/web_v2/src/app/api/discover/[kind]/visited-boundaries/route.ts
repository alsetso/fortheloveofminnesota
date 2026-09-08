import { NextResponse } from 'next/server';
import { passportKindBySlug } from '@/features/accountTerritories/store/passportKinds';
import {
  districtOutlinesToFeatureCollection,
  rowsToFeatureCollection,
} from '@/features/map/territory/geojson';
import { getTerritoryLayer } from '@/features/map/territory/territoryLayers';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

const ID_CHUNK = 200;

/**
 * GET /api/discover/[kind]/visited-boundaries
 * GeoJSON of the signed-in account's stamped units for this territory type.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  try {
    const { kind: kindParam } = await params;
    const def = passportKindBySlug(kindParam);
    if (!def) {
      return NextResponse.json({ error: 'Unknown territory type' }, { status: 404 });
    }

    const config = getTerritoryLayer(def.slug);
    if (!config) {
      return NextResponse.json({ error: 'Unknown territory type' }, { status: 404 });
    }

    const session = await getSessionAccount().catch(() => null);
    if (!session) {
      return NextResponse.json({
        type: 'FeatureCollection',
        features: [],
        meta: { visitedTotal: 0, label: def.label, unitKind: def.unitKind },
      });
    }

    const supabase = await createSupabaseServerClient();
    const { data: presence, error: presenceError } = await supabase
      .from('account_territory_presence')
      .select('unit_id')
      .eq('account_id', session.accountId)
      .eq('unit_kind', config.entityKind);

    if (presenceError) throw presenceError;

    const ids = [
      ...new Set(
        (presence ?? [])
          .map((r) => (r.unit_id ? String(r.unit_id) : ''))
          .filter(Boolean),
      ),
    ];

    if (ids.length === 0) {
      return NextResponse.json({
        type: 'FeatureCollection',
        features: [],
        meta: { visitedTotal: 0, label: def.label, unitKind: def.unitKind },
      });
    }

    const db = createTerritoryServerClient();
    const rows: Record<string, unknown>[] = [];

    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const chunk = ids.slice(i, i + ID_CHUNK);
      const { data, error } = await db
        .from(config.table)
        .select(config.boundarySelect)
        .in('id', chunk);
      if (error) throw error;
      for (const row of data ?? []) {
        rows.push(row as unknown as Record<string, unknown>);
      }
    }

    const fc =
      def.slug === 'districts'
        ? districtOutlinesToFeatureCollection(rows)
        : rowsToFeatureCollection(config, rows);

    return NextResponse.json({
      ...fc,
      meta: {
        visitedTotal: fc.features.length,
        label: def.label,
        unitKind: def.unitKind,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[discover visited-boundaries]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
