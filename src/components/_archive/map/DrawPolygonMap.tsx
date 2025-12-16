'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { loadMapboxGL, loadMapboxDraw } from '@/features/_archive/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/_archive/map/config';
import { XMarkIcon, CheckIcon, PencilIcon } from '@heroicons/react/24/outline';

export interface DrawPolygonMapProps {
  initialPolygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  onPolygonChange: (polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon | null) => void;
  onSave?: () => void;
  onCancel?: () => void;
  height?: string;
  className?: string;
  allowMultiPolygon?: boolean;
}

export default function DrawPolygonMap({
  initialPolygon,
  onPolygonChange,
  onSave,
  onCancel,
  height = '500px',
  className = '',
  allowMultiPolygon = false,
}: DrawPolygonMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const draw = useRef<import('@mapbox/mapbox-gl-draw').default | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPolygon, setCurrentPolygon] = useState<GeoJSON.Polygon | GeoJSON.MultiPolygon | null>(initialPolygon || null);

  // Initialize map and draw
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      console.error('Mapbox token missing');
      return;
    }

    const initMap = async () => {
      try {
        // Import Mapbox CSS
        await import('mapbox-gl/dist/mapbox-gl.css');
        await import('@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css');
        
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current) return;

        const center = MAP_CONFIG.DEFAULT_CENTER;

        const mapInstance = new mapbox.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        mapInstance.on('load', async () => {
          setMapLoaded(true);
          
          // Initialize Mapbox Draw
          const MapboxDraw = await loadMapboxDraw();
          const drawInstance = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
              polygon: true,
              trash: true,
            },
            defaultMode: 'simple_select',
          });

          mapInstance.addControl(drawInstance);
          draw.current = drawInstance;

            // Load initial polygon if provided
          if (initialPolygon) {
            try {
              const feature: GeoJSON.Feature = {
                type: 'Feature',
                properties: {},
                geometry: initialPolygon,
              };
              drawInstance.add(feature);
              setCurrentPolygon(initialPolygon);
              
              // Fit map to polygon bounds
              if (initialPolygon.type === 'Polygon' && initialPolygon.coordinates[0]) {
                const coords = initialPolygon.coordinates[0];
                const bounds = coords.reduce((bounds, coord) => {
                  return bounds.extend([coord[0], coord[1]]);
                }, new mapbox.LngLatBounds(coords[0], coords[0]));
                
                mapInstance.fitBounds(bounds, {
                  padding: 50,
                  duration: 1000,
                });
              }
            } catch (error) {
              console.error('Error loading initial polygon:', error);
            }
          }

          // Listen for draw events
          mapInstance.on('draw.create', (e) => {
            const features = drawInstance.getAll();
            if (features.features.length > 0) {
              const geometry = features.features[0].geometry;
              if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
                setCurrentPolygon(geometry);
                onPolygonChange(geometry);
                setIsDrawing(false);
              }
            }
          });

          mapInstance.on('draw.update', (e) => {
            const features = drawInstance.getAll();
            if (features.features.length > 0) {
              const geometry = features.features[0].geometry;
              if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
                setCurrentPolygon(geometry);
                onPolygonChange(geometry);
              }
            }
          });

          mapInstance.on('draw.delete', () => {
            setCurrentPolygon(null);
            onPolygonChange(null);
            setIsDrawing(false);
          });

          mapInstance.on('draw.modechange', (e) => {
            setIsDrawing(e.mode === 'draw_polygon');
          });
        });

        map.current = mapInstance;
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();

    return () => {
      if (draw.current && map.current) {
        map.current.removeControl(draw.current);
      }
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  // Update polygon when initialPolygon changes externally
  useEffect(() => {
    if (mapLoaded && initialPolygon && draw.current && map.current) {
      const polygonChanged = 
        !currentPolygon ||
        JSON.stringify(currentPolygon) !== JSON.stringify(initialPolygon);

      if (polygonChanged) {
        draw.current.deleteAll();
        try {
          const feature: GeoJSON.Feature = {
            type: 'Feature',
            properties: {},
            geometry: initialPolygon,
          };
          draw.current.add(feature);
          setCurrentPolygon(initialPolygon);
          
          // Fit map to polygon bounds
          const fitToPolygon = async () => {
            if (initialPolygon.type === 'Polygon' && initialPolygon.coordinates[0] && map.current) {
              const mapbox = await loadMapboxGL();
              const coords = initialPolygon.coordinates[0];
              const bounds = coords.reduce((bounds, coord) => {
                return bounds.extend([coord[0], coord[1]]);
              }, new mapbox.LngLatBounds(coords[0], coords[0]));
              
              map.current.fitBounds(bounds, {
                padding: 50,
                duration: 1000,
              });
            }
          };
          fitToPolygon();
        } catch (error) {
          console.error('Error updating polygon:', error);
        }
      }
    }
  }, [initialPolygon, mapLoaded, currentPolygon]);

  // Start drawing
  const handleStartDrawing = useCallback(() => {
    if (!draw.current) return;
    draw.current.changeMode('draw_polygon');
    setIsDrawing(true);
  }, []);

  // Clear polygon
  const handleClear = useCallback(() => {
    if (!draw.current) return;
    draw.current.deleteAll();
    setCurrentPolygon(null);
    onPolygonChange(null);
    setIsDrawing(false);
  }, [onPolygonChange]);

  // Save polygon
  const handleSave = useCallback(() => {
    if (currentPolygon && onSave) {
      onSave();
    }
  }, [currentPolygon, onSave]);

  // Cancel drawing
  const handleCancel = useCallback(() => {
    if (draw.current) {
      draw.current.changeMode('simple_select');
      setIsDrawing(false);
    }
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter to save
      if (e.key === 'Enter' && currentPolygon && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleSave();
      }
      
      // Esc to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPolygon, handleSave, handleCancel]);

  return (
    <div className={`relative ${className}`}>
      {/* Controls */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleStartDrawing}
          disabled={isDrawing}
          className="px-4 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <PencilIcon className="w-4 h-4" />
          {isDrawing ? 'Drawing...' : 'Start Drawing'}
        </button>

        {currentPolygon && (
          <>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <CheckIcon className="w-4 h-4" />
              Save (Enter)
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <XMarkIcon className="w-4 h-4" />
              Clear
            </button>
          </>
        )}

        {isDrawing && (
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            Cancel (Esc)
          </button>
        )}
      </div>

      {/* Map Container */}
      <div className="relative border border-gray-300 rounded-lg overflow-hidden" style={{ height }}>
        <div ref={mapContainer} className="w-full h-full" />
        
        {/* Instructions Overlay */}
        {!currentPolygon && !isDrawing && (
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm text-sm text-gray-600">
            Click &quot;Start Drawing&quot; to begin drawing a polygon
          </div>
        )}

        {isDrawing && (
          <div className="absolute top-4 left-4 bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg shadow-sm text-sm text-blue-800">
            <div className="font-medium mb-1">Drawing Mode</div>
            <div>Click on the map to add points. Double-click to finish.</div>
            <div className="text-xs mt-1">Press Esc to cancel</div>
          </div>
        )}

        {/* Polygon Info */}
        {currentPolygon && !isDrawing && (
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Polygon</div>
            <div className="text-sm font-mono text-gray-900">
              {currentPolygon.type === 'Polygon' 
                ? `${currentPolygon.coordinates[0]?.length || 0} points`
                : `${currentPolygon.coordinates.length} polygons`
              }
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Press Enter to save, Esc to cancel
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

