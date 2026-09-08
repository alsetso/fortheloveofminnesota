import type { AnyLayer, ExpressionSpecification } from 'mapbox-gl';
import { MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import type { GeoJsonLayerSpec } from '@/map/layers/GeoJsonLayer';

/**
 * Linear zoom stops → Mapbox `interpolate` expression.
 * Used so fog / boundaries breathe at atlas zoom instead of painting as a tarp.
 */
function zoomFade(stops: ReadonlyArray<readonly [number, number]>): ExpressionSpecification {
  const expr: [string, ...unknown[]] = ['interpolate', ['linear'], ['zoom']];
  for (const [z, v] of stops) expr.push(z, v);
  return expr as ExpressionSpecification;
}

/** Locked (Explore unlocked mask) — soft cool fog + lock glyph. */
const LOCKED_FILL = '#a8b0b8';
const LOCKED_LINE = '#7b8490';
/** Light at atlas → denser near street (never a solid slab). */
const LOCKED_FILL_OPACITY = zoomFade([
  [5.5, 0.28],
  [9, 0.42],
  [12, 0.55],
]);

/** Passport frame — far fog (non-interactive). */
const FAR_FILL = '#9aa3ad';
const FAR_FILL_OPACITY = zoomFade([
  [5.5, 0.45],
  [9, 0.58],
  [12, 0.7],
]);
/** Passport frame — adjacent ring (semi-discoverable). */
const ADJACENT_FILL = '#b4bbc3';
const ADJACENT_FILL_OPACITY = zoomFade([
  [7, 0.16],
  [10, 0.28],
  [13, 0.36],
]);
const ADJACENT_LINE = '#6b7380';

/** Default territory outlines — hairlines far out, readable near. */
const BOUNDARY_LINE_WIDTH = zoomFade([
  [5.5, 0.35],
  [9, 0.7],
  [12, 1.1],
]);
const BOUNDARY_LINE_OPACITY = zoomFade([
  [5.5, 0.28],
  [9, 0.55],
  [12, 0.88],
]);
const DISTRICT_LINE_WIDTH = zoomFade([
  [5.5, 0.4],
  [9, 0.85],
  [12, 1.35],
]);

/** Lock badge on locked polygons — denser layers need a higher minzoom. */
function unlockedLockSymbolLayer(
  prefix: string,
  minzoom = 8.5,
): Omit<AnyLayer, 'source'> {
  return {
    id: `${prefix}-lock`,
    type: 'symbol',
    minzoom,
    filter: ['==', ['get', 'ftl_unlocked'], 0],
    layout: {
      'text-field': '🔒',
      'text-size': 13,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'symbol-placement': 'point',
      'text-anchor': 'center',
    },
    paint: {
      'text-opacity': zoomFade([
        [8.5, 0.5],
        [10, 0.78],
        [12, 0.9],
      ]),
      'text-halo-color': 'rgba(255,255,255,0.85)',
      'text-halo-width': 1.25,
    },
  };
}

/** Counties fill + line with selected > hover > default paint.
 * When Explore Unlocked Areas stamps `ftl_unlocked`, locked units paint grey
 * with a lock mark (not clickable) and unlocked stay a clear tint.
 */
const COUNTIES_LAYERS: Omit<AnyLayer, 'source'>[] = [
  {
    id: 'app-counties-fill',
    type: 'fill',
    paint: {
      'fill-color': [
        'case',
        ['==', ['get', 'ftl_unlocked'], 0],
        LOCKED_FILL,
        ['boolean', ['feature-state', 'selected'], false],
        '#1b4d3e',
        ['boolean', ['feature-state', 'hover'], false],
        '#3d8f78',
        '#2f6f5e',
      ],
      'fill-opacity': [
        'case',
        ['==', ['get', 'ftl_unlocked'], 0],
        LOCKED_FILL_OPACITY,
        ['boolean', ['feature-state', 'selected'], false],
        0.55,
        ['boolean', ['feature-state', 'hover'], false],
        0.42,
        0.18,
      ],
    },
  },
  {
    id: 'app-counties-line',
    type: 'line',
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'ftl_unlocked'], 0],
        LOCKED_LINE,
        ['boolean', ['feature-state', 'selected'], false],
        '#0f2f26',
        ['boolean', ['feature-state', 'hover'], false],
        '#1b4d3e',
        '#1b4d3e',
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        2.5,
        ['boolean', ['feature-state', 'hover'], false],
        1.8,
        BOUNDARY_LINE_WIDTH,
      ],
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        1,
        ['boolean', ['feature-state', 'hover'], false],
        0.95,
        BOUNDARY_LINE_OPACITY,
      ],
    },
  },
  unlockedLockSymbolLayer('app-counties', 8.5),
];

