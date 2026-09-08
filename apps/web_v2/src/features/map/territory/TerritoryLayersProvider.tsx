'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { FeatureCollection } from 'geojson';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import {
  TERRITORY_LAYERS,
  EXPLORE_LAYER_SLUGS,
  getTerritoryLayer,
  isCtuCityClass,
  isCtuTownClass,
  type TerritorySlug,
} from '@/features/map/territory/territoryLayers';
import {
  EXPLORE_UNLOCKED_PROP,
  buildPassportCtuPublishFc,
} from '@/features/map/territory/passportCtuPublish';

type LoadingMap = Partial<Record<TerritorySlug, boolean>>;
type ErrorMap = Partial<Record<TerritorySlug, string | null>>;

type CountyOverlayKind = 'cities-and-towns' | 'school-districts';

type CountyOverlays = {
  countyId: string | null;
  /** Show CITY-class CTUs for `countyId` (prefs may be on before a county is selected). */
  citiesOn: boolean;
  /** Show township/town CTUs for `countyId`. */
  townsOn: boolean;
  schoolDistrictsOn: boolean;
  citiesCount: number;
  townsCount: number;
  schoolDistrictsCount: number;
  citiesLoading: boolean;
  schoolDistrictsLoading: boolean;
  citiesError: string | null;
  schoolDistrictsError: string | null;
};

type DistrictSchools = {
  districtId: string | null;
  schoolsOn: boolean;
  schoolsCount: number;
  schoolsLoading: boolean;
  schoolsError: string | null;
};

/** Statewide schools overlay (Controls → School districts → Schools). */
type SchoolsLayer = {
  on: boolean;
  count: number;
  loading: boolean;
  error: string | null;
};

type DistrictParts = {
  districtId: string | null;
  partsOn: boolean;
  partsCount: number;
  partsLoading: boolean;
  partsError: string | null;
};

type TerritoryLayersContextValue = {
  activeSlugs: ReadonlySet<TerritorySlug>;
  isActive: (slug: TerritorySlug) => boolean;
  loading: LoadingMap;
  error: ErrorMap;
  toggleSlug: (slug: TerritorySlug) => void;
  ensureActive: (slug: TerritorySlug) => Promise<void>;
  isLoaded: (slug: TerritorySlug) => boolean;

  /**
   * Explore "Your visits" mask — paints locked units grey, unlocked clear.
   * Locked geometry stays hittable so hover/details can show Travel to unlock.
   */
  unlockedOnly: boolean;
  setUnlockedOnly: (on: boolean) => void;
  /** Seeds the unlocked-id sets (keyed by `TerritoryLayerConfig.entityKind`) used by the mask above. */
  setUnlockedIds: (idsByKind: Readonly<Record<string, ReadonlySet<string>>>) => void;
  /**
   * Passport unlock check — `null` until ids are seeded (signed out / loading).
   * `false` = travel required; `true` = visited / unlocked.
   */
  isUnlocked: (entityKind: string, unitId: string) => boolean | null;
  /**
   * Explore exclusivity — activate exactly one primary boundary layer
   * (or `null` to clear all primary slugs). Nested overlays are cleared.
   */
  setExclusiveLayer: (slug: TerritorySlug | null) => Promise<void>;

  countyOverlays: CountyOverlays;
  /** Toggle city CTUs — requires a focused county to draw on the map. */
  toggleCitiesLayer: () => void;
  /** Toggle town/township CTUs — requires a focused county to draw on the map. */
  toggleTownsLayer: () => void;
  /** Toggle cities inside a selected county (details pane). */
  toggleCountyCities: (countyId: string) => void;
  /** Toggle towns inside a selected county (details pane). */
  toggleCountyTowns: (countyId: string) => void;
  /** Bind CTU overlays to the selected county (or `null` when none). */
  setCtuFocusCounty: (countyId: string | null) => void;
  /** Toggle school districts intersecting a selected county. */
  toggleCountySchoolDistricts: (countyId: string) => void;
  clearCountyOverlays: () => void;
  /**
   * Full boundary end-state — empty activeSlugs, overlays, schools, parts,
   * and all Controls GeoJSON sources. Leaves Find Me / selected point alone.
   */
  clearAllBoundaryPaint: () => void;

  districtSchools: DistrictSchools;
  /** Toggle schools inside a selected school district. */
  toggleDistrictSchools: (districtId: string) => void;
  clearDistrictSchools: () => void;

  schoolsLayer: SchoolsLayer;
  /** Toggle statewide school points (nested under school-districts in Controls). */
  toggleSchoolsLayer: () => void;
  clearSchoolsLayer: () => void;

  districtParts: DistrictParts;
  /** Load precinct / sub-features for a selected congressional district. */
  loadDistrictParts: (districtId: string) => void;
  clearDistrictParts: () => void;
};

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

