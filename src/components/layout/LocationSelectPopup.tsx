'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { XMarkIcon, MapPinIcon, CheckCircleIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import { supabase } from '@/lib/supabase';

interface LocationSelectPopupProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  address: string | null;
  mapMeta?: Record<string, any> | null;
  mentionTypeId?: string | null;
  mentionTypeName?: string | null;
  onAddToMap?: (coordinates: { lat: number; lng: number }, mapMeta?: Record<string, any> | null, mentionTypeId?: string | null) => void;
}

/**
 * Simple popup that appears when user clicks on map
 * Shows address, coordinates, and "Add to map" button
 * Navigates to /add page with lat/lng parameters
 */
export default function LocationSelectPopup({
  isOpen,
  onClose,
  lat,
  lng,
  address,
  mapMeta,
  mentionTypeId: propMentionTypeId,
  mentionTypeName: propMentionTypeName,
  onAddToMap,
}: LocationSelectPopupProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const popupRef = useRef<HTMLDivElement>(null);
  const [selectedMentionTypeId, setSelectedMentionTypeId] = useState<string | null>(null);
  const [selectedMentionType, setSelectedMentionType] = useState<{ name: string; emoji: string } | null>(null);
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });

  // Listen for blur style and map style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    const handleMapStyleChange = (e: CustomEvent) => {
      setCurrentMapStyle(e.detail.mapStyle);
    };
    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
    };
  }, []);

  const useWhiteText = useBlurStyle && currentMapStyle === 'satellite';
  const useTransparentUI = useBlurStyle && currentMapStyle === 'satellite';
  const [addressCopied, setAddressCopied] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<Array<{ id: string; description: string | null; mention_type: { emoji: string; name: string } | null; distance: number }>>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when popup is open
      document.body.style.overflow = 'hidden';
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        if (popupRef.current) {
          popupRef.current.style.transform = 'translate(-50%, 0)';
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

  // Fetch nearby places when popup opens
  useEffect(() => {
    if (!isOpen || !lat || !lng) {
      setNearbyPlaces([]);
      return;
    }

    const fetchNearbyPlaces = async () => {
      setLoadingNearby(true);
      try {
        // Fetch places within 25 miles (40 km)
        const radiusKm = 40; // 25 miles ≈ 40 km
        const response = await fetch(
          `/api/mentions/nearby?lat=${lat}&lng=${lng}&radius=${radiusKm}`
        );

        if (!response.ok) {
          // Silently fail - don't show error, just don't display nearby places
          setNearbyPlaces([]);
          return;
        }

        const data = await response.json();
        const mentions = data.mentions || [];

        if (!mentions || mentions.length === 0) {
          setNearbyPlaces([]);
          return;
        }

        // Convert distance from degrees to miles
        // The API returns distance in degrees (Euclidean distance)
        // For Minnesota (~45°N): 1 degree lat ≈ 69 miles
        const mentionsWithMiles = mentions.map((mention: any) => {
          const distanceDegrees = mention.distance || 0;
          const distanceMiles = distanceDegrees * 69; // Convert degrees to miles
          return {
            id: mention.id,
            description: mention.description,
            mention_type: mention.mention_type || null,
            distance: distanceMiles,
          };
        });

        // Show only the 3 closest places
        setNearbyPlaces(mentionsWithMiles.slice(0, 3));
      } catch (err) {
        // Silently fail - don't show error
        console.error('Error fetching nearby places:', err);
        setNearbyPlaces([]);
      } finally {
        setLoadingNearby(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchNearbyPlaces();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [isOpen, lat, lng]);

  // Fetch selected mention type from URL parameters or props (props take priority)
  useEffect(() => {
    // If mention type is passed via props (from custom mention button), use it
    if (propMentionTypeId) {
      const fetchPropMentionType = async () => {
        const { data: allTypes } = await supabase
          .from('mention_types')
          .select('id, name, emoji')
          .eq('is_active', true);
        
        if (allTypes) {
          const matchingType = allTypes.find(type => type.id === propMentionTypeId);
          
          if (matchingType) {
            setSelectedMentionTypeId(matchingType.id);
            setSelectedMentionType({ name: matchingType.name, emoji: matchingType.emoji });
          }
        }
      };
      
      fetchPropMentionType();
      return;
    }
    
    // Otherwise, check URL parameters
    const typeParam = searchParams.get('type');
    const typesParam = searchParams.get('types');
    
    // Only use single type selection, not multiple
    if (typesParam) {
      setSelectedMentionTypeId(null);
      setSelectedMentionType(null);
      return;
    }
    
    if (typeParam) {
      const fetchMentionType = async () => {
        const { data: allTypes } = await supabase
          .from('mention_types')
          .select('id, name, emoji')
          .eq('is_active', true);
        
        if (allTypes) {
          const matchingType = allTypes.find(type => {
            const typeSlug = mentionTypeNameToSlug(type.name);
            return typeSlug === typeParam;
          });
          
          if (matchingType) {
            setSelectedMentionTypeId(matchingType.id);
            setSelectedMentionType({ name: matchingType.name, emoji: matchingType.emoji });
          } else {
            setSelectedMentionTypeId(null);
            setSelectedMentionType(null);
          }
        } else {
          setSelectedMentionTypeId(null);
          setSelectedMentionType(null);
        }
      };
      
      fetchMentionType();
    } else {
      setSelectedMentionTypeId(null);
      setSelectedMentionType(null);
    }
  }, [searchParams, propMentionTypeId]);

  const handleClose = () => {
    if (popupRef.current) {
      popupRef.current.style.transform = 'translate(-50%, 100%)';
    }
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleAddToMap = () => {
    // Always navigate to /add page
    const params = new URLSearchParams();
    params.set('lat', lat.toString());
    params.set('lng', lng.toString());
    if (selectedMentionTypeId) {
      params.set('mention_type_id', selectedMentionTypeId);
    }
    router.push(`/add?${params.toString()}`);
    handleClose();
  };

  const handleCopyAddress = async () => {
    if (!address) return;
    
    try {
      await navigator.clipboard.writeText(address);
      setAddressCopied(true);
      setTimeout(() => {
        setAddressCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - hidden on desktop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300 xl:hidden"
        onClick={handleClose}
      />
      
      {/* Popup - iOS-style bottom sheet */}
      <div
        ref={popupRef}
        className={`fixed z-[60] shadow-2xl transition-all duration-300 ease-out flex flex-col
          bottom-0 left-1/2 -translate-x-1/2 rounded-t-3xl
          xl:rounded-t-lg xl:rounded-b-none xl:max-h-[50vh]
          ${useTransparentUI
            ? 'bg-transparent backdrop-blur-md border-t border-white/20'
            : useBlurStyle
            ? 'bg-transparent backdrop-blur-md'
            : 'bg-white'
          }`}
        style={{
          transform: 'translate(-50%, 100%)',
          maxWidth: '600px',
          width: 'calc(100% - 2rem)',
          minHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? 'auto' : 'auto',
          maxHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '50vh' : '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 border-b flex-shrink-0 ${
          useTransparentUI
            ? 'border-white/20'
            : useBlurStyle
            ? 'border-transparent'
            : 'border-gray-200'
        }`}>
          <h2 className={`text-sm font-semibold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
            Location Selected
          </h2>
          <button
            onClick={handleClose}
            className={`p-1 -mr-1 transition-colors ${
              useWhiteText
                ? 'text-white/80 hover:text-white'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto xl:overflow-y-auto p-4 space-y-4">
          {/* Map Metadata Label */}
          {mapMeta && mapMeta.feature && (() => {
            const feature = mapMeta.feature;
            const props = feature.properties || {};
            
            // Determine display label - prefer name, fallback to type/class/layerId
            let displayName = feature.name || 'Map Feature';
            if (!feature.name) {
              if (props.type) {
                displayName = String(props.type);
              } else if (props.class) {
                displayName = String(props.class).replace(/_/g, ' ');
              } else if (feature.layerId) {
                // Parse layerId for common patterns
                const layerId = feature.layerId.toLowerCase();
                if (layerId.includes('poi')) displayName = 'Point of Interest';
                else if (layerId.includes('building')) displayName = 'Building';
                else if (layerId.includes('road') || layerId.includes('highway')) displayName = 'Road';
                else if (layerId.includes('water')) displayName = 'Water';
                else if (layerId.includes('landuse')) displayName = 'Land Use';
                else if (layerId.includes('place')) displayName = 'Place';
                else displayName = feature.layerId.replace(/-/g, ' ').replace(/_/g, ' ');
              }
            }
            
            // Determine category label - prefer category, fallback to type/class
            let categoryLabel = feature.category && feature.category !== 'unknown' 
              ? feature.category.replace(/_/g, ' ')
              : null;
            
            if (!categoryLabel || categoryLabel === 'unknown') {
              if (props.type) {
                categoryLabel = String(props.type).replace(/_/g, ' ');
              } else if (props.class) {
                categoryLabel = String(props.class).replace(/_/g, ' ');
              } else if (feature.sourceLayer) {
                categoryLabel = feature.sourceLayer.replace(/_/g, ' ');
              } else if (feature.layerId) {
                const layerId = feature.layerId.toLowerCase();
                if (layerId.includes('poi')) categoryLabel = 'Point of Interest';
                else if (layerId.includes('building')) categoryLabel = 'Building';
                else if (layerId.includes('road') || layerId.includes('highway')) categoryLabel = 'Road';
                else if (layerId.includes('water')) categoryLabel = 'Water';
                else categoryLabel = feature.layerId.replace(/-/g, ' ').replace(/_/g, ' ');
              }
            }
            
            // Combine displayName and categoryLabel into single line
            const singleLineLabel = categoryLabel && categoryLabel !== displayName
              ? `${displayName} • ${categoryLabel}`
              : displayName;

            return (
              <div className={`p-2 border rounded-md space-y-1 ${
                useTransparentUI
                  ? 'bg-white/10 border-white/20'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                {/* Name/Type on top */}
                <div className="flex items-center gap-1.5">
                  {feature.icon && feature.icon !== '📍' && (
                    <span className="text-[10px] flex-shrink-0">{feature.icon}</span>
                  )}
                  <div className={`text-[10px] font-semibold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
                    {displayName}
                  </div>
                </div>
                {/* Shortened info text below */}
                <div className={`text-[10px] ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                  Map data included in mention for context.
                </div>
              </div>
            );
          })()}

          {/* Address - Clickable input to copy */}
          {address && (
            <div className="relative">
              <button
                onClick={handleCopyAddress}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left border rounded-md transition-all ${
                  useTransparentUI
                    ? 'bg-white/10 border-white/20 hover:bg-white/20'
                    : 'bg-gray-100 border-gray-300 hover:border-gray-400'
                } ${addressCopied ? 'border-green-500' : ''}`}
              >
                <MapPinIcon className={`w-4 h-4 flex-shrink-0 ${
                  useWhiteText ? 'text-white/60' : 'text-gray-400'
                }`} />
                <input
                  type="text"
                  value={address}
                  readOnly
                  className={`flex-1 min-w-0 text-xs font-medium bg-transparent border-none outline-none cursor-pointer ${
                    useWhiteText ? 'text-white' : 'text-gray-900'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyAddress();
                  }}
                />
                {addressCopied ? (
                  <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <DocumentDuplicateIcon className={`w-4 h-4 flex-shrink-0 ${
                    useWhiteText ? 'text-white/60' : 'text-gray-400'
                  }`} />
                )}
              </button>
            </div>
          )}

          {/* Coordinates */}
          <div className={`text-xs font-mono ${useWhiteText ? 'text-white/70' : 'text-gray-600'}`}>
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </div>

          {/* Add to Map Button */}
          <button
            onClick={handleAddToMap}
            className={`w-full px-4 py-3 text-sm font-medium rounded-md transition-colors border flex items-center justify-center gap-2 ${
              useTransparentUI
                ? 'text-white bg-white/10 border-white/30 hover:bg-white/20'
                : selectedMentionType
                ? 'text-gray-900 bg-white border-gray-300 hover:bg-gray-50'
                : 'text-gray-900 bg-white border-gray-300 hover:bg-gray-50'
            }`}
          >
            {selectedMentionType ? (
              <>
                <span className="text-base">{selectedMentionType.emoji}</span>
                <span>Add {selectedMentionType.name}</span>
              </>
            ) : (
              'Add to Map'
            )}
          </button>

          {/* Nearby Places - Show 3 closest */}
          {nearbyPlaces.length > 0 && (
            <div className="space-y-2">
              <h3 className={`text-xs font-semibold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
                Nearby Places
              </h3>
              <div className="space-y-1.5">
                {loadingNearby ? (
                  <div className={`text-xs ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                    Loading...
                  </div>
                ) : (
                  nearbyPlaces.map((place) => (
                    <div
                      key={place.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md border ${
                        useTransparentUI
                          ? 'bg-white/10 border-white/20'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      {place.mention_type && (
                        <span className="text-xs flex-shrink-0">{place.mention_type.emoji}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] font-medium truncate ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
                          {place.description || place.mention_type?.name || 'Place'}
                        </div>
                      </div>
                      <div className={`text-[10px] flex-shrink-0 ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                        {place.distance < 0.1 
                          ? `${(place.distance * 5280).toFixed(0)} ft`
                          : `${place.distance.toFixed(1)} mi`
                        }
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
