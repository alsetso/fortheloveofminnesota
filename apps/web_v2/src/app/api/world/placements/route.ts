import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { isAdminRole } from '@/lib/auth/isAdminAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { WorldModelSlug } from '@/features/map/game/world/catalog';
import { prioritizePlacements } from '@/features/map/game/world/placementPriority';

export const dynamic = 'force-dynamic';

export type WorldPlacementDto = {
  id: string;
  lat: number;
  lng: number;
  slug: string;
  kind: WorldModelSlug;
  scaleMultiplier: number;
  /** null = follow catalog default_rotation_z */
  rotationZ: number | null;
  /** null = follow catalog default_height_meters */
  altitudeMeters: number | null;
  /** Placement-specific overrides (e.g. { postId } for community-* models). */
  overrides: Record<string, unknown> | null;
};

function nullableNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/world/placements
 *
 * Query params (all optional):
 *   lat, lng              — caller position for CTU cold-start + priority sort
 *   bbox                  — "west,south,east,north" bounding box (tile streaming mode)
 *   experienceZoneId      — venue mode: only placements tagged to this zone
 *   zonePreview           — "1" = Discover zone hero: skip CTU, allow zone-only fetch
 *
 * Tile streaming mode (bbox present):
 *   PlacementStreamService sends a bbox derived from the current XYZ viewport
 *   tiles. The server filters placements to that bbox via ST_Within and skips
 *   the global CTU scope check — the client already knows which tiles to request.
 *
 * Legacy mode (no bbox):
 *   Non-admin accounts only receive objects inside their unlocked CTUs. Cold
 *   start resolves the CTU under the caller's position for this read only.
 *
 * In both modes, the response is distance-sorted and budget-capped for non-admins
 * so the closest hearts → coins → chests always load first.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const session = await getSessionAccount();
    const isAdmin = !!session && isAdminRole(session.role);

    const url = new URL(request.url);
    const userLat = Number(url.searchParams.get('lat'));
    const userLng = Number(url.searchParams.get('lng'));
    const hasPosition = Number.isFinite(userLat) && Number.isFinite(userLng);

    // ── Tile streaming mode ─────────────────────────────────────────────────
    // When PlacementStreamService supplies a bbox, skip CTU scoping and let
    // the DB filter by geography directly. This is the primary fetch path for
    // the game map; legacy lat/lng mode is the fallback for older clients.
    const experienceZoneId = url.searchParams.get('experienceZoneId');
    const zoneId =
      experienceZoneId &&
      /^[0-9a-f-]{36}$/i.test(experienceZoneId)
        ? experienceZoneId
        : null;
    const zonePreview = url.searchParams.get('zonePreview') === '1';

    const bboxParam = url.searchParams.get('bbox');
    if (bboxParam || (zonePreview && zoneId)) {
      let west: number | null = null;
      let south: number | null = null;
      let east: number | null = null;
      let north: number | null = null;

      if (bboxParam) {
        const parts = bboxParam.split(',').map(Number);
        if (
          parts.length === 4 &&
          parts.every((n) => Number.isFinite(n))
        ) {
          [west, south, east, north] = parts as [number, number, number, number];
        } else if (!zonePreview || !zoneId) {
          return NextResponse.json({ error: 'Invalid bbox' }, { status: 400 });
        }
      }

      const { data, error } = await supabase.rpc('world_list_placements', {
        p_slugs: null,
        p_ctu_unit_ids: null,
        p_account_id: session?.accountId ?? null,
        p_bbox_west: west,
        p_bbox_south: south,
        p_bbox_east: east,
        p_bbox_north: north,
        p_experience_zone_id: zoneId,
      } as Record<string, unknown>);

      if (error) {
        // p_bbox_* params may not be in the current RPC signature — fall
        // through to legacy mode gracefully (unless this is a zone preview).
        if (!error.message.includes('p_bbox')) {
          console.error('world_list_placements bbox', error.message);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        if (zonePreview && zoneId) {
          const fallback = await supabase.rpc('world_list_placements', {
            p_slugs: null,
            p_ctu_unit_ids: null,
            p_account_id: session?.accountId ?? null,
            p_experience_zone_id: zoneId,
          } as Record<string, unknown>);
          if (fallback.error) {
            console.error('world_list_placements zonePreview', fallback.error.message);
            return NextResponse.json({ error: fallback.error.message }, { status: 500 });
          }
          const placements: WorldPlacementDto[] = [];
          for (const row of fallback.data ?? []) {
            const slug = String(row.slug ?? '');
            if (!slug) continue;
            const lat = Number(row.lat);
            const lng = Number(row.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            placements.push({
              id: String(row.id),
              lat, lng, slug,
              kind: slug,
              scaleMultiplier: Number(row.scale_multiplier) || 1,
              rotationZ: nullableNumber(row.rotation_z),
              altitudeMeters: nullableNumber(row.altitude_meters),
              overrides: (row.overrides as Record<string, unknown> | null) ?? null,
            });
          }
          return NextResponse.json({ placements });
        }
      } else {
          const placements: WorldPlacementDto[] = [];
          for (const row of data ?? []) {
            const slug = String(row.slug ?? '');
            if (!slug) continue;
            const lat = Number(row.lat);
            const lng = Number(row.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            placements.push({
              id: String(row.id),
              lat, lng, slug,
              kind: slug,
              scaleMultiplier: Number(row.scale_multiplier) || 1,
              rotationZ: nullableNumber(row.rotation_z),
              altitudeMeters: nullableNumber(row.altitude_meters),
              overrides: (row.overrides as Record<string, unknown> | null) ?? null,
            });
          }
          const prioritized =
            !isAdmin && hasPosition
              ? prioritizePlacements(placements, userLat, userLng)
              : placements;
          return NextResponse.json({ placements: prioritized });
      }
    }

    let ctuUnitIds: string[] | null = null;
    if (!isAdmin && session) {
      const { data: unlocked } = await supabase
        .from('account_territory_presence')
        .select('unit_id')
        .eq('account_id', session.accountId)
        .eq('unit_kind', 'ctu');
      ctuUnitIds = (unlocked ?? []).map((row) => String((row as { unit_id: string }).unit_id));

      if (ctuUnitIds.length === 0) {
        if (hasPosition) {
          const { data: here } = await supabase.rpc('territory_at_point', {
            p_lat: userLat,
            p_lng: userLng,
          });
          const jurisdictions =
            (here as { jurisdictions?: Array<{ kind: string; id: string }> } | null)
              ?.jurisdictions ?? [];
          const ctu = jurisdictions.find((j) => j.kind === 'ctu');
          ctuUnitIds = ctu ? [ctu.id] : null; // no CTU resolved → fall through unscoped
        } else {
          ctuUnitIds = null; // no position at all → don't scope, avoid an empty map
        }
      }
    }

    const { data, error } = await supabase.rpc('world_list_placements', {
      p_slugs: null,
      p_ctu_unit_ids: ctuUnitIds,
      // Multi-account safe: scopes the on_collect=remove filter to the
      // selected account instead of "any account this user owns".
      p_account_id: session?.accountId ?? null,
      p_experience_zone_id: zoneId,
    } as Record<string, unknown>);

    if (error) {
      console.error('world_list_placements', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map RPC rows to DTOs.
    const placements: WorldPlacementDto[] = [];
    for (const row of data ?? []) {
      const slug = String(row.slug ?? '');
      if (!slug) continue;
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      placements.push({
        id: String(row.id),
        lat,
        lng,
        slug,
        kind: slug,
        scaleMultiplier: Number(row.scale_multiplier) || 1,
        rotationZ: nullableNumber(row.rotation_z),
        altitudeMeters: nullableNumber(row.altitude_meters),
        overrides: (row.overrides as Record<string, unknown> | null) ?? null,
      });
    }

    // Distance-sort + budget-cap for non-admin callers with a known position.
    // Admins always receive the full unfiltered set for map editing.
    const prioritized =
      !isAdmin && hasPosition
        ? prioritizePlacements(placements, userLat, userLng)
        : placements;

    return NextResponse.json({ placements: prioritized });
  } catch (err) {
    console.error('world placements GET', err);
    return NextResponse.json({ error: 'Failed to load placements' }, { status: 500 });
  }
}

/**
 * POST /api/world/placements
 * Body: { slug: string, lat, lng } (kind accepted as slug alias)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in to place models' }, { status: 401 });
    }
    if (!isAdminRole(session.role)) {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const body = (await request.json()) as {
      slug?: string;
      kind?: string;
      lat?: number;
      lng?: number;
    };
    const slug = String(body.slug || body.kind || '').trim();
    if (!slug) {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
    }
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const { data: account } = await supabase
      .from('accounts')
      .select('username, email')
      .eq('id', session.accountId)
      .maybeSingle();

    const placedByName =
      (account as { username?: string | null; email?: string | null } | null)?.username?.trim() ||
      (account as { username?: string | null; email?: string | null } | null)?.email?.trim() ||
      '';

    // Null pose overrides → follow catalog defaults on world_models
    const { data, error } = await supabase.rpc('world_place_model', {
      p_slug: slug,
      p_lng: lng,
      p_lat: lat,
      p_account_id: session.accountId,
      p_placed_by_name: placedByName,
      p_scale_multiplier: 1,
      p_rotation_z: null,
    });

    if (error) {
      console.error('world_place_model', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) {
      return NextResponse.json({ error: 'Placement failed' }, { status: 500 });
    }

    const placement: WorldPlacementDto = {
      id: String(row.id),
      lat: Number(row.lat),
      lng: Number(row.lng),
      slug: String(row.slug ?? slug),
      kind: String(row.slug ?? slug),
      scaleMultiplier: Number(row.scale_multiplier) || 1,
      rotationZ: nullableNumber(row.rotation_z),
      altitudeMeters: null,
      overrides: (row.overrides as Record<string, unknown> | null) ?? null,
    };

    return NextResponse.json({ placement }, { status: 201 });
  } catch (err) {
    console.error('world placements POST', err);
    return NextResponse.json({ error: 'Failed to place model' }, { status: 500 });
  }
}