const INITIAL_OVERLAYS: CountyOverlays = {
  countyId: null,
  citiesOn: false,
  townsOn: false,
  schoolDistrictsOn: false,
  citiesCount: 0,
  townsCount: 0,
  schoolDistrictsCount: 0,
  citiesLoading: false,
  schoolDistrictsLoading: false,
  citiesError: null,
  schoolDistrictsError: null,
};

function filterCtuFeatures(
  fc: FeatureCollection,
  citiesOn: boolean,
  townsOn: boolean,
): FeatureCollection {
  if (!citiesOn && !townsOn) {
    return EMPTY_FC;
  }
  return {
    type: 'FeatureCollection',
    features: fc.features.filter((f) => {
      const cls =
        typeof f.properties?.ctu_class === 'string' ? f.properties.ctu_class : null;
      if (citiesOn && isCtuCityClass(cls)) return true;
      if (townsOn && isCtuTownClass(cls)) return true;
      return false;
    }),
  };
}

function countCtuClasses(fc: FeatureCollection): { cities: number; towns: number } {
  let cities = 0;
  let towns = 0;
  for (const f of fc.features) {
    const cls =
      typeof f.properties?.ctu_class === 'string' ? f.properties.ctu_class : null;
    if (isCtuCityClass(cls)) cities += 1;
    else if (isCtuTownClass(cls)) towns += 1;
  }
  return { cities, towns };
}

const INITIAL_DISTRICT_SCHOOLS: DistrictSchools = {
  districtId: null,
  schoolsOn: false,
  schoolsCount: 0,
  schoolsLoading: false,
  schoolsError: null,
};

const INITIAL_SCHOOLS_LAYER: SchoolsLayer = {
  on: false,
  count: 0,
  loading: false,
  error: null,
};

const INITIAL_DISTRICT_PARTS: DistrictParts = {
  districtId: null,
  partsOn: false,
  partsCount: 0,
  partsLoading: false,
  partsError: null,
};

const TerritoryLayersContext = createContext<TerritoryLayersContextValue | null>(null);

