'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

/** Single selected boundary (state/county/district/CTU). Only one entity selectable at a time. */
export interface BoundarySelectionItem {
  layer: 'state' | 'county' | 'district' | 'ctu';
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface LiveMapFooterStatusState {
  loadingData: boolean;
  mapLoaded: boolean;
  loadingPins: boolean;
  /** true = loading, false = done. Omit when layer not selected (live map: boundary toggled in menu). */
  loadingStateBoundary?: boolean;
  loadingCountyBoundaries?: boolean;
  loadingCongressionalDistricts?: boolean;
  loadingCTUBoundaries?: boolean;
  /** Current map zoom (for optional future use). */
  currentZoom?: number;
  /** Single selected boundary (0 or 1 item). Passed across layers; shown in Review. */
  selectedBoundaries?: BoundarySelectionItem[];
}

/** @deprecated Boundary layers are toggled in the main menu Live map section (one at a time). */
export type LiveBoundaryVisibility = {
  state: boolean;
  county: boolean;
  district: boolean;
  ctu: boolean;
};

interface LiveMapFooterStatusProps {
  status: LiveMapFooterStatusState;
}

/** Small status dot: gray = pending, yellow = loading, green = done, red = error */
function StatusDot({ state }: { state: 'pending' | 'loading' | 'done' | 'error' }) {
  const bg =
    state === 'loading'
      ? 'bg-amber-400'
      : state === 'error'
        ? 'bg-red-500'
        : state === 'pending'
          ? 'bg-gray-300'
          : 'bg-emerald-500';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${bg}`}
      aria-hidden
    />
  );
}

/**
 * Collapsible accordion for the transparent footer strip on /live.
 * Header: "Review +N" when all done (N = load count), or "Loading…" when loading.
 * Expanded: list of layers (map data, map, boundaries, pins, selected). Boundary layers are toggled
 * in the main menu Live map section (one at a time); boundary rows show pending/loading/done per type.
 */
export default function LiveMapFooterStatus({ status }: LiveMapFooterStatusProps) {
  const [expanded, setExpanded] = useState(false);
  const { loadingData, mapLoaded, loadingPins, selectedBoundaries = [] } = status;

  const layerLabel = (l: string) =>
    l === 'state'
      ? 'State boundary'
      : l === 'county'
        ? 'County'
        : l === 'district'
          ? 'Congressional district'
          : l === 'ctu'
            ? 'CTU'
            : l;

  type ItemState = 'loading' | 'done';
  const items: { label: string; state: ItemState }[] = [
    { label: 'Map data', state: loadingData ? 'loading' : 'done' },
    { label: 'Map', state: loadingData ? 'loading' : mapLoaded ? 'done' : 'loading' },
    { label: 'Pins', state: !mapLoaded ? 'loading' : loadingPins ? 'loading' : 'done' },
    ...selectedBoundaries.map((item) => ({
      label: `${layerLabel(item.layer)} – ${item.name}`,
      state: 'done' as ItemState,
    })),
  ];

  const doneCount = items.filter((i) => i.state === 'done').length;
  const allDone = doneCount === items.length;
  const selectedCount = selectedBoundaries.length;

  const headerLabel = allDone
    ? selectedCount > 0
      ? `Review +${doneCount} (${selectedCount} selected)`
      : `Review +${doneCount}`
    : 'Loading…';

  return (
    <div className="bg-transparent rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full h-[25px] min-h-[25px] flex items-center justify-between gap-2 px-2 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white/5 transition-colors text-left rounded-md"
        aria-expanded={expanded}
        aria-controls="live-map-footer-status-content"
        id="live-map-footer-status-toggle"
      >
        <span>{headerLabel}</span>
        <span className="flex-shrink-0 text-gray-500">
          {expanded ? (
            <ChevronDownIcon className="w-3.5 h-3.5" />
          ) : (
            <ChevronUpIcon className="w-3.5 h-3.5" />
          )}
        </span>
      </button>
      <div
        id="live-map-footer-status-content"
        role="region"
        aria-labelledby="live-map-footer-status-toggle"
        hidden={!expanded}
        className={expanded ? 'px-3 pb-2' : undefined}
      >
        <ul className="space-y-0.5 list-none p-0 m-0">
          {items.map(({ label, state }, index) => (
            <li
              key={index < 3 ? label : `sel-${selectedBoundaries[index - 3].layer}-${selectedBoundaries[index - 3].id}`}
              className="flex items-center gap-2 text-xs text-gray-600"
            >
              <StatusDot state={state} />
              <span className="flex-1 min-w-0">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
