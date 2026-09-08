'use client';

/**
 * /setup demo chrome context — controls which GameDock elements are unlocked
 * for the current tutorial step, and hosts the coach chip in the rail slot.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { DemoStepKey } from '@/features/setup/demoSteps';

export type DemoMapChromeValue = {
  stepKey: DemoStepKey;
  /** Compact rail prompt — sits in the ExperienceZoneBanner slot. */
  panel: ReactNode;
};

const DemoMapChromeContext = createContext<DemoMapChromeValue | null>(null);

export function DemoMapChromeProvider({
  value,
  children,
}: {
  value: DemoMapChromeValue | null;
  children: ReactNode;
}) {
  return (
    <DemoMapChromeContext.Provider value={value}>
      {children}
    </DemoMapChromeContext.Provider>
  );
}

export function useDemoMapChrome(): DemoMapChromeValue | null {
  return useContext(DemoMapChromeContext);
}

// ─── Per-element reveal gates ─────────────────────────────────────────────────
// Steps: find_me(0) → claim_streak(1) → zoom_map(2) → rotate_map(3)
//        → open_minimap(4) → tap_hud(5) → unlock_territories(6)
//        → collect_heart(7) → collect_coin(8) → select_point(9)

const STEP_ORDER: DemoStepKey[] = [
  'find_me',
  'claim_streak',
  'zoom_map',
  'rotate_map',
  'open_minimap',
  'tap_hud',
  'unlock_territories',
  'collect_heart',
  'collect_coin',
  'select_point',
];

function stepIndex(key: DemoStepKey | null | undefined): number {
  if (!key) return STEP_ORDER.length; // no demo = everything visible
  return STEP_ORDER.indexOf(key);
}

function atOrPast(key: DemoStepKey | null | undefined, target: DemoStepKey): boolean {
  return stepIndex(key) >= stepIndex(target);
}

/** Find Me — visible from step 1 (the first step IS Find Me). */
export function demoShowsFindMe(_key: DemoStepKey | null | undefined): boolean {
  return true; // always shown
}

/** Object MiniMap — visible from step 4 (open_minimap) onward. */
export function demoShowsMinimap(key: DemoStepKey | null | undefined): boolean {
  return atOrPast(key, 'open_minimap');
}

/**
 * Stats HUD container — visible from step 2 (claim_streak) onward.
 * Shows the level bar right as the user first earns XP so they see their
 * progress bar fill during the level-up ceremonies at that step.
 * Individual stat counts are gated separately below.
 */
export function demoShowsTopChrome(key: DemoStepKey | null | undefined): boolean {
  return atOrPast(key, 'claim_streak');
}

/** Areas count — shown from unlock_territories (step 8) onward. */
export function demoShowsAreas(key: DemoStepKey | null | undefined): boolean {
  return atOrPast(key, 'unlock_territories');
}

/** Hearts count — shown from collect_heart (step 10) onward. */
export function demoShowsHearts(key: DemoStepKey | null | undefined): boolean {
  return atOrPast(key, 'collect_heart');
}

/** Coins count — shown from collect_coin (step 11) onward. */
export function demoShowsCoins(key: DemoStepKey | null | undefined): boolean {
  return atOrPast(key, 'collect_coin');
}
