/**
 * World 3D model catalog types + URL resolution.
 * Runtime list is hydrated from Supabase via /api/world/models (see catalogStore).
 */

import type { ModelPurpose, ModelVerbDb, ObjectClass } from '@/features/map/game/world/modelVerbs';
export type { ObjectClass };

/** Stable client/runtime id — matches world.world_models.slug. */
export type WorldModelSlug = string;

/**
 * Strongly-typed verb payload. Shape is per-verb; unknown verbs are Record.
 * Admin writes this as jsonb; iOS reads and narrows at runtime.
 */
export type TapPayload =
  | { verb?: 'info';      url: string; ctaLabel?: string }
  | { verb?: 'unlock';    unlockSku: string }
  | { verb?: 'redeem';    codeKind: string; label?: string }
  | { verb?: 'challenge'; questId?: string; stepIndex?: number; [key: string]: unknown }
  | Record<string, unknown>; // future verbs

export type WorldModelSpec = {
  /** Mapbox `addModel` id. */
  id: string;
  /** Public GLB URL served by this app. */
  url: string;
  /** Default Mapbox model-scale before placement scale_multiplier. */
  scale: [number, number, number];
  rotation: [number, number, number];
  /** Catalog default yaw (degrees) — same as rotation[2], explicit for pose resolve. */
  defaultRotationZ?: number;
  /** Catalog default altitude meters AGL when placement.altitudeMeters is null. */
  defaultHeightMeters?: number;
  /**
   * Largest real-world dimension (meters) used for map hit-plane sizing.
   * From world.world_models.real_world_meters when known.
   */
  realWorldMeters?: number | null;
  label: string;
  slug: WorldModelSlug;
  category: string;
  /** Hashtag slugs from world.world_model_tags (no leading #). */
  tags: string[];
  active: boolean;
  /** True when the GLB exists under apps/ios/public. */
  available: boolean;
  allowUserScale: boolean;
  sortOrder: number;
  /**
   * Tap verb (DB column `interaction`).
   * Prefer {@link resolveModelVerb} — legacy `none` means see.
   */
  interaction?: ModelVerbDb;
  /** North-star purpose branch (DB `purpose`). */
  purpose?: ModelPurpose;
  /**
   * Admin-confirmed flag — this model may be placed by players from the
   * Drop Catalog in the selected-point toolbar.
   * Default false: admin must explicitly opt each model in.
   * Omitted in offline fallback records (treated as false).
   */
  playerPlaceable?: boolean;
  /** Verb-specific payload — typed per verb, validated at runtime. */
  tapPayload?: TapPayload | null;
  /** What happens to the placement once collected. */
  onCollect?: 'remove' | 'stay';
  /**
   * Rare finds stay on the map for claim but stay off Collectibles until
   * the account has claimed at least one. Claim slots = placement.total_available.
   */
  rare?: boolean;
  reward?: WorldModelReward | null;
  /** Discovery card title (DB found_header). Null = verb-aware default. */
  foundHeader?: string | null;
  /** Discovery card body (DB found_footer). Null = verb-aware default. */
  foundFooter?: string | null;
};

export type WorldModelReward = {
  /** credits → tool_credits wallet; hearts → collection progress (not spendable). */
  type: 'credits' | 'hearts' | 'stat' | 'loot';
  amount?: number;
  key?: string;
  item?: string;
  /** XP granted on collect — also the weight used in the account-wide XP ceiling. */
  xp?: number;
};

/** GeoJSON source for all placed world models. */
export const WORLD_PLACEMENTS_SOURCE_ID = 'ftlomn-world-placements';
/** Prefix for per-slug Mapbox model layers. */
export const WORLD_PLACEMENTS_LAYER_PREFIX = 'ftlomn-world-model';
/** Shared ground pulse ring (visual only — not the primary tap target). */
export const WORLD_PLACEMENT_HIT_LAYER_ID = 'ftlomn-world-placement-hit';
/**
 * 2D circle fallback when zoomed out. Must share WORLD_PLACEMENTS_SOURCE_ID —
 * never add this layer until that source is on the current style.
 */
