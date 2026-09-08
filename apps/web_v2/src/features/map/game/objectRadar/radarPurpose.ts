/**
 * Object Radar — purpose colors + which verbs appear on the dial / map.
 */

import {
  MODEL_PURPOSES,
  PURPOSE_BRANCH,
  isInteractiveVerb,
  resolveModelPurpose,
  resolveModelVerb,
  type ModelPurpose,
  type ModelVerb,
} from '@/features/map/game/world/modelVerbs';

/** Classic collectible slugs keep their brand colors on the dial. */
export const CLASSIC_COLLECTIBLE_COLORS: Record<string, string> = {
  'heart-quaternius': '#e85a6b',
  'coin-quaternius': '#e8b84a',
  'treasure-chest-safayan': '#c9863a',
};

/** Experience-zone fill + outline on the Object Radar map (preview + venue). */
export const OBJECT_MAP_ZONE_FILL = '#8B5CF6';
export const OBJECT_MAP_ZONE_STROKE = '#A78BFA';

export const PURPOSE_COLORS: Record<ModelPurpose, string> = {
  presence: '#9ca3af',
  utility: '#5BA3FF',
  collectible: '#e85a6b',
  progress: '#34C759',
  story: '#AF52DE',
  social: '#FF9F0A',
  redeem: '#FFD60A',
};

export type ObjectRadarPurposeFilter = 'all' | ModelPurpose;

export const OBJECT_RADAR_PURPOSE_FILTERS: readonly {
  id: ObjectRadarPurposeFilter;
  label: string;
}[] = [
  { id: 'all', label: 'All' },
  ...MODEL_PURPOSES.map((id) => ({
    id,
    label: PURPOSE_BRANCH[id].label,
  })),
];

export function radarColorFor(
  purpose: ModelPurpose,
  slug: string,
): string {
  return CLASSIC_COLLECTIBLE_COLORS[slug] ?? PURPOSE_COLORS[purpose];
}

/** Still-out radar includes anything that opens a tap flow (not silent scenery). */
export function isRadarStillOutVerb(verb: ModelVerb): boolean {
  return isInteractiveVerb(verb);
}

export function resolveRadarPurpose(
  purpose: string | null | undefined,
  interaction: string | null | undefined,
): ModelPurpose {
  const verb = resolveModelVerb(interaction);
  return resolveModelPurpose(purpose, verb);
}

export type ObjectRadarPurposeCounts = Record<ModelPurpose, number>;

export function emptyPurposeCounts(): ObjectRadarPurposeCounts {
  return {
    presence: 0,
    utility: 0,
    collectible: 0,
    progress: 0,
    story: 0,
    social: 0,
    redeem: 0,
  };
}

export function purposeLegendOrder(): ModelPurpose[] {
  // Collectible / utility first — what players care about in Explore.
  return [
    'collectible',
    'utility',
    'progress',
    'story',
    'redeem',
    'social',
    'presence',
  ];
}
