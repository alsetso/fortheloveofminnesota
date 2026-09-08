/** Map viewport + style constants for FTLOM 2.0 shell. */
export const MAP_CONFIG = {
  MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '',
  STYLE: process.env.NEXT_PUBLIC_MAPBOX_STYLE ?? 'mapbox://styles/mapbox/standard',
  STYLES: {
    streets: 'mapbox://styles/mapbox/standard',
    outdoors: 'mapbox://styles/mapbox/outdoors-v12',
    satellite: 'mapbox://styles/mapbox/standard-satellite',
  },
  /**
   * Twin Cities — placeholder / proximity bias only (geocode).
   * Map cold-open uses last-known Find Me coords when available; otherwise
   * this center at DEFAULT_ZOOM until GPS lands (never a statewide frame).
   */
  DEFAULT_CENTER: [-93.265, 44.9778] as [number, number],
  /** Locked Live close frame — matches Find Me / ZOOM_STATE_CLOSE. */
  DEFAULT_ZOOM: 16,
  /**
   * Tilted map (3D mode) — Live Presence pitch (see PRESENCE_PITCH.live).
   * Two-finger pitch may go further up to MAX_PITCH.
   */
  DEFAULT_PITCH: 75,
  /** Max tilt from two-finger pitch gestures. */
  MAX_PITCH: 85,
  /**
   * Game zoom band — wide enough to pull back to a clear birds-eye (14)
   * and push in to avatar-inspect level (22).
   * Not an atlas range (see EXPLORE_MAP_CONFIG).
   * Play (Live) uses this band; Scout uses {@link SCOUT_MIN_ZOOM}–
   * {@link SCOUT_MAX_ZOOM}.
   */
  MIN_ZOOM: 14.0,
  /**
   * Scout free-roam zoom floor — pull back to metro / regional frame.
   */
  SCOUT_MIN_ZOOM: 12,
  /**
   * Scout free-roam zoom ceiling — same inspect depth as Play.
   */
  SCOUT_MAX_ZOOM: 22,
  /**
   * Minimum zoom allowed when the game camera is unlocked for a regional /
   * multi-city pullback. Live follow restores MIN_ZOOM (14).
   */
  EXPLORE_MIN_ZOOM: 10,
  MAX_ZOOM: 22,
  /**
   * Speed threshold (m/s) above which the user is clearly in a vehicle.
   * 22.35 m/s ≈ 50 mph. Used by `resolveSpeedTier` (speedometer color) and
   * reserved for Driving mode (scaffolded — next pass). Does not change
   * position mode or camera on its own.
   */
  VEHICLE_SPEED_MPS: 22.35,
  /**
   * Zoom at and below which the third-person look-ahead fades to zero.
   * At this zoom a 6 m offset is sub-pixel; users expect dead-center framing.
   * Must stay between MIN_ZOOM and FIND_ME_ZOOM.
   */
  PITCH_FLAT_ZOOM: 14.5,
  /**
   * Live follow zoom floor — pinch/scroll may rise to MAX_ZOOM for avatar
   * inspect, but cannot pull out past this home frame.
   */
  LOCKED_EXIT_ZOOM: 16,
  MINNESOTA_BOUNDS: {
    west: -97.5,
    south: 43.5,
    east: -89.5,
    north: 49.5,
  },
  /**
   * Extra Mapbox host height past the visible clip (CSS `--map-bleed-bottom`).
   * Keep in sync with globals.css — camera padding treats this as off-screen.
   */
  BLEED_BOTTOM_PX: 40,
  /** Find Me / Live home zoom — inspect pinch may go up to MAX_ZOOM. */
  FIND_ME_ZOOM: 16,
  /**
   * Third-person Follow Me — camera look-at sits this many meters ahead of the
   * avatar along map bearing so the frame sits behind him (see his back).
   * Fades to zero toward MAX_ZOOM so close inspect is avatar-centered.
   */
  FIND_ME_LOOK_AHEAD_M: 6,
  /** Selected map point — Live home frame (inspect zoom still free after). */
  SELECTED_POINT_ZOOM: 16,
  /**
   * Each game map click eases in by this many zoom levels toward
   * {@link MAX_ZOOM} / {@link SCOUT_MAX_ZOOM} (see `resolveMapClickZoom`).
   */
  MAP_CLICK_ZOOM_STEP: 1,
  /**
   * Canonical zoom-state anchors.
   *
   *   ZOOM_STATE_STREET — Scout land
   *   ZOOM_STATE_CLOSE  — Live home / floor (pinch up to MAX_ZOOM)
   */
  ZOOM_STATE_STREET: 16,
  ZOOM_STATE_CLOSE: 16,
  /**
   * Minimum Mapbox `padding.bottom` for Follow Me (collapsed pill + float gap).
   * Live dock footprint + {@link BLEED_BOTTOM_PX} are added in `flyToFindMe`
   * so the avatar clears `.map-canvas` clip and the Game sheet.
   */
  FIND_ME_PADDING_BOTTOM_PX: 80,
  GEOLOCATION_OPTIONS: {
    enableHighAccuracy: true,
    timeout: 10_000,
    maximumAge: 0,
  },
  /** Soft retry after timeout / unavailable (still one user gesture). */
  GEOLOCATION_RETRY_OPTIONS: {
    enableHighAccuracy: true,
    timeout: 15_000,
    maximumAge: 0,
  },
  /** Watch while Find Me is active — no cache so a relocation isn't replayed. */
  GEOLOCATION_WATCH_OPTIONS: {
    enableHighAccuracy: true,
    timeout: 10_000,
    maximumAge: 0,
  },
  /**
   * Despia continuous GPS defaults (walking). Mode machine may retune via
   * `adaptDespiaLocationWatch` — see LOCOMOTION.profiles.*.despia.
   * https://setup.despia.com/native-features/gps-location.md
   */
  DESPIA_LOCATION_WATCH: {
    bufferSeconds: 5,
    movementCm: 100,
  },
  /**
   * Stationary / walking / movingFast — speed thresholds (m/s) plus per-mode
   * profiles (accuracy reject, display EMA, follow camera, Despia, facing).
   */
  LOCOMOTION: {
    /** Enter stationary when speed drops below this. */
    enterStationaryMps: 0.45,
    /** Leave stationary when speed rises above this (hysteresis). */
    leaveStationaryMps: 0.7,
    /** Enter movingFast when speed rises above this (~6.3 mph). */
    enterMovingFastMps: 2.8,
    /** Leave movingFast when speed drops below this (hysteresis). */
    leaveMovingFastMps: 2.2,
    profiles: {
      stationary: {
        maxAccuracyM: 25,
        displayAlpha: 0.08,
        follow: { enabled: false, minDeltaM: 12, durationMs: 400 },
        despia: { bufferSeconds: 20, movementCm: 400 },
        preferGpsCourse: false,
      },
      walking: {
        maxAccuracyM: 20,
        displayAlpha: 0.22,
        follow: { enabled: true, minDeltaM: 8, durationMs: 320 },
        despia: { bufferSeconds: 5, movementCm: 100 },
        preferGpsCourse: false,
      },
      movingFast: {
        maxAccuracyM: 40,
        displayAlpha: 0.80,
        follow: { enabled: true, minDeltaM: 16, durationMs: 180 },
        despia: { bufferSeconds: 1, movementCm: 800 },
        preferGpsCourse: true,
      },
    },
  },
} as const;