type OverlayPalette = {
  fill: string;
  hoverFill: string;
  selectedFill: string;
  line: string;
  hoverLine: string;
  selectedLine: string;
};

/** Secondary overlays: rest muted → hover brighter → select deeper + thicker outline.
 * Same Explore unlocked mask contract as counties (`ftl_unlocked` = 0 → grey + lock).
 */
function overlayPaintLayers(
  prefix: string,
  palette: OverlayPalette,
  lockMinZoom = 8.5,
): Omit<AnyLayer, 'source'>[] {
  const { fill, hoverFill, selectedFill, line, hoverLine, selectedLine } = palette;
  return [
    {
      id: `${prefix}-fill`,
      type: 'fill',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'ftl_unlocked'], 0],
          LOCKED_FILL,
          ['boolean', ['feature-state', 'selected'], false],
          selectedFill,
          ['boolean', ['feature-state', 'hover'], false],
          hoverFill,
          fill,
        ],
        'fill-opacity': [
          'case',
          ['==', ['get', 'ftl_unlocked'], 0],
          LOCKED_FILL_OPACITY,
          ['boolean', ['feature-state', 'selected'], false],
          0.58,
          ['boolean', ['feature-state', 'hover'], false],
          0.42,
          0.2,
        ],
      },
    },
    {
      id: `${prefix}-line`,
      type: 'line',
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'ftl_unlocked'], 0],
          LOCKED_LINE,
          ['boolean', ['feature-state', 'selected'], false],
          selectedLine,
          ['boolean', ['feature-state', 'hover'], false],
          hoverLine,
          line,
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          2.6,
          ['boolean', ['feature-state', 'hover'], false],
          1.9,
          BOUNDARY_LINE_WIDTH,
        ],
        'line-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          1,
          ['boolean', ['feature-state', 'hover'], false],
          0.95,
          BOUNDARY_LINE_OPACITY,
        ],
      },
    },
    unlockedLockSymbolLayer(prefix, lockMinZoom),
  ];
}

/**
 * Cities & towns — passport frame paint.
 * `ftl_tier`: 2 unlocked (no fill), 1 adjacent (soft wash), 0 far (atmospheric fog).
 * Falls back to lake-blue tint when tiers are unstamped.
 */