export const WORLD_LOD_CIRCLE_LAYER_ID = 'ftlomn-world-lod-circles';
/** 3D model layers hidden below this zoom; LOD circles take over. */
export const WORLD_LOD_3D_MIN_ZOOM = 15;
/**
 * Camera-facing vertical hit plane (transparent symbol).
 * Same footprint as the model silhouette; always rotates toward the viewport.
 */
export const WORLD_PLACEMENT_HIT_BILLBOARD_LAYER_ID =
  'ftlomn-world-placement-hit-billboard';
/** Runtime image id for the clear hit plane (added via map.addImage). */
export const WORLD_PLACEMENT_HIT_BILLBOARD_IMAGE_ID =
  'ftlomn-world-placement-hit-plane';
/** Source PNG size for the hit plane — icon-size scales this to meters. */
export const WORLD_PLACEMENT_HIT_BILLBOARD_IMAGE_PX = 128;

export function worldModelLayerId(slug: WorldModelSlug): string {
  // Layer ids must be CSS-selector safe-ish; slugs are already kebab-case.
  return `${WORLD_PLACEMENTS_LAYER_PREFIX}-${slug}`;
}

export function worldModelRuntimeId(slug: WorldModelSlug): string {
  return `ftlomn-world-${slug}`;
}

/**
 * Resolve DB file_path → app-public URL.
 * Legacy `/3d_models/Foo Bar.glb` → `/models/world/{slug}.glb`.
 */
export function resolveWorldModelUrl(
  filePath: string,
  slug: WorldModelSlug,
): string {
  if (filePath.startsWith('/models/')) return filePath;
  if (filePath.startsWith('/3d_models/')) {
    return `/models/world/${slug}.glb`;
  }
  return filePath;
}

/** Uniform scale from DB meters metadata (clamped for Mapbox sanity). */
export function scaleFromMeters(
  realWorldMeters: number | null | undefined,
  nativeUnitsMax: number | null | undefined,
): [number, number, number] {
  const meters = Number(realWorldMeters);
  const native = Number(nativeUnitsMax);
  const m = Number.isFinite(meters) && meters > 0 ? meters : 1;
  const n = Number.isFinite(native) && native > 0 ? native : 1;
  // Props historically used ~6; meter-accurate models stay closer to m/n.
  const s = Math.min(Math.max(m / n, 0.005), 40);
  return [s, s, s];
}

/**
 * Minimal offline bootstrap — only the three collect slugs that must work
 * before the API hydrates (setup tutorial / demo mode).
 * Full catalog comes from Supabase via world_list_models.
 *
 * DO NOT expand this list. Add new models in the DB; they stream in at runtime.
 */