/**
 * Statewide frame for `/world-manager` — unlocks zoom so staff can scan
 * placements across Minnesota, then drop to street level to place.
 * Consumer `MAP_CONFIG` stays locked at neighborhood zoom.
 */
export const WORLD_MANAGER_MAP_CONFIG = {
  ...MAP_CONFIG,
  /** Statewide frame so managers can scan placements across Minnesota. */
  DEFAULT_ZOOM: 6.5,
  /** Zoom unlocked for statewide browse → street-level place. */
  MIN_ZOOM: 5.5,
  MAX_ZOOM: 20,
} as const;

/**
 * Statewide frame for `/explore-map` — Explore is for browsing datasets
 * across all of Minnesota, not following the account's live location, so it
 * boots independent of Find Me at a flat, zoom-unlocked atlas frame.
 * Pitch stays 0 (no tilt); soft "Locate" never frame-locks like Game Find Me.
 * Kept as its own export so Explore can diverge without cross-wiring Game.
 */
export const EXPLORE_MAP_CONFIG = {
  ...MAP_CONFIG,
  DEFAULT_ZOOM: 6.5,
  MIN_ZOOM: 5.5,
  MAX_ZOOM: 20,
  /** Flat atlas — Explore never boots or gestures into 3D pitch. */
  DEFAULT_PITCH: 0,
  MAX_PITCH: 0,
} as const;

export type MapStyleId = keyof typeof MAP_CONFIG.STYLES;