function ctuPassportPaintLayers(): Omit<AnyLayer, 'source'>[] {
  return [
    {
      id: 'app-ctus-fill',
      type: 'fill',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'ftl_tier'], 0],
          FAR_FILL,
          ['==', ['get', 'ftl_tier'], 1],
          ADJACENT_FILL,
          ['boolean', ['feature-state', 'selected'], false],
          '#1a4f6e',
          ['boolean', ['feature-state', 'hover'], false],
          '#4aa3c8',
          '#2a6f97',
        ],
        'fill-opacity': [
          'case',
          ['==', ['get', 'ftl_tier'], 0],
          FAR_FILL_OPACITY,
          ['==', ['get', 'ftl_tier'], 1],
          ADJACENT_FILL_OPACITY,
          // Unlocked (tier 2) or unstamped: clear / light tint
          ['==', ['get', 'ftl_tier'], 2],
          0,
          ['boolean', ['feature-state', 'selected'], false],
          0.58,
          ['boolean', ['feature-state', 'hover'], false],
          0.42,
          0.2,
        ],
      },
    },
    {
      id: 'app-ctus-line',
      type: 'line',
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'ftl_tier'], 0],
          LOCKED_LINE,
          ['==', ['get', 'ftl_tier'], 1],
          ADJACENT_LINE,
          ['boolean', ['feature-state', 'selected'], false],
          '#0f3348',
          ['boolean', ['feature-state', 'hover'], false],
          '#2a6f97',
          '#1a4a66',
        ],
        'line-width': [
          'case',
          ['==', ['get', 'ftl_tier'], 0],
          zoomFade([
            [5.5, 0.2],
            [10, 0.35],
            [13, 0.45],
          ]),
          ['==', ['get', 'ftl_tier'], 1],
          zoomFade([
            [7, 0.5],
            [10, 0.9],
            [13, 1.2],
          ]),
          ['boolean', ['feature-state', 'selected'], false],
          2.6,
          ['boolean', ['feature-state', 'hover'], false],
          1.9,
          BOUNDARY_LINE_WIDTH,
        ],
        'line-opacity': [
          'case',
          ['==', ['get', 'ftl_tier'], 0],
          zoomFade([
            [5.5, 0.12],
            [9, 0.25],
            [12, 0.38],
          ]),
          ['==', ['get', 'ftl_tier'], 1],
          zoomFade([
            [7, 0.4],
            [10, 0.68],
            [13, 0.9],
          ]),
          ['boolean', ['feature-state', 'selected'], false],
          1,
          ['boolean', ['feature-state', 'hover'], false],
          0.95,
          BOUNDARY_LINE_OPACITY,
        ],
      },
    },
    // Lock glyph only on the adjacent ring — far fog stays quiet.
    {
      id: 'app-ctus-lock',
      type: 'symbol',
      minzoom: 9.5,
      filter: ['==', ['get', 'ftl_tier'], 1],
      layout: {
        'text-field': '🔒',
        'text-size': 12,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'symbol-placement': 'point',
        'text-anchor': 'center',
      },
      paint: {
        'text-opacity': zoomFade([
          [9.5, 0.55],
          [11, 0.8],
          [13, 0.88],
        ]),
        'text-halo-color': 'rgba(255,255,255,0.9)',
        'text-halo-width': 1.25,
      },
    },
  ];
}

/** School districts — amber/umber (distinct from green + blue). */
const SCHOOL_DISTRICT_PALETTE: OverlayPalette = {
  fill: '#a86f2d',
  hoverFill: '#d49a4a',
  selectedFill: '#7a4a18',
  line: '#5c3a1a',
  hoverLine: '#8b5a2b',
  selectedLine: '#3d2610',
};

/** State senate — cool slate. */
const SENATE_DISTRICT_PALETTE: OverlayPalette = {
  fill: '#3d5a80',
  hoverFill: '#5a7aa0',
  selectedFill: '#2a4060',
  line: '#1e3348',
  hoverLine: '#3d5a80',
  selectedLine: '#142233',
};

/** State house — warm umber (distinct from CD reds + senate slate). */
const HOUSE_DISTRICT_PALETTE: OverlayPalette = {
  fill: '#8b5a4a',
  hoverFill: '#a87868',
  selectedFill: '#6a4030',
  line: '#4f2e22',
  hoverLine: '#8b5a4a',
  selectedLine: '#3a2118',
};

/** Map labels for legislative districts — officeholder name (fallback: district name). */
function legislativeLabelLayer(
  prefix: string,
  opts: {
    minzoom: number;
    textColor: string;
    selectedTextColor: string;
    haloColor: string;
    selectedHaloColor: string;
  },
): Omit<AnyLayer, 'source'> {
  return {
    id: `${prefix}-label`,
    type: 'symbol',
    minzoom: opts.minzoom,
    layout: {
      'text-field': [
        'coalesce',
        ['get', 'officeholder_name'],
        ['get', 'name'],
      ],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        opts.minzoom,
        10,
        opts.minzoom + 3,
        12,
        14,
        13,
      ],
      'text-anchor': 'center',
      'text-max-width': 8,
      'text-line-height': 1.15,
      'text-padding': 6,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'symbol-placement': 'point',
      'symbol-z-order': 'source',
    },
    paint: {
      'text-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        opts.selectedTextColor,
        ['boolean', ['feature-state', 'hover'], false],
        opts.textColor,
        opts.textColor,
      ],
      'text-halo-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        opts.selectedHaloColor,
        'rgba(255, 255, 255, 0.92)',
      ],
      'text-halo-width': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        2.5,
        1.75,
      ],
      'text-halo-blur': 0.25,
      'text-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        opts.minzoom,
        0.85,
        opts.minzoom + 1,
        1,
      ],
    },
  };
}

