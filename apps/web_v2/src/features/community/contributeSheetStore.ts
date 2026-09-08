/**
 * contributeSheetStore — two-step contribution picker state.
 *
 * Step 1: category selection (Report / Highlight / Event / Story / Idea)
 * Step 2: subtype selection within the chosen category
 *
 * Open from anywhere: DockCityPane button, map-click handler, rail shortcut.
 * Pass `ctu: null` for the statewide context.
 *
 * Error state: when `errorMessage` is set, the sheet opens in error-only mode
 * (e.g. tapped outside the GPS accuracy circle) and shows the message instead
 * of the category picker.
 */

import type { ContributionCategoryId } from '@/features/community/contributionTypes';
import { clearOutOfRangePin } from '@/map/points/outOfRangePin';

export type ContributeSheetCtu = {
  id: string;
  name: string;
  /** e.g. "City", "Township", "Borough" */
  kindLabel: string;
};

export type ContributeSheetState = {
  open: boolean;
  /** The CTU the user is contributing to. null = all of Minnesota. */
  ctu: ContributeSheetCtu | null;
  /**
   * Experience zone the user is actively exploring — scopes the contribution
   * to that zone and passes the id through to the post record.
   */
  experienceZoneId?: string | null;
  experienceZoneName?: string | null;
  /** When set, skips directly to the subtype picker for this category. */
  preselectedCategoryId?: ContributionCategoryId;
  /**
   * When set, the sheet opens in error-only mode — shows this message
   * instead of the category/subtype picker. Cleared on close.
   */
  errorMessage?: string;
};

const DEFAULT: ContributeSheetState = { open: false, ctu: null };

let state: ContributeSheetState = DEFAULT;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export function subscribeContributeSheet(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function getContributeSheetSnapshot(): ContributeSheetState {
  return state;
}

export function openContributeSheet(opts: {
  ctu?: ContributeSheetCtu | null;
  experienceZoneId?: string | null;
  experienceZoneName?: string | null;
  preselectedCategoryId?: ContributionCategoryId;
}): void {
  state = {
    open: true,
    ctu: opts.ctu ?? null,
    experienceZoneId: opts.experienceZoneId ?? null,
    experienceZoneName: opts.experienceZoneName ?? null,
    preselectedCategoryId: opts.preselectedCategoryId,
  };
  notify();
}

export function closeContributeSheet(): void {
  if (!state.open) return;
  state = { ...state, open: false };
  notify();
  // Clear the out-of-range ghost pin if one is lingering.
  clearOutOfRangePin();
}

/**
 * Open the sheet in error-only mode — shows `message` instead of the
 * category picker. Used when a map tap lands outside the GPS accuracy circle.
 */
export function openContributeSheetWithError(message: string): void {
  state = { open: true, ctu: null, errorMessage: message };
  notify();
}
