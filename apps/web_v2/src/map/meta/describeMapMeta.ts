/**
 * Turns raw basemap features into the few facts a person actually wants:
 * what road is this, what water is this, what kind of ground, is it a building.
 *
 * Every value below is the documented Mapbox Streets v8 vocabulary or a
 * Mapbox Standard featureset property. Two schema details drive most of the
 * shape of this file:
 *
 * - The `water` source-layer is "a polygon layer with no differentiating types
 *   or classes... a single merged shape per tile". It can only ever say "water".
 *   Lake, bay and reservoir names come from `natural_label`; river, stream and
 *   canal come from `waterway`.
 * - `landuse` carries no name, only `class` and `type`, so an area is always
 *   described by its kind rather than by a title.
 *
 * Reference: https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/
 */

import type { MapMetaFeature } from '@/map/meta/queryMapMeta';

export type MapMetaLabelKind = 'building' | 'water' | 'road' | 'area';

export type MapMetaLabel = {
  kind: MapMetaLabelKind;
  /** Strong text — a proper name when the tile has one, else the type. */
  label: string;
  /** The type, when `label` is already a proper name. */
  detail: string | null;
};

/** How many chips a callout can carry before it stops being glanceable. */
const MAX_LABELS = 3;

// ─── Roads (`road.class`) ─────────────────────────────────────────────────────

const ROAD_CLASS_LABEL: Record<string, string> = {
  motorway: 'Highway',
  motorway_link: 'Highway ramp',
  trunk: 'Trunk road',
  trunk_link: 'Trunk ramp',
  primary: 'Major road',
  primary_link: 'Major road ramp',
  secondary: 'Secondary road',
  secondary_link: 'Secondary ramp',
  tertiary: 'Connecting road',
  tertiary_link: 'Connecting ramp',
  street: 'Street',
  street_limited: 'Limited-access street',
  pedestrian: 'Pedestrian way',
  construction: 'Road under construction',
  track: 'Track',
  service: 'Service road',
  ferry: 'Ferry route',
  path: 'Trail',
  major_rail: 'Railway',
  minor_rail: 'Light rail',
  service_rail: 'Rail yard',
  aerialway: 'Aerialway',
  golf: 'Golf cart path',
};

// ─── Water ───────────────────────────────────────────────────────────────────

/**
 * `natural_label.class`, water members only. Class `water` covers "lakes,
 * ponds, etc." — in Minnesota that reads as a lake often enough to say so.
 */
const NATURAL_WATER_CLASS_LABEL: Record<string, string> = {
  water: 'Lake',
  ocean: 'Ocean',
  sea: 'Sea',
  bay: 'Bay',
  reservoir: 'Reservoir',
  river: 'River',
  stream: 'Stream',
  canal: 'Canal',
  dock: 'Dock',
  water_feature: 'Waterfall',
  wetland: 'Wetland',
};

/** `waterway.class` — lines, biased small; the big ones repeat in `water`. */
const WATERWAY_CLASS_LABEL: Record<string, string> = {
  river: 'River',
  canal: 'Canal',
  stream: 'Stream',
  stream_intermittent: 'Seasonal stream',
  drain: 'Storm drain',
  ditch: 'Ditch',
};

// ─── Ground (`landuse.class`, `landuse_overlay.class`) ───────────────────────

const LANDUSE_CLASS_LABEL: Record<string, string> = {
  aboriginal_lands: 'Tribal land',
  agriculture: 'Farmland',
  airport: 'Airport grounds',
  cemetery: 'Cemetery',
  commercial_area: 'Commercial area',
  facility: 'Facility grounds',
  glacier: 'Glacier',
  grass: 'Grass',
  hospital: 'Hospital grounds',
  industrial: 'Industrial area',
  park: 'Park',
  parking: 'Parking',
  piste: 'Ski area',
  pitch: 'Sports field',
  residential: 'Residential',
  rock: 'Rock',
  sand: 'Sand',
  school: 'School grounds',
  scrub: 'Scrub',
  wood: 'Woods',
};

const LANDUSE_OVERLAY_CLASS_LABEL: Record<string, string> = {
  national_park: 'National park',
  wetland: 'Wetland',
  wetland_noveg: 'Tidal flat',
};

