import type { Map as MapboxMap } from 'mapbox-gl';

export interface MapInfo {
  zoom: number;
  center: { lat: number; lng: number };
  cursor: { lat: number; lng: number };
  bearing: number;
  pitch: number;
}

export interface TrackMapInfoOptions {
  map: MapboxMap;
  onUpdate: (info: MapInfo) => void;
}

export interface MapInfoSubscription {
  unsubscribe: () => void;
}

/**
 * Track map info (zoom, center, bearing, pitch)
 */
export function trackMapInfo(
  options: TrackMapInfoOptions
): MapInfoSubscription {
  const { map, onUpdate } = options;

  // Initial state
  const getCurrentInfo = (): MapInfo => {
    const center = map.getCenter();
    return {
      zoom: map.getZoom(),
      center: { lat: center.lat, lng: center.lng },
      cursor: { lat: 0, lng: 0 },
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };
  };

  // Update function
  const updateInfo = () => {
    if (!map || map.removed) return;
    onUpdate(getCurrentInfo());
  };

  // Zoom handler
  const handleZoom = () => {
    if (!map || map.removed) return;
    const center = map.getCenter();
    onUpdate({
      zoom: map.getZoom(),
      center: { lat: center.lat, lng: center.lng },
      cursor: { lat: 0, lng: 0 },
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    });
  };

  // Move handler
  const handleMove = () => {
    if (!map || map.removed) return;
    const center = map.getCenter();
    onUpdate({
      zoom: map.getZoom(),
      center: { lat: center.lat, lng: center.lng },
      cursor: { lat: 0, lng: 0 },
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    });
  };

  // Rotate handler
  const handleRotate = () => {
    if (!map || map.removed) return;
    const center = map.getCenter();
    onUpdate({
      zoom: map.getZoom(),
      center: { lat: center.lat, lng: center.lng },
      cursor: { lat: 0, lng: 0 },
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    });
  };

  // Pitch handler
  const handlePitch = () => {
    if (!map || map.removed) return;
    const center = map.getCenter();
    onUpdate({
      zoom: map.getZoom(),
      center: { lat: center.lat, lng: center.lng },
      cursor: { lat: 0, lng: 0 },
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    });
  };

  // Register event listeners
  map.on('zoom', handleZoom);
  map.on('move', handleMove);
  map.on('rotate', handleRotate);
  map.on('pitch', handlePitch);

  // Initial update
  updateInfo();

  return {
    unsubscribe: () => {
      map.off('zoom', handleZoom);
      map.off('move', handleMove);
      map.off('rotate', handleRotate);
      map.off('pitch', handlePitch);
    },
  };
}

/**
 * Get current map info snapshot
 */
export function getMapInfo(map: MapboxMap | null): MapInfo | null {
  if (!map || map.removed) return null;

  const center = map.getCenter();
  return {
    zoom: map.getZoom(),
    center: { lat: center.lat, lng: center.lng },
    cursor: { lat: 0, lng: 0 },
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}



