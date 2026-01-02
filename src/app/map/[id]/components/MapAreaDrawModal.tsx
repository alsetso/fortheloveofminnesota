'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface MapAreaDrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapId: string;
  mapInstance: MapboxMapInstance | null;
  mapLoaded: boolean;
  mapStyle: 'street' | 'satellite' | 'light' | 'dark';
  onAreaCreated?: () => void;
  autoSave?: boolean;
}

type DrawingState = 'idle' | 'drawing' | 'completed';

export default function MapAreaDrawModal({
  isOpen,
  onClose,
  mapId,
  mapInstance,
  mapLoaded,
  mapStyle,
  onAreaCreated,
  autoSave = false,
}: MapAreaDrawModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState>('idle');
  const [polygon, setPolygon] = useState<GeoJSON.Polygon | GeoJSON.MultiPolygon | null>(null);
  const drawRef = useRef<any>(null);

  // Ensure polygon is closed (first coordinate = last coordinate)
  const ensureClosedPolygon = useCallback((geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): GeoJSON.Polygon | GeoJSON.MultiPolygon => {
    if (geometry.type === 'Polygon') {
      const coordinates = geometry.coordinates.map((ring) => {
        if (ring.length < 3) return ring;
        const first = ring[0];
        const last = ring[ring.length - 1];
        // Check if first and last are the same (within small tolerance)
        const isClosed = Math.abs(first[0] - last[0]) < 0.0001 && Math.abs(first[1] - last[1]) < 0.0001;
        if (!isClosed) {
          return [...ring, first]; // Close the ring
        }
        return ring;
      });
      return { ...geometry, coordinates };
    } else if (geometry.type === 'MultiPolygon') {
      const coordinates = geometry.coordinates.map((polygon) =>
        polygon.map((ring) => {
          if (ring.length < 3) return ring;
          const first = ring[0];
          const last = ring[ring.length - 1];
          const isClosed = Math.abs(first[0] - last[0]) < 0.0001 && Math.abs(first[1] - last[1]) < 0.0001;
          if (!isClosed) {
            return [...ring, first];
          }
          return ring;
        })
      );
      return { ...geometry, coordinates };
    }
    return geometry;
  }, []);

  // Initialize Mapbox Draw when modal opens
  useEffect(() => {
    if (!isOpen || !mapInstance || !mapLoaded) return;

    let cleanup: (() => void) | null = null;

    const initDraw = async () => {
      try {
        const MapboxDraw = (await import('@mapbox/mapbox-gl-draw')).default;
        const mapboxMap = mapInstance as any;

        if (!drawRef.current) {
          drawRef.current = new MapboxDraw({
            displayControlsDefault: false,
            defaultMode: 'simple_select',
            controls: {},
          });

          mapboxMap.addControl(drawRef.current);
        }

        const drawInstance = drawRef.current;

        // Handle polygon creation (when user finishes drawing)
        const handleDrawCreate = (e: any) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
              // Ensure polygon is closed (first point = last point)
              const geometry = ensureClosedPolygon(feature.geometry);
              setPolygon(geometry);
              setDrawingState('completed');
            }
          }
        };

        // Handle polygon update (when user edits)
        const handleDrawUpdate = (e: any) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
              const geometry = ensureClosedPolygon(feature.geometry);
              setPolygon(geometry);
            }
          }
        };

        // Handle polygon delete
        const handleDrawDelete = () => {
          setPolygon(null);
          setDrawingState('idle');
        };

        // Handle mode changes
        const handleModeChange = (e: any) => {
          if (e.mode === 'draw_polygon') {
            setDrawingState('drawing');
          } else if (e.mode === 'simple_select' && polygon) {
            setDrawingState('completed');
          } else if (e.mode === 'simple_select' && !polygon) {
            setDrawingState('idle');
          }
        };

        mapboxMap.on('draw.create', handleDrawCreate);
        mapboxMap.on('draw.update', handleDrawUpdate);
        mapboxMap.on('draw.delete', handleDrawDelete);
        mapboxMap.on('draw.modechange', handleModeChange);

        cleanup = () => {
          if (mapboxMap && !mapboxMap.removed) {
            mapboxMap.off('draw.create', handleDrawCreate);
            mapboxMap.off('draw.update', handleDrawUpdate);
            mapboxMap.off('draw.delete', handleDrawDelete);
            mapboxMap.off('draw.modechange', handleModeChange);
          }
        };
      } catch (err) {
        console.error('Error initializing draw:', err);
        setError('Failed to initialize drawing tool');
      }
    };

    initDraw();

    return () => {
      if (cleanup) cleanup();
    };
  }, [isOpen, mapInstance, mapLoaded, polygon, ensureClosedPolygon]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (drawRef.current && mapInstance) {
        const mapboxMap = mapInstance as any;
        try {
          // Exit any drawing mode
          if (drawRef.current.changeMode) {
            drawRef.current.changeMode('simple_select');
          }
          if (drawRef.current.deleteAll) {
            drawRef.current.deleteAll();
          }
          if (mapboxMap.removeControl) {
            mapboxMap.removeControl(drawRef.current);
          }
          // Reset cursor
          const canvas = mapboxMap.getCanvas();
          if (canvas) {
            canvas.style.cursor = '';
          }
        } catch (err) {
          // Ignore cleanup errors
        }
        drawRef.current = null;
      }
      setPolygon(null);
      setName('');
      setDescription('');
      setError(null);
      setDrawingState('idle');
    }
  }, [isOpen, mapInstance]);

  // Handle Start button - enter drawing mode
  const handleStart = () => {
    if (!drawRef.current || !mapInstance) return;
    const drawInstance = drawRef.current;
    const mapboxMap = mapInstance as any;
    
    // Clear any existing polygon
    drawInstance.deleteAll();
    setPolygon(null);
    
    // Enter draw polygon mode
    drawInstance.changeMode('draw_polygon');
    setDrawingState('drawing');
    setError(null);
  };

  // Handle Stop button - finish drawing
  const handleStop = async () => {
    if (!drawRef.current) return;
    const drawInstance = drawRef.current;
    
    // Get current features
    const features = drawInstance.getAll();
    if (features.features && features.features.length > 0) {
      const feature = features.features[0];
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        const geometry = ensureClosedPolygon(feature.geometry);
        setPolygon(geometry);
        setDrawingState('completed');
        // Switch to select mode so user can edit
        drawInstance.changeMode('simple_select');

        // Auto-save if enabled (for owners)
        if (autoSave) {
          try {
            const response = await fetch(`/api/maps/${mapId}/areas`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: `Area ${new Date().toLocaleDateString()}`,
                description: null,
                geometry: geometry,
              }),
            });

            if (response.ok) {
              if (onAreaCreated) {
                onAreaCreated();
              }
              // Clear the drawing and close
              drawInstance.deleteAll();
              onClose();
            }
          } catch (err) {
            console.error('Error auto-saving area:', err);
            setError('Failed to save area');
          }
        }
      }
    } else {
      // No polygon drawn yet, just exit drawing mode
      drawInstance.changeMode('simple_select');
      setDrawingState('idle');
    }
  };

  // Handle Save button - save the area
  const handleSave = async () => {
    if (!polygon) {
      setError('Please draw an area on the map');
      return;
    }

    if (!name.trim()) {
      setError('Please enter a name for the area');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Ensure polygon is closed before saving
      const closedPolygon = ensureClosedPolygon(polygon);

      const response = await fetch(`/api/maps/${mapId}/areas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          geometry: closedPolygon,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create area');
      }

      if (onAreaCreated) {
        onAreaCreated();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create area');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-3 right-3 z-50 bg-white/95 backdrop-blur-sm rounded-md border border-gray-200 shadow-sm">
      <div className="p-[10px] space-y-3 min-w-[280px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-900">Draw Area</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Status Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-[10px]">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {drawingState === 'idle' && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-[10px]">
            <p className="text-xs text-blue-700">Click "Start" to begin drawing a polygon on the map.</p>
          </div>
        )}

        {drawingState === 'drawing' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-[10px]">
            <p className="text-xs text-yellow-700">Click on the map to add points. Click "Stop" when finished.</p>
          </div>
        )}

        {drawingState === 'completed' && polygon && (
          <div className="bg-green-50 border border-green-200 rounded-md p-[10px]">
            <p className="text-xs text-green-700">
              {autoSave 
                ? 'Area saved successfully!'
                : `Area drawn with ${polygon.type === 'Polygon' 
                  ? polygon.coordinates[0]?.length || 0 
                  : polygon.coordinates[0]?.[0]?.length || 0} points. Enter details and save.`}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleStart}
            disabled={drawingState === 'drawing' || saving}
            className="flex-1 flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Start
          </button>
          <button
            onClick={handleStop}
            disabled={drawingState !== 'drawing' || saving}
            className="flex-1 flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Stop
          </button>
        </div>

        {/* Name and Description Inputs - Only show if not auto-saving */}
        {!autoSave && (
          <>
            <div>
              <label htmlFor="area-name" className="block text-xs font-medium text-gray-500 mb-0.5">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="area-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors"
                placeholder="Area name"
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="area-description" className="block text-xs font-medium text-gray-500 mb-0.5">
                Description
              </label>
              <textarea
                id="area-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-[10px] py-[10px] border border-gray-200 rounded-md text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-colors resize-none"
                placeholder="Area description (optional)"
                rows={2}
                disabled={saving}
              />
            </div>
          </>
        )}

        {/* Save Button - Only show if not auto-saving */}
        {!autoSave && (
          <button
            onClick={handleSave}
            disabled={saving || !polygon || !name.trim() || drawingState === 'drawing'}
            className="w-full flex justify-center items-center gap-1.5 px-[10px] py-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              'Save Area'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

