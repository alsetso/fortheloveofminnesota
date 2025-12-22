'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { POIService, type PointOfInterest, type CreatePOIData } from '@/features/poi/services/poiService';
import { useFeatureTracking } from '@/features/map-metadata/hooks/useFeatureTracking';
import { useAuthStateSafe } from '@/features/auth';
import { PlusIcon, CheckIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon, MapPinIcon } from '@heroicons/react/24/outline';
import type { ExtractedFeature } from '@/features/map-metadata/services/featureService';
import { queryFeatureAtPoint } from '@/features/map-metadata/services/featureService';
import { getFeatureCenter } from '@/features/poi/utils/featureGeometry';
import { isFeatureBlocked } from '@/features/poi/config/poiFilters';
import POIsLayer from '@/features/map/components/POIsLayer';

interface POISecondaryContentProps {
  map?: MapboxMapInstance | null;
  mapLoaded?: boolean;
}

interface FeatureHistoryItem {
  feature: ExtractedFeature;
  coordinates: { lat: number; lng: number };
  timestamp: number;
  id: string; // Unique ID for this feature+location combo
  rawFeature?: any; // Raw mapbox feature for geometry extraction
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

export default function POISecondaryContent({ map, mapLoaded = false }: POISecondaryContentProps) {
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingPOI, setIsCreatingPOI] = useState(false);
  const [hoverCoordinates, setHoverCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const hoverCoordinatesRef = useRef<{ lat: number; lng: number } | null>(null);
  const [clickPoint, setClickPoint] = useState<{ x: number; y: number } | null>(null);
  const { user, account } = useAuthStateSafe();
  
  // Track live cursor metadata
  const { hoverFeature } = useFeatureTracking(map, mapLoaded, { throttleMs: 50 });
  
  // Feature history - accumulates all features cursor has passed over
  const [featureHistory, setFeatureHistory] = useState<FeatureHistoryItem[]>([]);
  const featureHistoryRef = useRef<FeatureHistoryItem[]>([]);
  const lastFeatureIdRef = useRef<string | null>(null);
  const MAX_HISTORY_SIZE = 50; // Limit history to prevent memory issues
  
  // Draft POIs (pending confirmation)
  const [draftPOIs, setDraftPOIs] = useState<DraftPOI[]>([]);
  const draftPOIsRef = useRef<DraftPOI[]>([]);
  
  // Keep draftPOIsRef in sync
  useEffect(() => {
    draftPOIsRef.current = draftPOIs;
  }, [draftPOIs]);
  
  // Toggle for showing draft vs active POIs
  const [showDraftPOIs, setShowDraftPOIs] = useState(true);
  const [showActivePOIs, setShowActivePOIs] = useState(true);
  
  // Track which POI rows are expanded to show full metadata
  const [expandedPOIs, setExpandedPOIs] = useState<Set<string>>(new Set());
  
  // Track which feature history items are expanded
  const [expandedHistoryItems, setExpandedHistoryItems] = useState<Set<string>>(new Set());
  
  // Track which draft POIs are expanded (all expanded by default)
  const [expandedDraftPOIs, setExpandedDraftPOIs] = useState<Set<string>>(new Set());
  
  // Track if controls accordion is open
  const [controlsAccordionOpen, setControlsAccordionOpen] = useState(false);
  
  // Auto-expand all draft POIs when they're added
  useEffect(() => {
    if (draftPOIs.length > 0) {
      setExpandedDraftPOIs(new Set(draftPOIs.map(d => d.id)));
    }
  }, [draftPOIs.length]);
  
  // Filter state for feature history
  const [filteredCategories, setFilteredCategories] = useState<Set<string>>(new Set([
    'road', 'highway', 'path', 'street', 'trail', 'water', 'unknown'
  ]));
  const [filterShowNamedOnly, setFilterShowNamedOnly] = useState(false);
  const [filterShowUsefulDataOnly, setFilterShowUsefulDataOnly] = useState(true);
  
  // Feature query priority mode
  type FeaturePriorityMode = 'labels-first' | 'geometry-first' | 'labels-only';
  const [featurePriorityMode, setFeaturePriorityMode] = useState<FeaturePriorityMode>('labels-first');
  
  // Dummy mode: only capture primary POI icons (not building numbers, road labels, etc.)
  const [dummyMode, setDummyMode] = useState(false);
  
  // Track mouse position for coordinates and accumulate feature history
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
  
  // Track map clicks to get raw feature for geometry extraction
  // Only when POI tab is active (check URL param)
  useEffect(() => {
    if (!map || !mapLoaded) return;
    
    const handleMapClick = (e: any) => {
      // Check if POI tab is active
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('tab') === 'poi') {
        setClickPoint(e.point);
      }
    };
    
    map.on('click', handleMapClick);
    
    return () => {
      if (map && !map.removed) {
        map.off('click', handleMapClick);
      }
    };
  }, [map, mapLoaded]);
  
