/**
 * Parses Mapbox `queryRenderedFeatures` results at a clicked point into
 * human-readable surface chips: water type, road name, land use, labels.
 *
 * Filters out all our own ftlomn-* layers so only Mapbox basemap data surfaces.
 * Works across both Mapbox Streets and Mapbox Standard styles.
 */

import type { MapboxGeoJSONFeature } from 'mapbox-gl';

export type SurfaceFeatureKind = 'water' | 'road' | 'landuse' | 'label' | 'transit';

export type SurfaceFeature = {
  kind: SurfaceFeatureKind;
  /** Primary text — feature name or class label. */
  label: string;
  /** Supporting text — e.g. "River" when the label is the proper name. */
  sublabel?: string;
  emoji: string;
};

// ─── Own-source guard ─────────────────────────────────────────────────────────

const OWN_PREFIX = 'ftlomn-';
const OWN_MAPBOX_SOURCES = new Set(['composite', 'mapbox-streets', 'mapbox']);

function isOwnSource(sourceId: string | undefined): boolean {
  return Boolean(sourceId?.startsWith(OWN_PREFIX));
}

// ─── Water ────────────────────────────────────────────────────────────────────

const WATER_CLASS_LABEL: Record<string, string> = {
  lake: 'Lake',
  river: 'River',
  river_bank: 'River',
  stream: 'Stream',
  canal: 'Canal',
  pond: 'Pond',
  reservoir: 'Reservoir',
  ocean: 'Ocean',
  sea: 'Sea',
  bay: 'Bay',
  lagoon: 'Lagoon',
  swimming_pool: 'Pool',
  dock: 'Dock',
  ditch: 'Stream',
  drain: 'Stream',
};

const WATERWAY_CLASS_LABEL: Record<string, string> = {
  river: 'River',
  stream: 'Stream',
  canal: 'Canal',
  drain: 'Drain',
  ditch: 'Ditch',
};

function waterEmoji(cls: string): string {
  if (cls === 'ocean' || cls === 'sea' || cls === 'bay') return '🌊';
  if (cls === 'river' || cls === 'river_bank' || cls === 'stream' || cls === 'canal') return '🏞️';
  if (cls === 'lake' || cls === 'pond' || cls === 'reservoir' || cls === 'lagoon') return '💧';
  return '💧';
}

// ─── Road ─────────────────────────────────────────────────────────────────────

const ROAD_CLASS_LABEL: Record<string, string> = {
  motorway: 'Highway',
  motorway_link: 'Highway ramp',
  trunk: 'Trunk road',
  trunk_link: 'Trunk ramp',
  primary: 'Major road',
  primary_link: 'Road',
  secondary: 'Road',
  secondary_link: 'Road',
  tertiary: 'Road',
  tertiary_link: 'Road',
  street: 'Street',
  street_limited: 'Street',
  service: 'Service road',
  track: 'Track',
  path: 'Path',
  pedestrian: 'Pedestrian way',
  ferry: 'Ferry route',
  golf: 'Golf path',
  construction: 'Under construction',
};

function roadEmoji(cls: string): string {
  if (cls === 'motorway' || cls === 'trunk' || cls === 'motorway_link' || cls === 'trunk_link') return '🛣️';
  if (cls === 'ferry') return '⛴️';
  if (cls === 'path' || cls === 'pedestrian' || cls === 'track') return '🚶';
  return '🛤️';
}

// ─── Landuse ──────────────────────────────────────────────────────────────────

const LANDUSE_CLASS_INFO: Record<string, { label: string; emoji: string }> = {
  park: { label: 'Park', emoji: '🌳' },
  wood: { label: 'Forest', emoji: '🌲' },
  pitch: { label: 'Sports field', emoji: '⚽' },
  grass: { label: 'Grassy area', emoji: '🌿' },
  scrub: { label: 'Natural area', emoji: '🌿' },
  meadow: { label: 'Meadow', emoji: '🌾' },
  farmland: { label: 'Farmland', emoji: '🌾' },
  farmyard: { label: 'Farmyard', emoji: '🚜' },
  airport: { label: 'Airport', emoji: '✈️' },
  parking: { label: 'Parking', emoji: '🅿️' },
  residential: { label: 'Residential', emoji: '🏘️' },
  commercial: { label: 'Commercial', emoji: '🏢' },
  industrial: { label: 'Industrial', emoji: '🏭' },
  cemetery: { label: 'Cemetery', emoji: '⛪' },
  school: { label: 'School', emoji: '🏫' },
  hospital: { label: 'Hospital', emoji: '🏥' },
  stadium: { label: 'Stadium', emoji: '🏟️' },
  sand: { label: 'Beach / sand', emoji: '🏖️' },
  rock: { label: 'Rocky area', emoji: '🪨' },
  glacier: { label: 'Glacier', emoji: '🧊' },
  quarry: { label: 'Quarry', emoji: '⛏️' },
  military: { label: 'Military area', emoji: '🪖' },
  aboriginal_lands: { label: 'Tribal land', emoji: '🌿' },
  national_park: { label: 'National park', emoji: '🏕️' },
};

