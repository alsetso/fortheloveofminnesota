'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface PostMapDrawerProps {
  onClose: () => void;
  onMapDataSave: (data: {
    type: 'pin' | 'area' | 'both';
    geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.Point;
    center?: { lat: number; lng: number };
    screenshot?: string;
  }) => void;
  initialMapData?: {
    type: 'pin' | 'area' | 'both';
    geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.Point;
    center?: { lat: number; lng: number };
    screenshot?: string;
  } | null;
}

type DrawingMode = 'idle' | 'draw_polygon' | 'draw_point';

export default function PostMapDrawer({ onClose, onMapDataSave, initialMapData }: PostMapDrawerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MapboxMapInstance | null>(null);
  const drawRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('idle');
  const [polygon, setPolygon] = useState<GeoJSON.Polygon | GeoJSON.MultiPolygon | null>(null);
  const [point, setPoint] = useState<GeoJSON.Point | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    let mounted = true;

    const initMap = async () => {
      try {
        if (!MAP_CONFIG.MAPBOX_TOKEN) {
          console.error('Mapbox token missing');
          return undefined;
        }

        const mapboxgl = await loadMapboxGL();
        mapboxgl.accessToken = MAP_CONFIG.MAPBOX_TOKEN;
        
        if (!mounted || !mapContainer.current) return undefined;

        const map = new mapboxgl.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center: initialMapData?.center ? [initialMapData.center.lng, initialMapData.center.lat] : MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          minZoom: MAP_CONFIG.MIN_ZOOM_MN,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
          preserveDrawingBuffer: true,
        });

        map.on('load', () => {
          if (mounted) {
            setMapLoaded(true);
            mapInstance.current = map as any;
          }
        });

        return () => {
          if (map) {
            map.remove();
          }
        };
      } catch (error) {
        console.error('Error loading map:', error);
        return undefined;
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (mapInstance.current) {
        try {
          (mapInstance.current as any).remove();
        } catch (e) {
          // Ignore
        }
        mapInstance.current = null;
      }
    };
  }, []);

  // Initialize Mapbox Draw
  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return;

    const initDraw = async () => {
      try {
        const MapboxDraw = (await import('@mapbox/mapbox-gl-draw')).default;
        const mapboxMap = mapInstance.current as any;

        if (!drawRef.current) {
          drawRef.current = new MapboxDraw({
            displayControlsDefault: false,
            defaultMode: 'simple_select',
            controls: {},
          });

          mapboxMap.addControl(drawRef.current);

          // Handle draw create
          mapboxMap.on('draw.create', (e: any) => {
            if (e.features && e.features.length > 0) {
              const feature = e.features[0];
              if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                setPolygon(feature.geometry);
                setDrawingMode('idle');
              } else if (feature.geometry.type === 'Point') {
                setPoint(feature.geometry);
                setDrawingMode('idle');
              }
            }
          });

          // Handle draw update
          mapboxMap.on('draw.update', (e: any) => {
            if (e.features && e.features.length > 0) {
              const feature = e.features[0];
              if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                setPolygon(feature.geometry);
              } else if (feature.geometry.type === 'Point') {
                setPoint(feature.geometry);
              }
            }
          });

          // Handle draw delete
          mapboxMap.on('draw.delete', () => {
            setPolygon(null);
            setPoint(null);
          });
        }
      } catch (error) {
        console.error('Error initializing Mapbox Draw:', error);
      }
    };

    initDraw();
  }, [mapLoaded]);

  // Handle drawing mode changes
  useEffect(() => {
    if (!drawRef.current || !mapInstance.current) return;

    const draw = drawRef.current;
    const mapboxMap = mapInstance.current as any;

    if (drawingMode === 'draw_polygon') {
      draw.changeMode('draw_polygon');
    } else if (drawingMode === 'draw_point') {
      draw.changeMode('draw_point');
    } else {
      draw.changeMode('simple_select');
    }
  }, [drawingMode]);

  const handleSave = useCallback(async () => {
    if (!mapInstance.current || !mapLoaded) return;

    try {
      // Capture screenshot - ensure map is fully rendered
      const mapboxMap = mapInstance.current as any;
      const canvas = mapboxMap.getCanvas();
      
      // Wait a brief moment to ensure map is fully rendered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Compress and resize screenshot to reduce size
      const compressScreenshot = (canvas: HTMLCanvasElement, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            // Calculate new dimensions
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
            
            // Create a new canvas with compressed dimensions
            const compressedCanvas = document.createElement('canvas');
            compressedCanvas.width = width;
            compressedCanvas.height = height;
            const ctx = compressedCanvas.getContext('2d');
            
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              // Use JPEG with quality setting for better compression
              const compressed = compressedCanvas.toDataURL('image/jpeg', quality);
              resolve(compressed);
            } else {
              // Fallback to original if compression fails
              resolve(canvas.toDataURL('image/png'));
            }
          };
          img.onerror = () => {
            // Fallback to original if compression fails
            resolve(canvas.toDataURL('image/png'));
          };
          img.src = canvas.toDataURL('image/png');
        });
      };
      
      let screenshot = await compressScreenshot(canvas);
      
      // Validate screenshot
      if (!screenshot || screenshot === 'data:,') {
        console.error('Failed to capture map screenshot');
        return;
      }
      
      // Check size (base64 is ~33% larger than binary, so 1MB binary ≈ 1.33MB base64)
      // We want to stay under ~700KB base64 to be safe
      let base64Size = (screenshot.length * 3) / 4;
      if (base64Size > 700 * 1024) {
        console.warn('Screenshot still large after compression:', Math.round(base64Size / 1024), 'KB');
        // Try more aggressive compression
        const moreCompressed = await compressScreenshot(canvas, 600, 0.6);
        const newSize = (moreCompressed.length * 3) / 4;
        if (newSize <= 700 * 1024) {
          screenshot = moreCompressed;
          base64Size = newSize;
        }
      }
      
      console.log('Screenshot size after compression:', Math.round(base64Size / 1024), 'KB');

      // Calculate center
      let center: { lat: number; lng: number } | undefined;
      if (point) {
        center = { lng: point.coordinates[0], lat: point.coordinates[1] };
      } else if (polygon) {
        // Calculate centroid
        const coords = polygon.type === 'Polygon' 
          ? polygon.coordinates[0] 
          : polygon.coordinates[0][0];
        const sum = coords.reduce((acc, coord) => ({
          lng: acc.lng + coord[0],
          lat: acc.lat + coord[1],
        }), { lng: 0, lat: 0 });
        center = {
          lng: sum.lng / coords.length,
          lat: sum.lat / coords.length,
        };
      }

      const type = point && polygon ? 'both' : polygon ? 'area' : point ? 'pin' : 'pin';
      const geometry = polygon || point || undefined;

      onMapDataSave({
        type,
        geometry,
        center,
        screenshot,
      });
    } catch (error) {
      console.error('Error saving map data:', error);
    }
  }, [point, polygon, onMapDataSave, mapLoaded]);

  const handleClear = () => {
    if (drawRef.current) {
      drawRef.current.deleteAll();
      setPolygon(null);
      setPoint(null);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Map Container */}
      <div className="flex-1 relative min-h-0">
        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-gray-200 space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawingMode('draw_polygon')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              drawingMode === 'draw_polygon'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Draw Area
          </button>
          <button
            type="button"
            onClick={() => setDrawingMode('draw_point')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              drawingMode === 'draw_point'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Drop Pin
          </button>
        </div>

        {(polygon || point) && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