  // When user clicks map, query feature and add to draft if not blocked
  useEffect(() => {
    if (!map || !mapLoaded || !clickPoint) return;
    
    const result = (queryFeatureAtPoint as any)(map, clickPoint, featurePriorityMode, true, dummyMode);
    if (!result) {
      setClickPoint(null);
      return;
    }
    
    const { feature, rawFeature } = result;
    
    // Check if feature is blocked
    if (isFeatureBlocked(feature.category, feature.properties.type, feature.layerId)) {
      setClickPoint(null);
      return;
    }
    
    // Get feature center (for buildings/areas) or use click coordinates
    const featureCenter = getFeatureCenter(rawFeature, hoverCoordinatesRef.current || undefined);
    if (!featureCenter) {
      setClickPoint(null);
      return;
    }
    
    // Create draft POI
    const draftId = `draft-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const draftPOI: DraftPOI = {
      id: draftId,
      lat: featureCenter.lat,
      lng: featureCenter.lng,
      name: feature.name || feature.displayLabel || 'Unnamed POI',
      emoji: feature.icon || undefined,
      category: feature.category,
      feature,
      rawFeature,
    };
    
    setDraftPOIs(prev => [...prev, draftPOI]);
    setClickPoint(null);
  }, [map, mapLoaded, clickPoint]);
  
  // Accumulate features into history as cursor moves (only if not blocked)
  // Automatically create draft POIs for all features that enter history
  useEffect(() => {
    if (!hoverFeature || !hoverFeature.hasUsefulData || !hoverCoordinates || !map) return;
    
    // Check if feature is blocked
    if (isFeatureBlocked(hoverFeature.category, hoverFeature.properties.type, hoverFeature.layerId)) {
      return;
    }
    
    // Create unique ID for this feature+location combo
    const featureId = `${hoverFeature.layerId}-${hoverFeature.name || 'unnamed'}-${hoverCoordinates.lat.toFixed(4)}-${hoverCoordinates.lng.toFixed(4)}`;
    
    // Skip if this is the same feature as last one (avoid duplicates from rapid updates)
    if (lastFeatureIdRef.current === featureId) return;
    
    lastFeatureIdRef.current = featureId;
    
    // Get raw feature for geometry extraction (synchronous query at current mouse position)
    let rawFeature: any = null;
    let featureCenter = hoverCoordinates;
    
    try {
      // Convert lat/lng to pixel coordinates for querying
      const point = (map as any).project([hoverCoordinates.lng, hoverCoordinates.lat]);
      const result = (queryFeatureAtPoint as any)(map, point, featurePriorityMode, true, dummyMode);
      
      if (result?.rawFeature) {
        rawFeature = result.rawFeature;
        // Get feature center (for buildings/areas) or use hover coordinates
        const center = getFeatureCenter(rawFeature, hoverCoordinates);
        if (center) {
          featureCenter = center;
        }
      }
    } catch (error) {
      // If query fails, use hover coordinates as fallback
      console.debug('[POISecondaryContent] Could not query raw feature, using hover coordinates');
    }
    
    // Create history item with raw feature
    const historyItem: FeatureHistoryItem = {
      feature: hoverFeature,
      coordinates: featureCenter,
      timestamp: Date.now(),
      id: featureId,
      rawFeature: rawFeature || undefined,
    };
    
    // Append to history (most recent first)
    setFeatureHistory(prev => {
      // Remove duplicate if exists (same ID)
      const filtered = prev.filter(item => item.id !== featureId);
      // Add new item at the beginning
      const updated = [historyItem, ...filtered];
      // Limit history size
      return updated.slice(0, MAX_HISTORY_SIZE);
    });
    
    featureHistoryRef.current = [historyItem, ...featureHistoryRef.current.filter(item => item.id !== featureId)].slice(0, MAX_HISTORY_SIZE);
    
    // Automatically create draft POI for this feature (if not filtered)
    // Check if feature passes filters
    const passesFilters = 
      !filteredCategories.has(hoverFeature.category) &&
      (!filterShowNamedOnly || hoverFeature.name) &&
      (!filterShowUsefulDataOnly || hoverFeature.hasUsefulData);
    
    // Dummy mode: only allow POI categories (exclude building, road, infrastructure)
    if (dummyMode) {
      const poiCategories = new Set([
        'poi', 'restaurant', 'hotel', 'gas_station', 'park', 'church', 'school', 
        'hospital', 'cemetery', 'golf_course', 'municipal', 'airport', 'watertower',
        'shop', 'cafe', 'bar', 'bank', 'pharmacy', 'gym', 'museum', 'theater', 
        'stadium', 'zoo', 'aquarium', 'entertainment'
      ]);
      if (!poiCategories.has(hoverFeature.category)) {
        return; // Skip non-POI categories in dummy mode
      }
    }
    
    if (passesFilters) {
      // Check if draft already exists for this feature (avoid duplicates)
      // Use ref to avoid stale closure issues
      // For buildings, check if we already have a draft for the same building geometry
      // (not just same coordinates, since labels can have different coordinates on same building)
      const existingDraft = draftPOIsRef.current.find(d => {
        // Same layer ID and category
        if (d.feature.layerId === hoverFeature.layerId && d.feature.category === hoverFeature.category) {
          // For building labels, check if coordinates are very close (same building)
          if (hoverFeature.layerId.includes('building') && hoverFeature.layerId.includes('label')) {
            const distance = Math.sqrt(
              Math.pow(d.lat - featureCenter.lat, 2) + 
              Math.pow(d.lng - featureCenter.lng, 2)
            );
            // If within ~50 meters (roughly 0.0005 degrees), consider it the same building
            if (distance < 0.0005) {
              return true;
            }
          }
          // For other features, use exact coordinate match
          if (Math.abs(d.lat - featureCenter.lat) < 0.0001 &&
              Math.abs(d.lng - featureCenter.lng) < 0.0001) {
            return true;
          }
        }
        return false;
      });
      
      if (!existingDraft) {
        const draftId = `draft-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const draftPOI: DraftPOI = {
          id: draftId,
          lat: featureCenter.lat,
          lng: featureCenter.lng,
          name: hoverFeature.name || hoverFeature.displayLabel || 'Unnamed POI',
          emoji: hoverFeature.icon || undefined,
          category: hoverFeature.category,
          feature: hoverFeature,
          rawFeature: rawFeature || undefined,
        };
        
        setDraftPOIs(prev => [draftPOI, ...prev]);
      }
    }
  }, [hoverFeature, hoverCoordinates, map, MAX_HISTORY_SIZE, filteredCategories, filterShowNamedOnly, filterShowUsefulDataOnly, dummyMode, featurePriorityMode]);

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

    // Listen for POI created event to refresh list
    const handlePOICreated = async () => {
      try {
        const fetchedPOIs = await POIService.getPOIs();
        setPois(fetchedPOIs);
      } catch (error) {
        console.error('[POISecondaryContent] Error refreshing POIs:', error);
      }
    };

    window.addEventListener('poi-created', handlePOICreated);
    return () => {
      window.removeEventListener('poi-created', handlePOICreated);
    };
  }, []);

  
  // Handle confirming draft POI (convert to active)
  const handleConfirmDraft = useCallback(async (draftPOI: DraftPOI) => {
    if (!user || !account || isCreatingPOI) return;
    
    setIsCreatingPOI(true);
    
    try {
      const poiData: CreatePOIData = {
        name: draftPOI.name,
        category: draftPOI.category || draftPOI.feature.category,
        type: draftPOI.feature.properties.type || draftPOI.feature.category,
        location: { lat: draftPOI.lat, lng: draftPOI.lng },
        emoji: draftPOI.emoji || undefined,
        description: draftPOI.feature.displayLabel,
        mapbox_source: draftPOI.feature.sourceLayer ?? undefined,
        mapbox_source_layer: draftPOI.feature.sourceLayer ?? undefined,
        mapbox_layer_id: draftPOI.feature.layerId ?? undefined,
        mapbox_properties: draftPOI.feature.properties || undefined,
        metadata: {
          category: draftPOI.feature.category,
          label: draftPOI.feature.label,
          displayLabel: draftPOI.feature.displayLabel,
        },
      };
      
      await POIService.createPOI(poiData);
      
      // Remove from drafts
      setDraftPOIs(prev => prev.filter(d => d.id !== draftPOI.id));
      
      // Refresh POI list
      const fetchedPOIs = await POIService.getPOIs();
      setPois(fetchedPOIs);
      
      // Dispatch event
      window.dispatchEvent(new CustomEvent('poi-created'));
    } catch (error) {
      console.error('[POISecondaryContent] Error confirming draft POI:', error);
    } finally {
      setIsCreatingPOI(false);
    }
  }, [user, account, isCreatingPOI]);
  
  // Handle removing draft POI
  const handleRemoveDraft = useCallback((draftId: string) => {
    setDraftPOIs(prev => prev.filter(d => d.id !== draftId));
  }, []);
  
  // Handle creating POI from history item
  const handleCreateFromHistory = useCallback(async (historyItem: FeatureHistoryItem) => {
    if (!user || !account || isCreatingPOI) return;
    
    setIsCreatingPOI(true);
    
    try {
      // Get feature center if raw feature available
      let finalCoordinates = historyItem.coordinates;
      if (historyItem.rawFeature) {
        const center = getFeatureCenter(historyItem.rawFeature, historyItem.coordinates);
        if (center) {
          finalCoordinates = center;
        }
      }
      
      const poiData: CreatePOIData = {
        name: historyItem.feature.name || historyItem.feature.displayLabel || 'Unnamed POI',
        category: historyItem.feature.category,
        type: historyItem.feature.properties.type || historyItem.feature.category,
        location: finalCoordinates,
        emoji: historyItem.feature.icon || undefined,
        description: historyItem.feature.displayLabel,
        mapbox_source: historyItem.feature.sourceLayer ?? undefined,
        mapbox_source_layer: historyItem.feature.sourceLayer ?? undefined,
        mapbox_layer_id: historyItem.feature.layerId ?? undefined,
        mapbox_properties: historyItem.feature.properties || undefined,
        metadata: {
          category: historyItem.feature.category,
          label: historyItem.feature.label,
          displayLabel: historyItem.feature.displayLabel,
        },
      };
      
      await POIService.createPOI(poiData);
      
      // Refresh POI list
      const fetchedPOIs = await POIService.getPOIs();
      setPois(fetchedPOIs);
      
      // Dispatch event
      window.dispatchEvent(new CustomEvent('poi-created'));
      
      console.log('[POISecondaryContent] POI created from history');
    } catch (error) {
      console.error('[POISecondaryContent] Error creating POI from history:', error);
    } finally {
      setIsCreatingPOI(false);
    }
  }, [user, account, isCreatingPOI]);

  const handlePOIClick = (poi: PointOfInterest) => {
    if (!map) return;

    // Extract coordinates from geography point
    // Supabase returns geography as GeoJSON or string format
    try {
      let lng: number, lat: number;
      
      if (typeof poi.location === 'string') {
        // Parse PostGIS geography string formats:
        // "SRID=4326;POINT(lng lat)" or "POINT(lng lat)"
        const match = poi.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
        if (match) {
          lng = parseFloat(match[1]);
          lat = parseFloat(match[2]);
        } else {
          console.error('[POISecondaryContent] Could not parse location:', poi.location);
          return;
        }
      } else if (poi.location && typeof poi.location === 'object') {
        // GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
        if (poi.location.coordinates && Array.isArray(poi.location.coordinates)) {
          lng = poi.location.coordinates[0];
          lat = poi.location.coordinates[1];
        } else if (poi.location.lng !== undefined && poi.location.lat !== undefined) {
          lng = poi.location.lng;
          lat = poi.location.lat;
        } else {
          console.error('[POISecondaryContent] Unknown location object format:', poi.location);
          return;
        }
      } else {
        console.error('[POISecondaryContent] Unknown location format:', poi.location);
        return;
      }

      map.flyTo({
        center: [lng, lat],
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
    return (
      <div className="text-xs text-gray-500 py-2">Loading POIs...</div>
    );
  }

  return (
    <>
      {/* POIs Layer - Visualize draft and active POIs on map */}
      {map && mapLoaded && (
        <POIsLayer
          map={map}
          mapLoaded={mapLoaded}
          draftPOIs={showDraftPOIs ? draftPOIs : []}
          activePOIs={showActivePOIs ? pois : []}
        />
      )}
      
      <div className="space-y-3">

      {/* Dummy Mode Toggle */}
      <div className="border-b border-gray-200 pb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={dummyMode}
            onChange={(e) => setDummyMode(e.target.checked)}
            className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-500"
          />
          <div>
            <div className="text-xs text-gray-900 font-medium">Dummy Mode</div>
            <div className="text-[10px] text-gray-500">
              Only capture primary POI icons (supermarkets, parks, churches, etc.)
            </div>
          </div>
        </label>
      </div>

      {/* Feature Query Priority Control */}
      <div className="border-b border-gray-200 pb-3">
        <div className="text-xs text-gray-600 font-medium mb-2">Query Priority</div>
        <div className="flex flex-wrap gap-1 mb-3">
          <button
            onClick={() => setFeaturePriorityMode('labels-first')}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              featurePriorityMode === 'labels-first'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Labels First
          </button>
          <button
            onClick={() => setFeaturePriorityMode('geometry-first')}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              featurePriorityMode === 'geometry-first'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Geometry First
          </button>
          <button
            onClick={() => setFeaturePriorityMode('labels-only')}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              featurePriorityMode === 'labels-only'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Labels Only
          </button>
        </div>
        <div className="text-[10px] text-gray-500">
          {featurePriorityMode === 'labels-first' && 'Prioritizes labels, then geometry'}
          {featurePriorityMode === 'geometry-first' && 'Prioritizes geometry, then labels'}
          {featurePriorityMode === 'labels-only' && 'Only captures label features'}
        </div>
      </div>

      {/* Feature History Filters */}
      <div className="border-b border-gray-200 pb-3">
        <div className="text-xs text-gray-600 font-medium mb-2">Filter Features</div>
        
        {/* Category Filters */}
        <div className="mb-2">
          <div className="text-[10px] text-gray-500 mb-1.5">Categories:</div>
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'road', label: 'Roads', group: 'infrastructure' },
              { id: 'highway', label: 'Highways', group: 'infrastructure' },
              { id: 'path', label: 'Paths', group: 'infrastructure' },
              { id: 'street', label: 'Streets', group: 'infrastructure' },
              { id: 'trail', label: 'Trails', group: 'infrastructure' },
              { id: 'water', label: 'Water', group: 'nature' },
              { id: 'lake', label: 'Lakes', group: 'nature' },
              { id: 'park', label: 'Parks', group: 'nature' },
              { id: 'building', label: 'Buildings', group: 'structures' },
              { id: 'house', label: 'Houses', group: 'structures' },
              { id: 'city', label: 'Cities', group: 'places' },
              { id: 'neighborhood', label: 'Neighborhoods', group: 'places' },
              { id: 'school', label: 'Schools', group: 'poi' },
              { id: 'hospital', label: 'Hospitals', group: 'poi' },
              { id: 'church', label: 'Churches', group: 'poi' },
              { id: 'restaurant', label: 'Restaurants', group: 'poi' },
              { id: 'hotel', label: 'Hotels', group: 'poi' },
              { id: 'gas_station', label: 'Gas Stations', group: 'poi' },
              { id: 'poi', label: 'Other POIs', group: 'poi' },
              { id: 'unknown', label: 'Unknown', group: 'other' },
            ].map(cat => (
              <label
                key={cat.id}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                  filteredCategories.has(cat.id)
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={filteredCategories.has(cat.id)}
                  onChange={(e) => {
                    setFilteredCategories(prev => {
                      const next = new Set(prev);
                      if (e.target.checked) {
                        next.add(cat.id);
                      } else {
                        next.delete(cat.id);
                      }
                      return next;
                    });
                  }}
                  className="w-2.5 h-2.5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span>{cat.label}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Quick Filter Buttons */}
        <div className="flex flex-wrap gap-1 mb-2">
          <button
            onClick={() => {
              setFilteredCategories(new Set([
                'road', 'highway', 'path', 'street', 'trail', 'water', 'unknown'
              ]));
            }}
            className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
          >
            Default Filters
          </button>
          <button
            onClick={() => {
              setFilteredCategories(new Set([
                'road', 'highway', 'path', 'street', 'trail', 'water', 'lake', 'unknown'
              ]));
            }}
            className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
          >
            Filter Infrastructure
          </button>
          <button
            onClick={() => setFilteredCategories(new Set())}
            className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
          >
            Show All
          </button>
        </div>
        
        {/* Additional Filters */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filterShowNamedOnly}
              onChange={(e) => setFilterShowNamedOnly(e.target.checked)}
              className="w-3 h-3 text-gray-900 border-gray-300 rounded focus:ring-gray-500"
            />
            <span className="text-[10px] text-gray-600">Show named features only</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filterShowUsefulDataOnly}
              onChange={(e) => setFilterShowUsefulDataOnly(e.target.checked)}
              className="w-3 h-3 text-gray-900 border-gray-300 rounded focus:ring-gray-500"
            />
            <span className="text-[10px] text-gray-600">Show useful data only</span>
          </label>
        </div>
      </div>

      {/* Draft POIs Section - Main Focus */}
      <div className="flex-1 min-h-0 flex flex-col">
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
        
        {draftPOIs.length === 0 ? (
          <div className="text-xs text-gray-500 px-2 py-4 text-center">
            Hover over map features to create draft POIs
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1">
            {draftPOIs.map((draft) => {
              const isExpanded = expandedDraftPOIs.has(draft.id);
              
              return (
                <div
                  key={draft.id}
                  className="border border-gray-200 rounded text-xs bg-white"
                >
                  {/* Table-style Header Row */}
                  <div className="grid grid-cols-12 gap-2 items-center px-2 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                    {/* Emoji */}
                    <div className="col-span-1 flex items-center justify-center">
                      {draft.emoji && (
                        <span className="text-base">{draft.emoji}</span>
                      )}
                    </div>
                    
                    {/* Name */}
                    <div className="col-span-4 min-w-0">
                      <div className="font-medium text-gray-900 truncate text-xs">{draft.name}</div>
                    </div>
                    
                    {/* Category */}
                    <div className="col-span-2 min-w-0">
                      <div className="text-[10px] text-gray-600 truncate">{draft.category || '—'}</div>
                    </div>
                    
                    {/* Coordinates */}
                    <div className="col-span-3 min-w-0">
                      <div className="text-[10px] font-mono text-gray-500 truncate">
                        {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmDraft(draft);
                        }}
                        disabled={isCreatingPOI || !user || !account}
                        className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                        title="Confirm and save"
                      >
                        <CheckIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveDraft(draft.id);
                        }}
                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        title="Remove draft"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setExpandedDraftPOIs(prev => {
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
                        title={isExpanded ? 'Collapse' : 'Expand metadata'}
                      >
                        {isExpanded ? (
                          <ChevronUpIcon className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDownIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Expanded Metadata - Always shown (table format) */}
                  <div className="px-2 py-2 border-t border-gray-200 bg-white">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                      {/* Basic Info - Table Format */}
                      <div className="col-span-2 grid grid-cols-3 gap-2 pb-2 border-b border-gray-200">
                        <div>
                          <div className="text-[9px] text-gray-500 font-medium mb-0.5">Name</div>
                          <div className="text-gray-900 text-xs">{draft.name}</div>
                        </div>
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
                      </div>
                      
                      {/* Feature Info - Table Format */}
                      <div className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-gray-200">
                        <div>
                          <div className="text-[9px] text-gray-500 font-medium mb-0.5">Display Label</div>
                          <div className="text-gray-900 text-[10px]">{draft.feature.displayLabel || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-gray-500 font-medium mb-0.5">Layer ID</div>
                          <div className="text-gray-900 font-mono text-[9px] break-all">{draft.feature.layerId}</div>
                        </div>
                        {draft.feature.sourceLayer && (
                          <div>
                            <div className="text-[9px] text-gray-500 font-medium mb-0.5">Source Layer</div>
                            <div className="text-gray-900 font-mono text-[9px] break-all">{draft.feature.sourceLayer}</div>
                          </div>
                        )}
                        <div>
                          <div className="text-[9px] text-gray-500 font-medium mb-0.5">Label</div>
                          <div className="text-gray-900 text-[10px]">{draft.feature.label || '—'}</div>
                        </div>
                        {draft.feature.atlasType && (
                          <div>
                            <div className="text-[9px] text-gray-500 font-medium mb-0.5">Atlas Type</div>
                            <div className="text-gray-900 text-[10px]">{draft.feature.atlasType}</div>
                          </div>
                        )}
                      </div>
                      
                      {/* Feature Properties */}
                      {draft.feature.properties && Object.keys(draft.feature.properties).length > 0 && (
                        <div className="col-span-2 pt-2 border-t border-gray-200">
                          <div className="text-[9px] text-gray-500 font-medium mb-1">Feature Properties</div>
                          <div className="bg-gray-50 rounded p-1.5 max-h-[80px] overflow-y-auto">
                            <pre className="text-[9px] font-mono text-gray-900 whitespace-pre-wrap break-all">
                              {JSON.stringify(draft.feature.properties, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      {/* Raw Mapbox Feature */}
                      {draft.rawFeature && (
                        <div className="col-span-2 pt-2 border-t border-gray-200">
                          <div className="text-[9px] text-gray-500 font-medium mb-1">Raw Mapbox Feature</div>
                          <div className="bg-gray-50 rounded p-1.5 max-h-[120px] overflow-y-auto space-y-1">
                            {draft.rawFeature.geometry && (
                              <div>
                                <span className="text-[9px] text-gray-500">Geometry:</span>
                                <span className="text-gray-900 ml-1 font-mono text-[9px]">{draft.rawFeature.geometry.type}</span>
                              </div>
                            )}
                            {draft.rawFeature.properties && (
                              <div>
                                <div className="text-[9px] text-gray-500 mb-0.5">Raw Properties:</div>
                                <pre className="text-[9px] font-mono text-gray-900 whitespace-pre-wrap break-all">
                                  {JSON.stringify(draft.rawFeature.properties, null, 2)}
                                </pre>
                              </div>
                            )}
                            {draft.rawFeature.source && (
                              <div>
                                <span className="text-[9px] text-gray-500">Source:</span>
                                <span className="text-gray-900 ml-1 font-mono text-[9px]">{draft.rawFeature.source}</span>
                              </div>
                            )}
                            {draft.rawFeature.layer && (
                              <div>
                                <div className="text-[9px] text-gray-500 mb-0.5">Layer:</div>
                                <pre className="text-[9px] font-mono text-gray-900 whitespace-pre-wrap break-all">
                                  {typeof draft.rawFeature.layer === 'object' 
                                    ? JSON.stringify(draft.rawFeature.layer, null, 2)
                                    : draft.rawFeature.layer}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Feature Flags */}
                      <div className="col-span-2 pt-2 border-t border-gray-200">
                        <div className="text-[9px] text-gray-500 font-medium mb-1">Flags</div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`px-1 py-0.5 rounded text-[9px] ${draft.feature.hasUsefulData ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {draft.feature.hasUsefulData ? 'Has Useful Data' : 'No Useful Data'}
                          </span>
                          {draft.feature.showIntelligence && (
                            <span className="px-1 py-0.5 rounded text-[9px] bg-blue-100 text-blue-700">
                              Show Intelligence
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active POIs List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-600 font-medium">Active POIs</div>
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
          <div className="space-y-1">
            {pois.map((poi) => {
              const isExpanded = expandedPOIs.has(poi.id);
              
              // Extract location coordinates
              let locationStr = 'N/A';
              try {
                if (typeof poi.location === 'string') {
                  const match = poi.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
                  if (match) {
                    locationStr = `${parseFloat(match[2]).toFixed(6)}, ${parseFloat(match[1]).toFixed(6)}`;
                  } else {
                    locationStr = poi.location;
                  }
                } else if (poi.location && typeof poi.location === 'object') {
                  if (poi.location.coordinates && Array.isArray(poi.location.coordinates)) {
                    locationStr = `${poi.location.coordinates[1].toFixed(6)}, ${poi.location.coordinates[0].toFixed(6)}`;
                  } else if (poi.location.lng !== undefined && poi.location.lat !== undefined) {
                    locationStr = `${poi.location.lat.toFixed(6)}, ${poi.location.lng.toFixed(6)}`;
                  }
                }
              } catch (e) {
                locationStr = 'Parse error';
              }
              
              return (
                <div
                  key={poi.id}
                  className="border border-gray-200 rounded text-xs"
                >
                  {/* Header - Clickable to expand/collapse and navigate */}
                  <div
                    onClick={() => {
                      setExpandedPOIs(prev => {
                        const next = new Set(prev);
                        if (next.has(poi.id)) {
                          next.delete(poi.id);
                        } else {
                          next.add(poi.id);
                        }
                        return next;
                      });
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {poi.emoji && (
                      <span className="text-base flex-shrink-0">{poi.emoji}</span>
                    )}
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
                    <button
                      className="flex-shrink-0 p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                      title={isExpanded ? 'Collapse' : 'Expand metadata'}
                    >
                      {isExpanded ? (
                        <ChevronUpIcon className="w-3 h-3" />
                      ) : (
                        <ChevronDownIcon className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  
                  {/* Expanded Metadata */}
                  {isExpanded && (
                    <div className="px-2 py-2 border-t border-gray-200 bg-gray-50 space-y-1.5 text-[10px]">
                      {/* Basic Fields */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-gray-500 font-medium">ID:</span>
                          <div className="text-gray-900 font-mono text-[9px] break-all">{poi.id}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 font-medium">Location:</span>
                          <div className="text-gray-900 font-mono text-[9px]">{locationStr}</div>
                        </div>
                      </div>
                      
                      {/* Category & Type */}
                      <div className="grid grid-cols-2 gap-2">
                        {poi.category && (
                          <div>
                            <span className="text-gray-500 font-medium">Category:</span>
                            <div className="text-gray-900">{poi.category}</div>
                          </div>
                        )}
                        {poi.type && (
                          <div>
                            <span className="text-gray-500 font-medium">Type:</span>
                            <div className="text-gray-900">{poi.type}</div>
                          </div>
                        )}
                      </div>
                      
                      {/* Description */}
                      {poi.description && (
                        <div>
                          <span className="text-gray-500 font-medium">Description:</span>
                          <div className="text-gray-900">{poi.description}</div>
                        </div>
                      )}
                      
                      {/* Mapbox Fields */}
                      {(poi.mapbox_source || poi.mapbox_source_layer || poi.mapbox_layer_id) && (
                        <div className="border-t border-gray-300 pt-1.5">
                          <div className="text-gray-500 font-medium mb-1">Mapbox Data:</div>
                          <div className="space-y-0.5">
                            {poi.mapbox_source && (
                              <div>
                                <span className="text-gray-500">Source:</span>
                                <span className="text-gray-900 ml-1 font-mono text-[9px]">{poi.mapbox_source}</span>
                              </div>
                            )}
                            {poi.mapbox_source_layer && (
                              <div>
                                <span className="text-gray-500">Source Layer:</span>
                                <span className="text-gray-900 ml-1 font-mono text-[9px]">{poi.mapbox_source_layer}</span>
                              </div>
                            )}
                            {poi.mapbox_layer_id && (
                              <div>
                                <span className="text-gray-500">Layer ID:</span>
                                <span className="text-gray-900 ml-1 font-mono text-[9px]">{poi.mapbox_layer_id}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Mapbox Properties */}
                      {poi.mapbox_properties && Object.keys(poi.mapbox_properties).length > 0 && (
                        <div className="border-t border-gray-300 pt-1.5">
                          <div className="text-gray-500 font-medium mb-1">Mapbox Properties:</div>
                          <div className="bg-white rounded p-1.5 max-h-[100px] overflow-y-auto">
                            <pre className="text-[9px] font-mono text-gray-900 whitespace-pre-wrap break-all">
                              {JSON.stringify(poi.mapbox_properties, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      {/* Metadata */}
                      {poi.metadata && Object.keys(poi.metadata).length > 0 && (
                        <div className="border-t border-gray-300 pt-1.5">
                          <div className="text-gray-500 font-medium mb-1">Metadata:</div>
                          <div className="bg-white rounded p-1.5 max-h-[100px] overflow-y-auto">
                            <pre className="text-[9px] font-mono text-gray-900 whitespace-pre-wrap break-all">
                              {JSON.stringify(poi.metadata, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      {/* Status & Timestamps */}
                      <div className="border-t border-gray-300 pt-1.5 grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-gray-500 font-medium">Status:</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className={`px-1 py-0.5 rounded text-[9px] ${poi.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {poi.is_active ? 'Active' : 'Inactive'}
                            </span>
                            {poi.is_verified && (
                              <span className="px-1 py-0.5 rounded text-[9px] bg-blue-100 text-blue-700">
                                Verified
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500 font-medium">Created:</span>
                          <div className="text-gray-900 text-[9px]">
                            {new Date(poi.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      {/* User IDs */}
                      {(poi.created_by || poi.updated_by) && (
                        <div className="border-t border-gray-300 pt-1.5 grid grid-cols-2 gap-2">
                          {poi.created_by && (
                            <div>
                              <span className="text-gray-500 font-medium">Created By:</span>
                              <div className="text-gray-900 font-mono text-[9px] break-all">{poi.created_by}</div>
                            </div>
                          )}
                          {poi.updated_by && (
                            <div>
                              <span className="text-gray-500 font-medium">Updated By:</span>
                              <div className="text-gray-900 font-mono text-[9px] break-all">{poi.updated_by}</div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Updated At */}
                      {poi.updated_at && (
                        <div className="border-t border-gray-300 pt-1.5">
                          <span className="text-gray-500 font-medium">Updated:</span>
                          <div className="text-gray-900 text-[9px]">
                            {new Date(poi.updated_at).toLocaleString()}
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
    </div>
    </>
  );
}