// ─── Readers ─────────────────────────────────────────────────────────────────

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** v8 name fields, local first — matches how the basemap itself labels. */
function readName(props: Record<string, unknown>): string | null {
  return readString(props.name) ?? readString(props.name_en) ?? readString(props['name:en']);
}

function readClass(props: Record<string, unknown>): string {
  return readString(props.class) ?? '';
}

/** `snow_and_ice` → `Snow and ice`. Used for v8 `type`, an open OSM tag set. */
function humanize(value: string): string {
  const spaced = value.replace(/[_:-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** Building heights are metres in the tiles; feet is what Minnesota reads in. */
function heightDetail(props: Record<string, unknown>): string | null {
  const metres = readNumber(props.height);
  // Below a storey the number is noise, and often an estimate from levels.
  if (metres == null || metres < 3) return null;
  return `${Math.round(metres * 3.28084)} ft tall`;
}

/**
 * `type` is the raw primary OSM tag, so it's only worth showing when it says
 * something the class label didn't. `building=yes` arrives as plain "building".
 */
function refineDetail(type: string | null, base: string): string {
  if (!type) return base;
  const humanized = humanize(type);
  if (humanized.toLowerCase() === base.toLowerCase()) return base;
  if (humanized.toLowerCase() === 'building') return base;
  return humanized;
}

// ─── Chips ───────────────────────────────────────────────────────────────────

function buildingLabel(feature: MapMetaFeature): MapMetaLabel | null {
  const props = feature.properties;

  // Standard's `buildings` featureset carries height but no type.
  if (feature.lane === 'basemap') {
    return { kind: 'building', label: 'Building', detail: heightDetail(props) };
  }

  // v8 marks parts of a 3D building separately from the footprint; the part is
  // an implementation detail of the extrusion, not a place.
  const type = readString(props.type);
  if (type === 'building:part') return null;

  return {
    kind: 'building',
    label: refineDetail(type, 'Building'),
    detail: heightDetail(props),
  };
}

/**
 * True when the point is inside a `water` polygon.
 *
 * This is the gate on every `natural_label` reading. That layer labels an entire
 * lake from one point, which we deliberately reach a long way to find — so
 * without a check like this, tapping a house near a shoreline would confidently
 * report the lake. The polygon is the ground truth; the label only supplies its
 * name.
 */
function isOnWater(features: MapMetaFeature[]): boolean {
  return features.some((feature) => feature.set === 'water');
}

function waterLabel(feature: MapMetaFeature, onWater: boolean): MapMetaLabel | null {
  const props = feature.properties;
  const name = readName(props);
  const cls = readClass(props);

  if (feature.set === 'natural_label') {
    const type = NATURAL_WATER_CLASS_LABEL[cls];
    if (!type || !onWater) return null;
    return { kind: 'water', label: name ?? type, detail: name ? type : null };
  }

  // Streams and ditches are lines with no polygon under them, so they stand on
  // their own rather than waiting on the water gate.
  if (feature.set === 'waterway') {
    const type = WATERWAY_CLASS_LABEL[cls] ?? 'Waterway';
    return { kind: 'water', label: name ?? type, detail: name ? type : null };
  }

  // The merged `water` polygon itself carries no class and no name, so it can't
  // describe anything. It only decides `onWater`, and becomes a bare chip in
  // describeMapMeta if nothing better turned up.
  return null;
}

/** Shown when the tap is on water that no label or waterway could name. */
const UNNAMED_WATER: MapMetaLabel = { kind: 'water', label: 'Water', detail: null };

function areaLabel(feature: MapMetaFeature): MapMetaLabel | null {
  const props = feature.properties;
  const cls = readClass(props);
  const base =
    feature.set === 'landuse_overlay'
      ? LANDUSE_OVERLAY_CLASS_LABEL[cls]
      : LANDUSE_CLASS_LABEL[cls];
  if (!base) return null;

  const detail = refineDetail(readString(props.type), base);
  return { kind: 'area', label: base, detail: detail === base ? null : detail };
}

function roadLabel(feature: MapMetaFeature): MapMetaLabel | null {
  const props = feature.properties;
  const cls = readClass(props);
  const base = ROAD_CLASS_LABEL[cls];
  if (!base) return null;

  // `ref` is the route number ("I 35"), the right name for an unnamed highway.
  const name = readName(props) ?? readString(props.ref);
  const structure = readString(props.structure);
  const type =
    structure === 'bridge' ? `${base} bridge`
    : structure === 'tunnel' ? `${base} tunnel`
    : base;

  return { kind: 'road', label: name ?? type, detail: name ? type : null };
}

function labelFor(feature: MapMetaFeature, onWater: boolean): MapMetaLabel | null {
  switch (feature.set) {
    case 'building':
    case 'buildings':
      return buildingLabel(feature);
    // `natural_label` yields a chip only for its water classes; peaks, islands
    // and valleys are places, not ground, and we have no way to bound how far
    // their label points sit from the tap.
    case 'water':
    case 'waterway':
    case 'natural_label':
      return waterLabel(feature, onWater);
    case 'landuse':
    case 'landuse_overlay':
      return areaLabel(feature);
    case 'road':
      return roadLabel(feature);
    default:
      return null;
  }
}

/** Most specific thing you touched, first. Ground is context, so it's last. */
const KIND_ORDER: readonly MapMetaLabelKind[] = ['building', 'water', 'road', 'area'];

/**
 * The handful of facts worth showing for a point.
 *
 * Tile boundaries split lines and buffer points, so the same road can come back
 * several times — deduped on the rendered text, which is the only sameness a
 * reader cares about.
 */
function describeMapMeta(
  features: MapMetaFeature[],
  onWater: boolean,
): MapMetaLabel[] {
  const byKind = new Map<MapMetaLabelKind, MapMetaLabel[]>();
  const seen = new Set<string>();

  for (const feature of features) {
    const label = labelFor(feature, onWater);
    if (!label) continue;

    const key = `${label.kind}:${label.label}:${label.detail ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const bucket = byKind.get(label.kind);
    if (bucket) bucket.push(label);
    else byKind.set(label.kind, [label]);
  }

  if (onWater && !byKind.has('water')) byKind.set('water', [UNNAMED_WATER]);

  const out: MapMetaLabel[] = [];
  for (const kind of KIND_ORDER) {
    for (const label of byKind.get(kind) ?? []) {
      if (out.length >= MAX_LABELS) return out;
      out.push(label);
    }
  }
  return out;
}

// ─── Place name ──────────────────────────────────────────────────────────────

export type MapMetaPlace = { title: string; subtitle: string | null };

/**
 * A name for the point, when the basemap already has a better one than an
 * address — a business, a lake, a park, a neighborhood.
 *
 * Ranked by how specifically it answers "what is this": a named POI beats a
 * named natural feature, which beats the name of the surrounding place.
 */
const PLACE_SET_RANK: Record<string, number> = {
  poi: 0,
  poi_label: 1,
  natural_label: 2,
  'place-labels': 3,
  place_label: 4,
};

function pickMapMetaPlace(
  features: MapMetaFeature[],
  onWater: boolean,
): MapMetaPlace | null {
  let best: { rank: number; place: MapMetaPlace } | null = null;

  for (const feature of features) {
    const rank = PLACE_SET_RANK[feature.set];
    if (rank == null) continue;
    if (best && rank >= best.rank) continue;

    const props = feature.properties;
    const title = readName(props);
    if (!title) continue;

    const cls = readClass(props);

    // Same gate as the chips: a lake name is only this point's name when this
    // point is in the lake.
    if (feature.set === 'natural_label') {
      const type = NATURAL_WATER_CLASS_LABEL[cls];
      if (!type || !onWater) continue;
      best = { rank, place: { title, subtitle: type } };
      continue;
    }

    const subtitle = readString(props.type) ?? (cls ? humanize(cls) : null);
    best = { rank, place: { title, subtitle } };
  }

  return best?.place ?? null;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export type MapMetaReading = {
  /** A name better than an address, when the basemap has one. */
  place: MapMetaPlace | null;
  /** Road, water, area and building facts about this spot. */
  labels: MapMetaLabel[];
};

/**
 * Everything worth saying about one point, read once.
 *
 * The name and the chips are produced together because they share context —
 * chiefly whether the tap landed on water, which decides how much of
 * `natural_label` can be trusted.
 */
export function interpretMapMeta(features: MapMetaFeature[]): MapMetaReading {
  const onWater = isOnWater(features);
  return {
    place: pickMapMetaPlace(features, onWater),
    labels: describeMapMeta(features, onWater),
  };
}
