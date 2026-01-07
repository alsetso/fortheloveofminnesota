'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, MapIcon, ViewfinderCircleIcon, SunIcon, CubeIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { MAP_CONFIG } from '@/features/map/config';
import { mapStylePreloader } from '@/features/map/services/mapStylePreloader';
import { addBuildingExtrusions, removeBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';

type MapStyle = 'streets' | 'satellite' | 'light';

interface MapStylesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  map?: any;
}

/**
 * Slide-up popup for map styles/layers selection
 * Appears from the bottom of the screen, positioned in front of mobile nav (z-[60])
 */
export default function MapStylesPopup({ isOpen, onClose, map }: MapStylesPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [selectedStyle, setSelectedStyle] = useState<MapStyle>('streets');
  const [mounted, setMounted] = useState(false);
  
  // 3D controls state
  const [buildingsEnabled, setBuildingsEnabled] = useState(false);
  const [opacity, setOpacity] = useState(0.6);
  const [castShadows, setCastShadows] = useState(false);
  const [pitch, setPitch] = useState(0);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when popup is open
      document.body.style.overflow = 'hidden';
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        if (popupRef.current) {
          popupRef.current.style.transform = 'translateY(0)';
        }
      });
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Detect current map style, 3D state, and preload styles on open
  useEffect(() => {
    if (!isOpen || !map) return;

    const mapboxMap = map as any;
    
    try {
      const currentStyle = mapboxMap.getStyle?.();
      if (currentStyle) {
        const styleUrl = typeof currentStyle === 'string' ? currentStyle : currentStyle.sprite;
        
        if (styleUrl?.includes('satellite')) {
          setSelectedStyle('satellite');
        } else if (styleUrl?.includes('light')) {
          setSelectedStyle('light');
        } else {
          setSelectedStyle('streets');
        }
      }
    } catch (error) {
      console.debug('[MapStylesPopup] Error detecting current style:', error);
    }

    // Initialize 3D state from map
    try {
      const currentPitch = mapboxMap.getPitch?.() || 0;
      setPitch(currentPitch);

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
          // Properties might not be accessible
        }
      }
    } catch (error) {
      console.debug('[MapStylesPopup] Error detecting 3D state:', error);
    }

    // Listen for pitch changes
    const handlePitch = () => {
      if (mapboxMap.getPitch) setPitch(mapboxMap.getPitch());
    };
    mapboxMap.on('pitch', handlePitch);

    // Preload all map styles when popup opens
    mapStylePreloader.preloadAllStyles().catch((error) => {
      console.warn('[MapStylesPopup] Error preloading styles:', error);
    });

    return () => {
      mapboxMap.off('pitch', handlePitch);
    };
  }, [isOpen, map]);

  const handleClose = () => {
    if (popupRef.current) {
      popupRef.current.style.transform = 'translateY(100%)';
    }
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleStyleChange = (style: MapStyle) => {
    if (!map) return;
    
    setSelectedStyle(style);
    const mapboxMap = map as any;
    
    try {
      // Dispatch event immediately to show reload button
      window.dispatchEvent(new CustomEvent('mentions-layer-hidden'));
      
      mapboxMap.setStyle(MAP_CONFIG.STRATEGIC_STYLES[style]);
    } catch (error) {
      console.error('[MapStylesPopup] Error changing map style:', error);
    }
  };

  // 3D controls handlers
  const toggleBuildings = () => {
    if (!map) return;
    
    const newEnabled = !buildingsEnabled;
    setBuildingsEnabled(newEnabled);
    const mapboxMap = map as any;
    
    if (newEnabled) {
      if (!mapboxMap.getLayer('3d-buildings')) {
        addBuildingExtrusions(map, {
          opacity,
          castShadows,
          minzoom: 14,
        });
      } else {
        try {
          mapboxMap.setLayoutProperty('3d-buildings', 'visibility', 'visible');
        } catch (e) {
          // Ignore
        }
      }
    } else {
      try {
        mapboxMap.setLayoutProperty('3d-buildings', 'visibility', 'none');
      } catch (e) {
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

  const setPitchValue = (newPitch: number) => {
    if (!map) return;
    setPitch(newPitch);
    const mapboxMap = map as any;
    mapboxMap.easeTo({ pitch: newPitch, duration: 300 });
  };

  if (!isOpen || !mounted) return null;

  const styles: Array<{ id: MapStyle; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'streets', label: 'Default', Icon: MapIcon },
    { id: 'satellite', label: 'Satellite', Icon: ViewfinderCircleIcon },
    { id: 'light', label: 'Light', Icon: SunIcon },
  ];

  const popupContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300"
        onClick={handleClose}
      />
      
      {/* Popup - positioned in front of mobile nav (z-[60], same as MapEntityPopup) */}
      <div
        ref={popupRef}
        className="fixed bottom-0 left-0 right-0 z-[60] bg-white shadow-2xl transition-all duration-300 ease-out flex flex-col rounded-t-3xl"
        style={{
          transform: 'translateY(100%)',
          minHeight: '40vh',
          maxHeight: '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">Map type</h2>
          <button
            onClick={handleClose}
            className="p-1 -mr-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-3">
            {/* Map Styles */}
            <div>
              <div className="text-xs font-semibold text-gray-900 mb-2">Map type</div>
              <div className="grid grid-cols-3 gap-2">
                {styles.map((style) => {
                  const IconComponent = style.Icon;
                  return (
                    <button
                      key={style.id}
                      onClick={() => handleStyleChange(style.id)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-md border transition-all ${
                        selectedStyle === style.id
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <IconComponent className={`w-5 h-5 ${
                        selectedStyle === style.id ? 'text-teal-600' : 'text-gray-600'
                      }`} />
                      <span className="text-[10px] font-medium text-gray-900">{style.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Additional Map Settings */}
            <div className="border-t border-gray-200 pt-3 space-y-3">
              <div className="text-xs font-semibold text-gray-900 mb-2">Additional map settings</div>
              
              {/* 3D View Controls */}
              <div>
                <div className="text-xs text-gray-600 font-medium mb-1.5">3D View</div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPitchValue(0)}
                    className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors border flex items-center justify-center gap-1 ${
                      pitch === 0
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pitch === 0 && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0" />
                    )}
                    <span>0°</span>
                  </button>
                  <button
                    onClick={() => setPitchValue(30)}
                    className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors border flex items-center justify-center gap-1 ${
                      Math.round(pitch) === 30
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {Math.round(pitch) === 30 && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0" />
                    )}
                    <span>30°</span>
                  </button>
                  <button
                    onClick={() => setPitchValue(60)}
                    className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors border flex items-center justify-center gap-1 ${
                      Math.round(pitch) === 60
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {Math.round(pitch) === 60 && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0" />
                    )}
                    <span>60°</span>
                  </button>
                </div>
              </div>

              {/* 3D Buildings Section */}
              <div>
                <div className="text-xs text-gray-600 font-medium mb-1.5">3D Buildings</div>
                <div className="space-y-1.5">
                  {/* Toggle Buildings */}
                  <button
                    onClick={toggleBuildings}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors border ${
                      buildingsEnabled
                        ? 'bg-gray-100 border-gray-200 text-gray-900'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CubeIcon className="w-3.5 h-3.5" />
                      <span>Show Buildings</span>
                    </div>
                    {buildingsEnabled ? (
                      <EyeIcon className="w-3.5 h-3.5" />
                    ) : (
                      <EyeSlashIcon className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Opacity Control */}
                  {buildingsEnabled && (
                    <div className="px-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-600">Opacity</span>
                        <span className="text-[10px] text-gray-500 font-mono">{Math.round(opacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={opacity}
                        onChange={(e) => updateOpacity(parseFloat(e.target.value))}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                      />
                    </div>
                  )}

                  {/* Shadows Toggle */}
                  {buildingsEnabled && (
                    <button
                      onClick={toggleShadows}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors border ${
                        castShadows
                          ? 'bg-gray-100 border-gray-200 text-gray-900'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span>Cast Shadows</span>
                      <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                        castShadows ? 'bg-gray-900' : 'bg-gray-300'
                      }`}>
                        <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${
                          castShadows ? 'translate-x-3.5' : 'translate-x-0'
                        }`} />
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // Render to document body to escape parent stacking context
  return createPortal(popupContent, document.body);
}

