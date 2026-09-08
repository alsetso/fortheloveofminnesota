/**
 * Interactive map demo steps — ten tactile interactions on the real /game
 * dock before the surface unlocks.
 *
 * XP budget (live economy: ceiling 112,040 · curve exponent 1.5):
 *
 *   Step 2   claim_streak: claimAllXp() claims the daily streak grant.
 *            Default rate = 250 XP (DEFAULT_SOURCE_XP_BY_TYPE.daily_streak).
 *            250 XP crosses Level 2 threshold (116 XP) → one LevelUpSequence
 *            ceremony: 1→2. Level 3 threshold is 327 XP (reached through play).
 *
 *   Step 8   unlock_territories: +10 XP per territory unit (county / city /
 *            school_district) claimed inside DemoTerritoryUnlockChip.
 *
 *   Steps 10-11  collect_heart / collect_coin — demo soft-collect, 0 XP.
 *
 * Location gate (DemoStreakClaimChip):
 *   Before the claim UI shows, GPS is verified. If no fix after 10s → "no_gps"
 *   message. If fix is outside Minnesota → friendly "outside_mn" message with
 *   "Continue anyway →". In both non-MN cases the demo proceeds.
 *
 * Level thresholds (xpThresholdForLevel(L, 112_040, 1.5)):
 *   Level 2  →   116 XP    Level 3  →   327 XP
 *   Level 4  →   600 XP    Level 5  →   924 XP
 *
 * HUD reveal schedule:
 *   Level bar  → step 2 (claim_streak)
 *   Areas      → step 8 (unlock_territories)
 *   Hearts     → step 10 (collect_heart)
 *   Coins      → step 11 (collect_coin)
 *
 * Persist as account_demo_steps = index + 1.
 */

export type DemoStepKey =
  | 'find_me'
  | 'claim_streak'
  | 'unlock_territories'
  | 'zoom_map'
  | 'rotate_map'
  | 'open_minimap'
  | 'select_point'
  | 'tap_hud'
  | 'collect_heart'
  | 'collect_coin';

export interface DemoStep {
  index: number;
  key: DemoStepKey;
  title: string;
  instruction: string;
  hint: string;
  gotItLabel?: string;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    index: 0,
    key: 'find_me',
    title: 'Find Me',
    instruction: 'Tap the Find Me button (bottom right) to place yourself on the map.',
    hint: 'Your location stays private — Find Me never broadcasts you to other players.',
    gotItLabel: 'I got it',
  },
  {
    index: 1,
    key: 'claim_streak',
    title: 'Daily Streak',
    instruction: 'You started your first streak — claim your XP and watch your level climb.',
    hint: 'Streaks compound: log in every day to multiply your daily XP reward.',
    gotItLabel: 'I got it',
  },
  {
    index: 2,
    key: 'zoom_map',
    title: 'Zoom In',
    instruction: 'Pinch to zoom in and get street-level with the world around you.',
    hint: 'Pinch open to zoom in, pinch closed to zoom back out.',
    gotItLabel: 'I got it',
  },
  {
    index: 3,
    key: 'rotate_map',
    title: 'Rotate Around You',
    instruction: 'Drag left or right to spin the map around your location.',
    hint: 'With Find Me on, the map orbits you — your pin stays fixed at center.',
    gotItLabel: 'I got it',
  },
  {
    index: 4,
    key: 'open_minimap',
    title: 'Object MiniMap',
    instruction: 'Tap the circular minimap (bottom left) to open your Object Radar.',
    hint: 'Nearby 3D finds show up here — direction, distance, and what you can collect.',
    gotItLabel: 'I got it',
  },
  {
    index: 5,
    key: 'tap_hud',
    title: 'Your Standing',
    instruction: 'Tap your level — it\'s your identity. This opens your full Standing profile.',
    hint: 'Standing tracks XP, levels, territories, and every collectible you find across Minnesota.',
    gotItLabel: 'I got it',
  },
  {
    index: 6,
    key: 'unlock_territories',
    title: 'Unlock Your Areas',
    instruction: 'Claim the territories you\'re standing in right now to start your Passport.',
    hint: 'Every county, city, and school district you visit stamps your Passport.',
    gotItLabel: 'I got it',
  },
  {
    index: 7,
    key: 'collect_heart',
    title: 'Collect a Heart',
    instruction: 'Tap the heart model we placed near you to collect it.',
    hint: 'Hearts count toward your Collections and appear on your Standing board.',
    gotItLabel: 'I got it',
  },
  {
    index: 8,
    key: 'collect_coin',
    title: 'Collect a Coin',
    instruction: 'Now tap the coin model near you to collect it.',
    hint: 'Coins are rare world objects — find them scattered across Minnesota.',
    gotItLabel: 'I got it',
  },
  {
    index: 8,
    key: 'select_point',
    title: 'Select a Point',
    instruction: 'Tap anywhere on the map to drop a pin and open selected-point details.',
    hint: 'The dock shows the address — from there you can create a page or a post.',
    gotItLabel: "Let's explore →",
  },
];

export const DEMO_STEPS_TOTAL = DEMO_STEPS.length; // 10

/**
 * Compact rail prompt copy — short enough for the zone-explore chip width.
 */
export function demoStepPrompt(step: DemoStep): string {
  switch (step.key) {
    case 'find_me':
      return 'Tap Find Me (right) to place yourself on the map.';
    case 'claim_streak':
      return 'Your first streak — tap Claim to earn XP.';
    case 'zoom_map':
      return 'Pinch to zoom in — get street-level.';
    case 'rotate_map':
      return 'Drag left or right to spin the map around you.';
    case 'open_minimap':
      return 'Tap the MiniMap (left) to open Object Radar.';
    case 'tap_hud':
      return 'Tap your level (top right) to open your Standing.';
    case 'unlock_territories':
      return "Claim the areas you're in to stamp your Passport.";
    case 'collect_heart':
      return 'Tap the heart model near you to collect it.';
    case 'collect_coin':
      return 'Now tap the coin model near you to collect it.';
    case 'select_point':
      return 'Tap anywhere on the map — see the full dock open.';
    default:
      return step.instruction;
  }
}
