import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import type { FeatureCollection } from 'geojson';
import {
  boundaryCutoutGeoJson,
  type BoundaryCutoutDiagnostics,
} from '@/map/geo/boundaryCutoutGeoJson';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

/** Bump when precomputed symbolClip / cutout contract changes. */
const MASK_CACHE_VERSION = 9;

type CachedMask = {
  id: string;
  name: string;
  cutout: FeatureCollection;
  minnesota: FeatureCollection;
  symbolClip: FeatureCollection;
  diagnostics: BoundaryCutoutDiagnostics;
  builtAt: string;
};

let maskCache: CachedMask | null = null;
let maskCacheVersion = 0;
let maskBuild: Promise<CachedMask> | null = null;

function isFeatureCollection(value: unknown): value is FeatureCollection {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as FeatureCollection).type === 'FeatureCollection' &&
    Array.isArray((value as FeatureCollection).features)
  );
}

async function loadPrecomputedMask(): Promise<CachedMask | null> {
  try {
    const filePath = path.join(
      process.cwd(),
      'public/geo/minnesota-outside-mask.json',
    );
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CachedMask>;
    if (!isFeatureCollection(parsed.cutout) || !parsed.cutout.features.length) {
      return null;
    }
    if (
      !isFeatureCollection(parsed.minnesota) ||
      !parsed.minnesota.features.length
    ) {
      return null;
    }
    if (
      !isFeatureCollection(parsed.symbolClip) ||
      !parsed.symbolClip.features.length
    ) {
      return null;
    }
    return {
      id: typeof parsed.id === 'string' ? parsed.id : 'precomputed',
      name: typeof parsed.name === 'string' ? parsed.name : 'Minnesota',
      cutout: parsed.cutout,
      minnesota: parsed.minnesota,
      symbolClip: parsed.symbolClip,
      diagnostics: parsed.diagnostics as BoundaryCutoutDiagnostics,
      builtAt:
        typeof parsed.builtAt === 'string'
          ? parsed.builtAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function buildMask(): Promise<CachedMask> {
  if (maskCache && maskCacheVersion === MASK_CACHE_VERSION) return maskCache;
  if (maskCacheVersion !== MASK_CACHE_VERSION) {
    maskCache = null;
  }
  if (maskBuild) return maskBuild;

  maskBuild = (async () => {
    const precomputed = await loadPrecomputedMask();
    if (precomputed) {
      maskCache = precomputed;
      maskCacheVersion = MASK_CACHE_VERSION;
      return precomputed;
    }

    const db = createTerritoryServerClient();
    const { data, error } = await db
      .from('state')
      .select('id, name, geometry')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data?.geometry || !isFeatureCollection(data.geometry)) {
      throw new Error('State boundary geometry missing');
    }

    const { cutout, minnesota, symbolClip, diagnostics } =
      boundaryCutoutGeoJson(data.geometry);

    if (
      !cutout.features.length ||
      !minnesota.features.length ||
      !symbolClip.features.length
    ) {
      throw new Error('State mask cutout empty');
    }

    console.info('[State Boundary API] mask ready', diagnostics);

    const cached: CachedMask = {
      id: String(data.id),
      name: typeof data.name === 'string' ? data.name : 'Minnesota',
      cutout,
      minnesota,
      symbolClip,
      diagnostics,
      builtAt: new Date().toISOString(),
    };
    maskCache = cached;
    maskCacheVersion = MASK_CACHE_VERSION;
    return cached;
  })().finally(() => {
    maskBuild = null;
  });

  return maskBuild;
}

/** GET /api/civic/state-boundary */
export async function GET() {
  try {
    const payload = await buildMask();
    return NextResponse.json(
      {
        id: payload.id,
        name: payload.name,
        cutout: payload.cutout,
        minnesota: payload.minnesota,
        symbolClip: payload.symbolClip,
        diagnostics: payload.diagnostics,
        builtAt: payload.builtAt,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
        },
      },
    );
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[State Boundary API]', e);
    }
    const message = e instanceof Error ? e.message : 'Internal server error';
    const status =
      message.includes('missing') || message.includes('empty') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
