/** Client helper for POST /api/world/collect — the tap-to-claim payout. */

import type { WorldModelReward } from '@/features/map/game/world/catalog';

/**
 * Claim kind — written to world_collections.kind for queryability.
 *   collect   — consumable grab (hearts, coins). on_collect=remove hides after claim.
 *   find      — landmark discovery. on_collect=stay; stays on map for everyone.
 *   check_in  — visit stamp. XP only, no wallet payout.
 */
export type ClaimKind = 'collect' | 'find' | 'check_in';

export type CollectResult = {
  ok: true;
  placementId: string;
  modelSlug: string;
  reward: WorldModelReward | null;
  /** tool_credits balance when reward.type === 'credits'; otherwise null. */
  walletBalance: number | null;
  xp: { total: number; level: number; highestLevelReached: number };
};

export type CollectError = {
  ok: false;
  code: string;
};

const FRIENDLY_ERRORS: Record<string, string> = {
  already_collected:    'You already found this one.',
  placement_unavailable:'Someone else already claimed this one.',
  placement_not_found:  "That one's gone.",
  not_collectible:      "That one's just for looking.",
  location_required:    'Turn on Find Me to claim.',
  too_far_away:         "You're too far away — get closer and try again.",
  invalid_kind:         'Something went wrong — try again.',
};

export function collectErrorMessage(code: string): string {
  return FRIENDLY_ERRORS[code] ?? "Couldn't claim that — try again.";
}

/**
 * Claim a placement.
 *   kind  — discriminates claim type; defaults to 'collect' for backward compat.
 *   fix   — GPS coords. Server enforces 820 m proximity.
 */
export async function collectPlacement(
  placementId: string,
  fix?: { lat: number; lng: number } | null,
  kind: ClaimKind = 'collect',
): Promise<CollectResult | CollectError> {
  try {
    const payload: { placementId: string; kind: ClaimKind; lat?: number; lng?: number } = {
      placementId,
      kind,
    };
    if (fix && Number.isFinite(fix.lat) && Number.isFinite(fix.lng)) {
      payload.lat = fix.lat;
      payload.lng = fix.lng;
    }
    const res = await fetch('/api/world/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, code: typeof body?.error === 'string' ? body.error : 'unknown' };
    }
    return body as CollectResult;
  } catch {
    return { ok: false, code: 'network' };
  }
}
