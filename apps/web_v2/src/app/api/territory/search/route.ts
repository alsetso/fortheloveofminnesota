import { NextResponse } from 'next/server';
import {
  TERRITORY_LAYERS,
  rowKindLabel,
  rowLabel,
  rowSubtitle,
  type TerritoryLayerConfig,
} from '@/features/map/territory/territoryLayers';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

const PER_LAYER_LIMIT = 5;
const MAX_TOTAL = 20;

export type TerritorySearchHit = {
  id: string;
  kind: TerritoryLayerConfig['entityKind'];
  slug: TerritoryLayerConfig['slug'];
  title: string;
  subtitle: string | null;
  kindLabel: string;
};

function escapeIlike(s: string): string {
  return s.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

/**
 * GET /api/territory/search?q=
 * Multi-layer name search across territory.* for the dock universal search.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    if (q.length < 2) {
      return NextResponse.json({ hits: [] as TerritorySearchHit[] });
    }
    if (q.length > 120) {
      return NextResponse.json({ error: 'Query too long' }, { status: 400 });
    }

    const pattern = `%${escapeIlike(q)}%`;
    const db = createTerritoryServerClient();

    const layerResults = await Promise.all(
      TERRITORY_LAYERS.map(async (config) => {
        const { data, error } = await db
          .from(config.table)
          .select(config.selectColumns)
          .ilike(config.nameColumn, pattern)
          .order(config.nameColumn, { ascending: true })
          .limit(PER_LAYER_LIMIT);

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[territory search ${config.slug}]`, error);
          }
          return [] as TerritorySearchHit[];
        }

        return (data ?? []).map((row) => {
          const rec = row as unknown as Record<string, unknown>;
          return {
            id: String(rec.id),
            kind: config.entityKind,
            slug: config.slug,
            title: rowLabel(config, rec),
            subtitle: rowSubtitle(config, rec) ?? null,
            kindLabel: rowKindLabel(config, rec) ?? config.label,
          } satisfies TerritorySearchHit;
        });
      }),
    );

    const hits = layerResults.flat().slice(0, MAX_TOTAL);
    return NextResponse.json({ hits });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory search]', err);
    }
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
