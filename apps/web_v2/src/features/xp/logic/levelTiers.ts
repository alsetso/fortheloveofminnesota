/** Level → tier chrome. Five bands across the 1–99 range, each with its own
 * ring glow — worn everywhere the avatar renders, not just the Account card. */

export type LevelTier = {
  name: string;
  ringClass: string;
};

const TIERS: LevelTier[] = [
  { name: 'Explorer', ringClass: 'shadow-[0_0_0_2px_rgba(148,163,184,0.55)]' }, // 1-19 · slate
  { name: 'Ranger', ringClass: 'shadow-[0_0_0_2px_rgba(74,222,128,0.6)]' }, // 20-39 · green
  { name: 'Voyager', ringClass: 'shadow-[0_0_0_2px_rgba(91,163,255,0.65)]' }, // 40-59 · lake blue
  { name: 'Vanguard', ringClass: 'shadow-[0_0_0_2px_rgba(192,132,252,0.65)]' }, // 60-79 · violet
  { name: 'Legend', ringClass: 'shadow-[0_0_0_2px_rgba(250,204,21,0.75)]' }, // 80-99 · gold
];

export function getLevelTier(level: number): LevelTier {
  const idx = Math.min(TIERS.length - 1, Math.max(0, Math.floor((Math.max(1, level) - 1) / 20)));
  return TIERS[idx];
}

/** Extra glow ring layered under/around the existing plan-based avatar ring. */
export function getLevelRingGlowClass(level: number | null | undefined): string {
  if (!level) return '';
  return `rounded-full ${getLevelTier(level).ringClass}`;
}
