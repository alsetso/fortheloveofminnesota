/** Object Radar — visual + range constants (Game). */

/** Darker than stock night nav — land almost black, roads punch through. */
export const OBJECT_RADAR_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

export const OBJECT_RADAR_MINIMAP_SIZE_PX = 84;

export const OBJECT_RADAR_DEFAULT_RANGE_M = 150;
export const OBJECT_RADAR_RANGE_MIN_M = 75;
export const OBJECT_RADAR_RANGE_MAX_M = 500;
export const OBJECT_RADAR_RANGE_STEP_M = 75;

export const OBJECT_RADAR_RANGE_STORAGE_KEY = 'ftlomn.object-radar.rangeM';

export const OBJECT_RADAR_LAND_COLOR = '#050608';
export const OBJECT_RADAR_WATER_COLOR = '#0a1018';
/** Neutral grey roads — readable on near-black land without teal cast. */
export const OBJECT_RADAR_ROAD_COLOR = '#9a9aa3';

/**
 * Maximum rim ticks rendered on the MiniMap border.
 * Keeps the 84 px dial readable and the DOM lightweight regardless of
 * how many out-of-range objects exist in the loaded store.
 */
export const OBJECT_RADAR_MAX_RIM_TICKS = 20;

/**
 * Angular slot width (degrees) used when deduplicating rim ticks.
 * Objects within this arc are collapsed to the highest-priority one.
 * 18° → 20 compass slots around the full 360°.
 */
export const OBJECT_RADAR_RIM_DEGREES_PER_SLOT = 18;

/**
 * Multiplier applied to rangeM when clipping the Mapbox source for the
 * MiniMap. Features beyond this radius are excluded from the GL source —
 * rim ticks handle direction-only display beyond range.
 * 1.0 = strictly inside range; 1.1 gives a tiny margin for edge dots.
 */
export const OBJECT_RADAR_MINIMAP_CLIP_PAD = 1.1;
