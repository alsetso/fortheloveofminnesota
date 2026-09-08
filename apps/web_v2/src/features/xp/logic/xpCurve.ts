/**
 * Client-side mirror of public.recompute_account_level() / xp_ceiling math.
 * frac = (level-1)/98, threshold(level) = frac^exponent * ceiling.
 * exponent defaults to 1 (today's linear curve) but the admin "Game
 * information" economy panel can publish a different value — always pass
 * the curveExponent that came back from /api/account/level or
 * /api/account/passport rather than assuming linear.
 */

export function xpThresholdForLevel(level: number, ceiling: number, exponent: number = 1): number {
  const safeCeiling = Math.max(1, ceiling);
  const safeExponent = Math.max(0.01, exponent);
  const safeLevel = Math.max(1, Math.min(99, Math.floor(level)));
  const frac = (safeLevel - 1) / 98;
  return Math.ceil(Math.pow(frac, safeExponent) * safeCeiling);
}

export function xpSpanForLevel(level: number, ceiling: number, exponent: number = 1): number {
  if (level >= 99) return 1;
  return Math.max(
    1,
    xpThresholdForLevel(level + 1, ceiling, exponent) - xpThresholdForLevel(level, ceiling, exponent),
  );
}

/** XP earned inside the current level band (0 … span). */
export function xpIntoLevel(totalXp: number, level: number, ceiling: number, exponent: number = 1): number {
  return Math.max(0, totalXp - xpThresholdForLevel(level, ceiling, exponent));
}

/** 0–1 progress through the current level band. */
export function progressInLevel(totalXp: number, level: number, ceiling: number, exponent: number = 1): number {
  if (level >= 99) return 1;
  const span = xpSpanForLevel(level, ceiling, exponent);
  return Math.max(0, Math.min(1, xpIntoLevel(totalXp, level, ceiling, exponent) / span));
}

/** Level for a claimed XP total — same clamp + ratchet-free formula as recompute_account_level. */
export function levelFromXp(totalXp: number, ceiling: number, exponent: number = 1): number {
  const safeCeiling = Math.max(1, ceiling);
  const safeExponent = Math.max(0.01, exponent);
  const pct = Math.min(Math.max(totalXp, 0) / safeCeiling, 1);
  const frac = Math.pow(pct, 1 / safeExponent);
  return Math.max(1, Math.min(99, 1 + Math.floor(frac * 98)));
}
