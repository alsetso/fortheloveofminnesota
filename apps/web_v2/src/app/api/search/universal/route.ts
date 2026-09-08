import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { searchMinnesotaForward } from '@/lib/geo/minnesotaMapbox';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';
import { getToolsServiceDb } from '@/lib/wallet/walletDb';
import {
  TERRITORY_LAYERS,
  rowKindLabel,
  rowLabel,
  rowSubtitle,
} from '@/features/map/territory/territoryLayers';
import { MAP_CONFIG } from '@/map/config';
import { ACCOUNT_SEARCH_VISIBILITY_FILTER } from '@/lib/account/accountSearchVisibility';

export const dynamic = 'force-dynamic';

const UNIVERSAL_SEARCH_ORIGIN = 'universal_search' as const;
const PLACE_LIMIT = 5;
const TERRITORY_PER_LAYER = 3;
const ACCOUNT_LIMIT = 5;

export type UniversalPlaceHit = {
  source: 'place';
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
};

export type UniversalTerritoryHit = {
  source: 'territory';
  id: string;
  kind: string;
  slug: string;
  title: string;
  subtitle: string | null;
  kindLabel: string;
};

export type UniversalAccountHit = {
  source: 'account';
  id: string;
  title: string;
  subtitle: string | null;
  username: string | null;
  imageUrl: string | null;
};

export type UniversalSearchResponse = {
  query: string;
  origin: typeof UNIVERSAL_SEARCH_ORIGIN;
  places: UniversalPlaceHit[];
  territories: UniversalTerritoryHit[];
  accounts: UniversalAccountHit[];
  recent?: UniversalRecentRow[];
};

export type UniversalRecentRow = {
  id: string;
  query: string;
  createdAt: string;
  hitSummary: {
    placeCount?: number;
    territoryCount?: number;
    accountCount?: number;
  };
};

function escapeIlike(s: string): string {
  return s.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function looksLikeEmail(q: string): boolean {
  return q.includes('@');
}

function looksLikePhone(q: string): boolean {
  const digits = q.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

async function searchTerritories(q: string): Promise<UniversalTerritoryHit[]> {
  const pattern = `%${escapeIlike(q)}%`;
  const db = createTerritoryServerClient();

  const layerResults = await Promise.all(
    TERRITORY_LAYERS.map(async (config) => {
      const { data, error } = await db
        .from(config.table)
        .select(config.selectColumns)
        .ilike(config.nameColumn, pattern)
        .order(config.nameColumn, { ascending: true })
        .limit(TERRITORY_PER_LAYER);

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`[universal search territory ${config.slug}]`, error);
        }
        return [] as UniversalTerritoryHit[];
      }

      return (data ?? []).map((row) => {
          const rec = row as unknown as Record<string, unknown>;
          return {
            source: 'territory' as const,
            id: String(rec.id),
            kind: config.entityKind,
            slug: config.slug,
            title: rowLabel(config, rec),
            subtitle: rowSubtitle(config, rec) ?? null,
            kindLabel: rowKindLabel(config, rec) ?? config.label,
          };
        });
    }),
  );

  return layerResults.flat().slice(0, 12);
}

async function searchAccounts(q: string): Promise<UniversalAccountHit[]> {
  const supabase = await createSupabaseServerClient();
  const select = 'id,username,first_name,last_name,image_url,search_visibility';

  if (looksLikeEmail(q)) {
    const { data } = await supabase
      .from('accounts')
      .select(select)
      .ilike('email', q.trim().toLowerCase())
      .or(ACCOUNT_SEARCH_VISIBILITY_FILTER)
      .limit(ACCOUNT_LIMIT);
    return mapAccounts(data ?? []);
  }

  if (looksLikePhone(q)) {
    // Phone match requires tools people lookup path; skip free-text phone here.
    return [];
  }

  const tokens = q.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const firstPattern = `%${escapeIlike(tokens[0])}%`;

  const { data: rows } = await supabase
    .from('accounts')
    .select(select)
    .not('username', 'is', null)
    .or(ACCOUNT_SEARCH_VISIBILITY_FILTER)
    .or(
      `first_name.ilike.${firstPattern},last_name.ilike.${firstPattern},username.ilike.${firstPattern}`,
    )
    .limit(40);

  const rest = tokens.slice(1).map((t) => t.toLowerCase());
  const filtered = (rows ?? [])
    .filter((row: { first_name: string | null; last_name: string | null; username: string | null; search_visibility?: boolean | null }) => {
      const first = (row.first_name ?? '').toLowerCase();
      const last = (row.last_name ?? '').toLowerCase();
      const username = (row.username ?? '').toLowerCase();
      return (
        row.search_visibility !== false &&
        rest.every(
          (t) => first.includes(t) || last.includes(t) || username.includes(t),
        )
      );
    })
    .slice(0, ACCOUNT_LIMIT);

  return mapAccounts(filtered);
}

