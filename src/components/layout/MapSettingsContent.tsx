'use client';

import { useEffect, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { MAP_CONFIG } from '@/features/map/config';
import { mapStylePreloader } from '@/features/map/services/mapStylePreloader';
import { useAuthStateSafe } from '@/features/auth';
import ProfileCard from '@/components/profile/ProfileCard';

type MapStyle = 'streets' | 'satellite';

interface MapSettingsContentProps {
  map?: any;
  timeFilter?: '24h' | '7d' | 'all';
  onTimeFilterChange?: (filter: '24h' | '7d' | 'all') => void;
  onUpgrade?: (feature?: string) => void;
  onProToast?: (feature?: string) => void;
  darkMode?: boolean; // New prop for dark mode styling
  districtsState?: {
    showDistricts: boolean;
    setShowDistricts: (show: boolean) => void;
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
 * Map Settings Content Component
 * Contains all map settings UI (time filter, 3D view, layers, UI style)
 * Designed for use in BottomButtonsPopup
 */
export default function MapSettingsContent({
  map,
  timeFilter = '7d',
  onTimeFilterChange,
  onUpgrade,
  onProToast,
  darkMode = false,
  districtsState,
  ctuState,
  stateBoundaryState,
  countyBoundariesState,
}: MapSettingsContentProps) {
  const { account } = useAuthStateSafe();
  const [selectedStyle, setSelectedStyle] = useState<MapStyle>('streets');
  const [pitch, setPitch] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [searchVisibility, setSearchVisibility] = useState<boolean>(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  
  // Accordion state
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isUIStyleOpen, setIsUIStyleOpen] = useState(false);

  // Initialize client-side values after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user's search visibility
  useEffect(() => {
    const fetchSearchVisibility = async () => {
      if (!account?.id) return;
      
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('accounts')
          .select('search_visibility')
          .eq('id', account.id)
          .single();
        
        if (!error && data) {
          setSearchVisibility(data.search_visibility || false);
        }
      } catch (error) {
        console.error('[MapSettingsContent] Error fetching search visibility:', error);
      }
    };
    
    if (account?.id) {
      fetchSearchVisibility();
    }
  }, [account?.id]);

  // Toggle search visibility
  const handleToggleSearchVisibility = async () => {
    if (!account?.id || isUpdatingVisibility) return;
    
    setIsUpdatingVisibility(true);
    const newValue = !searchVisibility;
    
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase
        .from('accounts')
        .update({ search_visibility: newValue })
        .eq('id', account.id);
      
      if (!error) {
        setSearchVisibility(newValue);
      } else {
        console.error('[MapSettingsContent] Error updating search visibility:', error);
      }
    } catch (error) {
      console.error('[MapSettingsContent] Error updating search visibility:', error);
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  // Detect current map style and 3D state
  useEffect(() => {
    if (!map) return;

    const mapboxMap = map as any;
    
    try {
      const currentStyle = mapboxMap.getStyle?.();
      if (currentStyle) {
        const styleUrl = typeof currentStyle === 'string' ? currentStyle : currentStyle.sprite;
        const detectedStyle = styleUrl?.includes('satellite') ? 'satellite' : 'streets';
        setSelectedStyle(detectedStyle);
        
        if (typeof window !== 'undefined') {
          (window as any).__currentMapStyle = detectedStyle;
        }
      }
    } catch (error) {
      console.debug('[MapSettingsContent] Error detecting current style:', error);
    }

    try {
      const currentPitch = mapboxMap.getPitch?.() || 0;
      setPitch(currentPitch);
    } catch (error) {
      console.debug('[MapSettingsContent] Error detecting 3D state:', error);
    }

    const handlePitch = () => {
      if (mapboxMap.getPitch) setPitch(mapboxMap.getPitch());
    };
    mapboxMap.on('pitch', handlePitch);

    mapStylePreloader.preloadAllStyles().catch((error) => {
      console.warn('[MapSettingsContent] Error preloading styles:', error);
    });

    return () => {
      mapboxMap.off('pitch', handlePitch);
    };
  }, [map]);

  const handleStyleChange = (style: MapStyle) => {
    if (!map) return;
    
    setSelectedStyle(style);
    const mapboxMap = map as any;
    
    try {
      window.dispatchEvent(new CustomEvent('mentions-layer-hidden'));
      mapboxMap.setStyle(MAP_CONFIG.STRATEGIC_STYLES[style]);
      
      if (typeof window !== 'undefined') {
        (window as any).__currentMapStyle = style;
        window.dispatchEvent(new CustomEvent('map-style-change', {
          detail: { mapStyle: style }
        }));
      }
    } catch (error) {
      console.error('[MapSettingsContent] Error changing map style:', error);
    }
  };

  const setPitchValue = (newPitch: number) => {
    if (!map) return;
    setPitch(newPitch);
    const mapboxMap = map as any;
    mapboxMap.easeTo({ pitch: newPitch, duration: 300 });
  };

  // Handle profile updates
  const handleSaveTraits = async (traits: string[]) => {
    if (!account?.id) return;
    
    const { supabase } = await import('@/lib/supabase');
    const { error } = await supabase
      .from('accounts')
      .update({ traits })
      .eq('id', account.id);
    
    if (error) {
      console.error('[MapSettingsContent] Error updating traits:', error);
      throw error;
    }
  };

  const handleSaveBio = async (bio: string) => {
    if (!account?.id) return;
    
    const { supabase } = await import('@/lib/supabase');
    const { error} = await supabase
      .from('accounts')
      .update({ bio })
      .eq('id', account.id);
    
    if (error) {
      console.error('[MapSettingsContent] Error updating bio:', error);
      throw error;
    }
  };

  const handleCoverImageClick = () => {
    // TODO: Implement cover image upload
    alert('Cover image upload coming soon!');
  };

  const handleProfileImageClick = () => {
    // TODO: Implement profile image upload
    alert('Profile image upload coming soon!');
  };

  return (
    <div className="space-y-3">
      {/* Profile Section */}
      {account && (
        <ProfileCard
          account={account}
          darkMode={darkMode}
          searchVisibility={searchVisibility}
          isUpdatingVisibility={isUpdatingVisibility}
          onToggleSearchVisibility={handleToggleSearchVisibility}
          onSaveTraits={handleSaveTraits}
          onSaveBio={handleSaveBio}
          onCoverImageClick={handleCoverImageClick}
          onProfileImageClick={handleProfileImageClick}
          showViewButton={true}
          showSearchToggle={true}
        />
      )}

      {/* Time Filter */}
      {onTimeFilterChange && (
        <div>
          <div className={`text-xs font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Time Filter</div>
          <div className={`flex gap-1 rounded-md px-1 py-1 items-center transition-all border ${
            darkMode
              ? 'bg-white/10 border-white/20'
              : 'bg-white border-gray-200'
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
                  ? 'text-gray-900 bg-gray-100'
                  : 'text-gray-500 hover:text-gray-700'
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
                  ? 'text-gray-900 bg-gray-100'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              7d
            </button>
            <button
              onClick={() => {
                const isPro = account?.plan === 'contributor' || account?.plan === 'plus';
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
                  ? 'text-gray-900 bg-gray-100'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All time
            </button>
          </div>
        </div>
      )}

      {/* 3D View Controls */}
      <div>
        <div className={`text-xs font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>3D View</div>
        <div className={`flex gap-1 rounded-md px-1 py-1 items-center transition-all border ${
          darkMode
            ? 'bg-white/10 border-white/20'
            : 'bg-white border-gray-200'
        }`}>
          <button
            onClick={() => setPitchValue(0)}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center ${
              pitch === 0
                ? darkMode ? 'text-white bg-white/20' : 'text-gray-900 bg-gray-100'
                : darkMode ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            0°
          </button>
          <button
            onClick={() => setPitchValue(30)}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center ${
              Math.round(pitch) === 30
                ? darkMode ? 'text-white bg-white/20' : 'text-gray-900 bg-gray-100'
                : darkMode ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            30°
          </button>
          <button
            onClick={() => setPitchValue(60)}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center ${
              Math.round(pitch) === 60
                ? darkMode ? 'text-white bg-white/20' : 'text-gray-900 bg-gray-100'
                : darkMode ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            60°
          </button>
        </div>
      </div>

      {/* Layers Section - Accordion */}
      {(districtsState || ctuState || stateBoundaryState || countyBoundariesState) && (
        <div>
          <button
            onClick={() => setIsLayersOpen(!isLayersOpen)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors border ${
              darkMode
                ? 'bg-white/10 border-white/20 hover:bg-white/20 text-white'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold">Layers</span>
              <span className={`text-[10px] ${darkMode ? 'text-white/50' : 'text-gray-500'}`}>
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
                    darkMode
                      ? 'bg-white/10 border-white/20 hover:bg-white/20 text-white'
                      : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <div className="flex flex-col items-start text-left gap-0.5">
                    <span className="text-left leading-tight">Congressional Districts</span>
                    <a
                      href="https://www.sos.mn.gov/election-administration-campaigns/data-maps/geojson-files/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                        darkMode
                          ? 'text-white/50 hover:text-white/70'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      6.1 MB
                    </a>
                  </div>
                  <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                    districtsState.showDistricts
                      ? 'bg-white'
                      : darkMode ? 'bg-white/30' : 'bg-gray-300'
                  }`}>
                    <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-transform ${
                      districtsState.showDistricts ? 'bg-black' : 'bg-white'
                    } ${
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
                    darkMode
                      ? 'bg-white/10 border-white/20 hover:bg-white/20 text-white'
                      : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <div className="flex flex-col items-start text-left gap-0.5">
                    <span className="text-left leading-tight">CTU Boundaries</span>
                    <a
                      href="https://gisdata.mn.gov/dataset/bdry-mn-city-township-unorg"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                        darkMode
                          ? 'text-white/50 hover:text-white/70'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      4.0 KB
                    </a>
                  </div>
                  <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                    ctuState.showCTU
                      ? 'bg-white'
                      : darkMode ? 'bg-white/30' : 'bg-gray-300'
                  }`}>
                    <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-transform ${
                      ctuState.showCTU ? 'bg-black' : 'bg-white'
                    } ${
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
                    darkMode
                      ? 'bg-white/10 border-white/20 hover:bg-white/20 text-white'
                      : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <div className="flex flex-col items-start text-left gap-0.5">
                    <span className="text-left leading-tight">County Boundaries</span>
                    <a
                      href="https://gisdata.mn.gov/dataset/bdry-counties-in-minnesota"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                        darkMode
                          ? 'text-white/50 hover:text-white/70'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      5.4 MB
                    </a>
                  </div>
                  <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                    countyBoundariesState.showCountyBoundaries
                      ? 'bg-white'
                      : darkMode ? 'bg-white/30' : 'bg-gray-300'
                  }`}>
                    <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-transform ${
                      countyBoundariesState.showCountyBoundaries ? 'bg-black' : 'bg-white'
                    } ${
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
                    darkMode
                      ? 'bg-white/10 border-white/20 hover:bg-white/20 text-white'
                      : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <div className="flex flex-col items-start text-left gap-0.5">
                    <span className="text-left leading-tight">State Boundary</span>
                    <a
                      href="https://gisdata.mn.gov/dataset/bdry-state-of-minnesota"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                        darkMode
                          ? 'text-white/50 hover:text-white/70'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      4.7 MB
                    </a>
                  </div>
                  <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                    stateBoundaryState.showStateBoundary
                      ? 'bg-white'
                      : darkMode ? 'bg-white/30' : 'bg-gray-300'
                  }`}>
                    <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-transform ${
                      stateBoundaryState.showStateBoundary ? 'bg-black' : 'bg-white'
                    } ${
                      stateBoundaryState.showStateBoundary ? 'translate-x-3.5' : 'translate-x-0'
                    }`} />
                  </div>
                </button>
              )}

              {/* Divider */}
              <div className={`border-t my-1 ${darkMode ? 'border-white/20' : 'border-gray-200'}`} />
              <div className={`text-[10px] font-medium px-2 pb-0.5 ${darkMode ? 'text-white/40' : 'text-gray-400'}`}>
                Coming Soon
              </div>

              {/* Water - Coming Soon */}
              <div className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs border cursor-not-allowed opacity-60 ${
                darkMode
                  ? 'bg-white/5 border-white/10 text-white/50'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}>
                <div className="flex flex-col items-start text-left gap-0.5">
                  <span className="text-left leading-tight">Water</span>
                  <a
                    href="https://gisdata.mn.gov/dataset/water-national-hydrography-data"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                      darkMode
                        ? 'text-white/40 hover:text-white/60'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    1.8 GB
                  </a>
                </div>
                <div className={`w-7 h-3.5 rounded-full relative ${darkMode ? 'bg-white/20' : 'bg-gray-200'}`}>
                  <div className="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full" />
                </div>
              </div>

              {/* Roads - Coming Soon */}
              <div className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs border cursor-not-allowed opacity-60 ${
                darkMode
                  ? 'bg-white/5 border-white/10 text-white/50'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}>
                <div className="flex flex-col items-start text-left gap-0.5">
                  <span className="text-left leading-tight">Roads</span>
                  <a
                    href="https://gisdata.mn.gov/dataset/trans-roads-centerlines"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                      darkMode
                        ? 'text-white/40 hover:text-white/60'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    530 MB
                  </a>
                </div>
                <div className={`w-7 h-3.5 rounded-full relative ${darkMode ? 'bg-white/20' : 'bg-gray-200'}`}>
                  <div className="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full" />
                </div>
              </div>

              {/* Parcels - Coming Soon */}
              <div className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs border cursor-not-allowed opacity-60 ${
                darkMode
                  ? 'bg-white/5 border-white/10 text-white/50'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}>
                <div className="flex flex-col items-start text-left gap-0.5">
                  <span className="text-left leading-tight">Parcels</span>
                  <a
                    href="https://gisdata.mn.gov/dataset/plan-parcels-open"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`text-[10px] underline transition-colors text-left hover:font-medium ${
                      darkMode
                        ? 'text-white/40 hover:text-white/60'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    2.3 GB
                  </a>
                </div>
                <div className={`w-7 h-3.5 rounded-full relative ${darkMode ? 'bg-white/20' : 'bg-gray-200'}`}>
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
            darkMode
              ? 'bg-white/10 border-white/20 hover:bg-white/20 text-white'
              : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">UI Style</span>
            <span className={`text-[10px] ${darkMode ? 'text-white/50' : 'text-gray-500'}`}>(1)</span>
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
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  const newStyle = selectedStyle === 'satellite' ? 'streets' : 'satellite';
                  handleStyleChange(newStyle);
                }}
                className={`flex-1 flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors border ${
                  selectedStyle === 'satellite'
                    ? darkMode
                      ? 'bg-white/20 border-white/20 text-white'
                      : 'bg-gray-100 border-gray-200 text-gray-900'
                    : darkMode
                      ? 'bg-white/10 border-white/20 hover:bg-white/20 text-white'
                      : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900'
                }`}
              >
                <span>Satellite</span>
                <div className={`w-7 h-3.5 rounded-full transition-colors relative ${
                  selectedStyle === 'satellite'
                    ? 'bg-white'
                    : darkMode ? 'bg-white/30' : 'bg-gray-300'
                }`}>
                  <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-transform ${
                    selectedStyle === 'satellite' ? 'bg-black' : 'bg-white'
                  } ${
                    selectedStyle === 'satellite' ? 'translate-x-3.5' : 'translate-x-0'
                  }`} />
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('reload-mentions'));
                }}
                className={`text-xs underline transition-colors whitespace-nowrap ${
                  darkMode
                    ? 'text-white/60 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Reload mentions
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
