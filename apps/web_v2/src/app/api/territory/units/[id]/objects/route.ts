import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createWorldServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key');
  }
  return createClient(url, key, {
    db: { schema: 'world' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Row = {
  placement_id: string;
  world_placements: {
    visible: boolean;
    world_models: {
      slug: string;
      name: string;
      file_path: string;
      category: string;
      /** Tap verb — drives iOS ObjectClass via classifyObject(). */
      interaction: string | null;
      /** Claim persistence: 'remove' (consumed) | 'stay' (permanent). */
      on_collect: string | null;
    } | null;
  } | null;
};

export type TerritoryObjectModel = {
  slug: string;
  name: string;
  filePath: string;
  category: string;
  /** Tap verb from world_models.interaction (null if not set). */
  interaction: string | null;
  /** Claim persistence from world_models.on_collect — used by classifyObject(). */
  onCollect: string | null;
  /** Visible placements of this model in the territory. */
  total: number;
  /** How many of those the signed-in account has collected (0 if signed out). */
  collected: number;
  /** Still on the map for this account. */
  remaining: number;
};

const EMPTY_OBJECTS = {
  total: 0,
  collectedTotal: 0,
  remainingTotal: 0,
  signedIn: false,
  models: [],
};

/**
 * GET /api/territory/units/[id]/objects?kind=ctu
 * Live world-object inventory for a CTU (city/town) — totals plus, when signed in,
 * what you've already collected here vs what's still out.
 *
 * Collectibles are scoped to CTUs only. Counties and school districts are
 * organizational containers — objects are placed at city/town granularity so
 * discovery scales with actual travel. Non-CTU requests return an empty payload
 * immediately rather than hitting the DB.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid unit id' }, { status: 400 });
    }

    const kind = new URL(request.url).searchParams.get('kind');
    if (kind && kind !== 'ctu') {
      return NextResponse.json({ ...EMPTY_OBJECTS, signedIn: Boolean(await getSessionAccount()) });
    }

    const world = createWorldServiceClient();
    // Chain through world_placements → world_models (no direct FK from
    // world_placement_territories to world_models).
    const { data, error } = await world
      .from('world_placement_territories')
      .select(
        'placement_id, world_placements(visible, world_models(slug, name, file_path, category, interaction, on_collect))',
      )
      .eq('unit_id', id)
      .overrideTypes<Row[]>();

    if (error) throw error;

    const placementIds: string[] = [];
    const byModel = new Map<
      string,
      {
        slug: string;
        name: string;
        filePath: string;
        category: string;
        interaction: string | null;
        onCollect: string | null;
        placementIds: string[];
      }
    >();

    for (const row of data ?? []) {
      const model = row.world_placements?.world_models;
      if (!row.world_placements?.visible || !model || !row.placement_id) continue;
      placementIds.push(row.placement_id);
      const key = model.slug;
      const existing = byModel.get(key);
      if (existing) {
        existing.placementIds.push(row.placement_id);
      } else {
        byModel.set(key, {
          slug: model.slug,
          name: model.name,
          filePath: model.file_path,
          category: model.category,
          interaction: model.interaction ?? null,
          onCollect: model.on_collect ?? null,
          placementIds: [row.placement_id],
        });
      }
    }

    const collectedPlacementIds = new Set<string>();
    const session = await getSessionAccount();
    if (session && placementIds.length > 0) {
      const supabase = await createSupabaseServerClient();
      // Chunk in case a large county has many placements.
      const CHUNK = 200;
      for (let i = 0; i < placementIds.length; i += CHUNK) {
        const chunk = placementIds.slice(i, i + CHUNK);
        const { data: collected, error: collectedErr } = await supabase
          .schema('world')
          .from('world_collections')
          .select('placement_id')
          .eq('account_id', session.accountId)
          .in('placement_id', chunk);
        if (collectedErr) throw collectedErr;
        for (const row of collected ?? []) {
          const pid = (row as { placement_id: string }).placement_id;
          if (pid) collectedPlacementIds.add(pid);
        }
      }
    }

    const models: TerritoryObjectModel[] = Array.from(byModel.values())
      .map((m) => {
        const total = m.placementIds.length;
        const collected = m.placementIds.filter((pid) =>
          collectedPlacementIds.has(pid),
        ).length;
        return {
          slug: m.slug,
          name: m.name,
          filePath: m.filePath,
          category: m.category,
          interaction: m.interaction,
          onCollect: m.onCollect,
          total,
          collected,
          remaining: Math.max(0, total - collected),
        };
      })
      .sort((a, b) => {
        // Still-out first, then most total, then name.
        if (b.remaining !== a.remaining) return b.remaining - a.remaining;
        if (b.total !== a.total) return b.total - a.total;
        return a.name.localeCompare(b.name);
      });

    const total = models.reduce((sum, m) => sum + m.total, 0);
    const collectedTotal = models.reduce((sum, m) => sum + m.collected, 0);
    const remainingTotal = models.reduce((sum, m) => sum + m.remaining, 0);

    return NextResponse.json({
      total,
      collectedTotal,
      remainingTotal,
      signedIn: Boolean(session),
      models,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory/objects]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
