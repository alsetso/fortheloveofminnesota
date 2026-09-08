/**
 * ElementType = named category every world model belongs to.
 * Hex colors drive Mapbox pulse rings (iOS + admin) from world.element_types.
 */

import type { ExpressionSpecification } from 'mapbox-gl';

export type ElementType = {
  slug: string;
  label: string;
  /** Hex color — e.g. '#F59E0B'. */
  color: string;
  sort_order: number;
};

/** Fallback registry when the DB table is unavailable. */
export const ELEMENT_TYPE_FALLBACKS: ElementType[] = [
  { slug: 'prop', label: 'Prop', color: '#FFFFFF', sort_order: 10 },
  { slug: 'animal', label: 'Animal', color: '#10B981', sort_order: 20 },
  { slug: 'vehicle', label: 'Vehicle', color: '#F97316', sort_order: 30 },
  { slug: 'air', label: 'Air', color: '#38BDF8', sort_order: 40 },
  { slug: 'water', label: 'Water', color: '#06B6D4', sort_order: 50 },
  { slug: 'character', label: 'Character', color: '#3B82F6', sort_order: 60 },
  { slug: 'sign', label: 'Sign', color: '#8B5CF6', sort_order: 70 },
  { slug: 'block', label: 'Block', color: '#64748B', sort_order: 80 },
  { slug: 'rides', label: 'Rides', color: '#EC4899', sort_order: 90 },
];

/** Common collectible ring (amber). Rare collectibles use COLLECTIBLE_RARE_COLOR. */
export const COLLECTIBLE_COLOR = '#F59E0B';
export const COLLECTIBLE_RARE_COLOR = '#A855F7';

export function buildColorMap(types: ElementType[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const t of types) map[t.slug] = t.color;
  return map;
}

export function categoryColor(slug: string, types: ElementType[]): string {
  return types.find((t) => t.slug === slug)?.color ?? '#9CA3AF';
}

/** Mapbox `match` on feature `category` → hex from the live registry. */
export function buildCategoryColorExpression(
  colors: Record<string, string>,
): ExpressionSpecification {
  const expr: unknown[] = ['match', ['get', 'category']];
  for (const [slug, color] of Object.entries(colors)) {
    expr.push(slug, color);
  }
  expr.push('#9CA3AF');
  return expr as ExpressionSpecification;
}

/**
 * Pulse ring stroke: collectible (rare → violet / common → amber) beats category;
 * non-interactive props stay white; otherwise category color from registry.
 */
export function buildPulseStrokeExpression(
  colors: Record<string, string>,
): ExpressionSpecification {
  const cat = buildCategoryColorExpression(colors);
  return [
    'case',
    ['boolean', ['get', 'collectible'], false],
    [
      'case',
      ['boolean', ['get', 'rare'], false],
      COLLECTIBLE_RARE_COLOR,
      COLLECTIBLE_COLOR,
    ],
    [
      'all',
      ['==', ['get', 'category'], 'prop'],
      ['==', ['get', 'interaction'], 'none'],
    ],
    '#FFFFFF',
    cat,
  ];
}

/** LOD / fill color follows the same registry + collectible override. */
export function buildPulseFillExpression(
  colors: Record<string, string>,
): ExpressionSpecification {
  return buildPulseStrokeExpression(colors);
}
