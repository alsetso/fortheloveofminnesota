'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import {
  IconLocate,
  IconMapPin,
  IconSearch,
  IconSpinner,
  IconX,
} from '@/features/map/dockCore/core/icons';
import { haptic } from '@/lib/despia/haptics';
import { fetchReverseGeocodeDetailed } from '@/lib/geo/fetch/fetchReverseGeocode';
import {
  universalSearch,
  type UniversalPlaceHit,
} from '@/lib/search/universalSearch';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';
import { MAP_CONFIG } from '@/map/config';
import { useMapEngine } from '@/map/engine/useMapEngine';
import { waitForMapStyleReady } from '@/map/engine/mapStyleGuard';
import {
  getUserPosition,
  type UserCoords,
} from '@/map/location/device/geolocation';
import { getFindMeCoordsSnapshot } from '@/map/location/camera/findMeCoordsStore';
import {
  getFindMeLastCoords,
  setFindMeLastCoords,
} from '@/map/location/device/findMeLastCoords';
import {
  FIND_ME_OUTSIDE_MN_MESSAGE,
  isWithinMinnesota,
} from '@/map/location/device/minnesotaGate';
import {
  BLUE_BEACON_MODEL_ID,
  removeSecondaryBeaconLayers,
  switchSelectedBeaconModel,
  syncSelectedPinBeacon,
} from '@/map/points/selectedPinBeaconLayer';
import {
  removeSelectedPointCircleLayers,
  syncSelectedPointCircle,
} from '@/map/points/selectedPointCircleLayer';

export type PostLocationValue = {
  lat: number;
  lng: number;
  address: string | null;
};

export type PostLocationPanelProps = {
  value: PostLocationValue;
  onChange: (next: PostLocationValue) => void;
  /** Compact padding when embedded in the Recents scroll surface. */
  className?: string;
  /** Dark = compose overlay; light = Manage / Own chrome. */
  tone?: 'dark' | 'light';
  /**
   * When true, Find Me also places the selected pin (page default address).
   * Compose posts keep camera-only Find Me (default false).
   */
  findMeSetsPin?: boolean;
  /** Hint under the address line. */
  pinHint?: string;
};

function isFiniteCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng);
}


/** Inline compose map — street-level 3D, not flat top-down. */
const POST_LOCATION_MAP = {
  zoom: 16.5,
  pitch: 52,
  bearing: -28,
} as const;

function cameraTo(
  map: MapboxMap,
  coords: UserCoords,
  mode: 'fly' | 'ease',
): void {
  map.stop();
  map.resize();
  const next = {
    center: [coords.lng, coords.lat] as [number, number],
    zoom: POST_LOCATION_MAP.zoom,
    pitch: POST_LOCATION_MAP.pitch,
    bearing: POST_LOCATION_MAP.bearing,
    essential: true,
    easing: (t: number) => 1 - Math.pow(1 - t, 3),
  };
  if (mode === 'fly') {
    map.flyTo({ ...next, speed: 0.9, curve: 1.4 });
  } else {
    map.easeTo({ ...next, duration: 450 });
  }
}

/** Best known user fix without forcing a new GPS round-trip. */
function readKnownUserCoords(): UserCoords | null {
  const live = getFindMeCoordsSnapshot().coords;
  if (live && isWithinMinnesota(live)) return live;
  const last = getFindMeLastCoords();
  if (last && isWithinMinnesota(last)) return last;
  return null;
}

/**
 * Seed for Create Post / MediaCapture.
 * Prefer an explicit entry pin; otherwise last Find Me fix; else MN default.
 */
export function resolvePostLocationSeed(
  initial?: Partial<PostLocationValue> | null,
): PostLocationValue {
  if (
    initial &&
    typeof initial.lat === 'number' &&
    typeof initial.lng === 'number' &&
    isFiniteCoords(initial.lat, initial.lng)
  ) {
    return {
      lat: initial.lat,
      lng: initial.lng,
      address: initial.address?.trim() || null,
    };
  }
  const last = getFindMeLastCoords();
  if (last && isFiniteCoords(last.lat, last.lng)) {
    return { lat: last.lat, lng: last.lng, address: null };
  }
  const [lng, lat] = MAP_CONFIG.DEFAULT_CENTER;
  return { lat, lng, address: null };
}