function mapAccounts(
  rows: Array<{
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    search_visibility?: boolean | null;
  }>,
): UniversalAccountHit[] {
  return rows
    .filter((row) => row.search_visibility !== false)
    .map((row) => {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    return {
      source: 'account' as const,
      id: row.id,
      title: name || row.username || 'Account',
      subtitle: row.username ? `@${row.username}` : null,
      username: row.username,
      imageUrl: row.image_url,
    };
  });
}

async function persistSearch(
  accountId: string,
  query: string,
  hitSummary: UniversalRecentRow['hitSummary'],
): Promise<void> {
  try {
    const db = getToolsServiceDb();
    await db.from('universal_searches').insert({
      account_id: accountId,
      origin: UNIVERSAL_SEARCH_ORIGIN,
      query,
      hit_summary: hitSummary,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[universal search] persist failed', err);
    }
  }
}

async function loadRecent(accountId: string): Promise<UniversalRecentRow[]> {
  try {
    const db = getToolsServiceDb();
    const { data } = await db
      .from('universal_searches')
      .select('id, query, hit_summary, created_at')
      .eq('account_id', accountId)
      .eq('origin', UNIVERSAL_SEARCH_ORIGIN)
      .order('created_at', { ascending: false })
      .limit(40);

    // Dedupe by query (case-insensitive) — keep newest. Clears prior
    // keystroke-spam rows from the idle Recent list.
    const seen = new Set<string>();
    const rows: UniversalRecentRow[] = [];
    for (const row of data ?? []) {
      const query = (row.query as string) ?? '';
      const key = query.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({
        id: row.id as string,
        query,
        createdAt: row.created_at as string,
        hitSummary: (row.hit_summary ?? {}) as UniversalRecentRow['hitSummary'],
      });
      if (rows.length >= 12) break;
    }
    return rows;
  } catch {
    return [];
  }
}

function hitSummaryForSource(
  source: string,
): UniversalRecentRow['hitSummary'] {
  if (source === 'territory') return { territoryCount: 1 };
  if (source === 'account') return { accountCount: 1 };
  return { placeCount: 1 };
}

/**
 * GET /api/search/universal?q=
 * Free Minnesota directory fan-out. Does not persist — activity records are
 * written on result click via POST. Empty q returns recent for the account.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const session = await getSessionAccount();

    if (q.length < 2) {
      const recent = session ? await loadRecent(session.accountId) : [];
      return NextResponse.json({
        query: q,
        origin: UNIVERSAL_SEARCH_ORIGIN,
        places: [],
        territories: [],
        accounts: [],
        recent,
      } satisfies UniversalSearchResponse);
    }

    if (q.length > 120) {
      return NextResponse.json({ error: 'Query too long' }, { status: 400 });
    }

    const placesPromise = MAP_CONFIG.MAPBOX_TOKEN
      ? searchMinnesotaForward(q, PLACE_LIMIT)
      : Promise.resolve([]);

    const [placeHits, territories, accounts] = await Promise.all([
      placesPromise,
      searchTerritories(q),
      searchAccounts(q),
    ]);

    const places: UniversalPlaceHit[] = placeHits.map((h) => ({
      source: 'place',
      id: h.id,
      title: h.name,
      subtitle: 'Minnesota',
      lat: h.lat,
      lng: h.lng,
    }));

    return NextResponse.json({
      query: q,
      origin: UNIVERSAL_SEARCH_ORIGIN,
      places,
      territories,
      accounts,
    } satisfies UniversalSearchResponse);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/search/universal]', err);
    }
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

/**
 * POST /api/search/universal
 * Persist a Recent activity row for the clicked result (full record title).
 * Body: { query: string, source: 'place' | 'territory' | 'account' }
 */
export async function POST(request: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ ok: true, saved: false });
    }

    const body = (await request.json().catch(() => ({}))) as {
      query?: unknown;
      source?: unknown;
    };
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const source =
      body.source === 'territory' || body.source === 'account' || body.source === 'place'
        ? body.source
        : 'place';

    if (query.length < 2) {
      return NextResponse.json({ error: 'Query too short' }, { status: 400 });
    }
    if (query.length > 120) {
      return NextResponse.json({ error: 'Query too long' }, { status: 400 });
    }

    await persistSearch(session.accountId, query, hitSummaryForSource(source));
    return NextResponse.json({ ok: true, saved: true });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/search/universal POST]', err);
    }
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
}