function senateDistrictLayers(): Omit<AnyLayer, 'source'>[] {
  return [
    ...overlayPaintLayers('app-senate-districts', SENATE_DISTRICT_PALETTE),
    legislativeLabelLayer('app-senate-districts', {
      minzoom: 6.5,
      textColor: '#142233',
      selectedTextColor: '#f4f7fb',
      haloColor: 'rgba(255, 255, 255, 0.92)',
      selectedHaloColor: '#2a4060',
    }),
  ];
}

function houseDistrictLayers(): Omit<AnyLayer, 'source'>[] {
  return [
    ...overlayPaintLayers('app-house-districts', HOUSE_DISTRICT_PALETTE),
    legislativeLabelLayer('app-house-districts', {
      minzoom: 7.5,
      textColor: '#3a2118',
      selectedTextColor: '#fff8f4',
      haloColor: 'rgba(255, 255, 255, 0.92)',
      selectedHaloColor: '#6a4030',
    }),
  ];
}

/** Congressional districts — distinct fill per CD 1–8. */
const DISTRICT_COLORS: Record<number, { fill: string; hover: string; selected: string; line: string }> = {
  1: { fill: '#c45c4a', hover: '#e07a68', selected: '#9a3f30', line: '#7a3226' },
  2: { fill: '#2a8f8a', hover: '#3fb3ad', selected: '#1d6b67', line: '#15524f' },
  3: { fill: '#3d7eb8', hover: '#5a9ad0', selected: '#2a5f8f', line: '#1e4669' },
  4: { fill: '#5a8f5e', hover: '#74ad78', selected: '#3f6b43', line: '#2f5232' },
  5: { fill: '#c4a035', hover: '#dbb84a', selected: '#957820', line: '#6f5a18' },
  6: { fill: '#c47a3a', hover: '#db9454', selected: '#955820', line: '#6f4218' },
  7: { fill: '#8b5e3c', hover: '#a87852', selected: '#6a452c', line: '#4f3420' },
  8: { fill: '#4a5d73', hover: '#6b849e', selected: '#2f3f52', line: '#1a2430' },
};

function districtColorExpr(
  key: 'fill' | 'hover' | 'selected' | 'line',
  fallback: string,
): unknown[] {
  const match: unknown[] = ['match', ['to-number', ['get', 'district_number']]];
  for (let n = 1; n <= 8; n++) {
    match.push(n, DISTRICT_COLORS[n]![key]);
  }
  match.push(fallback);
  return match;
}

function congressionalDistrictLayers(): Omit<AnyLayer, 'source'>[] {
  return [
    {
      id: 'app-districts-fill',
      type: 'fill',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'ftl_unlocked'], 0],
          LOCKED_FILL,
          ['boolean', ['feature-state', 'selected'], false],
          districtColorExpr('selected', '#2f3f52'),
          ['boolean', ['feature-state', 'hover'], false],
          districtColorExpr('hover', '#6b849e'),
          districtColorExpr('fill', '#4a5d73'),
        ],
        'fill-opacity': [
          'case',
          ['==', ['get', 'ftl_unlocked'], 0],
          LOCKED_FILL_OPACITY,
          ['boolean', ['feature-state', 'selected'], false],
          0.45,
          ['boolean', ['feature-state', 'hover'], false],
          0.4,
          0.18,
        ],
      },
    },
    {
      id: 'app-districts-line',
      type: 'line',
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'ftl_unlocked'], 0],
          LOCKED_LINE,
          ['boolean', ['feature-state', 'selected'], false],
          districtColorExpr('line', '#1a2430'),
          ['boolean', ['feature-state', 'hover'], false],
          districtColorExpr('fill', '#4a5d73'),
          districtColorExpr('line', '#1a2430'),
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          2.8,
          ['boolean', ['feature-state', 'hover'], false],
          2,
          DISTRICT_LINE_WIDTH,
        ],
        'line-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          1,
          ['boolean', ['feature-state', 'hover'], false],
          0.95,
          BOUNDARY_LINE_OPACITY,
        ],
      },
    },
    unlockedLockSymbolLayer('app-districts', 8.2),
  ];
}

