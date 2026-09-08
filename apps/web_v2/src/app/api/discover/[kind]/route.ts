import { NextResponse } from 'next/server';
import { passportKindBySlug } from '@/features/accountTerritories/store/passportKinds';
import {
  getTerritoryLayer,
  rowKindLabel,
  rowLabel,
  rowSubtitle,
} from '@/features/map/territory/territoryLayers';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const SEARCH_MIN = 1;

type Bucket = 'visited' | 'remaining' | 'all';

function parseBucket(raw: string | null): Bucket | null {
  if (raw === 'visited' || raw === 'remaining' || raw === 'all') return raw;
  return null;
}

function escapeIlike(q: string): string {
  return q.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function formatInList(ids: string[]): string {
  return `(${ids.map((id) => `"${id}"`).join(',')})`;
}

/**
 * GET /api/discover/[kind]?bucket=visited|remaining|all&offset=0&limit=25&q=
 *
 * visited — stamped units (presence).
 * remaining — not yet stamped.
 * all — full catalog A–Z (no presence split).
 */
export async function GET(
  request: Request,
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

    const url = new URL(request.url);
    const bucket = parseBucket(url.searchParams.get('bucket'));
    if (!bucket) {
      return NextResponse.json(
        { error: 'bucket must be visited, remaining, or all' },
        { status: 400 },
      );
    }

    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
    const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
    const q = (url.searchParams.get('q') ?? '').trim();

    const session = await getSessionAccount().catch(() => null);
    const accountId = session?.accountId ?? null;

    const db = createTerritoryServerClient();
    const supabase = await createSupabaseServerClient();

    const unlockedIds = new Set<string>();
    const firstSeenById = new Map<string, string>();

    if (accountId) {
      const { data: presence } = await supabase
        .from('account_territory_presence')
        .select('unit_id, first_seen_at')
        .eq('account_id', accountId)
        .eq('unit_kind', config.entityKind);

      for (const row of presence ?? []) {
        if (!row.unit_id) continue;
        const id = row.unit_id as string;
        unlockedIds.add(id);
        if (row.first_seen_at) {
          firstSeenById.set(id, row.first_seen_at as string);
        }
      }
    }

    const visitedTotal = unlockedIds.size;

    if (bucket === 'visited') {
      if (visitedTotal === 0) {
        return NextResponse.json({
          kind: def.slug,
          unitKind: def.unitKind,
          label: def.label,
          bucket,
          rows: [],
          total: 0,
          visitedTotal: 0,
          remainingTotal: Math.max(0, def.total - 0),
          offset,
          limit,
        });
      }

      let query = db
        .from(config.table)
        .select(config.selectColumns, { count: 'exact' })
        .in('id', [...unlockedIds])
        .order(config.nameColumn, { ascending: true });

      if (q.length >= SEARCH_MIN) {
        query = query.ilike(config.nameColumn, `%${escapeIlike(q)}%`);
      }

      const { data, error, count } = await query.range(offset, offset + limit - 1);
      if (error) throw error;

      const rows = (data ?? []).map((row) => {
        const r = row as unknown as Record<string, unknown>;
        const id = String(r.id ?? '');
        return {
          id,
          name: rowLabel(config, r),
          subtitle: rowSubtitle(config, r) ?? null,
          kindLabel: rowKindLabel(config, r) ?? def.label,
          visited: true,
          firstSeenAt: firstSeenById.get(id) ?? null,
        };
      });

      return NextResponse.json({
        kind: def.slug,
        unitKind: def.unitKind,
        label: def.label,
        bucket,
        rows,
        total: count ?? rows.length,
        visitedTotal,
        remainingTotal: Math.max(0, def.total - visitedTotal),
        offset,
        limit,
      });
    }

    if (bucket === 'all') {
      let query = db
        .from(config.table)
        .select(config.selectColumns, { count: 'exact' })
        .order(config.nameColumn, { ascending: true });

      if (q.length >= SEARCH_MIN) {
        query = query.ilike(config.nameColumn, `%${escapeIlike(q)}%`);
      }

      const { data, error, count } = await query.range(offset, offset + limit - 1);
      if (error) throw error;

      const rows = (data ?? []).map((row) => {
        const r = row as unknown as Record<string, unknown>;
        const id = String(r.id ?? '');
        const visited = unlockedIds.has(id);
        return {
          id,
          name: rowLabel(config, r),
          subtitle: rowSubtitle(config, r) ?? null,
          kindLabel: rowKindLabel(config, r) ?? def.label,
          visited,
          firstSeenAt: visited ? firstSeenById.get(id) ?? null : null,
        };
      });

      return NextResponse.json({
        kind: def.slug,
        unitKind: def.unitKind,
        label: def.label,
        bucket,
        rows,
        total: count ?? rows.length,
        visitedTotal,
        remainingTotal: Math.max(0, def.total - visitedTotal),
        offset,
        limit,
      });
    }

    // remaining — every unit not yet stamped
    let remainingQuery = db
      .from(config.table)
      .select(config.selectColumns, { count: 'exact' })
      .order(config.nameColumn, { ascending: true });

    if (unlockedIds.size > 0) {
      remainingQuery = remainingQuery.not('id', 'in', formatInList([...unlockedIds]));
    }

    if (q.length >= SEARCH_MIN) {
      remainingQuery = remainingQuery.ilike(
        config.nameColumn,
        `%${escapeIlike(q)}%`,
      );
    }

    const { data, error, count } = await remainingQuery.range(
      offset,
      offset + limit - 1,
    );
    if (error) throw error;

    const rows = (data ?? []).map((row) => {
      const r = row as unknown as Record<string, unknown>;
      const id = String(r.id ?? '');
      return {
        id,
        name: rowLabel(config, r),
        subtitle: rowSubtitle(config, r) ?? null,
        kindLabel: rowKindLabel(config, r) ?? def.label,
        visited: false,
        firstSeenAt: null as string | null,
      };
    });

    return NextResponse.json({
      kind: def.slug,
      unitKind: def.unitKind,
      label: def.label,
      bucket,
      rows,
      total: count ?? rows.length,
      visitedTotal,
      remainingTotal: count ?? Math.max(0, def.total - visitedTotal),
      offset,
      limit,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[discover kind]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