export const FALLBACK_WORLD_MODELS: WorldModelSpec[] = [
  {
    id: 'ftlomn-world-flag-quaternius',
    url: '/models/props/flag-quaternius.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Flag',
    slug: 'flag-quaternius',
    category: 'prop',
    tags: ['prop', 'civic'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 30,
  },
  {
    id: 'ftlomn-world-wooden-sign-ipoly3d',
    url: '/models/props/wooden-sign-ipoly3d.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Wooden sign',
    slug: 'wooden-sign-ipoly3d',
    category: 'prop',
    tags: ['prop', 'sign'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 10,
  },
  {
    id: 'ftlomn-world-billboard-poly',
    url: '/models/props/billboard-poly.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Billboard',
    slug: 'billboard-poly',
    category: 'prop',
    tags: ['prop', 'signage'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 40,
  },
  {
    id: 'ftlomn-world-tree-quaternius',
    url: '/models/props/tree-quaternius.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Tree',
    slug: 'tree-quaternius',
    category: 'prop',
    tags: ['prop', 'nature'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 50,
  },
  {
    id: 'ftlomn-world-cow-poly',
    url: '/models/props/cow-poly.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Cow',
    slug: 'cow-poly',
    category: 'prop',
    tags: ['prop', 'wildlife'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 60,
  },
  {
    id: 'ftlomn-world-chicken-jeremy',
    url: '/models/props/chicken-jeremy.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Chicken',
    slug: 'chicken-jeremy',
    category: 'prop',
    tags: ['prop', 'wildlife'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 70,
  },
  {
    id: 'ftlomn-world-chicken-coop-quaternius',
    url: '/models/props/chicken-coop-quaternius.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Chicken coop',
    slug: 'chicken-coop-quaternius',
    category: 'prop',
    tags: ['prop', 'structure'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 80,
  },
  {
    id: 'ftlomn-world-cat-poly',
    url: '/models/props/cat-poly.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Cat',
    slug: 'cat-poly',
    category: 'prop',
    tags: ['prop', 'wildlife'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 90,
  },
  {
    id: 'ftlomn-world-beagle-poly',
    url: '/models/props/beagle-poly.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Beagle',
    slug: 'beagle-poly',
    category: 'prop',
    tags: ['prop', 'wildlife'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 100,
  },
  {
    id: 'ftlomn-world-fox-poly',
    url: '/models/props/fox-poly.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Fox',
    slug: 'fox-poly',
    category: 'prop',
    tags: ['prop', 'wildlife'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 110,
  },
  {
    id: 'ftlomn-world-coin-quaternius',
    url: '/models/props/coin-quaternius.glb',
    scale: [8, 8, 8],
    rotation: [0, 0, 0],
    label: 'Credit',
    slug: 'coin-quaternius',
    category: 'prop',
    tags: ['prop', 'collectible', 'credits'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 20,
    interaction: 'collect',
    onCollect: 'remove',
    rare: true,
    // Map credit find → wallet.tool_credits (amount 1). Keep in sync with world.world_models.
    reward: { type: 'credits', amount: 1, xp: 100 },
  },
  {
    id: 'ftlomn-world-heart-quaternius',
    url: '/models/props/heart-quaternius.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Heart',
    slug: 'heart-quaternius',
    category: 'prop',
    tags: ['prop', 'collectible', 'heart'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 21,
    interaction: 'collect',
    onCollect: 'remove',
    rare: false,
    reward: { type: 'hearts', amount: 1, xp: 50 },
  },
  {
    id: 'ftlomn-world-treasure-chest-safayan',
    url: '/models/props/treasure-chest-safayan.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Treasure chest',
    slug: 'treasure-chest-safayan',
    category: 'prop',
    tags: ['prop', 'collectible', 'credits'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 120,
    interaction: 'collect',
    onCollect: 'remove',
    rare: true,
    // Bigger map credit find → wallet.tool_credits (amount 5).
    reward: { type: 'credits', amount: 5, xp: 500 },
  },
  {
    id: 'ftlomn-world-fish-kenney',
    url: '/models/props/fish-kenney.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Fish',
    slug: 'fish-kenney',
    category: 'animal',
    tags: ['animal', 'wildlife', 'prop', 'fishing', 'water'],
    active: false,
    available: false,
    allowUserScale: true,
    sortOrder: 125,
    interaction: 'none',
    onCollect: 'remove',
    reward: { type: 'stat', key: 'fish', xp: 5 },
  },
  {
    id: 'ftlomn-world-graduation-cap-poly',
    url: '/models/props/graduation-cap-poly.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Graduation cap',
    slug: 'graduation-cap-poly',
    category: 'prop',
    tags: ['prop', 'school', 'education', 'civic'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 126,
  },
  {
    id: 'ftlomn-world-lure-quaternius',
    url: '/models/props/lure-quaternius.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Lure',
    slug: 'lure-quaternius',
    category: 'prop',
    tags: ['prop', 'fishing', 'water', 'sport'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 127,
  },
  {
    id: 'ftlomn-world-fishing-pole-westphal',
    url: '/models/props/fishing-pole-westphal.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Fishing pole',
    slug: 'fishing-pole-westphal',
    category: 'prop',
    tags: ['prop', 'fishing', 'water', 'sport'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 128,
  },
  {
    id: 'ftlomn-world-market-stalls-quaternius',
    url: '/models/props/market-stalls-quaternius.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Market stalls',
    slug: 'market-stalls-quaternius',
    category: 'prop',
    tags: ['prop', 'farmers-market', 'fruit', 'structure'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 129,
  },
  {
    id: 'ftlomn-world-apple-jeremy',
    url: '/models/props/apple-jeremy.glb',
    scale: [6, 6, 6],
    rotation: [0, 0, 0],
    label: 'Apple',
    slug: 'apple-jeremy',
    category: 'prop',
    tags: ['prop', 'fruit', 'farmers-market'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 130,
  },
];

// ── Block builder ────────────────────────────────────────────────────────────
// Three Quaternius blocks seeded locally — no API row needed to place them.
// scale [1,1,1] ≈ 1 m³ ground cube at Mapbox street zoom.
export const BLOCK_BUILDER_SLUGS = [
  'dirt-block-quaternius',
  'brick-block-quaternius',
  'blank-block-quaternius',
] as const;

export type BlockBuilderSlug = (typeof BLOCK_BUILDER_SLUGS)[number];

export const BLOCK_BUILDER_META: Record<
  BlockBuilderSlug,
  { label: string; color: string }
> = {
  'dirt-block-quaternius':  { label: 'Dirt',  color: '#8B6530' },
  'brick-block-quaternius': { label: 'Brick', color: '#B22222' },
  'blank-block-quaternius': { label: 'Blank', color: '#9CA3AF' },
};

FALLBACK_WORLD_MODELS.push(
  {
    id: 'ftlomn-world-dirt-block-quaternius',
    url: '/models/props/dirt-block-quaternius.glb',
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
    label: 'Dirt block',
    slug: 'dirt-block-quaternius',
    category: 'block',
    tags: ['block', 'build'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 200,
  },
  {
    id: 'ftlomn-world-brick-block-quaternius',
    url: '/models/props/brick-block-quaternius.glb',
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
    label: 'Brick block',
    slug: 'brick-block-quaternius',
    category: 'block',
    tags: ['block', 'build'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 201,
  },
  {
    id: 'ftlomn-world-blank-block-quaternius',
    url: '/models/props/blank-block-quaternius.glb',
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
    label: 'Blank block',
    slug: 'blank-block-quaternius',
    category: 'block',
    tags: ['block', 'build'],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 202,
  },
);

/** @deprecated Prefer getWorldCatalog() from catalogStore. */
export const WORLD_MODEL_CATALOG: Record<string, WorldModelSpec> =
  Object.fromEntries(FALLBACK_WORLD_MODELS.map((m) => [m.slug, m]));

/** @deprecated Prefer getWorldCatalogSlugs(). */
export const WORLD_MODEL_KINDS: WorldModelSlug[] = FALLBACK_WORLD_MODELS.map(
  (m) => m.slug,
);

export function isWorldModelKind(value: unknown): value is WorldModelSlug {
  return typeof value === 'string' && value.length > 0;
}

export function worldModelKindForSlug(slug: string): WorldModelSlug | null {
  return slug || null;
}

/**
 * Ground ring under each placement (pulse visual).
 * Tap targeting uses WORLD_PLACEMENT_HIT_BILLBOARD_LAYER_ID instead.
 */
export const WORLD_PLACEMENT_PULSE = {
  /** Fallback ring color — live colors come from world.element_types via elementTypesStore. */
  color: '#FFFFFF',
  strokeWidth: 1.75,
  radiusPx: 22,
  periodMs: 2600,
  opacityMin: 0.18,
  opacityMax: 0.72,
  hoverColor: '#FFFFFF',
  hoverFillOpacity: 0.42,
  hoverStrokeWidth: 2.75,
  hoverStrokeOpacity: 0.95,
  hoverRadiusPx: 28,
} as const;

/**
 * Vertical hit-plane sizing.
 * Screen size tracks model meters via zoom; floored so far taps stay finger-friendly.
 */
export const WORLD_PLACEMENT_HIT_BILLBOARD = {
  /** ~lat 45° meters-per-pixel at zoom 0 (Web Mercator). */
  metersPerPixelZoom0: 156543.03392 * Math.cos((45 * Math.PI) / 180),
  /** Soft floor so tiny distant models stay tappable (~36px). */
  minIconSize: 36 / WORLD_PLACEMENT_HIT_BILLBOARD_IMAGE_PX,
  /** Slight pad past the mesh silhouette. */
  sizePad: 1.08,
  /** Fallback meters when catalog has no real_world_meters. */
  defaultMeters: 2,
} as const;

/** Full yaw revolution period for collectible models (ms). */
export const WORLD_COLLECTIBLE_SPIN_PERIOD_MS = 4800;
