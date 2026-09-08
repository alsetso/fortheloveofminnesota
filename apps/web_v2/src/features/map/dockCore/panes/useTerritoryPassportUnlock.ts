'use client';

/** Passport visit unlock for atlas territory detail panes. */

import { useAuthSafe } from '@/features/auth';
import { usePassport } from '@/features/accountTerritories/store/usePassport';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';

/** Atlas kinds that unlock via visiting (passport / presence). */
export const PASSPORT_UNLOCKABLE_KINDS = new Set<DockEntity['kind']>([
  'county',
  'ctu',
  'school_district',
  // district / senate_district / house_district: hidden for first launch
]);

export function isPassportUnlockableKind(kind: DockEntity['kind']): boolean {
  return PASSPORT_UNLOCKABLE_KINDS.has(kind);
}

/**
 * Visit gate for territory details — About stays public; everything below
 * unlocks after the account has traveled there (or for non-passport kinds).
 */
export function useTerritoryPassportUnlock(entity: DockEntity): {
  unlockable: boolean;
  /** Passport still loading for a signed-in account. */
  loading: boolean;
  /** True when deeper sections may render. */
  unlocked: boolean;
  /** Unlockable place the user has not visited yet (or signed out). */
  locked: boolean;
  /** XP credited for this specific unlock (null when locked or not-passport). */
  xpEarned: number | null;
} {
  const unlockable = isPassportUnlockableKind(entity.kind);
  const { account } = useAuthSafe();
  const { passport, loading: passportLoading } = usePassport(account?.id ?? null);

  if (!unlockable) {
    return { unlockable: false, loading: false, unlocked: true, locked: false, xpEarned: null };
  }

  if (!account) {
    return { unlockable: true, loading: false, unlocked: false, locked: true, xpEarned: null };
  }

  const loading = passportLoading && !passport;
  if (loading) {
    return { unlockable: true, loading: true, unlocked: false, locked: false, xpEarned: null };
  }

  const unlockedRecord = passport?.unlocked.find(
    (u) => u.unitKind === entity.kind && u.unitId === entity.id,
  );
  const visited = Boolean(unlockedRecord);

  return {
    unlockable: true,
    loading: false,
    unlocked: visited,
    locked: !visited,
    xpEarned: unlockedRecord?.xpAmount ?? null,
  };
}