// ─── Transit ──────────────────────────────────────────────────────────────────

const TRANSIT_MODE_INFO: Record<string, { label: string; emoji: string }> = {
  rail: { label: 'Rail station', emoji: '🚂' },
  metro_rail: { label: 'Metro station', emoji: '🚇' },
  light_rail: { label: 'Light rail station', emoji: '🚊' },
  tram: { label: 'Tram stop', emoji: '🚋' },
  bus: { label: 'Bus stop', emoji: '🚌' },
  ferry: { label: 'Ferry terminal', emoji: '⛴️' },
  aerialway: { label: 'Aerial tram', emoji: '🚡' },
  monorail: { label: 'Monorail stop', emoji: '🚝' },
  train: { label: 'Train station', emoji: '🚉' },
  airport: { label: 'Airport', emoji: '✈️' },
};

// ─── POI label emoji quick-map ─────────────────────────────────────────────────

function poiEmoji(type: string | undefined): string {
  if (!type) return '📍';
  const t = type.toLowerCase();
  if (t.includes('restaurant') || t.includes('food') || t.includes('cafe') || t.includes('bar')) return '🍽️';
  if (t.includes('school') || t.includes('college') || t.includes('university')) return '🎓';
  if (t.includes('hospital') || t.includes('clinic') || t.includes('medical')) return '🏥';
  if (t.includes('park') || t.includes('garden') || t.includes('trail')) return '🌳';
  if (t.includes('museum') || t.includes('gallery')) return '🏛️';
  if (t.includes('shop') || t.includes('store') || t.includes('market')) return '🛍️';
  if (t.includes('hotel') || t.includes('motel') || t.includes('lodge')) return '🏨';
  if (t.includes('church') || t.includes('worship') || t.includes('temple') || t.includes('mosque')) return '⛪';
  if (t.includes('sport') || t.includes('stadium') || t.includes('arena') || t.includes('gym')) return '🏟️';
  if (t.includes('library')) return '📚';
  if (t.includes('airport') || t.includes('aviation')) return '✈️';
  if (t.includes('fuel') || t.includes('gas')) return '⛽';
  if (t.includes('bank') || t.includes('atm')) return '🏦';
  if (t.includes('cemetery')) return '⛪';
  return '📍';
}

// ─── Source-layer → kind mapping ──────────────────────────────────────────────

// Mapbox Streets v12 / Standard source-layer names
const WATER_SOURCE_LAYERS = new Set(['water', 'water_polygon', 'water_shadow']);
const WATERWAY_SOURCE_LAYERS = new Set(['waterway', 'waterway_polygon']);
const ROAD_SOURCE_LAYERS = new Set(['road', 'roads', 'tunnel', 'bridge', 'transportation']);
const LANDUSE_SOURCE_LAYERS = new Set([
  'landuse',
  'landuse_overlay',
  'national_park',
  'landcover',
  'land',
  'area',
]);
const POI_SOURCE_LAYERS = new Set(['poi_label', 'poi', 'place_of_interest']);
const NATURAL_LABEL_SOURCE_LAYERS = new Set(['natural_label', 'natural']);
const TRANSIT_SOURCE_LAYERS = new Set(['transit_stop_label', 'transit_stop', 'transit']);
const PLACE_SOURCE_LAYERS = new Set(['place_label', 'place']);

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Turn raw `queryRenderedFeatures` output into at most 3 surface chips.
 * Priority: water > road (named) > label / POI > landuse > road (unnamed).
 */
