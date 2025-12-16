import type { Map as MapboxMap } from 'mapbox-gl';
import { loadMapboxDraw } from '../utils/mapboxLoader';

export interface DrawController {
  initializeDraw: () => Promise<void>;
  setDrawMode: (mode: string) => void;
  getDrawnFeatures: () => GeoJSON.FeatureCollection;
  clearDraw: () => void;
  updateDrawStyles: (styles: unknown[]) => void;
}

/**
 * Create draw controller instance
 * Stub implementation for future polygon drawing
 */
export function createDrawController(_map: MapboxMap): DrawController {
  // Stub: drawInstance will be initialized when draw functionality is implemented
  const drawInstance: import('@mapbox/mapbox-gl-draw').default | null = null;

  const initializeDraw = async (): Promise<void> => {
    // Stub - will be implemented when draw functionality is needed
    await loadMapboxDraw();
    // drawInstance = new MapboxDraw({ ... });
    // map.addControl(drawInstance);
  };

  const setDrawMode = (_mode: string): void => {
    // Stub
    if (drawInstance) {
      // drawInstance.changeMode(mode);
    }
  };

  const getDrawnFeatures = (): GeoJSON.FeatureCollection => {
    // Stub
    if (drawInstance) {
      // return drawInstance.getAll();
    }
    return { type: 'FeatureCollection', features: [] };
  };

  const clearDraw = (): void => {
    // Stub
    if (drawInstance) {
      // drawInstance.deleteAll();
    }
  };

  const updateDrawStyles = (styles: unknown[]): void => {
    // Stub
    if (drawInstance) {
      // drawInstance.options.styles = styles;
    }
  };

  return {
    initializeDraw,
    setDrawMode,
    getDrawnFeatures,
    clearDraw,
    updateDrawStyles,
  };
}



