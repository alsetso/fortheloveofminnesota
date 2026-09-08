'use client';

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { MapDataStore, mapDataStore } from '@/map/data/MapDataStore';

type MapContextValue = {
  map: MapboxMap | null;
  ready: boolean;
  store: MapDataStore;
};

const MapContext = createContext<MapContextValue | null>(null);

export function MapProvider({
  map,
  ready,
  store = mapDataStore,
  children,
}: {
  map: MapboxMap | null;
  ready: boolean;
  store?: MapDataStore;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ map, ready, store }), [map, ready, store]);
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error('useMapContext must be used within MapProvider');
  return ctx;
}