/** Precinct / sub-features inherit CD color via district_number. */
function districtPartsLayers(): Omit<AnyLayer, 'source'>[] {
  return [
    {
      id: 'app-district-parts-fill',
      type: 'fill',
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          districtColorExpr('selected', '#2f3f52'),
          ['boolean', ['feature-state', 'hover'], false],
          districtColorExpr('hover', '#6b849e'),
          districtColorExpr('fill', '#4a5d73'),
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          0.72,
          ['boolean', ['feature-state', 'hover'], false],
          0.55,
          0.32,
        ],
      },
    },
    {
      id: 'app-district-parts-line',
      type: 'line',
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          districtColorExpr('line', '#1a2430'),
          ['boolean', ['feature-state', 'hover'], false],
          districtColorExpr('fill', '#4a5d73'),
          'rgba(255,255,255,0.55)',
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          2.2,
          ['boolean', ['feature-state', 'hover'], false],
          1.6,
          0.6,
        ],
      },
    },
  ];
}

/** Individual school building footprints + geo-anchored name labels (GL symbol — no HTML markers). */
function schoolBuildingLayers(): Omit<AnyLayer, 'source'>[] {
  const palette = {
    fill: '#e8a54b',
    hoverFill: '#f0bc6e',
    selectedFill: '#a86f2d',
    line: '#7a4a18',
    hoverLine: '#a86f2d',
    selectedLine: '#5c3a1a',
  };
  return [
    {
      id: 'app-schools-fill',
      type: 'fill',
      filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          palette.selectedFill,
          ['boolean', ['feature-state', 'hover'], false],
          palette.hoverFill,
          palette.fill,
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          0.78,
          ['boolean', ['feature-state', 'hover'], false],
          0.7,
          0.55,
        ],
      },
    },
    {
      id: 'app-schools-line',
      type: 'line',
      filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          palette.selectedLine,
          ['boolean', ['feature-state', 'hover'], false],
          palette.hoverLine,
          palette.line,
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          2.4,
          ['boolean', ['feature-state', 'hover'], false],
          1.8,
          1.2,
        ],
      },
    },
    // Statewide Controls overlay uses points (no building polygons).
    {
      id: 'app-schools-point',
      type: 'circle',
      filter: ['==', ['geometry-type'], 'Point'],
      minzoom: 8,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          3,
          12,
          5,
          16,
          7,
        ],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          palette.selectedFill,
          ['boolean', ['feature-state', 'hover'], false],
          palette.hoverFill,
          palette.fill,
        ],
        'circle-stroke-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          palette.selectedLine,
          palette.line,
        ],
        'circle-stroke-width': 1.2,
        'circle-opacity': 0.9,
      },
    },
    // Label sits on the polygon centroid — Mapbox-composited, pans/zooms with the map.
    {
      id: 'app-schools-label',
      type: 'symbol',
      minzoom: 9,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          9,
          10,
          14,
          12,
          17,
          13,
        ],
        'text-anchor': 'bottom',
        'text-offset': [0, -0.35],
        'text-max-width': 9,
        'text-line-height': 1.1,
        'text-padding': 4,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'symbol-z-order': 'source',
      },
      paint: {
        'text-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#fff8f0',
          ['boolean', ['feature-state', 'hover'], false],
          '#3d2610',
          '#3d2610',
        ],
        'text-halo-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#7a4a18',
          'rgba(255, 248, 240, 0.96)',
        ],
        'text-halo-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          3.5,
          2.75,
        ],
        'text-halo-blur': 0.2,
      },
    },
  ];
}

