import { NextResponse } from 'next/server';
import {
  getDiscoverSearchSession,
  persistDiscoverSearch,
  runDiscoverSearch,
} from '@/lib/discover/search/discoverSearch';
import type {
  DiscoverSearchCompletedVia,
  DiscoverSearchKind,
  DiscoverSearchPersistInput,
  DiscoverSearchResponse,
} from '@/lib/discover/search/types';
import { DISCOVER_SEARCH_SECTION_ORDER } from '@/lib/discover/search/types';

export const dynamic = 'force-dynamic';

const HIT_KINDS = new Set<string>([
  ...DISCOVER_SEARCH_SECTION_ORDER,
  'school',
  'atlas_collection',
]);

function parseCompletedVia(value: unknown): DiscoverSearchCompletedVia | null {
  if (value === 'result_open' || value === 'submit') return value;
  return null;
}

function parseHitKind(value: unknown): DiscoverSearchKind | null {
  if (typeof value !== 'string' || !HIT_KINDS.has(value)) return null;
  return value as DiscoverSearchKind;
}

/**
 * GET /api/discover/search?q=
 * Unified Discover fan-out — pages, territories, atlas, places, zones, posts, people.
 * Empty q returns recent completed searches for the signed-in account.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const { accountId } = await getDiscoverSearchSession();

    if (q.length > 120) {
      return NextResponse.json({ error: 'Query too long' }, { status: 400 });
    }

    const result = await runDiscoverSearch(q, { accountId });
    return NextResponse.json(result satisfies DiscoverSearchResponse);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/discover/search]', err);
    }
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

/**
 * POST /api/discover/search
 * Persist a completed Discover search (result open or Enter submit).
 * Body: DiscoverSearchPersistInput
 */
export async function POST(request: Request) {
  try {
    const { accountId } = await getDiscoverSearchSession();
    if (!accountId) {
      return NextResponse.json({ ok: true, saved: false });
    }

    const body = (await request.json().catch(() => ({}))) as Partial<DiscoverSearchPersistInput> & {
      query?: unknown;
      completedVia?: unknown;
      hitKind?: unknown;
      hitId?: unknown;
      hitTitle?: unknown;
      hitHref?: unknown;
    };

    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (query.length < 2) {
      return NextResponse.json({ error: 'Query too short' }, { status: 400 });
    }
    if (query.length > 120) {
      return NextResponse.json({ error: 'Query too long' }, { status: 400 });
    }

    // Back-compat: bare `{ query }` treated as result_open without hit is rejected;
    // older clients that only sent query should send completedVia going forward.
    const completedVia =
      parseCompletedVia(body.completedVia) ??
      (body.hitKind || body.hitId ? 'result_open' : 'submit');

    const input: DiscoverSearchPersistInput = {
      query,
      completedVia,
      hitKind: parseHitKind(body.hitKind),
      hitId: typeof body.hitId === 'string' ? body.hitId : null,
      hitTitle: typeof body.hitTitle === 'string' ? body.hitTitle : null,
      hitHref: typeof body.hitHref === 'string' ? body.hitHref : null,
    };

    if (completedVia === 'result_open' && (!input.hitKind || !input.hitId)) {
      return NextResponse.json(
        { error: 'Result open requires hitKind and hitId' },
        { status: 400 },
      );
    }

    await persistDiscoverSearch(accountId, input);
    return NextResponse.json({ ok: true, saved: true });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/discover/search POST]', err);
    }
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
}