/**
 * Inline map + search for where a Create Post pin drops.
 * Blue dot = live user position (Find Me). Selected pin = confirmed post location.
 * Find Me never writes the post pin — only blue + camera.
 */
export default function PostLocationPanel({
  value,
  onChange,
  className = '',
  tone = 'dark',
  findMeSetsPin = false,
  pinHint = 'Blue pin marks where your post will appear',
}: PostLocationPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const geocodeGen = useRef(0);
  const searchGen = useRef(0);
  const watchStopRef = useRef<(() => void) | null>(null);
  /** While true, selected-pin sync must not steal the camera from Find Me. */
  const findMeCameraLockRef = useRef(false);
  const findMeCameraUnlockTimer = useRef<number | null>(null);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<UniversalPlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { map, ready, error: mapError } = useMapEngine({
    containerRef,
    styleId: 'streets',
    center: [value.lng, value.lat],
    zoom: POST_LOCATION_MAP.zoom,
    pitch: POST_LOCATION_MAP.pitch,
    bearing: POST_LOCATION_MAP.bearing,
    restrictToMinnesota: true,
  });

  const stopWatch = useCallback(() => {
    watchStopRef.current?.();
    watchStopRef.current = null;
  }, []);

  const lockFindMeCamera = useCallback((ms = 1800) => {
    findMeCameraLockRef.current = true;
    if (findMeCameraUnlockTimer.current != null) {
      window.clearTimeout(findMeCameraUnlockTimer.current);
    }
    findMeCameraUnlockTimer.current = window.setTimeout(() => {
      findMeCameraLockRef.current = false;
      findMeCameraUnlockTimer.current = null;
    }, ms);
  }, []);

  /**
   * Place the blue 3D post-location beacon.
   *
   * On a fresh Mapbox instance the Standard style's model system can take
   * a frame or two to become ready after `style.load`. We try once
   * immediately, then retry on `idle`, and finally fall back to the 2D
   * circle so something is always visible.
   */
  const placeSelectedPin = useCallback(
    async (coords: UserCoords) => {
      if (!map || !ready) return;
      await waitForMapStyleReady(map);

      const tryBeacon = (): boolean => {
        const ok = syncSelectedPinBeacon(map, coords);
        if (ok) switchSelectedBeaconModel(map, BLUE_BEACON_MODEL_ID);
        return ok;
      };

      if (!tryBeacon()) {
        // Model system not ready yet — retry once after the map goes idle.
        map.once('idle', () => {
          if (!tryBeacon()) {
            syncSelectedPointCircle(map, coords);
          }
        });
      }
    },
    [map, ready],
  );

  const applyCoords = useCallback(
    async (lat: number, lng: number, knownAddress?: string | null) => {
      const gen = ++geocodeGen.current;
      setError(null);
      setGeocoding(true);
      try {
        let address = knownAddress?.trim() || null;
        if (!address) {
          const detailed = await fetchReverseGeocodeDetailed(lat, lng);
          if (gen !== geocodeGen.current) return;
          if (detailed.outsideMinnesota) {
            setError('Location must be in Minnesota');
            const prev = valueRef.current;
            if (map && ready) {
              void placeSelectedPin({ lat: prev.lat, lng: prev.lng });
            }
            return;
          }
          if (detailed.error && !detailed.address) {
            setError(detailed.error);
          }
          address = detailed.address;
        }
        if (gen !== geocodeGen.current) return;
        onChange({ lat, lng, address });
        haptic.toggle();
      } finally {
        if (gen === geocodeGen.current) setGeocoding(false);
      }
    },
    [map, ready, onChange, placeSelectedPin],
  );

  // Correct canvas size once the map is ready.
  useEffect(() => {
    if (!map || !ready) return;
    map.resize();
  }, [map, ready]);

  // Place the blue beacon as soon as the map is ready (no user avatar dot).
  useEffect(() => {
    if (!map || !ready) return;
    void placeSelectedPin({ lat: value.lat, lng: value.lng });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready]);

  // Keep selected pin in sync with confirmed value — never steal camera during Find Me.
  useEffect(() => {
    if (!map || !ready) return;
    void placeSelectedPin({ lat: value.lat, lng: value.lng });
    if (findMeCameraLockRef.current) return;
    const center = map.getCenter();
    const dist =
      Math.abs(center.lat - value.lat) + Math.abs(center.lng - value.lng);
    if (dist > 0.00005) {
      cameraTo(map, { lat: value.lat, lng: value.lng }, 'ease');
    }
  }, [map, ready, value.lat, value.lng, placeSelectedPin]);

  // Fill address if seeded without one.
  useEffect(() => {
    if (value.address?.trim()) return;
    if (!isFiniteCoords(value.lat, value.lng)) return;
    void applyCoords(value.lat, value.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tap map → move selected pin only (confirm by placement).
  useEffect(() => {
    if (!map || !ready) return;
    const onClick = (e: MapMouseEvent) => {
      const { lat, lng } = e.lngLat;
      findMeCameraLockRef.current = false;
      void placeSelectedPin({ lat, lng });
      void applyCoords(lat, lng);
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map, ready, applyCoords, placeSelectedPin]);

  useEffect(() => {
    return () => {
      stopWatch();
      if (findMeCameraUnlockTimer.current != null) {
        window.clearTimeout(findMeCameraUnlockTimer.current);
      }
      removeSecondaryBeaconLayers(map);
      removeSelectedPointCircleLayers(map);
    };
  }, [stopWatch, map]);

  // Debounced place search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    const gen = ++searchGen.current;
    setSearching(true);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await universalSearch(q);
          if (gen !== searchGen.current) return;
          setHits(result.places.slice(0, 6));
        } catch {
          if (gen !== searchGen.current) return;
          setHits([]);
        } finally {
          if (gen === searchGen.current) setSearching(false);
        }
      })();
    }, 280);
    return () => window.clearTimeout(t);
  }, [query]);

  /**
   * Find Me: fly camera to user's position. Never moves the post pin.
   * Prefers the main-map live/last fix so GPS races don't fail.
   */
  const locateToUser = useCallback(async () => {
    setLocating(true);
    setError(null);
    try {
      if (!map || !ready) {
        setError('Map is still loading');
        return;
      }

      map.resize();
      await waitForMapStyleReady(map);

      let coords = readKnownUserCoords();
      try {
        const fresh = await getUserPosition();
        if (isWithinMinnesota(fresh)) {
          coords = fresh;
        } else if (!coords) {
          setError(FIND_ME_OUTSIDE_MN_MESSAGE);
          return;
        }
      } catch {
        if (!coords) {
          setError('Could not get your location');
          return;
        }
      }

      if (!coords || !isWithinMinnesota(coords)) {
        setError(FIND_ME_OUTSIDE_MN_MESSAGE);
        return;
      }

      setFindMeLastCoords(coords);
      lockFindMeCamera(2200);
      cameraTo(map, coords, 'fly');
      if (findMeSetsPin) {
        void placeSelectedPin(coords);
        void applyCoords(coords.lat, coords.lng);
      }
      haptic.toggle();
    } finally {
      setLocating(false);
    }
  }, [map, ready, lockFindMeCamera, findMeSetsPin, placeSelectedPin, applyCoords]);

  const pickHit = useCallback(
    (hit: UniversalPlaceHit) => {
      setQuery('');
      setHits([]);
      const coords = { lat: hit.lat, lng: hit.lng };
      findMeCameraLockRef.current = false;
      if (map && ready) cameraTo(map, coords, 'ease');
      void placeSelectedPin(coords);
      void applyCoords(hit.lat, hit.lng, hit.title);
    },
    [map, ready, applyCoords, placeSelectedPin],
  );

  const light = tone === 'light';

  return (
    <div className={`mb-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div
          className={`inline-flex items-center gap-1.5 text-[15px] font-semibold ${
            light ? 'text-foreground' : 'text-white'
          }`}
        >
          <IconMapPin
            className={`h-4 w-4 ${light ? 'text-foreground-muted' : 'text-white/70'}`}
          />
          Location
        </div>
        <button
          type="button"
          onClick={() => void locateToUser()}
          disabled={locating}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition active:scale-95 disabled:opacity-40 ${
            light
              ? 'bg-lake-blue/10 text-lake-blue'
              : 'rounded-full bg-white/10 text-white'
          }`}
        >
          {locating ? (
            <IconSpinner className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <IconLocate className="h-3.5 w-3.5" />
          )}
          Find Me
        </button>
      </div>

      <div className="relative mb-2">
        <IconSearch
          className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
            light ? 'text-foreground-muted' : 'text-white/45'
          }`}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a place"
          className={`h-11 w-full pl-10 pr-10 text-[15px] outline-none ${
            light
              ? 'rounded-[10px] border border-black/[0.08] bg-white placeholder:text-foreground-muted/40 focus:border-lake-blue/40'
              : 'rounded-2xl border border-white/10 bg-white/[0.08] text-white placeholder:text-white/40 focus:border-white/25'
          }`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              setHits([]);
            }}
            className={`absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition active:scale-95 ${
              light ? 'text-foreground-muted' : 'text-white/55'
            }`}
          >
            <IconX className="h-4 w-4" />
          </button>
        ) : null}
        {hits.length > 0 ? (
          <ul
            className={`absolute inset-x-0 top-[calc(100%+4px)] z-20 overflow-hidden shadow-xl ${
              light
                ? 'rounded-[10px] border border-black/[0.08] bg-white'
                : 'rounded-2xl border border-white/10 bg-[#1c1c1e]'
            }`}
          >
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => pickHit(hit)}
                  className={`flex w-full flex-col gap-0.5 px-3.5 py-2.5 text-left transition ${
                    light ? 'active:bg-black/[0.04]' : 'active:bg-white/10'
                  }`}
                >
                  <span
                    className={`text-[14px] font-semibold ${
                      light ? 'text-foreground' : 'text-white'
                    }`}
                  >
                    {hit.title}
                  </span>
                  {hit.subtitle ? (
                    <span
                      className={`truncate text-[12px] ${
                        light ? 'text-foreground-muted' : 'text-white/45'
                      }`}
                    >
                      {hit.subtitle}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {searching ? (
          <span className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2">
            <IconSpinner
              className={`h-4 w-4 animate-spin ${
                light ? 'text-foreground-muted' : 'text-white/45'
              }`}
            />
          </span>
        ) : null}
      </div>

      <div
        className={`relative overflow-hidden ${
          light
            ? 'rounded-[12px] border border-black/[0.08] bg-black/[0.03]'
            : 'rounded-2xl border border-white/10 bg-white/[0.04]'
        }`}
      >
        <div ref={containerRef} className="h-52 w-full" />
        {(mapError || geocoding) && (
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-2 pt-6 ${
              light
                ? 'bg-gradient-to-t from-white/95 to-transparent'
                : 'bg-gradient-to-t from-black/70 to-transparent'
            }`}
          >
            <p
              className={`text-[11px] font-medium ${
                light ? 'text-foreground-muted' : 'text-white/80'
              }`}
            >
              {mapError ?? (geocoding ? 'Updating address…' : null)}
            </p>
          </div>
        )}
      </div>

      <p
        className={`mt-2 text-[13px] leading-snug ${
          light ? 'text-foreground' : 'text-white/65'
        }`}
      >
        {value.address?.trim() ||
          (geocoding
            ? 'Looking up address…'
            : 'Tap the map or search to set the location')}
      </p>
      <p
        className={`mt-1 text-[11px] leading-snug ${
          light ? 'text-foreground-muted' : 'text-white/40'
        }`}
      >
        {pinHint}
      </p>
      {error ? (
        <p
          className={`mt-1 text-[12px] font-medium ${
            light ? 'text-red-600' : 'text-amber-300'
          }`}
          role="status"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Full-screen overlay for editing location while capture preview is locked. */
export function PostLocationOverlay({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean;
  value: PostLocationValue;
  onChange: (next: PostLocationValue) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 ${Z_LAYER_CLASS.CRITICAL_DIALOG} flex flex-col bg-black/90 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]`}
      role="dialog"
      aria-modal="true"
      aria-label="Location"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-white">Location</h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-[14px] font-semibold text-black transition active:scale-95"
        >
          Done
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PostLocationPanel value={value} onChange={onChange} />
      </div>
    </div>
  );
}
