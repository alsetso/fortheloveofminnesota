'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, CubeIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { MAP_CONFIG } from '@/features/map/config';
import { mapStylePreloader } from '@/features/map/services/mapStylePreloader';

type MapStyle = 'streets' | 'satellite';

interface MapStylesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  map?: any;
  timeFilter?: '24h' | '7d' | 'all';
  onTimeFilterChange?: (filter: '24h' | '7d' | 'all') => void;
  account?: any;
  onUpgrade?: (feature?: string) => void;
  onProToast?: (feature?: string) => void;
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
  stateBoundaryState?: {
    showStateBoundary: boolean;
    setShowStateBoundary: (show: boolean) => void;
  };
  countyBoundariesState?: {
    showCountyBoundaries: boolean;
    setShowCountyBoundaries: (show: boolean) => void;
  };
}

/**
 * Slide-up popup for map styles/layers selection
 * Appears from the bottom of the screen, positioned in front of mobile nav (z-[60])
 */
export default function MapStylesPopup({ isOpen, onClose, map, timeFilter = '24h', onTimeFilterChange, account, onUpgrade, onProToast, districtsState, buildingsState, ctuState, stateBoundaryState, countyBoundariesState }: MapStylesPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [selectedStyle, setSelectedStyle] = useState<MapStyle>('streets');
  const [mounted, setMounted] = useState(false);
  
  // Accordion state
  const [isStateResourcesOpen, setIsStateResourcesOpen] = useState(false);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isUIStyleOpen, setIsUIStyleOpen] = useState(false);
  
  // 3D controls state
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
            {/* Time Filter - At the top */}
            {onTimeFilterChange && (
              <div>
                <div className={`text-xs font-semibold mb-2 ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>Time Filter</div>
                <div className={`flex gap-1 rounded-md px-1 py-1 items-center transition-all ${
                  useBlurStyle 
                    ? 'bg-white/10 border border-white/20' 
                    : 'bg-white border border-gray-200'
                }`}>
                  <button
                    onClick={() => {
                      onTimeFilterChange('24h');
                      window.dispatchEvent(new CustomEvent('mention-time-filter-change', {
                        detail: { timeFilter: '24h' }
                      }));
                    }}
                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center ${
                      timeFilter === '24h'
                        ? useWhiteText ? 'text-white bg-white/20' : 'text-gray-900 bg-gray-100'
                        : useWhiteText ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    24h
                  </button>
                  <button
                    onClick={() => {
                      onTimeFilterChange('7d');
                      window.dispatchEvent(new CustomEvent('mention-time-filter-change', {
                        detail: { timeFilter: '7d' }
                      }));
                    }}
                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center ${
                      timeFilter === '7d'
                        ? useWhiteText ? 'text-white bg-white/20' : 'text-gray-900 bg-gray-100'
                        : useWhiteText ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    7d
                  </button>
                  <button
                    onClick={() => {
                      const isPro = account?.plan === 'pro' || account?.plan === 'plus';
                      if (!isPro && onUpgrade) {
                        onUpgrade('All Time Filter');
                        return;
                      }
                      if (onProToast) {
                        onProToast('All time filter');
                      }
                      onTimeFilterChange('all');
                      window.dispatchEvent(new CustomEvent('mention-time-filter-change', {
                        detail: { timeFilter: 'all' }
                      }));
                    }}
                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center ${
                      timeFilter === 'all'
                        ? useWhiteText ? 'text-white bg-white/20' : 'text-gray-900 bg-gray-100'
                        : useWhiteText ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    All time
                  </button>
                </div>
              </div>
            )}

            {/* 3D View Controls */}
            <div>
              <div className={`text-xs font-semibold mb-2 ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>3D View</div>
              <div className={`flex gap-1 rounded-md px-1 py-1 items-center transition-all ${
                useBlurStyle 
                  ? 'bg-white/10 border border-white/20' 
                  : 'bg-white border border-gray-200'
              }`}>
                <button
                  onClick={() => setPitchValue(0)}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center ${
                    pitch === 0
                      ? useWhiteText ? 'text-white bg-white/20' : 'text-gray-900 bg-gray-100'
                      : useWhiteText ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  0°
                </button>
                <button
                  onClick={() => setPitchValue(30)}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center ${
                    Math.round(pitch) === 30
                      ? useWhiteText ? 'text-white bg-white/20' : 'text-gray-900 bg-gray-100'
                      : useWhiteText ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  30°
                </button>
                <button
                  onClick={() => setPitchValue(60)}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center ${
                    Math.round(pitch) === 60
                      ? useWhiteText ? 'text-white bg-white/20' : 'text-gray-900 bg-gray-100'
                      : useWhiteText ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  60°
                </button>
              </div>
            </div>

              {/* State Resources Section - Accordion */}
              {buildingsState && (
                <div>
                  <button
                    onClick={() => setIsStateResourcesOpen(!isStateResourcesOpen)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors border ${
                      useBlurStyle
                        ? 'bg-white/10 border-white/20 hover:bg-white/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${useWhiteText ? 'text-white' : 'text-gray-900'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">State Resources</span>
                      <span className={`text-[10px] ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>(1)</span>
                    </div>
                    {isStateResourcesOpen ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                  </button>
                  {isStateResourcesOpen && (
                    <div className="mt-1.5 space-y-1.5 pl-2">
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
                </div>
              )}

              {/* Layers Section - Accordion */}
              {(districtsState || ctuState || stateBoundaryState || countyBoundariesState) && (
                <div>
                  <button
                    onClick={() => setIsLayersOpen(!isLayersOpen)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors border ${
                      useBlurStyle
                        ? 'bg-white/10 border-white/20 hover:bg-white/20'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    } ${useWhiteText ? 'text-white' : 'text-gray-900'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Layers</span>
                      <span className={`text-[10px] ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                        ({[
                          districtsState,
                          ctuState,
                          stateBoundaryState,
                          countyBoundariesState,
                          true, // Water
                          true, // Roads
                          true, // Parcels
                        ].filter(Boolean).length})
                      </span>
                    </div>
                    {isLayersOpen ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                  </button>
                  {isLayersOpen && (
                    <div className="mt-1 space-y-1 pl-2">
                      {/* Congressional Districts */}
                      {districtsState && (
                        <button
                          onClick={() => {
                            districtsState.setShowDistricts(!districtsState.showDistricts);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors border ${
                            useBlurStyle
                              ? 'bg-white/10 border-white/20 hover:bg-white/20'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          } ${useWhiteText ? 'text-white' : 'text-gray-900'}`}
                        >
                          <div className="flex flex-col items-start text-left gap-0.5">
                            <span className="text-left leading-tight">Congressional Districts</span>
                            <a
                              href="https://www.sos.mn.gov/election-administration-campaigns/data-maps/geojson-files/"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                                useWhiteText ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                              }`}
                              aria-label="View Congressional Districts dataset"
                            >
                              6.1 MB
                            </a>
                          </div>
                          <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                            districtsState.showDistricts ? 'bg-gray-900' : 'bg-gray-300'
                          }`}>
                            <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${
                              districtsState.showDistricts ? 'translate-x-3.5' : 'translate-x-0'
                            }`} />
                          </div>
                        </button>
                      )}

                      {/* CTU Boundaries */}
                      {ctuState && (
                        <button
                          onClick={() => {
                            ctuState.setShowCTU(!ctuState.showCTU);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors border ${
                            useBlurStyle
                              ? 'bg-white/10 border-white/20 hover:bg-white/20'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          } ${useWhiteText ? 'text-white' : 'text-gray-900'}`}
                        >
                          <div className="flex flex-col items-start text-left gap-0.5">
                            <span className="text-left leading-tight">CTU Boundaries</span>
                            <a
                              href="https://gisdata.mn.gov/dataset/bdry-mn-city-township-unorg"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                                useWhiteText ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                              }`}
                              aria-label="View CTU Boundaries dataset"
                            >
                              4.0 KB
                            </a>
                          </div>
                          <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                            ctuState.showCTU ? 'bg-gray-900' : 'bg-gray-300'
                          }`}>
                            <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${
                              ctuState.showCTU ? 'translate-x-3.5' : 'translate-x-0'
                            }`} />
                          </div>
                        </button>
                      )}

                      {/* County Boundaries */}
                      {countyBoundariesState && (
                        <button
                          onClick={() => {
                            countyBoundariesState.setShowCountyBoundaries(!countyBoundariesState.showCountyBoundaries);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors border ${
                            useBlurStyle
                              ? 'bg-white/10 border-white/20 hover:bg-white/20'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          } ${useWhiteText ? 'text-white' : 'text-gray-900'}`}
                        >
                          <div className="flex flex-col items-start text-left gap-0.5">
                            <span className="text-left leading-tight">County Boundaries</span>
                            <a
                              href="https://gisdata.mn.gov/dataset/bdry-counties-in-minnesota"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                                useWhiteText ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                              }`}
                              aria-label="View County Boundaries dataset"
                            >
                              5.4 MB
                            </a>
                          </div>
                          <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                            countyBoundariesState.showCountyBoundaries ? 'bg-gray-900' : 'bg-gray-300'
                          }`}>
                            <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${
                              countyBoundariesState.showCountyBoundaries ? 'translate-x-3.5' : 'translate-x-0'
                            }`} />
                          </div>
                        </button>
                      )}

                      {/* State Boundary */}
                      {stateBoundaryState && (
                        <button
                          onClick={() => {
                            stateBoundaryState.setShowStateBoundary(!stateBoundaryState.showStateBoundary);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors border ${
                            useBlurStyle
                              ? 'bg-white/10 border-white/20 hover:bg-white/20'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          } ${useWhiteText ? 'text-white' : 'text-gray-900'}`}
                        >
                          <div className="flex flex-col items-start text-left gap-0.5">
                            <span className="text-left leading-tight">State Boundary</span>
                            <a
                              href="https://gisdata.mn.gov/dataset/bdry-state-of-minnesota"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                                useWhiteText ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                              }`}
                              aria-label="View State Boundary dataset"
                            >
                              4.7 MB
                            </a>
                          </div>
                          <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                            stateBoundaryState.showStateBoundary ? 'bg-gray-900' : 'bg-gray-300'
                          }`}>
                            <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${
                              stateBoundaryState.showStateBoundary ? 'translate-x-3.5' : 'translate-x-0'
                            }`} />
                          </div>
                        </button>
                      )}

                      {/* Divider between active and coming soon layers */}
                      <div className={`border-t ${useBlurStyle ? 'border-white/10' : 'border-gray-200'} my-1`} />
                      <div className={`text-[10px] font-medium ${useWhiteText ? 'text-white/50' : 'text-gray-400'} px-2 pb-0.5`}>
                        Coming Soon
                      </div>

                      {/* Water (National Hydrography Data) - Coming Soon */}
                      <div
                        className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs border ${
                          useBlurStyle
                            ? 'bg-white/5 border-white/10'
                            : 'bg-gray-50 border-gray-200'
                        } ${useWhiteText ? 'text-gray-400' : 'text-gray-500'} cursor-not-allowed opacity-60`}
                      >
                        <div className="flex flex-col items-start text-left gap-0.5">
                          <span className="text-left leading-tight">Water</span>
                          <a
                            href="https://gisdata.mn.gov/dataset/water-national-hydrography-data"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                              useWhiteText ? 'text-white/40 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'
                            }`}
                            aria-label="View Water dataset"
                          >
                            1.8 GB
                          </a>
                        </div>
                        <div className="w-7 h-3.5 rounded-full bg-gray-200 relative">
                          <div className="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full" />
                        </div>
                      </div>

                      {/* Roads (Route Centerlines) - Coming Soon */}
                      <div
                        className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs border ${
                          useBlurStyle
                            ? 'bg-white/5 border-white/10'
                            : 'bg-gray-50 border-gray-200'
                        } ${useWhiteText ? 'text-gray-400' : 'text-gray-500'} cursor-not-allowed opacity-60`}
                      >
                        <div className="flex flex-col items-start text-left gap-0.5">
                          <span className="text-left leading-tight">Roads</span>
                          <a
                            href="https://gisdata.mn.gov/dataset/trans-roads-centerlines"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                              useWhiteText ? 'text-white/40 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'
                            }`}
                            aria-label="View Roads dataset"
                          >
                            530 MB
                          </a>
                        </div>
                        <div className="w-7 h-3.5 rounded-full bg-gray-200 relative">
                          <div className="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full" />
                        </div>
                      </div>

                      {/* Parcels - Coming Soon */}
                      <div
                        className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs border ${
                          useBlurStyle
                            ? 'bg-white/5 border-white/10'
                            : 'bg-gray-50 border-gray-200'
                        } ${useWhiteText ? 'text-gray-400' : 'text-gray-500'} cursor-not-allowed opacity-60`}
                      >
                        <div className="flex flex-col items-start text-left gap-0.5">
                          <span className="text-left leading-tight">Parcels</span>
                          <a
                            href="https://gisdata.mn.gov/dataset/plan-parcels-open"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                              useWhiteText ? 'text-white/40 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'
                            }`}
                            aria-label="View Parcels dataset"
                          >
                            2.3 GB
                          </a>
                        </div>
                        <div className="w-7 h-3.5 rounded-full bg-gray-200 relative">
                          <div className="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* UI Style Section - Accordion */}
              <div>
                <button
                  onClick={() => setIsUIStyleOpen(!isUIStyleOpen)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors border ${
                    useBlurStyle
                      ? 'bg-white/10 border-white/20 hover:bg-white/20'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  } ${useWhiteText ? 'text-white' : 'text-gray-900'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">UI Style</span>
                    <span className={`text-[10px] ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>(2)</span>
                  </div>
                  {isUIStyleOpen ? (
                    <ChevronUpIcon className="w-4 h-4" />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4" />
                  )}
                </button>
                {isUIStyleOpen && (
                  <div className="mt-1.5 space-y-1.5 pl-2">
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
                )}
              </div>
          </div>
        </div>
      </div>
    </>
  );

  // Render to document body to escape parent stacking context
  return createPortal(popupContent, document.body);
}

