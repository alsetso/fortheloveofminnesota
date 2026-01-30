'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

/** Single selected boundary (state/county/district/CTU). Only one entity selectable at a time. */
export interface BoundarySelectionItem {
  layer: 'state' | 'county' | 'district' | 'ctu';
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface ClickedItem {
  type: 'pin' | 'area' | 'map' | 'boundary';
  id?: string;
  lat: number;
  lng: number;
  /** For boundaries: the layer type (state, county, district, ctu) */
  layer?: 'state' | 'county' | 'district' | 'ctu';
  /** For pins: the username of the account that created the pin */
  username?: string | null;
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
  /** Array of clicked items (pin, area, map location, or boundary). Each click appends to this array. */
  clickedItems?: ClickedItem[];
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
  /** Called when a clicked item is clicked. Should navigate to that location/pin. */
  onItemClick?: (item: ClickedItem) => void;
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
export default function LiveMapFooterStatus({ status, onItemClick }: LiveMapFooterStatusProps) {
  const [expanded, setExpanded] = useState(false);
  const [showIncrement, setShowIncrement] = useState(false);
  const { loadingData, mapLoaded, loadingPins, selectedBoundaries = [], clickedItems = [] } = status;
  const prevClickedItemsLengthRef = useRef(clickedItems.length);

  // Detect when a new item is added and show "+1" indicator
  useEffect(() => {
    if (clickedItems.length > prevClickedItemsLengthRef.current) {
      setShowIncrement(true);
      const timer = setTimeout(() => {
        setShowIncrement(false);
      }, 1000);
      prevClickedItemsLengthRef.current = clickedItems.length;
      return () => clearTimeout(timer);
    }
    prevClickedItemsLengthRef.current = clickedItems.length;
    return undefined;
  }, [clickedItems.length]);

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

  const formatClickedItem = (item: ClickedItem): string => {
    if (item.type === 'pin' && item.username) {
      // Display as "@username mention (coordinates)"
      const coordsPart = ` (${item.lat.toFixed(6)}, ${item.lng.toFixed(6)})`;
      return `@${item.username} mention${coordsPart}`;
    }
    const typeLabel = item.type === 'pin' ? 'Pin' : item.type === 'area' ? 'Area' : item.type === 'boundary' ? 'Boundary' : 'Map';
    const idPart = item.id ? ` ${item.id}` : '';
    const coordsPart = ` (${item.lat.toFixed(6)}, ${item.lng.toFixed(6)})`;
    return `${typeLabel}${idPart}${coordsPart}`;
  };

  type ItemState = 'loading' | 'done';
  type ItemType = 'status' | 'boundary' | 'clicked';
  const items: { label: string; state: ItemState; type: ItemType; clickedItem?: ClickedItem }[] = [
    { label: 'Map data', state: loadingData ? 'loading' : 'done', type: 'status' },
    { label: 'Map', state: loadingData ? 'loading' : mapLoaded ? 'done' : 'loading', type: 'status' },
    { label: 'Pins', state: !mapLoaded ? 'loading' : loadingPins ? 'loading' : 'done', type: 'status' },
    ...selectedBoundaries.map((item) => ({
      label: `${layerLabel(item.layer)} – ${item.name}`,
      state: 'done' as ItemState,
      type: 'boundary' as ItemType,
    })),
    ...clickedItems.map((clickedItem, index) => ({
      label: formatClickedItem(clickedItem),
      state: 'done' as ItemState,
      type: 'clicked' as ItemType,
      clickedItem,
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
        <span className="flex items-center gap-1">
          {headerLabel}
          {showIncrement && (
            <span className="text-emerald-500 font-semibold transition-opacity duration-300">
              +1
            </span>
          )}
        </span>
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
          {items.map(({ label, state, type, clickedItem: item }, index) => {
            const isClickable = type === 'clicked' && onItemClick && item;
            return (
              <li
                key={index < 3 ? label : type === 'clicked' ? `clicked-${item?.type}-${item?.id || 'map'}-${index}` : `sel-${selectedBoundaries[index - 3].layer}-${selectedBoundaries[index - 3].id}`}
                className={`flex items-center gap-2 text-xs ${isClickable ? 'cursor-pointer hover:text-gray-900 hover:bg-white/5 rounded px-1 -mx-1 transition-colors' : 'text-gray-600'}`}
                onClick={isClickable ? () => onItemClick(item!) : undefined}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={isClickable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onItemClick(item!);
                  }
                } : undefined}
              >
                <StatusDot state={state} />
                <span className="flex-1 min-w-0">{label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
