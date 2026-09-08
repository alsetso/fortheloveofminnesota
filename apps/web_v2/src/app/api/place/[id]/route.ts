import { NextResponse } from 'next/server';
import {
  placeKindLabel,
  unitKindToDockKind,
  type PlaceRecord,
} from '@/features/place/placeTypes';
import { normalizePolygonGeometry } from '@/features/map/territory/geojson';
import { isUuid } from '@/lib/ai/subjectTypes';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/place/[id]
 * Public territory unit record + optional viewer passport stamp.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId).trim();
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const db = createTerritoryServerClient();
    const { data: unit, error } = await db
      .from('units')
      .select('id, name, slug, kind, subtype, geometry_simplified')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!unit?.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const unitKind = String(unit.kind ?? '');
    const subtype =
      typeof unit.subtype === 'string' && unit.subtype.trim()
        ? unit.subtype.trim()
        : null;
    const dockKind = unitKindToDockKind(unitKind, subtype);
    const geometry = normalizePolygonGeometry(
      unit.geometry_simplified as Parameters<typeof normalizePolygonGeometry>[0],
    );

    let viewer: PlaceRecord['viewer'] = {
      visited: false,
      firstSeenAt: null,
      xpAmount: null,
    };

    const session = await getSessionAccount().catch(() => null);
    if (session) {
      const supabase = await createSupabaseServerClient();
      const { data: presence } = await supabase
        .from('account_territory_presence')
        .select('first_seen_at')
        .eq('account_id', session.accountId)
        .eq('unit_kind', dockKind)
        .eq('unit_id', id)
        .maybeSingle();

      if (presence) {
        let xpAmount: number | null = null;
        const { data: xpRow } = await supabase
          .from('account_xp_transactions')
          .select('amount')
          .eq('account_id', session.accountId)
          .eq('source_type', 'territory_unlock')
          .eq('reference_id', id)
          .maybeSingle();
        if (xpRow?.amount != null) xpAmount = Number(xpRow.amount) || 0;

        viewer = {
          visited: true,
          firstSeenAt: (presence.first_seen_at as string) ?? null,
          xpAmount,
        };
      }
    }

    const body: PlaceRecord = {
      id: String(unit.id),
      name: String(unit.name ?? 'Place'),
      slug: unit.slug != null ? String(unit.slug) : null,
      unitKind,
      subtype,
      dockKind,
      kindLabel: placeKindLabel(dockKind, unitKind),
      geometry,
      viewer,
    };

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'private, max-age=30',
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[place]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