/**
 * Temporary single-boundary highlight — always painted above other overlays.
 * Independent of Controls / ensureActive; data comes from MAP_SOURCE_IDS.selection.
 */
export const SELECTION_LAYER_SPEC: GeoJsonLayerSpec = {
  sourceId: MAP_SOURCE_IDS.selection,
  layers: [
    {
      id: 'app-selection-fill',
      type: 'fill',
      filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
      paint: {
        'fill-color': '#0f2f26',
        'fill-opacity': 0.32,
      },
    },
    {
      id: 'app-selection-line-outer',
      type: 'line',
      filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'], true, false],
      paint: {
        'line-color': '#0f2f26',
        'line-width': 5,
        'line-opacity': 0.9,
      },
    },
    {
      id: 'app-selection-line',
      type: 'line',
      filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'], true, false],
      paint: {
        'line-color': '#f8faf8',
        'line-width': 2.4,
        'line-opacity': 0.98,
      },
    },
    {
      id: 'app-selection-circle',
      type: 'circle',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 9,
        'circle-color': '#0f2f26',
        'circle-opacity': 0.85,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#f8faf8',
      },
    },
  ],
  promoteId: 'id',
  generateId: false,
};

/**
 * Multi-boundary overlays for jurisdictions at a selected / Find Me point.
 * Fill/line colors come from feature `overlayColor` (one hue per territory).
 */
export const POINT_TERRITORIES_LAYER_SPEC: GeoJsonLayerSpec = {
  sourceId: MAP_SOURCE_IDS.pointTerritories,
  layers: [
    {
      id: 'app-point-territories-fill',
      type: 'fill',
      filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          ['coalesce', ['get', 'overlayColor'], '#1a4d42'],
          ['coalesce', ['get', 'overlayColor'], '#1a4d42'],
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.48,
          0.28,
        ],
      },
    },
    {
      id: 'app-point-territories-line-outer',
      type: 'line',
      filter: [
        'match',
        ['geometry-type'],
        ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'],
        true,
        false,
      ],
      paint: {
        'line-color': ['coalesce', ['get', 'overlayColor'], '#1a4d42'],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          5,
          3.5,
        ],
        'line-opacity': 0.85,
      },
    },
    {
      id: 'app-point-territories-line',
      type: 'line',
      filter: [
        'match',
        ['geometry-type'],
        ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'],
        true,
        false,
      ],
      paint: {
        'line-color': '#f8faf8',
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          2.4,
          1.8,
        ],
        'line-opacity': 0.95,
      },
    },
    {
      id: 'app-point-territories-circle',
      type: 'circle',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          10,
          8,
        ],
        'circle-color': ['coalesce', ['get', 'overlayColor'], '#1a4d42'],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#f8faf8',
      },
    },
  ],
  promoteId: 'id',
  generateId: false,
};

/**
 * Find Me → Selected point Directions line — always on when data is present.
 */
export const ROUTE_LAYER_SPEC: GeoJsonLayerSpec = {
  sourceId: MAP_SOURCE_IDS.route,
  layers: [
    {
      id: 'app-route-line-casing',
      type: 'line',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#ffffff',
        'line-width': 7,
        'line-opacity': 0.9,
      },
    },
    {
      id: 'app-route-line',
      type: 'line',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#0b6e4f',
        'line-width': 4,
        'line-opacity': 0.95,
      },
    },
  ],
  generateId: false,
};

/**
 * What's nearby POI overlay — lake-tinted dots while the layer is on.
 * Data from `nearbyPlacesStore` → `MAP_SOURCE_IDS.nearby`.
 * Explicit `slot: top` so dots paint above Mapbox Standard basemap.
 * Tap-to-select wired in `useTerritoryMapInteraction`; the selected feature's
 * `selected` property (set in `nearbyPlacesOverlayStore`) grows + darkens the
 * dot so it stands out under the `NearbyPlaceCallout`.
 */