async function fetchBoundaries(slug: TerritorySlug): Promise<FeatureCollection> {
  const res = await fetch(`/api/territory/layers/${slug}/boundaries`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to load ${slug}`);
  }
  return (await res.json()) as FeatureCollection;
}

async function fetchCountyRelated(
  countyId: string,
  kind: CountyOverlayKind,
): Promise<FeatureCollection> {
  const res = await fetch(`/api/territory/counties/${countyId}/related/${kind}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Failed to load ${kind}`);
  }
  return (await res.json()) as FeatureCollection;
}

async function fetchDistrictSchools(districtId: string): Promise<FeatureCollection> {
  const res = await fetch(`/api/territory/school-districts/${districtId}/related/schools`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Failed to load schools');
  }
  return (await res.json()) as FeatureCollection;
}

async function fetchStatewideSchools(): Promise<FeatureCollection> {
  const res = await fetch('/api/territory/schools/boundaries');
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Failed to load schools');
  }
  return (await res.json()) as FeatureCollection;
}

async function fetchDistrictParts(districtId: string): Promise<FeatureCollection> {
  const res = await fetch(`/api/territory/districts/${districtId}/parts`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Failed to load district parts');
  }
  return (await res.json()) as FeatureCollection;
}

export function TerritoryLayersProvider({ children }: { children: ReactNode }) {
  const [activeSlugs, setActiveSlugs] = useState<ReadonlySet<TerritorySlug>>(() => new Set());
  const [loading, setLoading] = useState<LoadingMap>({});
  const [error, setError] = useState<ErrorMap>({});
  const [unlockedOnly, setUnlockedOnlyState] = useState(false);
  const unlockedOnlyRef = useRef(false);
  const unlockedIdsRef = useRef<Readonly<Record<string, ReadonlySet<string>>>>({});
  /** True after ExploreUnlockedBridge (or equivalent) seeds passport ids. */
  const unlockSeededRef = useRef(false);
  const [unlockEpoch, setUnlockEpoch] = useState(0);
  const [countyOverlays, setCountyOverlays] = useState<CountyOverlays>(INITIAL_OVERLAYS);
  const [districtSchools, setDistrictSchools] = useState<DistrictSchools>(INITIAL_DISTRICT_SCHOOLS);
  const [schoolsLayer, setSchoolsLayer] = useState<SchoolsLayer>(INITIAL_SCHOOLS_LAYER);
  const [districtParts, setDistrictParts] = useState<DistrictParts>(INITIAL_DISTRICT_PARTS);
  const loadedRef = useRef<Partial<Record<TerritorySlug, boolean>>>({});
  const inflightRef = useRef<Partial<Record<TerritorySlug, Promise<void>>>>({});
  const slugFcRef = useRef<Partial<Record<TerritorySlug, FeatureCollection>>>({});
  const activeSlugsRef = useRef(activeSlugs);
  activeSlugsRef.current = activeSlugs;
  const relatedCacheRef = useRef<{
    countyId: string | null;
    cities: FeatureCollection | null;
    schoolDistricts: FeatureCollection | null;
  }>({ countyId: null, cities: null, schoolDistricts: null });
  /** Bumps when a newer passport CTU publish supersedes an in-flight mask build. */
  const ctuPassportPublishGenRef = useRef(0);

  /**
   * Single publish path to the map data bus — every boundary write (statewide
   * slug or county-scoped overlay) goes through here so "Your visits" /
   * passport stamping behaves identically no matter which toggle produced the
   * GeoJSON. Pass an `entityKind` for unlockable territories; omit it for
   * sources that aren't (e.g. school points).
   *
   * Passport CTUs: full FC stays in `slugFcRef` for adjacency; the map only
   * receives unlocked + adjacent polygons + one far-fog mask (not 2.6k fills).
   */
  const publishFeatures = useCallback(
    (
      sourceId: (typeof MAP_SOURCE_IDS)[keyof typeof MAP_SOURCE_IDS],
      fc: FeatureCollection,
      entityKind?: string,
    ) => {
      const shouldStamp =
        Boolean(entityKind) &&
        (unlockedOnlyRef.current || unlockSeededRef.current);
      if (!shouldStamp || !entityKind) {
        mapDataStore.set(sourceId, fc);
        return;
      }
      const ids = unlockedIdsRef.current[entityKind];
      // Cities & towns — passport frame publishes sparse GeoJSON (playable + fog).
      if (entityKind === 'ctu') {
        if (!unlockedOnlyRef.current) {
          mapDataStore.set(sourceId, fc);
          return;
        }
        const gen = ++ctuPassportPublishGenRef.current;
        void buildPassportCtuPublishFc(fc, ids).then((sparse) => {
          if (gen !== ctuPassportPublishGenRef.current) return;
          if (!unlockedOnlyRef.current) return;
          mapDataStore.set(sourceId, sparse);
        });
        return;
      }
      const hasIds = Boolean(ids && ids.size > 0);
      mapDataStore.set(sourceId, {
        type: 'FeatureCollection',
        features: fc.features.map((f) => {
          const id = String(f.properties?.id ?? '');
          const unlocked = hasIds && ids!.has(id) ? 1 : 0;
          return {
            ...f,
            properties: {
              ...(f.properties ?? {}),
              [EXPLORE_UNLOCKED_PROP]: unlocked,
            },
          };
        }),
      });
    },
    [],
  );

  /**
   * Publishes slug `slug`'s cached FeatureCollection to the map — stamped for
   * the unlocked mask when `unlockedOnly` is on. Keeping the full FC in
   * `slugFcRef` means toggling the filter never needs a refetch.
   */
  const publishSlug = useCallback(
    (slug: TerritorySlug) => {
      const config = getTerritoryLayer(slug);
      const fc = slugFcRef.current[slug];
      if (!config || !fc) return;
      publishFeatures(config.sourceId, fc, config.entityKind);
    },
    [publishFeatures],
  );

  const statewideSchoolsFcRef = useRef<FeatureCollection | null>(null);
  const schoolsCacheRef = useRef<{
    districtId: string | null;
    schools: FeatureCollection | null;
  }>({ districtId: null, schools: null });
  const partsCacheRef = useRef<{
    districtId: string | null;
    parts: FeatureCollection | null;
  }>({ districtId: null, parts: null });

  const restoreStatewideSchoolDistricts = useCallback(() => {
    if (!activeSlugsRef.current.has('school-districts')) {
      mapDataStore.clear(MAP_SOURCE_IDS.schoolDistricts);
      return;
    }
    const cached = slugFcRef.current['school-districts'];
    if (cached) mapDataStore.set(MAP_SOURCE_IDS.schoolDistricts, cached);
  }, []);

  const loadSlug = useCallback(async (slug: TerritorySlug) => {
    if (loadedRef.current[slug]) {
      publishSlug(slug);
      return;
    }
    if (inflightRef.current[slug]) {
      await inflightRef.current[slug];
      return;
    }

    const config = getTerritoryLayer(slug);
    if (!config) return;

    const run = (async () => {
      setLoading((prev) => ({ ...prev, [slug]: true }));
      setError((prev) => ({ ...prev, [slug]: null }));
      try {
        const fc = await fetchBoundaries(slug);
        if (!fc.features?.length) {
          throw new Error(`No boundary features for ${config.label}`);
        }
        slugFcRef.current[slug] = fc;
        publishSlug(slug);
        loadedRef.current[slug] = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load layer';
        setError((prev) => ({ ...prev, [slug]: message }));
        mapDataStore.set(config.sourceId, EMPTY_FC);
        throw err;
      } finally {
        setLoading((prev) => ({ ...prev, [slug]: false }));
        delete inflightRef.current[slug];
      }
    })();

    inflightRef.current[slug] = run;
    await run;
  }, [publishSlug]);

  const clearSchoolsLayer = useCallback(() => {
    statewideSchoolsFcRef.current = null;
    setSchoolsLayer(INITIAL_SCHOOLS_LAYER);
    // Restore district-scoped schools if that overlay is still on.
    if (
      schoolsCacheRef.current.districtId &&
      districtSchools.districtId === schoolsCacheRef.current.districtId &&
      districtSchools.schoolsOn &&
      schoolsCacheRef.current.schools
    ) {
      mapDataStore.set(MAP_SOURCE_IDS.schools, schoolsCacheRef.current.schools);
      return;
    }
    if (!districtSchools.schoolsOn) {
      mapDataStore.clear(MAP_SOURCE_IDS.schools);
    }
  }, [districtSchools.districtId, districtSchools.schoolsOn]);

  const toggleSchoolsLayer = useCallback(() => {
    if (schoolsLayer.on) {
      clearSchoolsLayer();
      return;
    }
    // Statewide owns the schools source — drop district-scoped overlay flag.
    setDistrictSchools(INITIAL_DISTRICT_SCHOOLS);
    setSchoolsLayer({
      on: true,
      count: 0,
      loading: true,
      error: null,
    });
    void (async () => {
      try {
        let fc = statewideSchoolsFcRef.current;
        if (!fc || fc.features.length === 0) {
          fc = await fetchStatewideSchools();
          statewideSchoolsFcRef.current = fc;
        }
        setSchoolsLayer((prev) => {
          if (!prev.on) {
            mapDataStore.clear(MAP_SOURCE_IDS.schools);
            return { ...prev, loading: false };
          }
          mapDataStore.set(MAP_SOURCE_IDS.schools, fc!);
          return {
            on: true,
            count: fc!.features.length,
            loading: false,
            error: null,
          };
        });
      } catch (err) {
        mapDataStore.clear(MAP_SOURCE_IDS.schools);
        setSchoolsLayer({
          on: false,
          count: 0,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load schools',
        });
      }
    })();
  }, [schoolsLayer.on, clearSchoolsLayer]);

  const toggleSlug = useCallback(
    (slug: TerritorySlug) => {
      setActiveSlugs((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) {
          next.delete(slug);
          if (slug === 'counties') {
            // Cities / towns nest under counties — drop prefs + focus with the parent.
            next.delete('cities-and-towns');
            const citiesConfig = getTerritoryLayer('cities-and-towns');
            if (citiesConfig) mapDataStore.clear(citiesConfig.sourceId);
            setCountyOverlays((overlays) => ({
              ...overlays,
              countyId: null,
              citiesOn: false,
              townsOn: false,
              citiesLoading: false,
              citiesCount: 0,
              townsCount: 0,
              citiesError: null,
            }));
          }
          if (slug === 'school-districts') {
            // Keep county-scoped SD overlay data if that overlay is still on
            setCountyOverlays((overlays) => {
              if (overlays.schoolDistrictsOn && overlays.countyId) {
                const cached = relatedCacheRef.current;
                if (
                  cached.countyId === overlays.countyId &&
                  cached.schoolDistricts
                ) {
                  mapDataStore.set(MAP_SOURCE_IDS.schoolDistricts, cached.schoolDistricts);
                }
              } else {
                mapDataStore.clear(MAP_SOURCE_IDS.schoolDistricts);
              }
              return overlays;
            });
            // Schools overlay is nested under school districts.
            mapDataStore.clear(MAP_SOURCE_IDS.schools);
            setSchoolsLayer(INITIAL_SCHOOLS_LAYER);
            setDistrictSchools(INITIAL_DISTRICT_SCHOOLS);
            schoolsCacheRef.current = { districtId: null, schools: null };
          } else {
            const config = getTerritoryLayer(slug);
            if (config) mapDataStore.clear(config.sourceId);
            if (slug === 'districts') {
              mapDataStore.clear(MAP_SOURCE_IDS.districtParts);
              partsCacheRef.current = { districtId: null, parts: null };
              setDistrictParts(INITIAL_DISTRICT_PARTS);
            }
          }
        } else {
          next.add(slug);
          if (slug === 'school-districts') {
            // Statewide owns the source; clear county SD overlay flag
            setCountyOverlays((overlays) =>
              overlays.schoolDistrictsOn
                ? { ...overlays, schoolDistrictsOn: false, schoolDistrictsLoading: false }
                : overlays,
            );
          }
          if (slug === 'cities-and-towns') {
            // Statewide CTUs own the source; clear county-scoped city/town prefs.
            setCountyOverlays((overlays) =>
              overlays.citiesOn || overlays.townsOn
                ? {
                    ...overlays,
                    citiesOn: false,
                    townsOn: false,
                    citiesLoading: false,
                    citiesCount: 0,
                    townsCount: 0,
                  }
                : overlays,
            );
          }
          void loadSlug(slug).catch(() => {
            /* error already in state */
          });
        }
        return next;
      });
    },
    [loadSlug],
  );

  const ensureActive = useCallback(
    async (slug: TerritorySlug) => {
      setActiveSlugs((prev) => {
        if (prev.has(slug)) return prev;
        const next = new Set(prev);
        next.add(slug);
        return next;
      });
      await loadSlug(slug);
    },
    [loadSlug],
  );

  /**
   * Explore one-layer-at-a-time — clears other primary slugs (+ nested
   * overlays), then activates `slug` (or clears everything when null).
   */
  const setExclusiveLayer = useCallback(
    async (slug: TerritorySlug | null) => {
      const prev = activeSlugsRef.current;
      for (const s of EXPLORE_LAYER_SLUGS) {
        if (s === slug) continue;
        if (!prev.has(s)) continue;
        const config = getTerritoryLayer(s);
        if (config) mapDataStore.clear(config.sourceId);
      }
      mapDataStore.clear(MAP_SOURCE_IDS.schools);
      mapDataStore.clear(MAP_SOURCE_IDS.districtParts);
      setSchoolsLayer(INITIAL_SCHOOLS_LAYER);
      setDistrictSchools(INITIAL_DISTRICT_SCHOOLS);
      setDistrictParts(INITIAL_DISTRICT_PARTS);
      setCountyOverlays(INITIAL_OVERLAYS);
      relatedCacheRef.current = { countyId: null, cities: null, schoolDistricts: null };
      schoolsCacheRef.current = { districtId: null, schools: null };
      partsCacheRef.current = { districtId: null, parts: null };

      if (!slug) {
        setActiveSlugs(new Set());
        return;
      }

      setActiveSlugs(new Set([slug]));
      await loadSlug(slug);
    },
    [loadSlug],
  );

  const clearCountyOverlays = useCallback(() => {
    relatedCacheRef.current = { countyId: null, cities: null, schoolDistricts: null };
    setCountyOverlays(INITIAL_OVERLAYS);
    restoreStatewideSchoolDistricts();
    if (activeSlugsRef.current.has('cities-and-towns')) {
      const cached = slugFcRef.current['cities-and-towns'];
      if (cached) publishFeatures(MAP_SOURCE_IDS.ctus, cached, 'ctu');
      else mapDataStore.clear(MAP_SOURCE_IDS.ctus);
    } else {
      mapDataStore.clear(MAP_SOURCE_IDS.ctus);
    }
  }, [restoreStatewideSchoolDistricts, publishFeatures]);

  /** Empty Controls paint — default explore ownership off. */
  const clearAllBoundaryPaint = useCallback(() => {
    setActiveSlugs(new Set());
    setLoading({});
    setError({});
    unlockedOnlyRef.current = false;
    setUnlockedOnlyState(false);
    setCountyOverlays(INITIAL_OVERLAYS);
    setDistrictSchools(INITIAL_DISTRICT_SCHOOLS);
    setSchoolsLayer(INITIAL_SCHOOLS_LAYER);
    setDistrictParts(INITIAL_DISTRICT_PARTS);
    relatedCacheRef.current = { countyId: null, cities: null, schoolDistricts: null };
    schoolsCacheRef.current = { districtId: null, schools: null };
    partsCacheRef.current = { districtId: null, parts: null };
    statewideSchoolsFcRef.current = null;
    for (const layer of TERRITORY_LAYERS) {
      mapDataStore.clear(layer.sourceId);
    }
    mapDataStore.clear(MAP_SOURCE_IDS.schools);
    mapDataStore.clear(MAP_SOURCE_IDS.districtParts);
  }, []);

  const clearDistrictSchools = useCallback(() => {
    schoolsCacheRef.current = { districtId: null, schools: null };
    setDistrictSchools(INITIAL_DISTRICT_SCHOOLS);
    // Don't wipe the map if Controls statewide schools overlay owns the source.
    if (schoolsLayer.on && statewideSchoolsFcRef.current) {
      mapDataStore.set(MAP_SOURCE_IDS.schools, statewideSchoolsFcRef.current);
      return;
    }
    if (!schoolsLayer.on) {
      mapDataStore.clear(MAP_SOURCE_IDS.schools);
    }
  }, [schoolsLayer.on]);

  const clearDistrictParts = useCallback(() => {
    mapDataStore.clear(MAP_SOURCE_IDS.districtParts);
    partsCacheRef.current = { districtId: null, parts: null };
    setDistrictParts(INITIAL_DISTRICT_PARTS);
  }, []);

  const loadDistrictParts = useCallback((districtId: string) => {
    if (
      districtParts.districtId === districtId &&
      districtParts.partsOn &&
      !districtParts.partsLoading
    ) {
      return;
    }

    setDistrictParts({
      districtId,
      partsOn: true,
      partsLoading: true,
      partsCount: 0,
      partsError: null,
    });

    void (async () => {
      try {
        if (partsCacheRef.current.districtId !== districtId) {
          partsCacheRef.current = { districtId, parts: null };
        }
        let fc = partsCacheRef.current.parts;
        if (!fc || fc.features.length === 0) {
          fc = await fetchDistrictParts(districtId);
          partsCacheRef.current = { districtId, parts: fc };
        }
        setDistrictParts((prev) => {
          if (prev.districtId !== districtId || !prev.partsOn) {
            mapDataStore.clear(MAP_SOURCE_IDS.districtParts);
            return { ...prev, partsLoading: false };
          }
          mapDataStore.set(MAP_SOURCE_IDS.districtParts, fc!);
          return {
            districtId,
            partsOn: true,
            partsLoading: false,
            partsCount: fc!.features.length,
            partsError: null,
          };
        });
      } catch (err) {
        mapDataStore.clear(MAP_SOURCE_IDS.districtParts);
        setDistrictParts((prev) => ({
          ...prev,
          partsOn: false,
          partsLoading: false,
          partsError: err instanceof Error ? err.message : 'Failed to load precincts',
        }));
      }
    })();
  }, [districtParts.districtId, districtParts.partsOn, districtParts.partsLoading]);

  const ensureRelatedCache = useCallback(async (countyId: string, kind: CountyOverlayKind) => {
    if (relatedCacheRef.current.countyId !== countyId) {
      relatedCacheRef.current = { countyId, cities: null, schoolDistricts: null };
    }
    if (kind === 'cities-and-towns' && relatedCacheRef.current.cities) {
      // Skip empty cache — may be from before county_id repair.
      if (relatedCacheRef.current.cities.features.length > 0) {
        return relatedCacheRef.current.cities;
      }
    }
    // Always refetch school districts so spatial filter stays accurate
    const fc = await fetchCountyRelated(countyId, kind);
    if (kind === 'cities-and-towns') relatedCacheRef.current.cities = fc;
    else relatedCacheRef.current.schoolDistricts = fc;
    return fc;
  }, []);

  const ctuLoadGenRef = useRef(0);

  /**
   * Reconcile CTU map data from overlay prefs + focused county.
   * Prefs can stay on without a county (Controls hint); polygons only publish
   * when both a focus county and at least one class toggle are set.
   */
  useEffect(() => {
    const { countyId, citiesOn, townsOn } = countyOverlays;
    const gen = ++ctuLoadGenRef.current;

    if ((!citiesOn && !townsOn) || !countyId) {
      if (!activeSlugsRef.current.has('cities-and-towns')) {
        mapDataStore.clear(MAP_SOURCE_IDS.ctus);
      }
      setCountyOverlays((prev) => {
        if (
          !prev.citiesLoading &&
          prev.citiesCount === 0 &&
          prev.townsCount === 0 &&
          prev.citiesError == null
        ) {
          return prev;
        }
        return {
          ...prev,
          citiesLoading: false,
          citiesError: null,
          citiesCount: 0,
          townsCount: 0,
        };
      });
      return;
    }

    // County overlay owns the CTU source — drop statewide slug if present.
    setActiveSlugs((prev) => {
      if (!prev.has('cities-and-towns')) return prev;
      const next = new Set(prev);
      next.delete('cities-and-towns');
      return next;
    });

    setCountyOverlays((prev) =>
      prev.citiesLoading ? prev : { ...prev, citiesLoading: true, citiesError: null },
    );

    void (async () => {
      try {
        const fc = await ensureRelatedCache(countyId, 'cities-and-towns');
        if (gen !== ctuLoadGenRef.current) return;

        const filtered = filterCtuFeatures(fc, citiesOn, townsOn);
        const counts = countCtuClasses(fc);
        publishFeatures(MAP_SOURCE_IDS.ctus, filtered, 'ctu');
        setCountyOverlays((prev) => {
          if (gen !== ctuLoadGenRef.current) return prev;
          if (prev.countyId !== countyId) return prev;
          return {
            ...prev,
            citiesLoading: false,
            citiesError: null,
            citiesCount: citiesOn ? counts.cities : 0,
            townsCount: townsOn ? counts.towns : 0,
          };
        });
      } catch (err) {
        if (gen !== ctuLoadGenRef.current) return;
        if (!activeSlugsRef.current.has('cities-and-towns')) {
          mapDataStore.clear(MAP_SOURCE_IDS.ctus);
        }
        setCountyOverlays((prev) => ({
          ...prev,
          citiesLoading: false,
          citiesError: err instanceof Error ? err.message : 'Failed to load cities',
          citiesCount: 0,
          townsCount: 0,
        }));
      }
    })();
  }, [
    countyOverlays.countyId,
    countyOverlays.citiesOn,
    countyOverlays.townsOn,
    ensureRelatedCache,
    publishFeatures,
  ]);

  const toggleCitiesLayer = useCallback(() => {
    setCountyOverlays((prev) => ({ ...prev, citiesOn: !prev.citiesOn }));
  }, []);

  const toggleTownsLayer = useCallback(() => {
    setCountyOverlays((prev) => ({ ...prev, townsOn: !prev.townsOn }));
  }, []);

  /** Sticky focus — set a county, or pass null only for an explicit clear. */
  const setCtuFocusCounty = useCallback((countyId: string | null) => {
    setCountyOverlays((prev) => {
      if (prev.countyId === countyId) return prev;
      return {
        ...prev,
        countyId,
        citiesCount: 0,
        townsCount: 0,
        citiesError: null,
      };
    });
  }, []);

  const toggleCountyCities = useCallback((countyId: string) => {
    setCountyOverlays((prev) => {
      const citiesOn = prev.countyId === countyId ? !prev.citiesOn : true;
      return {
        ...prev,
        countyId,
        citiesOn,
        townsOn: prev.townsOn,
      };
    });
  }, []);

  const toggleCountyTowns = useCallback((countyId: string) => {
    setCountyOverlays((prev) => {
      const townsOn = prev.countyId === countyId ? !prev.townsOn : true;
      return {
        ...prev,
        countyId,
        townsOn,
        citiesOn: prev.citiesOn,
      };
    });
  }, []);

  const toggleCountySchoolDistricts = useCallback(
    (countyId: string) => {
      const turningOff =
        countyOverlays.countyId === countyId && countyOverlays.schoolDistrictsOn;

      if (turningOff) {
        setCountyOverlays((prev) => ({
          ...prev,
          countyId,
          schoolDistrictsOn: false,
          schoolDistrictsLoading: false,
          schoolDistrictsError: null,
        }));
        restoreStatewideSchoolDistricts();
        return;
      }

      // County overlay takes the SD source; turn off statewide slug visually/data-wise
      setActiveSlugs((prev) => {
        if (!prev.has('school-districts')) return prev;
        const next = new Set(prev);
        next.delete('school-districts');
        return next;
      });

      setCountyOverlays((prev) => ({
        ...prev,
        countyId,
        schoolDistrictsOn: true,
        schoolDistrictsLoading: true,
        schoolDistrictsError: null,
        // Keep city/town prefs when switching focus county via SD toggle.
        citiesOn: prev.citiesOn,
        townsOn: prev.townsOn,
        citiesCount: prev.countyId === countyId ? prev.citiesCount : 0,
        townsCount: prev.countyId === countyId ? prev.townsCount : 0,
      }));

      void (async () => {
        try {
          const fc = await ensureRelatedCache(countyId, 'school-districts');
          setCountyOverlays((prev) => {
            if (prev.countyId !== countyId || !prev.schoolDistrictsOn) {
              restoreStatewideSchoolDistricts();
              return { ...prev, schoolDistrictsLoading: false };
            }
            mapDataStore.set(MAP_SOURCE_IDS.schoolDistricts, fc);
            return {
              ...prev,
              countyId,
              schoolDistrictsOn: true,
              schoolDistrictsLoading: false,
              schoolDistrictsError: null,
              schoolDistrictsCount: fc.features.length,
            };
          });
        } catch (err) {
          mapDataStore.clear(MAP_SOURCE_IDS.schoolDistricts);
          setCountyOverlays((prev) => ({
            ...prev,
            schoolDistrictsOn: false,
            schoolDistrictsLoading: false,
            schoolDistrictsError:
              err instanceof Error ? err.message : 'Failed to load school districts',
          }));
        }
      })();
    },
    [
      countyOverlays.countyId,
      countyOverlays.schoolDistrictsOn,
      ensureRelatedCache,
      restoreStatewideSchoolDistricts,
    ],
  );

  const toggleDistrictSchools = useCallback(
    (districtId: string) => {
      const turningOff =
        districtSchools.districtId === districtId && districtSchools.schoolsOn;

      if (turningOff) {
        mapDataStore.clear(MAP_SOURCE_IDS.schools);
        setDistrictSchools((prev) => ({
          ...prev,
          districtId,
          schoolsOn: false,
          schoolsLoading: false,
          schoolsError: null,
        }));
        return;
      }

      // District-scoped schools take the source; drop statewide Controls overlay.
      setSchoolsLayer(INITIAL_SCHOOLS_LAYER);

      setDistrictSchools({
        districtId,
        schoolsOn: true,
        schoolsLoading: true,
        schoolsCount: 0,
        schoolsError: null,
      });

      void (async () => {
        try {
          if (schoolsCacheRef.current.districtId !== districtId) {
            schoolsCacheRef.current = { districtId, schools: null };
          }
          let fc = schoolsCacheRef.current.schools;
          // Refetch empty or point-only caches (pre-polygon / RLS repair).
          const hasPolygon = Boolean(
            fc?.features.some(
              (f) =>
                f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon',
            ),
          );
          if (!fc || fc.features.length === 0 || !hasPolygon) {
            fc = await fetchDistrictSchools(districtId);
            schoolsCacheRef.current = { districtId, schools: fc };
          }
          setDistrictSchools((prev) => {
            if (prev.districtId !== districtId || !prev.schoolsOn) {
              mapDataStore.clear(MAP_SOURCE_IDS.schools);
              return { ...prev, schoolsLoading: false };
            }
            mapDataStore.set(MAP_SOURCE_IDS.schools, fc!);
            return {
              districtId,
              schoolsOn: true,
              schoolsLoading: false,
              schoolsCount: fc!.features.length,
              schoolsError: null,
            };
          });
        } catch (err) {
          mapDataStore.clear(MAP_SOURCE_IDS.schools);
          setDistrictSchools((prev) => ({
            ...prev,
            schoolsOn: false,
            schoolsLoading: false,
            schoolsError: err instanceof Error ? err.message : 'Failed to load schools',
          }));
        }
      })();
    },
    [districtSchools.districtId, districtSchools.schoolsOn],
  );

  const isActive = useCallback((slug: TerritorySlug) => activeSlugs.has(slug), [activeSlugs]);
  const isLoaded = useCallback((slug: TerritorySlug) => Boolean(loadedRef.current[slug]), []);

  /** Re-applies the unlocked filter to the county-scoped cities/towns overlay, if on. */
  const republishCountyCtu = useCallback(() => {
    const { countyId, citiesOn, townsOn } = countyOverlays;
    if (!countyId || (!citiesOn && !townsOn)) return;
    const fc =
      relatedCacheRef.current.countyId === countyId ? relatedCacheRef.current.cities : null;
    if (!fc) return;
    publishFeatures(MAP_SOURCE_IDS.ctus, filterCtuFeatures(fc, citiesOn, townsOn), 'ctu');
  }, [countyOverlays, publishFeatures]);

  const setUnlockedIds = useCallback(
    (idsByKind: Readonly<Record<string, ReadonlySet<string>>>) => {
      unlockedIdsRef.current = idsByKind;
      unlockSeededRef.current = true;
      setUnlockEpoch((n) => n + 1);
      for (const slug of activeSlugsRef.current) publishSlug(slug);
      republishCountyCtu();
    },
    [publishSlug, republishCountyCtu],
  );

  const isUnlocked = useCallback(
    (entityKind: string, unitId: string): boolean | null => {
      if (!unlockSeededRef.current) return null;
      const ids = unlockedIdsRef.current[entityKind];
      return Boolean(ids?.has(unitId));
    },
    // unlockEpoch forces a fresh closure after passport seed / refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unlockEpoch],
  );

  const setUnlockedOnly = useCallback(
    (on: boolean) => {
      unlockedOnlyRef.current = on;
      setUnlockedOnlyState(on);
      for (const slug of activeSlugsRef.current) publishSlug(slug);
      republishCountyCtu();
    },
    [publishSlug, republishCountyCtu],
  );

  const value = useMemo<TerritoryLayersContextValue>(
    () => ({
      activeSlugs,
      isActive,
      loading,
      error,
      toggleSlug,
      ensureActive,
      setExclusiveLayer,
      isLoaded,
      unlockedOnly,
      setUnlockedOnly,
      setUnlockedIds,
      isUnlocked,
      countyOverlays,
      toggleCitiesLayer,
      toggleTownsLayer,
      toggleCountyCities,
      toggleCountyTowns,
      setCtuFocusCounty,
      toggleCountySchoolDistricts,
      clearCountyOverlays,
      clearAllBoundaryPaint,
      districtSchools,
      toggleDistrictSchools,
      clearDistrictSchools,
      schoolsLayer,
      toggleSchoolsLayer,
      clearSchoolsLayer,
      districtParts,
      loadDistrictParts,
      clearDistrictParts,
    }),
    [
      activeSlugs,
      isActive,
      loading,
      error,
      toggleSlug,
      ensureActive,
      setExclusiveLayer,
      isLoaded,
      unlockedOnly,
      setUnlockedOnly,
      setUnlockedIds,
      isUnlocked,
      countyOverlays,
      toggleCitiesLayer,
      toggleTownsLayer,
      toggleCountyCities,
      toggleCountyTowns,
      setCtuFocusCounty,
      toggleCountySchoolDistricts,
      clearCountyOverlays,
      clearAllBoundaryPaint,
      districtSchools,
      toggleDistrictSchools,
      clearDistrictSchools,
      schoolsLayer,
      toggleSchoolsLayer,
      clearSchoolsLayer,
      districtParts,
      loadDistrictParts,
      clearDistrictParts,
    ],
  );

  return (
    <TerritoryLayersContext.Provider value={value}>{children}</TerritoryLayersContext.Provider>
  );
}

export function useTerritoryLayers(): TerritoryLayersContextValue {
  const ctx = useContext(TerritoryLayersContext);
  if (!ctx) throw new Error('useTerritoryLayers must be used within TerritoryLayersProvider');
  return ctx;
}
