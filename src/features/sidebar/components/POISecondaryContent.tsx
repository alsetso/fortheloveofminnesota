'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { POIService, type PointOfInterest, type CreatePOIData } from '@/features/poi/services/poiService';
import { useFeatureTracking } from '@/features/map-metadata/hooks/useFeatureTracking';
import { useAuthStateSafe } from '@/features/auth';
import { CheckIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon, MapPinIcon } from '@heroicons/react/24/outline';
import type { ExtractedFeature } from '@/features/map-metadata/services/featureService';
import { queryFeatureAtPoint } from '@/features/map-metadata/services/featureService';
import { getFeatureCenter } from '@/features/poi/utils/featureGeometry';
import { isFeatureBlocked } from '@/features/poi/config/poiFilters';
import { getPOIEmoji } from '@/features/poi/utils/getPOIEmoji';
import { useDraftPOIs } from '@/features/poi/contexts/DraftPOIsContext';

interface POISecondaryContentProps {
  map?: MapboxMapInstance | null;
  mapLoaded?: boolean;
}

interface DraftPOI {
  id: string;
  lat: number;
  lng: number;
  name: string;
  emoji?: string;
  category?: string;
  feature: ExtractedFeature;
  rawFeature?: any;
}

interface FilterConfig {
  categories: Set<string>;
  namedOnly: boolean;
  usefulDataOnly: boolean;
}

// Pure function: determine if feature should create draft
const shouldCreateDraft = (feature: ExtractedFeature, filters: FilterConfig): boolean => {
  if (isFeatureBlocked(feature.category, feature.properties.type, feature.layerId)) return false;
  if (filters.categories.size > 0 && !filters.categories.has(feature.category)) return false;
  if (filters.namedOnly && !feature.name) return false;
  if (filters.usefulDataOnly && !feature.hasUsefulData) return false;
  return true;
};

