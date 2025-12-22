'use client';

import { useState, useEffect } from 'react';
import { 
  CubeIcon,
  EyeIcon,
  EyeSlashIcon,
  MapIcon,
  GlobeAltIcon,
  SunIcon,
  MoonIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ArrowRightIcon,
  TagIcon,
  BeakerIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { addBuildingExtrusions, removeBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';
import { MAP_CONFIG } from '@/features/map/config';

interface Map3DControlsSecondaryContentProps {
  map?: MapboxMapInstance | null;
}

type MapStyle = 'streets' | 'satellite' | 'light' | 'dark' | 'outdoors';

export default function Map3DControlsSecondaryContent({ map }: Map3DControlsSecondaryContentProps = {}) {
  // Building controls
  const [buildingsEnabled, setBuildingsEnabled] = useState(false);
  const [opacity, setOpacity] = useState(0.6);
  const [castShadows, setCastShadows] = useState(false);

  // Map style
  const [mapStyle, setMapStyle] = useState<MapStyle>('streets');

  // 3D view controls
  const [pitch, setPitch] = useState(0);
  const [bearing, setBearing] = useState(0);

  // Layer visibility
  const [roadsVisible, setRoadsVisible] = useState(true);
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [waterVisible, setWaterVisible] = useState(true);
  const [landcoverVisible, setLandcoverVisible] = useState(true);

  // Initialize state from map
  useEffect(() => {
    if (!map) return;
    
    const mapboxMap = map as any;
    const updateState = () => {
      try {
        // Get current pitch and bearing
        const currentPitch = mapboxMap.getPitch?.() || 0;
        const currentBearing = mapboxMap.getBearing?.() || 0;
        setPitch(currentPitch);
        setBearing(currentBearing);

        // Check buildings
        const layer = mapboxMap.getLayer('3d-buildings');
        if (layer) {
          const visibility = mapboxMap.getLayoutProperty('3d-buildings', 'visibility');
          const isVisible = visibility !== 'none';
          setBuildingsEnabled(isVisible);
          
          try {
            const currentOpacity = mapboxMap.getPaintProperty('3d-buildings', 'fill-extrusion-opacity');
            if (typeof currentOpacity === 'number') {
              setOpacity(currentOpacity);
            }
            const currentShadows = mapboxMap.getPaintProperty('3d-buildings', 'fill-extrusion-cast-shadows');
            if (typeof currentShadows === 'boolean') {
              setCastShadows(currentShadows);
            }
          } catch (e) {
            // Properties might not be accessible yet
          }
        }

        // Detect current map style
        const style = mapboxMap.getStyle?.();
        if (style?.name) {
          const styleName = style.name.toLowerCase();
          if (styleName.includes('satellite')) setMapStyle('satellite');
          else if (styleName.includes('light')) setMapStyle('light');
          else if (styleName.includes('dark')) setMapStyle('dark');
          else if (styleName.includes('outdoors')) setMapStyle('outdoors');
          else setMapStyle('streets');
        }
      } catch (e) {
        // Map might not be ready
      }
    };

    if (mapboxMap.isStyleLoaded && mapboxMap.isStyleLoaded()) {
      updateState();
    } else {
      mapboxMap.once('style.load', updateState);
      mapboxMap.once('load', updateState);
    }

    // Listen for pitch/bearing changes
    const handleMove = () => {
      if (mapboxMap.getPitch) setPitch(mapboxMap.getPitch());
      if (mapboxMap.getBearing) setBearing(mapboxMap.getBearing());
    };

    mapboxMap.on('move', handleMove);
    mapboxMap.on('pitch', handleMove);
    mapboxMap.on('rotate', handleMove);

    return () => {
      mapboxMap.off('move', handleMove);
      mapboxMap.off('pitch', handleMove);
      mapboxMap.off('rotate', handleMove);
    };
  }, [map]);

  const toggleBuildings = () => {
    if (!map) return;
    
    const newEnabled = !buildingsEnabled;
    setBuildingsEnabled(newEnabled);

    const mapboxMap = map as any;
    
    if (newEnabled) {
      // Check if layer already exists (might have been added on map load)
      if (!mapboxMap.getLayer('3d-buildings')) {
        addBuildingExtrusions(map, {
          opacity,
          castShadows,
          minzoom: 14,
        });
      } else {
        // Layer exists, just make it visible
        try {
          mapboxMap.setLayoutProperty('3d-buildings', 'visibility', 'visible');
        } catch (e) {
          // Ignore
        }
      }
    } else {
      // Hide the layer instead of removing it (better for performance)
      try {
        mapboxMap.setLayoutProperty('3d-buildings', 'visibility', 'none');
      } catch (e) {
        // If that fails, remove it
        removeBuildingExtrusions(map);
      }
    }
  };

  const updateOpacity = (newOpacity: number) => {
    if (!map) return;
    
    setOpacity(newOpacity);
    
    if (buildingsEnabled) {
      const mapboxMap = map as any;
      try {
        mapboxMap.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', newOpacity);
      } catch (e) {
        // Layer might not exist yet
      }
    }
  };

  const toggleShadows = () => {
    if (!map) return;
    
    const newShadows = !castShadows;
    setCastShadows(newShadows);
    
    if (buildingsEnabled) {
      const mapboxMap = map as any;
      try {
        mapboxMap.setPaintProperty('3d-buildings', 'fill-extrusion-cast-shadows', newShadows);
      } catch (e) {
        // Layer might not exist yet
      }
    }
  };

  // Map style controls
  const changeMapStyle = (style: MapStyle) => {
    if (!map) return;
    setMapStyle(style);
    const mapboxMap = map as any;
    mapboxMap.setStyle(MAP_CONFIG.STRATEGIC_STYLES[style]);
  };

  // 3D view controls
  const updatePitch = (newPitch: number) => {
    if (!map) return;
    setPitch(newPitch);
    const mapboxMap = map as any;
    mapboxMap.easeTo({ pitch: newPitch, duration: 200 });
  };

  const updateBearing = (newBearing: number) => {
    if (!map) return;
    setBearing(newBearing);
    const mapboxMap = map as any;
    mapboxMap.easeTo({ bearing: newBearing, duration: 200 });
  };

  const resetView = () => {
    if (!map) return;
    const mapboxMap = map as any;
    mapboxMap.easeTo({ 
      pitch: 0, 
      bearing: 0, 
      duration: 500 
    });
    setPitch(0);
    setBearing(0);
  };

  // Layer visibility controls
  const toggleLayerVisibility = (layerType: 'road' | 'label' | 'water' | 'landcover', visible: boolean) => {
    if (!map) return;
    const mapboxMap = map as any;
    
    try {
      const style = mapboxMap.getStyle();
      if (!style?.layers) return;

      const patterns: Record<string, string[]> = {
        road: ['road', 'bridge', 'tunnel', 'highway', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'street', 'link', 'path'],
        label: ['label', 'text', 'place-label', 'poi-label'],
        water: ['water', 'waterway'],
        landcover: ['landcover', 'landuse', 'park', 'forest'],
      };

      style.layers.forEach((layer: any) => {
        const layerId = layer.id.toLowerCase();
        const sourceLayer = layer['source-layer']?.toLowerCase() || '';
        const matches = patterns[layerType].some(pattern => 
          layerId.includes(pattern) || sourceLayer.includes(pattern)
        );

        if (matches) {
          try {
            mapboxMap.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
          } catch (e) {
            // Layer might not support visibility
          }
        }
      });

      // Update state
      if (layerType === 'road') setRoadsVisible(visible);
      else if (layerType === 'label') setLabelsVisible(visible);
      else if (layerType === 'water') setWaterVisible(visible);
      else if (layerType === 'landcover') setLandcoverVisible(visible);
    } catch (e) {
      console.warn('[Map3DControls] Error toggling layer:', e);
    }
  };

  const styleOptions: Array<{ value: MapStyle; label: string; icon: typeof GlobeAltIcon }> = [
    { value: 'streets', label: 'Streets', icon: MapIcon },
    { value: 'satellite', label: 'Satellite', icon: GlobeAltIcon },
    { value: 'light', label: 'Light', icon: SunIcon },
    { value: 'dark', label: 'Dark', icon: MoonIcon },
    { value: 'outdoors', label: 'Outdoors', icon: Squares2X2Icon },
  ];

  return (
    <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
      {/* Map Style */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">Map Style</div>
        <div className="space-y-1">
          {styleOptions.map((option) => {
            const Icon = option.icon;
            const isActive = mapStyle === option.value;
            return (
              <button
                key={option.value}
                onClick={() => changeMapStyle(option.value)}
                className={`
                  w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors
                  ${isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3D View Controls */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">3D View</div>
        <div className="space-y-2">
          {/* Pitch Control */}
          <div className="px-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Pitch</span>
              <span className="text-xs text-gray-500 font-mono">{Math.round(pitch)}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={pitch}
              onChange={(e) => updatePitch(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
            />
          </div>

          {/* Bearing Control */}
          <div className="px-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Rotation</span>
              <span className="text-xs text-gray-500 font-mono">{Math.round(bearing)}°</span>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={bearing}
              onChange={(e) => updateBearing(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
            />
          </div>

          {/* Reset View */}
          <button
            onClick={resetView}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <ArrowUturnLeftIcon className="w-4 h-4" />
            <span>Reset View</span>
          </button>
        </div>
      </div>

      {/* 3D Buildings Section */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">3D Buildings</div>
        <div className="space-y-2">
          {/* Toggle Buildings */}
          <button
            onClick={toggleBuildings}
            className={`
              w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors
              ${buildingsEnabled
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <CubeIcon className="w-4 h-4" />
              <span>Show Buildings</span>
            </div>
            {buildingsEnabled ? (
              <EyeIcon className="w-4 h-4" />
            ) : (
              <EyeSlashIcon className="w-4 h-4" />
            )}
          </button>

          {/* Opacity Control */}
          {buildingsEnabled && (
            <div className="px-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Opacity</span>
                <span className="text-xs text-gray-500 font-mono">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(e) => updateOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
              />
            </div>
          )}

          {/* Shadows Toggle */}
          {buildingsEnabled && (
            <button
              onClick={toggleShadows}
              className={`
                w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors
                ${castShadows
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <span>Cast Shadows</span>
              <div className={`
                w-8 h-4 rounded-full transition-colors relative
                ${castShadows ? 'bg-gray-900' : 'bg-gray-300'}
              `}>
                <div className={`
                  absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform
                  ${castShadows ? 'translate-x-4' : 'translate-x-0'}
                `} />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Layer Visibility */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">Layers</div>
        <div className="space-y-1">
          {/* Roads */}
          <button
            onClick={() => toggleLayerVisibility('road', !roadsVisible)}
            className={`
              w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors
              ${roadsVisible
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <ArrowRightIcon className="w-4 h-4" />
              <span>Roads</span>
            </div>
            {roadsVisible ? (
              <EyeIcon className="w-4 h-4" />
            ) : (
              <EyeSlashIcon className="w-4 h-4" />
            )}
          </button>

          {/* Labels */}
          <button
            onClick={() => toggleLayerVisibility('label', !labelsVisible)}
            className={`
              w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors
              ${labelsVisible
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <TagIcon className="w-4 h-4" />
              <span>Labels</span>
            </div>
            {labelsVisible ? (
              <EyeIcon className="w-4 h-4" />
            ) : (
              <EyeSlashIcon className="w-4 h-4" />
            )}
          </button>

          {/* Water */}
          <button
            onClick={() => toggleLayerVisibility('water', !waterVisible)}
            className={`
              w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors
              ${waterVisible
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <BeakerIcon className="w-4 h-4" />
              <span>Water</span>
            </div>
            {waterVisible ? (
              <EyeIcon className="w-4 h-4" />
            ) : (
              <EyeSlashIcon className="w-4 h-4" />
            )}
          </button>

          {/* Landcover */}
          <button
            onClick={() => toggleLayerVisibility('landcover', !landcoverVisible)}
            className={`
              w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors
              ${landcoverVisible
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Squares2X2Icon className="w-4 h-4" />
              <span>Landcover</span>
            </div>
            {landcoverVisible ? (
              <EyeIcon className="w-4 h-4" />
            ) : (
              <EyeSlashIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
