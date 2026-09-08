/**
 * Object Radar — single source of truth for MiniMap + Object Map.
 * UI subscribes; services write.
 */

import { useSyncExternalStore } from 'react';
import {
  OBJECT_RADAR_DEFAULT_RANGE_M,
  OBJECT_RADAR_RANGE_STORAGE_KEY,
} from '@/features/map/game/objectRadar/constants';
import { parkObjectRadarMap } from '@/features/map/game/objectRadar/services/objectRadarMapEngine';
import { clampRangeM } from '@/features/map/game/objectRadar/range';
import type { ObjectRadarPurposeFilter } from '@/features/map/game/objectRadar/radarPurpose';
import {
  MINIMAPS_DEFAULT_TAB,
  type MinimapsTabId,
} from '@/features/map/game/minimaps/minimapsTabs';
import {
  EMPTY_OBJECT_RADAR_FC,
  type ObjectRadarFeatureCollection,
  type ObjectRadarMode,
  type ObjectRadarOrigin,
} from '@/features/map/game/objectRadar/types';

/** Lightweight territory identity used by the Unlocked minimap detail panel. */
export type MinimapsFocusedTerritory = {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  kindLabel?: string;
};

export type ObjectRadarState = {
  /** Meters from origin — Object Map edits; MiniMap projects. */
  rangeM: number;
  mode: ObjectRadarMode;
  /** Purpose lens on Object Map (still-out). Collected ignores this. */
  purposeFilter: ObjectRadarPurposeFilter;
  sheetOpen: boolean;
  /** Which Minimaps pane is showing while the sheet is open. */
  sheetTab: MinimapsTabId;
  selectedId: string | null;
  stillOut: ObjectRadarFeatureCollection;
  collected: ObjectRadarFeatureCollection;
  collectedLoaded: boolean;
  origin: ObjectRadarOrigin;
  /** Territory to highlight in the Unlocked tab detail panel. Set by openToTerritory(). */
  focusedTerritory: MinimapsFocusedTerritory | null;
};

function readInitialRangeM(): number {
  if (typeof window === 'undefined') return OBJECT_RADAR_DEFAULT_RANGE_M;
  try {
    const raw = window.localStorage.getItem(OBJECT_RADAR_RANGE_STORAGE_KEY);
    if (raw == null) return OBJECT_RADAR_DEFAULT_RANGE_M;
    return clampRangeM(Number(raw));
  } catch {
    return OBJECT_RADAR_DEFAULT_RANGE_M;
  }
}

function persistRangeM(meters: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OBJECT_RADAR_RANGE_STORAGE_KEY, String(meters));
  } catch {
    // private mode
  }
}

let state: ObjectRadarState = {
  rangeM: OBJECT_RADAR_DEFAULT_RANGE_M,
  mode: 'still-out',
  purposeFilter: 'all',
  sheetOpen: false,
  sheetTab: MINIMAPS_DEFAULT_TAB,
  selectedId: null,
  stillOut: EMPTY_OBJECT_RADAR_FC,
  collected: EMPTY_OBJECT_RADAR_FC,
  collectedLoaded: false,
  origin: { lng: -93.265, lat: 44.9778, bearing: 0 },
  focusedTerritory: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function write(partial: Partial<ObjectRadarState>) {
  state = { ...state, ...partial };
  emit();
}

/** Call once on client mount so persisted range hydrates before paint. */
export function hydrateObjectRadarStore() {
  const rangeM = readInitialRangeM();
  if (rangeM !== state.rangeM) write({ rangeM });
}

export function getObjectRadarState(): ObjectRadarState {
  return state;
}

export function subscribeObjectRadar(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useObjectRadarStore(): ObjectRadarState {
  return useSyncExternalStore(
    subscribeObjectRadar,
    getObjectRadarState,
    getObjectRadarState,
  );
}

export const objectRadarActions = {
  setRangeM(meters: number) {
    const rangeM = clampRangeM(meters);
    persistRangeM(rangeM);
    write({ rangeM, selectedId: null });
  },
  setMode(mode: ObjectRadarMode) {
    write({ mode, selectedId: null });
  },
  setPurposeFilter(purposeFilter: ObjectRadarPurposeFilter) {
    write({ purposeFilter, selectedId: null });
  },
  openSheet() {
    write({ sheetOpen: true, sheetTab: MINIMAPS_DEFAULT_TAB, selectedId: null, focusedTerritory: null  });
  },
  /** Open the Unlocked tab with a territory detail panel pre-loaded. */
  openToTerritory(territory: MinimapsFocusedTerritory) {
    parkObjectRadarMap();
    write({ sheetOpen: true, sheetTab: 'unlocked', selectedId: null, focusedTerritory: territory });
  },
  clearFocusedTerritory() {
    write({ focusedTerritory: null });
  },
  setSheetTab(sheetTab: MinimapsTabId) {
    if (sheetTab !== 'objects') parkObjectRadarMap();
    write({ sheetTab, selectedId: null, focusedTerritory: null });
  },
  closeSheet() {
    // Sync park before Object Map host unmounts (React would destroy the shell).
    parkObjectRadarMap();
    write({ sheetOpen: false, sheetTab: MINIMAPS_DEFAULT_TAB, selectedId: null, focusedTerritory: null });
  },
  setSelectedId(selectedId: string | null) {
    write({ selectedId });
  },
  setStillOut(stillOut: ObjectRadarFeatureCollection) {
    write({ stillOut });
  },
  setCollected(collected: ObjectRadarFeatureCollection) {
    write({ collected, collectedLoaded: true });
  },
  setOrigin(origin: ObjectRadarOrigin) {
    const prev = state.origin;
    if (
      Math.abs(prev.lng - origin.lng) < 1e-7 &&
      Math.abs(prev.lat - origin.lat) < 1e-7 &&
      Math.abs(prev.bearing - origin.bearing) < 0.15
    ) {
      return;
    }
    write({ origin });
  },
};