export function parseMapSurfaceFeatures(
  features: MapboxGeoJSONFeature[],
): SurfaceFeature[] {
  const water: SurfaceFeature[] = [];
  const namedRoads: SurfaceFeature[] = [];
  const unnamedRoads: SurfaceFeature[] = [];
  const landuse: SurfaceFeature[] = [];
  const labels: SurfaceFeature[] = [];
  const transit: SurfaceFeature[] = [];

  const seenLabels = new Set<string>();

  for (const f of features) {
    const src = f.sourceLayer ?? '';
    const props = f.properties ?? {};

    // Skip our own sources
    if (isOwnSource(f.source)) continue;

    // ── Water ──────────────────────────────────────────────────────────────
    if (WATER_SOURCE_LAYERS.has(src)) {
      const cls = String(props.class ?? '');
      const name = String(props.name ?? props['name:en'] ?? '').trim();
      const classLabel = WATER_CLASS_LABEL[cls] ?? 'Water';
      const emoji = waterEmoji(cls);
      const label = name || classLabel;
      const key = `water:${label}`;
      if (!seenLabels.has(key)) {
        seenLabels.add(key);
        water.push({
          kind: 'water',
          label,
          sublabel: name ? classLabel : undefined,
          emoji,
        });
      }
      continue;
    }

    if (WATERWAY_SOURCE_LAYERS.has(src)) {
      const cls = String(props.class ?? '');
      const name = String(props.name ?? props['name:en'] ?? '').trim();
      const classLabel = WATERWAY_CLASS_LABEL[cls] ?? 'Waterway';
      const emoji = waterEmoji(cls);
      const label = name || classLabel;
      const key = `waterway:${label}`;
      if (!seenLabels.has(key)) {
        seenLabels.add(key);
        water.push({ kind: 'water', label, sublabel: name ? classLabel : undefined, emoji });
      }
      continue;
    }

    // ── Road ───────────────────────────────────────────────────────────────
    if (ROAD_SOURCE_LAYERS.has(src)) {
      const cls = String(props.class ?? props.highway ?? '');
      const name = String(props.name ?? props['name:en'] ?? props.ref ?? '').trim();
      const classLabel = ROAD_CLASS_LABEL[cls] ?? 'Road';
      const emoji = roadEmoji(cls);
      if (name) {
        const key = `road:${name}`;
        if (!seenLabels.has(key)) {
          seenLabels.add(key);
          namedRoads.push({ kind: 'road', label: name, sublabel: classLabel, emoji });
        }
      } else if (classLabel !== 'Road' && classLabel !== 'Street') {
        const key = `road:${classLabel}`;
        if (!seenLabels.has(key)) {
          seenLabels.add(key);
          unnamedRoads.push({ kind: 'road', label: classLabel, emoji });
        }
      }
      continue;
    }

    // ── Transit stop labels ─────────────────────────────────────────────────
    if (TRANSIT_SOURCE_LAYERS.has(src)) {
      const name = String(props.name ?? props['name:en'] ?? '').trim();
      const mode = String(props.mode ?? props.network ?? '');
      const info = TRANSIT_MODE_INFO[mode] ?? { label: 'Transit stop', emoji: '🚏' };
      const label = name || info.label;
      const key = `transit:${label}`;
      if (!seenLabels.has(key)) {
        seenLabels.add(key);
        transit.push({ kind: 'transit', label, sublabel: name ? info.label : undefined, emoji: info.emoji });
      }
      continue;
    }

    // ── POI labels ─────────────────────────────────────────────────────────
    if (POI_SOURCE_LAYERS.has(src)) {
      const name = String(props.name ?? props['name:en'] ?? '').trim();
      if (!name) continue;
      const type = String(props.type ?? props.category ?? '');
      const key = `poi:${name}`;
      if (!seenLabels.has(key)) {
        seenLabels.add(key);
        labels.push({ kind: 'label', label: name, sublabel: type || undefined, emoji: poiEmoji(type) });
      }
      continue;
    }

    // ── Natural labels (lake names, peaks, rivers) ─────────────────────────
    if (NATURAL_LABEL_SOURCE_LAYERS.has(src)) {
      const name = String(props.name ?? props['name:en'] ?? '').trim();
      if (!name) continue;
      const cls = String(props.class ?? '');
      const key = `natural:${name}`;
      if (!seenLabels.has(key)) {
        seenLabels.add(key);
        const isWater = ['lake', 'ocean', 'sea', 'river', 'bay', 'reservoir'].includes(cls);
        labels.push({
          kind: isWater ? 'water' : 'label',
          label: name,
          sublabel: cls ? WATER_CLASS_LABEL[cls] ?? undefined : undefined,
          emoji: isWater ? waterEmoji(cls) : '📍',
        });
      }
      continue;
    }

    // ── Landuse ────────────────────────────────────────────────────────────
    if (LANDUSE_SOURCE_LAYERS.has(src)) {
      const cls = String(props.class ?? props.type ?? '');
      const name = String(props.name ?? props['name:en'] ?? '').trim();
      const info = LANDUSE_CLASS_INFO[cls];
      if (!info) continue;
      const label = name || info.label;
      const key = `landuse:${label}`;
      if (!seenLabels.has(key)) {
        seenLabels.add(key);
        landuse.push({
          kind: 'landuse',
          label,
          sublabel: name ? info.label : undefined,
          emoji: info.emoji,
        });
      }
      continue;
    }
  }

  // ── Assemble — capped at 3, priority: water > named roads > transit > labels > landuse > unnamed roads
  const out: SurfaceFeature[] = [];
  for (const bucket of [water, namedRoads, transit, labels, landuse, unnamedRoads]) {
    for (const item of bucket) {
      if (out.length >= 3) break;
      out.push(item);
    }
    if (out.length >= 3) break;
  }
  return out;
}