// Pure function: create draft from feature
const createDraftFromFeature = (
  feature: ExtractedFeature,
  coordinates: { lat: number; lng: number },
  rawFeature?: any
): DraftPOI => ({
  id: `draft-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  lat: coordinates.lat,
  lng: coordinates.lng,
  name: feature.name || feature.displayLabel || 'Unnamed POI',
  emoji: feature.icon || undefined,
  category: feature.category,
  feature,
  rawFeature,
});

// Pure function: dedupe drafts by name+category
const dedupeDrafts = (drafts: DraftPOI[]): DraftPOI[] => {
  const seen = new Set<string>();
  return drafts.filter(draft => {
    const key = `${(draft.name || '').toLowerCase().trim()}-${draft.category || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function POISecondaryContent({ map, mapLoaded = false }: POISecondaryContentProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isHomepage = pathname === '/';
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingPOI, setIsCreatingPOI] = useState(false);
  const [hoverCoordinates, setHoverCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const hoverCoordinatesRef = useRef<{ lat: number; lng: number } | null>(null);
  const { user, account } = useAuthStateSafe();
  
  const { hoverFeature } = useFeatureTracking(map, mapLoaded, { throttleMs: 50 });
  
  const { setDraftPOIs: setContextDraftPOIs } = useDraftPOIs();
  const [draftPOIs, setDraftPOIs] = useState<DraftPOI[]>([]);
  const draftPOIsRef = useRef<DraftPOI[]>([]);
  const lastFeatureIdRef = useRef<string | null>(null);
  
  const [showDraftPOIs, setShowDraftPOIs] = useState(true);
  const [showActivePOIs, setShowActivePOIs] = useState(true);
  const [expandedDrafts, setExpandedDrafts] = useState<Set<string>>(new Set());
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  
  const [filters, setFilters] = useState<FilterConfig>({
    categories: new Set(),
    namedOnly: false,
    usefulDataOnly: true,
  });
  
  // Sync draft POIs with context for map rendering
  useEffect(() => {
    draftPOIsRef.current = draftPOIs;
    setContextDraftPOIs(draftPOIs.map(d => ({
      id: d.id,
      lat: d.lat,
      lng: d.lng,
      name: d.name,
      emoji: d.emoji,
      category: d.category,
    })));
  }, [draftPOIs, setContextDraftPOIs]);
  
  // Track mouse position
  useEffect(() => {
    if (!map || !mapLoaded) return;
    const handleMouseMove = (e: any) => {
      const { lng, lat } = e.lngLat;
      hoverCoordinatesRef.current = { lat, lng };
      setHoverCoordinates({ lat, lng });
    };
    map.on('mousemove', handleMouseMove);
    return () => {
      if (map && !map.removed) {
        map.off('mousemove', handleMouseMove);
      }
    };
  }, [map, mapLoaded]);
  
  // Hover → draft creation (pure filter logic)
  useEffect(() => {
    if (!hoverFeature || !hoverCoordinates || !map) return;
    
    const featureId = `${hoverFeature.layerId}-${hoverFeature.name || 'unnamed'}-${hoverCoordinates.lat.toFixed(4)}-${hoverCoordinates.lng.toFixed(4)}`;
    if (lastFeatureIdRef.current === featureId) return;
    lastFeatureIdRef.current = featureId;
    
    if (!shouldCreateDraft(hoverFeature, filters)) return;
    
    // Get raw feature for geometry
    let rawFeature: any = null;
    let featureCenter = hoverCoordinates;
    try {
      const point = (map as any).project([hoverCoordinates.lng, hoverCoordinates.lat]);
      const result = (queryFeatureAtPoint as any)(map, point, 'labels-first', true, false);
      if (result?.rawFeature) {
        rawFeature = result.rawFeature;
        const center = getFeatureCenter(rawFeature, hoverCoordinates);
        if (center) featureCenter = center;
      }
    } catch (error) {
      console.debug('[POISecondaryContent] Could not query raw feature');
    }
    
    // Check for duplicate
    const existingDraft = draftPOIsRef.current.find(d => {
      const draftName = (d.name || d.feature.displayLabel || 'Unnamed POI').toLowerCase().trim();
      const featureName = (hoverFeature.name || hoverFeature.displayLabel || 'Unnamed POI').toLowerCase().trim();
      return draftName === featureName && d.category === hoverFeature.category;
    });
    
    if (!existingDraft) {
      const draft = createDraftFromFeature(hoverFeature, featureCenter, rawFeature);
      setDraftPOIs(prev => dedupeDrafts([draft, ...prev]).slice(0, 100));
    }
  }, [hoverFeature, hoverCoordinates, map, filters]);

  // Load active POIs
  useEffect(() => {
    const loadPOIs = async () => {
      setIsLoading(true);
      try {
        const fetchedPOIs = await POIService.getPOIs();
        setPois(fetchedPOIs);
      } catch (error) {
        console.error('[POISecondaryContent] Error loading POIs:', error);
        setPois([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadPOIs();
    const handlePOICreated = async () => {
      try {
        const fetchedPOIs = await POIService.getPOIs();
        setPois(fetchedPOIs);
      } catch (error) {
        console.error('[POISecondaryContent] Error refreshing POIs:', error);
      }
    };
    window.addEventListener('poi-created', handlePOICreated);
    return () => window.removeEventListener('poi-created', handlePOICreated);
  }, []);
  
  // Create POI from draft (pure function)
  const createPOIFromDraft = useCallback(async (draft: DraftPOI): Promise<PointOfInterest> => {
    const category = draft.category || draft.feature.category;
    const type = draft.feature.properties.type || draft.feature.category;
    const poiData: CreatePOIData = {
      name: draft.name,
      category,
      type,
      location: { lat: draft.lat, lng: draft.lng },
      emoji: draft.emoji || getPOIEmoji(category, type),
      description: draft.feature.displayLabel,
      mapbox_source: draft.feature.sourceLayer ?? undefined,
      mapbox_source_layer: draft.feature.sourceLayer ?? undefined,
      mapbox_layer_id: draft.feature.layerId ?? undefined,
      mapbox_properties: draft.feature.properties || undefined,
      metadata: {
        category: draft.feature.category,
        label: draft.feature.label,
        displayLabel: draft.feature.displayLabel,
      },
    };
    return await POIService.createPOI(poiData);
  }, []);
  
  // Confirm single draft
  const handleConfirmDraft = useCallback(async (draft: DraftPOI) => {
    if (!user || !account || isCreatingPOI) return;
    setIsCreatingPOI(true);
    try {
      const createdPOI = await createPOIFromDraft(draft);
      setDraftPOIs(prev => prev.filter(d => d.id !== draft.id));
      setPois(prev => [createdPOI, ...prev]);
      POIService.getPOIs().then(setPois).catch(console.error);
      window.dispatchEvent(new CustomEvent('poi-created'));
    } catch (error) {
      console.error('[POISecondaryContent] Error confirming draft:', error);
      POIService.getPOIs().then(setPois).catch(console.error);
    } finally {
      setIsCreatingPOI(false);
    }
  }, [user, account, isCreatingPOI, createPOIFromDraft]);
  
  // Bulk approve selected drafts
  const handleBulkApprove = useCallback(async () => {
    if (!user || !account || isCreatingPOI || bulkSelected.size === 0) return;
    setIsCreatingPOI(true);
    try {
      const selectedDrafts = draftPOIs.filter(d => bulkSelected.has(d.id));
      const results = await Promise.allSettled(selectedDrafts.map(createPOIFromDraft));
      const successful = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<PointOfInterest>).value);
      setDraftPOIs(prev => prev.filter(d => !bulkSelected.has(d.id)));
      setPois(prev => [...successful, ...prev]);
      setBulkSelected(new Set());
      POIService.getPOIs().then(setPois).catch(console.error);
      window.dispatchEvent(new CustomEvent('poi-created'));
    } catch (error) {
      console.error('[POISecondaryContent] Error bulk approving:', error);
      POIService.getPOIs().then(setPois).catch(console.error);
    } finally {
      setIsCreatingPOI(false);
    }
  }, [user, account, isCreatingPOI, bulkSelected, draftPOIs, createPOIFromDraft]);
  
  // Remove draft(s)
  const handleRemoveDraft = useCallback((draftId: string) => {
    setDraftPOIs(prev => prev.filter(d => d.id !== draftId));
    setBulkSelected(prev => {
      const next = new Set(prev);
      next.delete(draftId);
      return next;
    });
  }, []);

  const handlePOIClick = (poi: PointOfInterest) => {
    if (!map) return;

    try {
      // Use lat/lng directly
      if (poi.lat === null || poi.lng === null || poi.lat === undefined || poi.lng === undefined) {
        console.error('[POISecondaryContent] POI missing lat/lng:', poi.id);
        return;
      }

      map.flyTo({
        center: [poi.lng, poi.lat],
        zoom: 15,
        duration: 1500,
      });

      // Dispatch event to select POI (if needed by other components)
      window.dispatchEvent(new CustomEvent('select-poi', {
        detail: { poiId: poi.id }
      }));
    } catch (error) {
      console.error('[POISecondaryContent] Error handling POI click:', error);
    }
  };

  if (isLoading) {
    return <div className="text-xs text-gray-500 py-2">Loading POIs...</div>;
  }

  const categoryOptions = [
    { id: 'road', label: 'Roads' },
    { id: 'highway', label: 'Highways' },
    { id: 'path', label: 'Paths' },
    { id: 'street', label: 'Streets' },
    { id: 'trail', label: 'Trails' },
    { id: 'water', label: 'Water' },
    { id: 'lake', label: 'Lakes' },
    { id: 'park', label: 'Parks' },
    { id: 'building', label: 'Buildings' },
    { id: 'house', label: 'Houses' },
    { id: 'city', label: 'Cities' },
    { id: 'neighborhood', label: 'Neighborhoods' },
    { id: 'school', label: 'Schools' },
    { id: 'hospital', label: 'Hospitals' },
    { id: 'church', label: 'Churches' },
    { id: 'restaurant', label: 'Restaurants' },
    { id: 'grocery', label: 'Grocery Stores' },
    { id: 'store', label: 'Stores' },
    { id: 'entertainment', label: 'Entertainment' },
    { id: 'hotel', label: 'Hotels' },
    { id: 'gas_station', label: 'Gas Stations' },
    { id: 'poi', label: 'Other POIs' },
    { id: 'unknown', label: 'Unknown' },
  ];

  return (
    <div className="space-y-3">
      {/* Filters - Always Visible */}
      <div className="border-b border-gray-200 pb-2">
        <div className="text-xs font-medium text-gray-900 mb-2">Filters</div>
        <div className="text-[10px] text-gray-500 mb-2">Select categories to allow. Only checked categories create drafts.</div>
        
        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1 mb-2">
          <button
            onClick={() => setFilters(prev => ({ ...prev, categories: new Set(categoryOptions.map(c => c.id)) }))}
            className="px-2 py-0.5 text-[10px] bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors"
          >
            All
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, categories: new Set(['park', 'school', 'hospital', 'church', 'restaurant', 'hotel', 'gas_station', 'poi']) }))}
            className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
          >
            Common POIs
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, categories: new Set(['building', 'house', 'park', 'school', 'hospital', 'church']) }))}
            className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
          >
            Structures
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, categories: new Set() }))}
            className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
          >
            Clear
          </button>
        </div>
        
        {/* Category Checkboxes */}
        <div className="flex flex-wrap gap-1 mb-2">
          {categoryOptions.map(cat => (
            <label
              key={cat.id}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                filters.categories.has(cat.id)
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <input
                type="checkbox"
                checked={filters.categories.has(cat.id)}
                onChange={(e) => {
                  setFilters(prev => {
                    const next = new Set(prev.categories);
                    if (e.target.checked) {
                      next.add(cat.id);
                    } else {
                      next.delete(cat.id);
                    }
                    return { ...prev, categories: next };
                  });
                }}
                className="w-2.5 h-2.5 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span>{cat.label}</span>
            </label>
          ))}
        </div>
        
        {/* Additional Filters */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.namedOnly}
              onChange={(e) => setFilters(prev => ({ ...prev, namedOnly: e.target.checked }))}
              className="w-3 h-3 text-gray-900 border-gray-300 rounded focus:ring-gray-500"
            />
            <span className="text-[10px] text-gray-600">Named features only</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.usefulDataOnly}
              onChange={(e) => setFilters(prev => ({ ...prev, usefulDataOnly: e.target.checked }))}
              className="w-3 h-3 text-gray-900 border-gray-300 rounded focus:ring-gray-500"
            />
            <span className="text-[10px] text-gray-600">Useful data only</span>
          </label>
        </div>
      </div>

      {/* Draft POIs - Main Focus */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-900">Draft POIs ({draftPOIs.length})</div>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showDraftPOIs}
              onChange={(e) => setShowDraftPOIs(e.target.checked)}
              className="w-3 h-3 text-gray-900 border-gray-300 rounded focus:ring-gray-500"
            />
            <span className="text-[10px] text-gray-500">Show on map</span>
          </label>
        </div>
        
        {/* Bulk Actions */}
        {draftPOIs.length > 0 && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
            <button
              onClick={() => setBulkSelected(bulkSelected.size === draftPOIs.length ? new Set() : new Set(draftPOIs.map(d => d.id)))}
              className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
            >
              {bulkSelected.size === draftPOIs.length ? 'Deselect All' : 'Select All'}
            </button>
            {bulkSelected.size > 0 && (
              <button
                onClick={handleBulkApprove}
                disabled={isCreatingPOI || !user || !account}
                className="px-2 py-0.5 text-[10px] bg-green-600 text-white hover:bg-green-700 rounded transition-colors disabled:opacity-50"
              >
                Approve Selected ({bulkSelected.size})
              </button>
            )}
          </div>
        )}
        
        {draftPOIs.length === 0 ? (
          <div className="text-xs text-gray-500 px-2 py-4 text-center">
            Hover over map features to create draft POIs
          </div>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {draftPOIs.map((draft) => {
              const isExpanded = expandedDrafts.has(draft.id);
              const isSelected = bulkSelected.has(draft.id);
              
              return (
                <div
                  key={draft.id}
                  className={`border border-gray-200 rounded text-xs bg-white ${isSelected ? 'ring-2 ring-green-500' : ''}`}
                >
                  <div className="grid grid-cols-12 gap-2 items-center px-2 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="col-span-1 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          setBulkSelected(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) {
                              next.add(draft.id);
                            } else {
                              next.delete(draft.id);
                            }
                            return next;
                          });
                        }}
                        className="w-3 h-3 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      {draft.emoji && <span className="text-base">{draft.emoji}</span>}
                    </div>
                    <div className="col-span-4 min-w-0">
                      <div className="font-medium text-gray-900 truncate text-xs">{draft.name}</div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-[10px] text-gray-600 truncate">{draft.category || '—'}</div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-[10px] font-mono text-gray-500 truncate">
                        {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)}
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmDraft(draft);
                        }}
                        disabled={isCreatingPOI || !user || !account}
                        className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                        title="Approve"
                      >
                        <CheckIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveDraft(draft.id);
                        }}
                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setExpandedDrafts(prev => {
                            const next = new Set(prev);
                            if (next.has(draft.id)) {
                              next.delete(draft.id);
                            } else {
                              next.add(draft.id);
                            }
                            return next;
                          });
                        }}
                        className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? (
                          <ChevronUpIcon className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDownIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="px-2 py-2 border-t border-gray-200 bg-white text-[10px]">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[9px] text-gray-500 font-medium mb-0.5">Category</div>
                          <div className="text-gray-900 text-xs">{draft.category || draft.feature.category || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-gray-500 font-medium mb-0.5">Location</div>
                          <div className="text-gray-900 font-mono text-[9px]">
                            {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-gray-500 font-medium mb-0.5">Display Label</div>
                          <div className="text-gray-900 text-[10px]">{draft.feature.displayLabel || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-gray-500 font-medium mb-0.5">Layer ID</div>
                          <div className="text-gray-900 font-mono text-[9px] break-all">{draft.feature.layerId}</div>
                        </div>
                      </div>
                      {draft.feature.hasUsefulData && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <span className="px-1 py-0.5 rounded text-[9px] bg-green-100 text-green-700">Has Useful Data</span>
                        </div>
                      )}
                      {draft.feature.properties && Object.keys(draft.feature.properties).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="text-[9px] text-gray-500 font-medium mb-1">Properties</div>
                          <div className="bg-gray-50 rounded p-1.5 max-h-[60px] overflow-y-auto">
                            <pre className="text-[9px] font-mono text-gray-900 whitespace-pre-wrap break-all">
                              {JSON.stringify(draft.feature.properties, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active POIs - Read Only */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-600 font-medium">Active POIs ({pois.length})</div>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showActivePOIs}
              onChange={(e) => setShowActivePOIs(e.target.checked)}
              className="w-3 h-3 text-gray-900 border-gray-300 rounded focus:ring-gray-500"
            />
            <span className="text-[10px] text-gray-500">Show on map</span>
          </label>
        </div>
        {pois.length === 0 ? (
          <div className="text-xs text-gray-500 px-2 py-1.5">No points of interest yet</div>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {pois.map((poi) => (
              <div
                key={poi.id}
                className="border border-gray-200 rounded text-xs bg-white"
              >
                <div
                  onClick={() => handlePOIClick(poi)}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <span className="text-base flex-shrink-0">
                    {getPOIEmoji(poi.category, poi.type, poi.emoji)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {poi.name || 'Unnamed POI'}
                    </div>
                    {poi.category && (
                      <div className="text-[10px] text-gray-500 truncate">
                        {poi.category}
                        {poi.type && ` · ${poi.type}`}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePOIClick(poi);
                    }}
                    className="flex-shrink-0 p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                    title="Zoom to POI"
                  >
                    <MapPinIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
