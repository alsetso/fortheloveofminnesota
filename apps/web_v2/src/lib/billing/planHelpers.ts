/**
 * Billing plan helpers — mirrors web `lib/billing/planHelpers` for avatar chrome.
 * hobby is free; contributor / professional / executive are paid.
 */

export function isPaidPlan(plan: string | null | undefined): boolean {
  if (!plan) return false;
  return ['contributor', 'professional', 'executive'].includes(plan.toLowerCase());
}

export type DockAvatarRingSize = 'sm' | 'lg';

const RING_SIZE: Record<DockAvatarRingSize, string> = {
  /** Explore dock pill */
  sm: 'relative inline-flex h-11 w-11 shrink-0 rounded-full p-[2px]',
  /** Account dock card */
  lg: 'relative inline-flex h-[4.25rem] w-[4.25rem] shrink-0 rounded-full p-[3px]',
};

const BADGE_SIZE: Record<DockAvatarRingSize, string> = {
  /** Inset inside the circle, bottom-right */
  sm: 'bottom-0.5 right-0.5 h-3.5 w-3.5 rounded text-[8px]',
  lg: 'bottom-1 right-1 h-5 w-5 rounded-md text-[10px]',
};

/**
 * Outer plan ring for dock avatars (`relative` so the level badge can sit on the rim).
 * Paid: gold. Hobby: grey. One ring only — no stacked XP glow.
 */
export function getDockAvatarRingClass(
  plan: string | null | undefined,
  size: DockAvatarRingSize = 'lg',
): string {
  const base = RING_SIZE[size];
  return isPaidPlan(plan)
    ? `${base} bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600`
    : `${base} bg-neutral-400`;
}

/** Inner clip so the image sits inside the plan ring. */
export function getDockAvatarInnerClass(_plan?: string | null): string {
  return 'h-full w-full overflow-hidden rounded-full bg-white';
}

/**
 * Square level badge — sits inside the avatar circle at bottom-right.
 * Ring color matches the plan border (gold paid / grey hobby).
 */
export function getDockAvatarLevelBadgeClass(
  plan: string | null | undefined,
  size: DockAvatarRingSize = 'lg',
): string {
  const base = `absolute z-10 flex ${BADGE_SIZE[size]} items-center justify-center font-bold leading-none tabular-nums shadow-sm`;
  return isPaidPlan(plan)
    ? `${base} bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 text-white ring-2 ring-yellow-500`
    : `${base} bg-neutral-500 text-white ring-2 ring-neutral-400`;
}
