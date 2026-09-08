import {
  ACCOUNT_TERRITORY_RETIRED_KINDS,
  isAccountTerritoryKind,
} from '@/features/accountTerritories/store/constants';
import { getHomeStatus } from '@/features/accountTerritories/db/setHomeTerritories';
import { getAccountPlacesDb } from '@/features/accountTerritories/db/accountTerritoriesDb';

export type RemoveSavedTerritoryInput = {
  accountId: string;
  territoryUnitId: string;
  /** Omit to remove every removable affinity for this unit. Product + retired kinds OK. */
  kind?: string;
};

function isRemovableKind(kind: string): boolean {
  return (
    isAccountTerritoryKind(kind) ||
    (ACCOUNT_TERRITORY_RETIRED_KINDS as readonly string[]).includes(kind)
  );
}

export type RemoveSavedTerritoryResult =
  | {
      ok: true;
      removedKinds: string[];
      remainingKinds: string[];
      homeLocked: boolean;
      homeResetAvailableAt: string | null;
    }
  | {
      ok: false;
      error: string;
      status: number;
      homeLocked?: boolean;
      homeResetAvailableAt?: string | null;
    };

/**
 * Remove one affinity or all removable affinities for a territory unit.
 * Home units inside the 30-day cooldown keep `live_here` (and block full remove).
 */
export async function removeSavedTerritory(
  input: RemoveSavedTerritoryInput,
): Promise<RemoveSavedTerritoryResult> {
  if (input.kind && !isRemovableKind(input.kind)) {
    return { ok: false, error: 'Invalid kind', status: 400 };
  }

  const db = getAccountPlacesDb();
  const homeStatus = await getHomeStatus(input.accountId);
  const isHome = homeStatus.unitIds.includes(input.territoryUnitId);
  const homeLocked = isHome && Boolean(homeStatus.homeSetAt) && !homeStatus.canReset;
  const resetAt = homeStatus.homeResetAvailableAt;

  const { data: rows, error: listErr } = await db
    .from('account_places')
    .select('id, kind')
    .eq('account_id', input.accountId)
    .eq('territory_unit_id', input.territoryUnitId);

  if (listErr) {
    return { ok: false, error: listErr.message, status: 500 };
  }

  const existing = (rows ?? []) as { id: string; kind: string }[];
  if (existing.length === 0) {
    return {
      ok: true,
      removedKinds: [],
      remainingKinds: [],
      homeLocked,
      homeResetAvailableAt: resetAt,
    };
  }

  const kindsToRemove = new Set<string>();

  if (input.kind) {
    if (!existing.some((r) => r.kind === input.kind)) {
      return {
        ok: true,
        removedKinds: [],
        remainingKinds: existing.map((r) => r.kind),
        homeLocked,
        homeResetAvailableAt: resetAt,
      };
    }
    if (input.kind === 'live_here' && homeLocked) {
      return {
        ok: false,
        error: `Home areas stay locked until ${formatResetDate(resetAt)}. Reset home from Map layers after that.`,
        status: 423,
        homeLocked: true,
        homeResetAvailableAt: resetAt,
      };
    }
    kindsToRemove.add(input.kind);
  } else {
    for (const row of existing) {
      if (row.kind === 'live_here' && homeLocked) continue;
      kindsToRemove.add(row.kind);
    }
    if (kindsToRemove.size === 0) {
      return {
        ok: false,
        error: `This is part of your home base until ${formatResetDate(resetAt)}. You can’t remove it yet.`,
        status: 423,
        homeLocked: true,
        homeResetAvailableAt: resetAt,
      };
    }
  }

  const ids = existing.filter((r) => kindsToRemove.has(r.kind)).map((r) => r.id);
  if (ids.length === 0) {
    return {
      ok: true,
      removedKinds: [],
      remainingKinds: existing.map((r) => r.kind),
      homeLocked,
      homeResetAvailableAt: resetAt,
    };
  }

  const { error: delErr } = await db.from('account_places').delete().in('id', ids);
  if (delErr) {
    return { ok: false, error: delErr.message, status: 500 };
  }

  const remainingKinds = existing
    .map((r) => r.kind)
    .filter((k) => !kindsToRemove.has(k));

  return {
    ok: true,
    removedKinds: [...kindsToRemove],
    remainingKinds,
    homeLocked,
    homeResetAvailableAt: resetAt,
  };
}

function formatResetDate(iso: string | null): string {
  if (!iso) return 'the cooldown ends';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'the cooldown ends';
  }
}
