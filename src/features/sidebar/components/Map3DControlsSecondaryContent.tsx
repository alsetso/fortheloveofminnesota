'use client';

import { useState, useEffect } from 'react';
import { 
  CubeIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { addBuildingExtrusions, removeBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';
import { MAP_CONFIG } from '@/features/map/config';

interface Map3DControlsSecondaryContentProps {
  map?: MapboxMapInstance | null;
}

type MapStyle = 'streets' | 'satellite' | 'light' | 'dark' | 'outdoors';

export default function Map3DControlsSecondaryContent({ 
  map, 
}: Map3DControlsSecondaryContentProps = {}) {
  
  // Building controls
  const [buildingsEnabled, setBuildingsEnabled] = useState(false);
  const [opacity, setOpacity] = useState(0.6);
  const [castShadows, setCastShadows] = useState(false);

  // Map style
  const [mapStyle, setMapStyle] = useState<MapStyle>('streets');

  // 3D view controls
  const [pitch, setPitch] = useState(0);


  // Initialize state from map
  useEffect(() => {
    if (!map) return;
    
    const mapboxMap = map as any;
    const updateState = () => {
      try {
        // Get current pitch
        const currentPitch = mapboxMap.getPitch?.() || 0;
        setPitch(currentPitch);

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

    // Listen for pitch changes
    const handlePitch = () => {
      if (mapboxMap.getPitch) setPitch(mapboxMap.getPitch());
    };

    mapboxMap.on('pitch', handlePitch);

    return () => {
      mapboxMap.off('pitch', handlePitch);
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

  // 3D view controls - fixed pitch options
  const setPitchValue = (newPitch: number) => {
    if (!map) return;
    setPitch(newPitch);
    const mapboxMap = map as any;
    mapboxMap.easeTo({ pitch: newPitch, duration: 300 });
  };


  return (
    <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">

      {/* 3D View Controls */}
      <div>
        <div className="text-xs text-gray-600 font-medium mb-2">3D View</div>
        <div className="space-y-1">
          {/* Fixed Pitch Options */}
          <div className="flex gap-1">
            <button
              onClick={() => setPitchValue(0)}
              className="flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5"
            >
              {pitch === 0 && (
                <div className="w-2 h-2 bg-green-500 rounded-full border border-white flex-shrink-0" />
              )}
              <span>0°</span>
            </button>
            <button
              onClick={() => setPitchValue(30)}
              className="flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5"
            >
              {Math.round(pitch) === 30 && (
                <div className="w-2 h-2 bg-green-500 rounded-full border border-white flex-shrink-0" />
              )}
              <span>30°</span>
            </button>
            <button
              onClick={() => setPitchValue(60)}
              className="flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5"
            >
              {Math.round(pitch) === 60 && (
                <div className="w-2 h-2 bg-green-500 rounded-full border border-white flex-shrink-0" />
              )}
              <span>60°</span>
            </button>
          </div>
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

    </div>
  );
}
