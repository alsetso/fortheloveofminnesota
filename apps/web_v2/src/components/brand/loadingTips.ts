/**
 * Map tips shown during cold splash.
 * Prefer `useLoadingTip` in client components — `pickRandomLoadingTip` must
 * not run during SSR (Math.random → hydration mismatch).
 */

export const LOADING_TIPS = [
  'Tap Find Me to snap the camera to your location and start walking the map from where you are.',
  'Switch Live when you want the avatar to follow your GPS; use Scout to roam ahead and explore freely.',
  'Pinch to zoom and drag to pan — the game map stays street-level so nearby objects stay readable.',
  'Walk into a glowing Experience Zone, then tap Yes to load that zone’s placements and content pack.',
  'Objects only collect inside the Object Radar ring around you — get closer before you tap.',
  'Follow Interests to thin the map; leave them empty if you want to see everything.',
  'Set a city as Live, Work, or Follow, and turn on notify so you hear posts from places you care about.',
  'Drop pins as Event, Marketplace, Promotion, or Note — Kind is the verb; Place is where it lives.',
  'Earn XP by showing up: daily streak, territory presence, and claiming standing rewards when they land.',
  'Open a zone from Play, then Open on map to jump straight to that experience’s centroid.',
] as const;

export type LoadingTip = (typeof LOADING_TIPS)[number];

export function pickRandomLoadingTip(): LoadingTip {
  const i = Math.floor(Math.random() * LOADING_TIPS.length);
  return LOADING_TIPS[i] ?? LOADING_TIPS[0];
}
