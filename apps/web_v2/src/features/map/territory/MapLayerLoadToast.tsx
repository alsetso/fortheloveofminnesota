'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { IconCheck, IconSpinner, IconX } from '@/features/map/dockCore/core/icons';
import { useTerritoryLayers } from '@/features/map/territory/TerritoryLayersProvider';
import { clearMapStatusToast } from '@/features/map/toast/mapStatusToastStore';
import { useMapStatusToast } from '@/features/map/toast/useMapStatusToast';

type RowStatus = 'loading' | 'success' | 'error';

type ToastRow = {
  id: string;
  label: string;
  nested?: boolean;
  status: RowStatus;
  detail?: string | null;
};

const SUCCESS_LINGER_MS = 1600;

function StatusGlyph({
  status,
  size = 'md',
}: {
  status: RowStatus;
  size?: 'sm' | 'md';
}) {
  const iconClass = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  if (status === 'loading') {
    return <IconSpinner className={`${iconClass} animate-spin text-lake-blue`} />;
  }
  if (status === 'success') {
    return <IconCheck className={`${iconClass} text-emerald-600`} />;
  }
  return <IconX className={`${iconClass} text-red-600`} />;
}

function collectActiveRows(input: {
  loading: Partial<Record<string, boolean>>;
  error: Partial<Record<string, string | null>>;
  countyOverlays: {
    citiesOn: boolean;
    townsOn: boolean;
    citiesLoading: boolean;
    citiesError: string | null;
    schoolDistrictsLoading: boolean;
    schoolDistrictsError: string | null;
  };
  districtSchools: { schoolsLoading: boolean; schoolsError: string | null };
  schoolsLayer: { loading: boolean; error: string | null };
  districtParts: { partsLoading: boolean; partsError: string | null };
}): ToastRow[] {
  const { loading, error, countyOverlays, districtSchools, schoolsLayer, districtParts } =
    input;
  const next: ToastRow[] = [];

  if (loading.counties || error.counties) {
    next.push({
      id: 'counties',
      label: 'Counties',
      status: loading.counties ? 'loading' : 'error',
      detail: error.counties,
    });
  }
  if (countyOverlays.citiesLoading || countyOverlays.citiesError) {
    next.push({
      id: 'county-cities',
      label:
        countyOverlays.citiesOn && countyOverlays.townsOn
          ? 'Cities & towns'
          : countyOverlays.townsOn
            ? 'Towns'
            : 'Cities',
      nested: true,
      status: countyOverlays.citiesLoading ? 'loading' : 'error',
      detail: countyOverlays.citiesError,
    });
  }
  if (countyOverlays.schoolDistrictsLoading || countyOverlays.schoolDistrictsError) {
    next.push({
      id: 'county-sd',
      label: 'School districts',
      nested: true,
      status: countyOverlays.schoolDistrictsLoading ? 'loading' : 'error',
      detail: countyOverlays.schoolDistrictsError,
    });
  }

  if (loading['cities-and-towns'] || error['cities-and-towns']) {
    next.push({
      id: 'cities-and-towns',
      label: 'Cities & towns',
      nested: true,
      status: loading['cities-and-towns'] ? 'loading' : 'error',
      detail: error['cities-and-towns'],
    });
  }
  if (loading['school-districts'] || error['school-districts']) {
    next.push({
      id: 'school-districts',
      label: 'School districts',
      status: loading['school-districts'] ? 'loading' : 'error',
      detail: error['school-districts'],
    });
  }
  if (districtSchools.schoolsLoading || districtSchools.schoolsError) {
    next.push({
      id: 'schools',
      label: 'Schools',
      nested: true,
      status: districtSchools.schoolsLoading ? 'loading' : 'error',
      detail: districtSchools.schoolsError,
    });
  }
  if (schoolsLayer.loading || schoolsLayer.error) {
    next.push({
      id: 'schools-layer',
      label: 'Schools',
      nested: true,
      status: schoolsLayer.loading ? 'loading' : 'error',
      detail: schoolsLayer.error,
    });
  }

  if (loading.districts || error.districts) {
    next.push({
      id: 'districts',
      label: 'Congressional Districts',
      status: loading.districts ? 'loading' : 'error',
      detail: error.districts,
    });
  }
  if (districtParts.partsLoading || districtParts.partsError) {
    next.push({
      id: 'district-parts',
      label: 'Precincts',
      nested: true,
      status: districtParts.partsLoading ? 'loading' : 'error',
      detail: districtParts.partsError,
    });
  }
  if (loading['senate-districts'] || error['senate-districts']) {
    next.push({
      id: 'senate-districts',
      label: 'Senate Districts',
      status: loading['senate-districts'] ? 'loading' : 'error',
      detail: error['senate-districts'],
    });
  }
  if (loading['house-districts'] || error['house-districts']) {
    next.push({
      id: 'house-districts',
      label: 'House Districts',
      status: loading['house-districts'] ? 'loading' : 'error',
      detail: error['house-districts'],
    });
  }

  return next;
}

