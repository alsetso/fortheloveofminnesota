'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { queryFeatureAtPoint } from '@/features/map-metadata/services/featureService';
import { supabase } from '@/lib/supabase';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';

interface AtlasType {
  id: string;
  name: string;
  slug: string;
  icon_path: string | null;
  emoji: string | null;
}

interface CapturedLocation {
  id: string;
  lat: number;
  lng: number;
  atlasType: AtlasType;
  metadata: any;
  name?: string;
}

interface AddAtlasLocationToolProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  onClose: () => void;
}

export default function AddAtlasLocationTool({ map, mapLoaded, onClose }: AddAtlasLocationToolProps) {
  const [atlasTypes, setAtlasTypes] = useState<AtlasType[]>([]);
  const [selectedType, setSelectedType] = useState<AtlasType | null>(null);
  const [capturedLocations, setCapturedLocations] = useState<CapturedLocation[]>([]);
  const [currentMetadata, setCurrentMetadata] = useState<any>(null);
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const temporaryPinsRef = useRef<Map<any, any>>(new Map());
  const hoverFeatureRef = useRef<any>(null);

  // Fetch atlas types
  useEffect(() => {
    const fetchAtlasTypes = async () => {
      try {
        const response = await fetch('/api/atlas/types');
        if (response.ok) {
          const data = await response.json();
          // API returns { types: [...] }
          const types = data.types || [];
          // Filter for active types only and map to our interface
          const activeTypes = types
            .filter((type: any) => type.status === 'active')
            .map((type: any) => ({
              id: type.id,
              name: type.name,
              slug: type.slug,
              icon_path: type.icon_path,
              emoji: type.emoji,
            }));
          setAtlasTypes(activeTypes);
        } else {
          throw new Error(`Failed to fetch: ${response.status}`);
        }
      } catch (err) {
        console.error('Error fetching atlas types:', err);
      }
    };

    fetchAtlasTypes();
  }, []);

  // Handle mouse move - capture metadata from cursor position
  const handleMouseMove = useCallback((e: any) => {
    if (!map || !mapLoaded || !isActive || !selectedType) return;

    const feature = queryFeatureAtPoint(map as any, e.point, 'poi' as any, false);
    hoverFeatureRef.current = feature;
    
    // Filter for relevant metadata
    if (feature && 'properties' in feature) {
      const props = feature.properties || {};
      const filtered = {
        name: props.name || props.text || props.place_name || null,
        type: props.type || props.class || null,
        category: props.category || props.maki || null,
        address: props.address || null,
        city: props.city || null,
      };
      
      // Only show if has meaningful data
      if (filtered.name || filtered.type || filtered.category) {
        setCurrentMetadata(filtered);
      } else {
        setCurrentMetadata(null);
      }
    } else {
      setCurrentMetadata(null);
    }
  }, [map, mapLoaded, isActive, selectedType]);

  // Handle map click - drop pin and add to list
  const handleMapClick = useCallback(async (e: any) => {
    if (!map || !mapLoaded || !isActive || !selectedType) return;

    const lng = e.lngLat.lng;
    const lat = e.lngLat.lat;
    const feature = hoverFeatureRef.current;

    // Create temporary pin marker
    const el = document.createElement('div');
    el.className = 'atlas-temp-pin';
    el.style.width = '24px';
    el.style.height = '24px';
    el.style.borderRadius = '50%';
    el.style.border = '2px solid white';
    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.cursor = 'pointer';
    
    if (selectedType.icon_path) {
      el.style.backgroundImage = `url(${selectedType.icon_path})`;
      el.style.backgroundColor = 'white';
    } else if (selectedType.emoji) {
      el.innerHTML = selectedType.emoji;
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontSize = '16px';
      el.style.backgroundColor = 'white';
    } else {
      el.style.backgroundColor = '#ef4444';
    }

    // Load mapbox and create marker
    const mapbox = await loadMapboxGL();
    const marker = new mapbox.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map as any);

    const locationId = `loc-${Date.now()}-${Math.random()}`;
    temporaryPinsRef.current.set(locationId, marker);

    // Extract metadata
    const metadata = feature && 'properties' in feature ? feature.properties : {};
    const name = metadata.name || metadata.text || metadata.place_name || 'Unnamed Location';

    const newLocation: CapturedLocation = {
      id: locationId,
      lat,
      lng,
      atlasType: selectedType,
      metadata,
      name,
    };

    setCapturedLocations(prev => [...prev, newLocation]);
  }, [map, mapLoaded, isActive, selectedType]);

  // Register/unregister map event handlers
  useEffect(() => {
    if (!map || !mapLoaded || !isActive || !selectedType) {
      return;
    }

    map.on('mousemove', handleMouseMove);
    map.on('click', handleMapClick);

    // Change cursor style
    const mapboxMap = map as any;
    const canvas = mapboxMap.getCanvas?.();
    if (canvas) {
      canvas.style.cursor = 'crosshair';
    }

    return () => {
      if (map && !(map as any).removed) {
        map.off('mousemove', handleMouseMove);
        map.off('click', handleMapClick);
        const canvas = mapboxMap.getCanvas?.();
        if (canvas) {
          canvas.style.cursor = '';
        }
      }
    };
  }, [map, mapLoaded, isActive, selectedType, handleMouseMove, handleMapClick]);

  // Handle type selection
  const handleTypeSelect = (type: AtlasType) => {
    setSelectedType(type);
    setIsActive(true);
  };

  // Remove location from list
  const handleRemoveLocation = (id: string) => {
    const marker = temporaryPinsRef.current.get(id);
    if (marker) {
      marker.remove();
      temporaryPinsRef.current.delete(id);
    }
    setCapturedLocations(prev => prev.filter(loc => loc.id !== id));
  };

  // Save all locations
  const handleSaveAll = async () => {
    if (capturedLocations.length === 0) return;

    setSaving(true);
    try {
      // Group by atlas type
      const byType = capturedLocations.reduce((acc, loc) => {
        if (!acc[loc.atlasType.slug]) {
          acc[loc.atlasType.slug] = [];
        }
        acc[loc.atlasType.slug].push(loc);
        return acc;
      }, {} as Record<string, CapturedLocation[]>);

      // Save each type
      for (const [tableName, locations] of Object.entries(byType)) {
        // Save one at a time (API expects single entity)
        for (const loc of locations) {
          const entityData = {
            name: loc.name || 'Unnamed',
            lat: loc.lat,
            lng: loc.lng,
            metadata: loc.metadata,
          };

          const response = await fetch(`/api/admin/atlas/${tableName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entityData),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Failed to save ${tableName}`);
          }
        }
      }

      // Clean up temporary pins
      temporaryPinsRef.current.forEach(marker => marker.remove());
      temporaryPinsRef.current.clear();

      // Close tool
      onClose();
    } catch (err) {
      console.error('Error saving locations:', err);
      alert('Failed to save locations. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      temporaryPinsRef.current.forEach(marker => marker.remove());
      temporaryPinsRef.current.clear();
    };
  }, []);

  // Type selector view
  if (!selectedType) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Select Atlas Type</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {atlasTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => handleTypeSelect(type)}
              className="flex items-center gap-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-left"
            >
              {type.icon_path ? (
                <Image
                  src={type.icon_path}
                  alt={type.name}
                  width={20}
                  height={20}
                  className="w-5 h-5 object-contain"
                  unoptimized
                />
              ) : type.emoji ? (
                <span className="text-lg">{type.emoji}</span>
              ) : null}
              <span className="text-xs font-medium text-gray-900">{type.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Active mode - show metadata and captured locations
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedType.icon_path ? (
            <Image
              src={selectedType.icon_path}
              alt={selectedType.name}
              width={20}
              height={20}
              className="w-5 h-5 object-contain"
              unoptimized
            />
          ) : selectedType.emoji ? (
            <span className="text-lg">{selectedType.emoji}</span>
          ) : null}
          <h3 className="text-sm font-semibold text-gray-900">{selectedType.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Current metadata preview */}
      {currentMetadata && (
        <div className="p-2 bg-gray-50 rounded-md border border-gray-200">
          <div className="text-[10px] text-gray-500 mb-1">Hovering over:</div>
          {currentMetadata.name && (
            <div className="text-xs font-medium text-gray-900">{currentMetadata.name}</div>
          )}
          {currentMetadata.type && (
            <div className="text-[10px] text-gray-600">{currentMetadata.type}</div>
          )}
        </div>
      )}

      <div className="text-xs text-gray-600">
        Click on the map to add locations. {capturedLocations.length} location(s) captured.
      </div>

      {/* Captured locations list */}
      {capturedLocations.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {capturedLocations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-start justify-between gap-2 p-2 bg-white border border-gray-200 rounded-md"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900 truncate">
                    {loc.name}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveLocation(loc.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="w-full mt-3 px-3 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                Save All ({capturedLocations.length})
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

