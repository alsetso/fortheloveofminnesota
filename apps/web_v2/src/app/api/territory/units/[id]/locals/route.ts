import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { accountTerritoryKindLabel } from '@/features/accountTerritories/store/constants';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CityLocalAccount = {
  account_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  /** Human-readable relationship label, e.g. "Lives here", "Works here", "Home" */
  relationship: string;
};

type AccountRow = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
};

// Priority for deduplication: if someone has multiple relationships pick the richest
const KIND_PRIORITY: Record<string, number> = {
  live_here: 4,
  work_here: 3,
  interested_in: 1,
};

function kindPriority(k: string): number {
  return KIND_PRIORITY[k] ?? 0;
}

/**
 * GET /api/territory/units/[id]/locals
 *
 * Returns accounts connected to this CTU via:
 *   1. account_home_units (home territory — "Home")
 *   2. account_places WHERE kind IN ('live_here','work_here') ("Lives here" / "Works here")
 *
 * Results are merged, deduplicated by account_id (richest relationship wins),
 * capped at 80, and ordered by home/relationship priority then recency.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const db = createServiceRoleClient();

    // Run both queries in parallel
    const [homeResult, placesResult] = await Promise.all([
      db
        .from('account_home_units')
        .select('account_id, accounts!inner(id, username, first_name, last_name, image_url)')
        .eq('territory_unit_id', id)
        .order('set_at', { ascending: false })
        .limit(80),
      db
        .from('account_places')
        .select('account_id, kind, accounts!inner(id, username, first_name, last_name, image_url)')
        .eq('territory_unit_id', id)
        .in('kind', ['live_here', 'work_here'])
        .order('created_at', { ascending: false })
        .limit(80),
    ]);

    if (homeResult.error) {
      console.error('[territory/locals] home query:', homeResult.error.message);
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    // Map: account_id → { account, bestKind }
    const map = new Map<string, { account: AccountRow; kind: string }>();

    // Home accounts — relationship label "Home"
    for (const row of homeResult.data ?? []) {
      const acct = row.accounts as unknown as AccountRow;
      if (!acct?.id) continue;
      const existing = map.get(acct.id);
      if (!existing || kindPriority('live_here') > kindPriority(existing.kind)) {
        map.set(acct.id, { account: acct, kind: 'home' });
      }
    }

    // account_places accounts — live_here / work_here
    for (const row of (placesResult.data ?? []) as { account_id: string; kind: string; accounts: unknown }[]) {
      const acct = row.accounts as unknown as AccountRow;
      if (!acct?.id) continue;
      const existing = map.get(acct.id);
      // home (priority 5) beats everything; otherwise pick highest kind priority
      if (!existing) {
        map.set(acct.id, { account: acct, kind: row.kind });
      } else if (existing.kind !== 'home' && kindPriority(row.kind) > kindPriority(existing.kind)) {
        map.set(acct.id, { account: acct, kind: row.kind });
      }
    }

    const locals: CityLocalAccount[] = [...map.values()].slice(0, 80).map(({ account, kind }) => ({
      account_id: account.id,
      username: account.username,
      first_name: account.first_name,
      last_name: account.last_name,
      image_url: account.image_url,
      relationship: kind === 'home' ? 'Home' : accountTerritoryKindLabel(kind),
    }));

    return NextResponse.json({ locals });
  } catch (e) {
    console.error('[territory/locals]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