export const NEARBY_PLACES_LAYER_SPEC: GeoJsonLayerSpec = {
  sourceId: MAP_SOURCE_IDS.nearby,
  layers: [
    {
      id: 'app-nearby-places-hit',
      type: 'circle',
      filter: ['==', ['geometry-type'], 'Point'],
      minzoom: 5,
      slot: 'top',
      paint: {
        'circle-radius': 16,
        'circle-color': '#2A6F8F',
        'circle-opacity': 0,
      },
    },
    {
      id: 'app-nearby-places-dot',
      type: 'circle',
      filter: ['==', ['geometry-type'], 'Point'],
      minzoom: 5,
      slot: 'top',
      paint: {
        // Slightly smaller at normal so high-density crowds don't merge.
        'circle-radius': ['case', ['==', ['get', 'selected'], true], 9, 6],
        'circle-color': ['case', ['==', ['get', 'selected'], true], '#1D4E66', '#2A6F8F'],
        'circle-opacity': 0.95,
        'circle-stroke-width': ['case', ['==', ['get', 'selected'], true], 3, 2.5],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 1,
      },
    },
    /**
     * iOS-style name label floating above each nearby pin.
     * White text halo mimics Apple Maps' ambient POI label treatment —
     * readable on any basemap, GPU-rendered for max-density (60 places).
     * Selected place renders bolder + darker so it stands out under the
     * HTML `NearbyPlaceCallout` glass pill.
     * minzoom 13 = neighbourhood zoom; Mapbox collision detection prevents
     * overlapping labels so dense areas stay readable.
     */
    {
      id: 'app-nearby-places-label',
      type: 'symbol',
      filter: ['==', ['geometry-type'], 'Point'],
      minzoom: 13,
      slot: 'top',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          13, 10,
          15, 12,
          17, 13,
        ],
        'text-anchor': 'bottom',
        // Float the label above the dot (1.3em clears the 6px dot + stroke).
        'text-offset': [0, -1.3],
        'text-max-width': 10,
        'text-padding': 3,
        // Selected label sorts above unselected siblings.
        'symbol-sort-key': ['case', ['==', ['get', 'selected'], true], 0, 1],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': ['case', ['==', ['get', 'selected'], true], '#0d3a52', '#1c1c1e'],
        // Strong white halo = the iOS "ambient label" look (same as Apple Maps).
        'text-halo-color': 'rgba(255, 255, 255, 0.96)',
        'text-halo-width': 2,
        'text-halo-blur': 0.2,
        'text-opacity': [
          'case', ['==', ['get', 'selected'], true], 1,
          ['interpolate', ['linear'], ['zoom'], 13, 0.7, 15, 0.92],
        ],
      },
    },
  ],
  generateId: true,
};

/**
 * User-generated directory pages — blue 3D GLB map pins.
 * Runtime ownership: `DirectoryPagesLayer` (source + model + hit circle).
 * Keep hit layer id in sync with hit-test policy (`app-directory-pages-hit`).
 *
 * NOTE: This spec is kept as a documentation anchor. The actual source/layers
 * are managed imperatively inside DirectoryPagesLayer (same pattern as
 * SavedAddressesLayer) so they can use Mapbox's `model` layer type.
 */
export const DIRECTORY_PAGES_LAYER_SPEC: GeoJsonLayerSpec = {
  sourceId: MAP_SOURCE_IDS.pages,
  layers: [
    {
      id: 'app-directory-pages-hit',
      type: 'circle',
      filter: ['==', ['geometry-type'], 'Point'],
      minzoom: 5,
      paint: {
        'circle-radius': 16,
        'circle-color': '#0a84ff',
        'circle-opacity': 0,
      },
    },
  ],
  promoteId: 'id',
  generateId: false,
};

/**
 * Public community pins — layer ids / paint reference.
 * Runtime ownership is `CommunityPinsLayer` (source + icons + layers).
 * Keep ids in sync with hit-test policy (`app-community-pins-hit` / `-avatar`).
 */
