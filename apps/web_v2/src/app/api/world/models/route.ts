import { existsSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  resolveWorldModelUrl,
  scaleFromMeters,
  worldModelRuntimeId,
  type WorldModelSpec,
} from '@/features/map/game/world/catalog';
import {
  isModelVerb,
  resolveModelPurpose,
  resolveModelVerb,
  type ModelPurpose,
  type ModelVerbDb,
} from '@/features/map/game/world/modelVerbs';

export const dynamic = 'force-dynamic';

function publicFileExists(urlPath: string): boolean {
  // urlPath like /models/props/foo.glb
  const rel = urlPath.replace(/^\//, '');
  const disk = path.join(process.cwd(), 'public', rel);
  return existsSync(disk);
}

function normalizeInteraction(raw: unknown): ModelVerbDb {
  const s = String(raw ?? 'none');
  if (isModelVerb(s)) return s;
  return 'none';
}

function normalizePurpose(raw: unknown, interaction: unknown): ModelPurpose {
  return resolveModelPurpose(
    typeof raw === 'string' ? raw : null,
    resolveModelVerb(typeof interaction === 'string' ? interaction : null),
  );
}

/**
 * GET /api/world/models
 * Full world.world_models catalog for the dock picker (all rows).
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('world_list_models', {
      p_active_only: false,
    });

    if (error) {
      console.error('world_list_models', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const models: WorldModelSpec[] = [];
    for (const row of data ?? []) {
      const slug = String(row.slug ?? '').trim();
      if (!slug) continue;
      const filePath = String(row.file_path ?? '');
      const url = resolveWorldModelUrl(filePath, slug);
      const rotZ = Number(row.default_rotation_z) || 0;
      const heightM = Number(row.default_height_meters) || 0;
      const realWorldMeters = Number(row.real_world_meters);
      models.push({
        id: worldModelRuntimeId(slug),
        url,
        scale: scaleFromMeters(row.real_world_meters, row.native_units_max),
        rotation: [0, 0, rotZ],
        defaultRotationZ: rotZ,
        defaultHeightMeters: heightM,
        realWorldMeters:
          Number.isFinite(realWorldMeters) && realWorldMeters > 0
            ? realWorldMeters
            : null,
        label: String(row.name ?? slug),
        slug,
        category: String(row.category ?? 'prop'),
        tags: Array.isArray(row.tags)
          ? row.tags.map((t: unknown) => String(t)).filter(Boolean)
          : [],
        active: Boolean(row.active),
        available: publicFileExists(url),
        allowUserScale: Boolean(row.allow_user_scale),
        sortOrder: Number(row.sort_order) || 0,
        interaction: normalizeInteraction(row.interaction),
        purpose: normalizePurpose(row.purpose, row.interaction),
        playerPlaceable: Boolean(row.player_placeable),
        tapPayload:
          row.tap_payload && typeof row.tap_payload === 'object'
            ? (row.tap_payload as Record<string, unknown>)
            : null,
        onCollect: row.on_collect === 'stay' ? 'stay' : 'remove',
        rare: Boolean(row.rare),
        reward: row.reward ?? null,
        foundHeader: typeof row.found_header === 'string' && row.found_header ? row.found_header : null,
        foundFooter: typeof row.found_footer === 'string' && row.found_footer ? row.found_footer : null,
      });
    }

    return NextResponse.json({ models, count: models.length });
  } catch (err) {
    console.error('world models GET', err);
    return NextResponse.json({ error: 'Failed to load models' }, { status: 500 });
  }
}
