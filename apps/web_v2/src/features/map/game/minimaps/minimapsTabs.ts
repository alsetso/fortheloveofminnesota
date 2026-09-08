/**
 * Minimaps — full-screen sheet opened from the Game MiniMap dial.
 * Three sibling panes behind a floating bottom nav:
 *   objects  — Object Radar map (still-out / collected)
 *   unlocked — passport map of stamped territories (explore-map lens)
 *   records  — list of what's unlocked
 */

export const MINIMAPS_TABS = [
  { id: 'objects', label: 'Objects' },
  { id: 'unlocked', label: 'Unlocked' },
  { id: 'records', label: 'Records' },
] as const;

export type MinimapsTabId = (typeof MINIMAPS_TABS)[number]['id'];

export const MINIMAPS_DEFAULT_TAB: MinimapsTabId = 'objects';

/** Capsule height — matches Own tab bar so the two navs feel like one family. */
export const MINIMAPS_NAV_CAPSULE_PX = 56;
export const MINIMAPS_NAV_FLOAT_GAP_PX = 8;

/**
 * Space map chrome / lists must clear above the floating nav.
 * float gap + capsule + home-indicator.
 */
export const MINIMAPS_NAV_CLEARANCE = `calc(${MINIMAPS_NAV_FLOAT_GAP_PX + MINIMAPS_NAV_CAPSULE_PX}px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)))`;

export function isMinimapsTabId(value: string | null | undefined): value is MinimapsTabId {
  return value === 'objects' || value === 'unlocked' || value === 'records';
}
