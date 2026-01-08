'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, CubeIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { MAP_CONFIG } from '@/features/map/config';
import { mapStylePreloader } from '@/features/map/services/mapStylePreloader';
import { addBuildingExtrusions, removeBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';

type MapStyle = 'streets' | 'satellite';

interface MapStylesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  map?: any;
  districtsState?: {
    showDistricts: boolean;
    setShowDistricts: (show: boolean) => void;
  };
  buildingsState?: {
    showBuildings: boolean;
    setShowBuildings: (show: boolean) => void;
  };
  ctuState?: {
    showCTU: boolean;
    setShowCTU: (show: boolean) => void;
  };
}

/**
 * Slide-up popup for map styles/layers selection
 * Appears from the bottom of the screen, positioned in front of mobile nav (z-[60])
 */
export default function MapStylesPopup({ isOpen, onClose, map, districtsState, buildingsState, ctuState }: MapStylesPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [selectedStyle, setSelectedStyle] = useState<MapStyle>('streets');
  const [mounted, setMounted] = useState(false);
  
  // 3D controls state
  const [buildingsEnabled, setBuildingsEnabled] = useState(false);
  const [opacity, setOpacity] = useState(0.6);
  const [castShadows, setCastShadows] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    // Initialize from window state if available
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });

  // Listen for blur style changes (in case changed elsewhere)
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    };
  }, []);

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
        
        const detectedStyle = styleUrl?.includes('satellite') ? 'satellite' : 'streets';
        setSelectedStyle(detectedStyle);
        
        // Store map style in window and dispatch event
        if (typeof window !== 'undefined') {
          (window as any).__currentMapStyle = detectedStyle;
          window.dispatchEvent(new CustomEvent('map-style-change', {
            detail: { mapStyle: detectedStyle }
          }));
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
      
      // Store map style in window and dispatch event
      if (typeof window !== 'undefined') {
        (window as any).__currentMapStyle = style;
        window.dispatchEvent(new CustomEvent('map-style-change', {
          detail: { mapStyle: style }
        }));
      }
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

  // Text color logic: white only when blur AND satellite, otherwise dark
  const useWhiteText = useBlurStyle && selectedStyle === 'satellite';

  const popupContent = (
    <>
      {/* Backdrop - hidden on desktop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300 xl:hidden"
        onClick={handleClose}
      />
      
      {/* Popup - positioned in front of mobile nav (z-[60], same as MapEntityPopup) */}
      <div
        ref={popupRef}
        className={`fixed z-[60] shadow-2xl transition-all duration-300 ease-out flex flex-col
          /* Mobile: bottom sheet */
          bottom-0 left-0 right-0 rounded-t-3xl
          /* Desktop: bottom sheet with 500px width, left side, squared bottom corners */
          xl:bottom-0 xl:left-4 xl:right-auto xl:w-[500px] xl:rounded-t-lg xl:rounded-b-none xl:max-h-[50vh]
          ${useBlurStyle ? 'bg-transparent backdrop-blur-md' : 'bg-white'}`}
        style={{
          transform: 'translateY(100%)',
          minHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? 'auto' : '40vh',
          maxHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '50vh' : '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar - hidden on desktop */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0 xl:hidden">
          <div className={`w-12 h-1 rounded-full ${useBlurStyle ? 'bg-white/40' : 'bg-gray-300'}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 border-b flex-shrink-0 ${
          useBlurStyle ? 'border-transparent' : 'border-gray-200'
        }`}>
          <h2 className={`text-sm font-semibold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>Map Settings</h2>
          <button
            onClick={handleClose}
            className={`p-1 -mr-1 transition-colors ${
              useWhiteText 
                ? 'text-gray-300 hover:text-white' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Always scrollable on desktop */}
        <div className="flex-1 overflow-y-auto xl:overflow-y-auto">
          <div className="p-3 space-y-3">
            {/* 3D View Controls */}
            <div>
              <div className={`text-xs font-semibold mb-2 ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>3D View</div>
              <div className="flex gap-1">
                  <button
                    onClick={() => setPitchValue(0)}
                    className={`flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors border flex items-center justify-center gap-1 ${
                      pitch === 0
                        ? 'bg-gray-900 text-white border-gray-900'
                        : useBlurStyle
                        ? 'bg-white/10 border-white/20 hover:bg-white/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${useWhiteText && pitch !== 0 ? 'text-white' : pitch !== 0 ? 'text-gray-700' : ''}`}
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
                        : useBlurStyle
                        ? 'bg-white/10 border-white/20 hover:bg-white/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${useWhiteText && Math.round(pitch) !== 30 ? 'text-white' : Math.round(pitch) !== 30 ? 'text-gray-700' : ''}`}
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
                        : useBlurStyle
                        ? 'bg-white/10 border-white/20 hover:bg-white/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${useWhiteText && Math.round(pitch) !== 60 ? 'text-white' : Math.round(pitch) !== 60 ? 'text-gray-700' : ''}`}
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
                <div className={`text-xs font-semibold mb-2 ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>3D Buildings</div>
                <div className="space-y-1.5">
                  {/* Toggle Buildings */}
                  <button
                    onClick={toggleBuildings}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors border ${
                      buildingsEnabled
                        ? useBlurStyle
                        ? 'bg-white/10 border-white/20'
                        : 'bg-gray-100 border-gray-200'
                        : useBlurStyle
                        ? 'bg-white/10 border-white/20 hover:bg-white/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${
                      buildingsEnabled
                        ? useWhiteText ? 'text-white' : 'text-gray-900'
                        : useWhiteText ? 'text-white' : 'text-gray-600 hover:text-gray-900'
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
                        <span className={`text-[10px] ${useWhiteText ? 'text-white/90' : 'text-gray-600'}`}>Opacity</span>
                        <span className={`text-[10px] font-mono ${useWhiteText ? 'text-white/80' : 'text-gray-500'}`}>{Math.round(opacity * 100)}%</span>
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
                          ? useBlurStyle
                          ? 'bg-white/10 border-white/20'
                          : 'bg-gray-100 border-gray-200'
                          : useBlurStyle
                          ? 'bg-white/10 border-white/20 hover:bg-white/20'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      } ${
                        castShadows
                          ? useWhiteText ? 'text-white' : 'text-gray-900'
                          : useWhiteText ? 'text-white' : 'text-gray-600 hover:text-gray-900'
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

              {/* State Resources Section */}
              {buildingsState && (
                <div>
                  <div className={`text-xs font-semibold mb-2 ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>State Resources</div>
                  <button
                    onClick={() => {
                      buildingsState.setShowBuildings(!buildingsState.showBuildings);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors border ${
                      useBlurStyle
                        ? 'bg-white/10 border-white/20 hover:bg-white/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${useWhiteText ? 'text-white' : 'text-gray-900'}`}
                  >
                    <div className="flex items-center gap-2">
                      <CubeIcon className="w-3.5 h-3.5" />
                      <span>Government Buildings</span>
                    </div>
                    <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                      buildingsState.showBuildings ? 'bg-gray-900' : 'bg-gray-300'
                    }`}>
                      <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${
                        buildingsState.showBuildings ? 'translate-x-3.5' : 'translate-x-0'
                      }`} />
                    </div>
                  </button>
                </div>
              )}

              {/* Congressional Districts Toggle */}
              {districtsState && (
                <div>
                  <div className={`text-xs font-semibold mb-2 ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>Layers</div>
                  <button
                    onClick={() => {
                      districtsState.setShowDistricts(!districtsState.showDistricts);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors border ${
                      useBlurStyle
                        ? 'bg-white/10 border-white/20 hover:bg-white/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${useWhiteText ? 'text-white' : 'text-gray-900'}`}
                  >
                    <span>Congressional Districts</span>
                    <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                      districtsState.showDistricts ? 'bg-gray-900' : 'bg-gray-300'
                    }`}>
                      <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${
                        districtsState.showDistricts ? 'translate-x-3.5' : 'translate-x-0'
                      }`} />
                    </div>
                  </button>
                </div>
              )}

              {/* CTU Boundaries Toggle */}
              {ctuState && (
                <div>
                  {!districtsState && (
                    <div className={`text-xs font-semibold mb-2 ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>Layers</div>
                  )}
                  <button
                    onClick={() => {
                      ctuState.setShowCTU(!ctuState.showCTU);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors border ${
                      useBlurStyle
                        ? 'bg-white/10 border-white/20 hover:bg-white/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${useWhiteText ? 'text-white' : 'text-gray-900'}`}
                  >
                    <span>CTU Boundaries</span>
                    <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                      ctuState.showCTU ? 'bg-gray-900' : 'bg-gray-300'
                    }`}>
                      <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${
                        ctuState.showCTU ? 'translate-x-3.5' : 'translate-x-0'
                      }`} />
                    </div>
                  </button>
                </div>
              )}

              {/* UI Style Section */}
              <div>
                <div className={`text-xs font-semibold mb-2 ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>UI Style</div>
                <div className="space-y-1.5">
                  {/* Satellite Toggle */}
                  <button
                    onClick={() => {
                      const newStyle = selectedStyle === 'satellite' ? 'streets' : 'satellite';
                      handleStyleChange(newStyle);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors border ${
                      selectedStyle === 'satellite'
                        ? useBlurStyle
                        ? 'bg-white/10 border-white/20'
                        : 'bg-gray-100 border-gray-200'
                        : useBlurStyle
                        ? 'bg-white/10 border-white/20 hover:bg-white/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${useWhiteText ? 'text-white' : 'text-gray-900'}`}
                  >
                    <span>Satellite</span>
                    <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                      selectedStyle === 'satellite' ? 'bg-gray-900' : 'bg-gray-300'
                    }`}>
                      <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${
                        selectedStyle === 'satellite' ? 'translate-x-3.5' : 'translate-x-0'
                      }`} />
                    </div>
                  </button>

                  {/* Transparent Blur Toggle */}
                  <button
                    onClick={() => {
                      const newValue = !useBlurStyle;
                      setUseBlurStyle(newValue);
                      // Store in window for session persistence
                      if (typeof window !== 'undefined') {
                        (window as any).__useBlurStyle = newValue;
                      }
                      // Dispatch event to update all components
                      window.dispatchEvent(new CustomEvent('blur-style-change', {
                        detail: { useBlurStyle: newValue }
                      }));
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors border ${
                      useBlurStyle
                        ? 'bg-white/10 border-white/20 hover:bg-white/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${useWhiteText ? 'text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    <span>Transparent Blur</span>
                    <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                      useBlurStyle ? 'bg-gray-900' : 'bg-gray-300'
                    }`}>
                      <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${
                        useBlurStyle ? 'translate-x-3.5' : 'translate-x-0'
                      }`} />
                    </div>
                  </button>
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