function resolveTitle(input: {
  layerLoading: boolean;
  layerError: boolean;
  layerSuccess: boolean;
  ephemeralTitle: string | null;
  ephemeralRows: ToastRow[];
}): string {
  const { layerLoading, layerError, layerSuccess, ephemeralTitle, ephemeralRows } = input;
  if (layerLoading) return 'Loading map data';
  if (layerError) return 'Map data error';
  if (ephemeralTitle) return ephemeralTitle;
  if (ephemeralRows.some((r) => r.status === 'loading')) return 'Find me';
  if (ephemeralRows.some((r) => r.status === 'error')) return 'Location error';
  if (ephemeralRows.some((r) => r.status === 'success')) return 'Location found';
  if (layerSuccess) return 'Map data ready';
  return 'Map status';
}

/**
 * Upper-right glass toast — territory layer loads + ephemeral map status (Find Me).
 * Lingers briefly on success; stays on failure until dismissed.
 */
export function MapLayerLoadToast() {
  const { loading, error, countyOverlays, districtSchools, schoolsLayer, districtParts } =
    useTerritoryLayers();
  const { rows: ephemeralRows, title: ephemeralTitle } = useMapStatusToast();

  const liveLayerRows = useMemo(
    () =>
      collectActiveRows({
        loading,
        error,
        countyOverlays,
        districtSchools,
        schoolsLayer,
        districtParts,
      }),
    [loading, error, countyOverlays, districtSchools, schoolsLayer, districtParts],
  );

  const anyLayerLoading = liveLayerRows.some((r) => r.status === 'loading');
  const anyLayerError = liveLayerRows.some((r) => r.status === 'error');
  const anyEphemeralLoading = ephemeralRows.some((r) => r.status === 'loading');
  const anyEphemeralError = ephemeralRows.some((r) => r.status === 'error');
  const anyLoading = anyLayerLoading || anyEphemeralLoading;
  const anyError = anyLayerError || anyEphemeralError;

  const [dismissed, setDismissed] = useState(false);
  const [successRows, setSuccessRows] = useState<ToastRow[]>([]);
  /** Accumulate every layer row that entered loading during this burst. */
  const seenLoadingRef = useRef<Map<string, ToastRow>>(new Map());

  useEffect(() => {
    if (anyLayerLoading) {
      for (const row of liveLayerRows) {
        if (row.status === 'loading') {
          seenLoadingRef.current.set(row.id, row);
        }
      }
      setDismissed(false);
      setSuccessRows([]);
      return;
    }

    // Burst finished — show checks for everything that loaded (when no errors remain).
    if (seenLoadingRef.current.size > 0 && !anyLayerError) {
      const finished = Array.from(seenLoadingRef.current.values()).map((r) => ({
        ...r,
        status: 'success' as const,
        detail: null,
      }));
      seenLoadingRef.current.clear();
      setSuccessRows(finished);
      const t = window.setTimeout(() => setSuccessRows([]), SUCCESS_LINGER_MS);
      return () => {
        window.clearTimeout(t);
      };
    }

    seenLoadingRef.current.clear();
    return;
  }, [anyLayerLoading, anyLayerError, liveLayerRows]);

  // New ephemeral activity re-opens the toast if it was dismissed.
  useEffect(() => {
    if (ephemeralRows.length === 0) return;
    setDismissed(false);
  }, [ephemeralRows]);

  const layerDisplayRows =
    anyLayerLoading || anyLayerError ? liveLayerRows : successRows;
  const displayRows: ToastRow[] = [...ephemeralRows, ...layerDisplayRows];
  const visible = !dismissed && displayRows.length > 0;
  if (!visible) return null;

  const title = resolveTitle({
    layerLoading: anyLayerLoading,
    layerError: anyLayerError,
    layerSuccess: successRows.length > 0,
    ephemeralTitle,
    ephemeralRows,
  });

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto w-full overflow-hidden rounded-2xl shadow-lg ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] px-3 py-2">
        <p className="truncate text-[11px] font-bold uppercase tracking-wide text-foreground-muted">
          {title}
        </p>
        {!anyLoading ? (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setDismissed(true);
              setSuccessRows([]);
              clearMapStatusToast();
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-foreground-muted transition hover:bg-map-ink-subtle hover:text-foreground"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <ul className="max-h-[min(40vh,14rem)] space-y-0.5 overflow-y-auto overscroll-none px-2.5 py-2 scrollbar-hide">
        {displayRows.map((row) => {
          const nested = Boolean(row.nested);
          return (
            <li
              key={row.id}
              className={`flex items-start gap-2 rounded-xl ${
                nested ? 'ml-4 gap-1.5 px-1 py-0.5' : 'px-1.5 py-1'
              }`}
            >
              <span
                className={`inline-flex shrink-0 items-center justify-center ${
                  nested ? 'mt-px h-3.5 w-3.5' : 'mt-0.5 h-4 w-4'
                }`}
              >
                <StatusGlyph status={row.status} size={nested ? 'sm' : 'md'} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate leading-tight ${
                    nested
                      ? 'text-[11px] font-medium text-foreground-muted'
                      : 'text-[13px] font-medium text-foreground'
                  } ${row.status === 'error' ? '!text-red-700' : ''}`}
                >
                  {row.label}
                </span>
                {row.status === 'error' && row.detail ? (
                  <span
                    className={`mt-0.5 block leading-snug text-red-600/90 ${
                      nested ? 'text-[10px]' : 'text-[11px]'
                    }`}
                  >
                    {row.detail}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