export const COMMUNITY_PINS_LAYER_SPEC: GeoJsonLayerSpec = {
  sourceId: MAP_SOURCE_IDS.pins,
  layers: [
    {
      id: 'app-community-pins-hit',
      type: 'circle',
      filter: ['==', ['geometry-type'], 'Point'],
      minzoom: 5,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          10,
          12,
          14,
          16,
          18,
        ],
        'circle-color': '#000000',
        'circle-opacity': 0,
      },
    },
    {
      id: 'app-community-pins-avatar',
      type: 'symbol',
      filter: ['==', ['geometry-type'], 'Point'],
      minzoom: 5,
      layout: {
        'icon-image': ['coalesce', ['get', 'icon_image_id'], 'map-account-pin-fallback'],
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          0.55,
          10,
          0.75,
          14,
          0.95,
          17,
          1.15,
        ],
        'icon-anchor': 'center',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-padding': 2,
      },
    },
  ],
  promoteId: 'id',
  generateId: false,
};

/**
 * World object radar — circle dots marking uncollected collectible placements.
 * Scoped to the account's unlocked territories (passport). Painted above the
 * basemap with a pulsing-ready gold accent; collected items are already absent
 * from the API response (on_collect=remove). Fades in at zoom 9 to avoid clutter.
 * Runtime ownership: WorldObjectRadarLayer.
 */
export const WORLD_OBJECT_RADAR_LAYER_SPEC: GeoJsonLayerSpec = {
  sourceId: MAP_SOURCE_IDS.worldObjectRadar,
  layers: [
    {
      id: 'app-world-radar-hit',
      type: 'circle',
      filter: ['==', ['geometry-type'], 'Point'],
      minzoom: 9,
      slot: 'top',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          9, 14,
          13, 18,
          16, 22,
        ],
        'circle-color': '#F5B731',
        'circle-opacity': 0,
      },
    },
    {
      id: 'app-world-radar-dot',
      type: 'circle',
      filter: ['==', ['geometry-type'], 'Point'],
      minzoom: 9,
      slot: 'top',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          9, 5,
          13, 7,
          16, 9,
        ],
        'circle-color': '#F5B731',
        'circle-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          9, 0.6,
          11, 0.9,
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.95,
      },
    },
    {
      id: 'app-world-radar-label',
      type: 'symbol',
      filter: ['==', ['geometry-type'], 'Point'],
      minzoom: 13,
      slot: 'top',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 10,
        'text-anchor': 'top',
        'text-offset': [0, 0.8],
        'text-max-width': 8,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': '#7a5800',
        'text-halo-color': 'rgba(255, 255, 255, 0.96)',
        'text-halo-width': 2,
        'text-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          13, 0,
          14, 1,
        ],
      },
    },
  ],
  generateId: true,
};

/** Shell layers — counties / CDs / SD statewide; CTU + school buildings + CD parts as overlays. */
export const SHELL_LAYER_SPECS: GeoJsonLayerSpec[] = [
  {
    sourceId: MAP_SOURCE_IDS.counties,
    layers: COUNTIES_LAYERS,
    promoteId: 'id',
    generateId: false,
  },
  {
    sourceId: MAP_SOURCE_IDS.districts,
    layers: congressionalDistrictLayers(),
    promoteId: 'id',
    generateId: false,
  },
  {
    sourceId: MAP_SOURCE_IDS.senateDistricts,
    layers: senateDistrictLayers(),
    promoteId: 'id',
    generateId: false,
  },
  {
    sourceId: MAP_SOURCE_IDS.houseDistricts,
    layers: houseDistrictLayers(),
    promoteId: 'id',
    generateId: false,
  },
  {
    sourceId: MAP_SOURCE_IDS.ctus,
    layers: ctuPassportPaintLayers(),
    promoteId: 'id',
    generateId: false,
  },
  {
    sourceId: MAP_SOURCE_IDS.schoolDistricts,
    layers: overlayPaintLayers('app-school-districts', SCHOOL_DISTRICT_PALETTE),
    promoteId: 'id',
    generateId: false,
  },
  {
    sourceId: MAP_SOURCE_IDS.districtParts,
    layers: districtPartsLayers(),
    promoteId: 'id',
    generateId: false,
  },
  {
    sourceId: MAP_SOURCE_IDS.schools,
    layers: schoolBuildingLayers(),
    promoteId: 'id',
    generateId: false,
  },
];
