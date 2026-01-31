'use client';

import { useState, useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import CTUBoundariesLayer from '@/features/map/components/CTUBoundariesLayer';
import CountyBoundariesLayer from '@/features/map/components/CountyBoundariesLayer';
import CongressionalDistrictsLayer from '@/features/map/components/CongressionalDistrictsLayer';
import StateBoundaryLayer from '@/features/map/components/StateBoundaryLayer';

export type LocationPreferenceType = 'cities_and_towns' | 'county' | 'districts';

interface LocationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  layerType: LocationPreferenceType;
  onSelect: (data: any) => void;
  onSave?: (data: any) => Promise<void>;
  currentSelection?: any;
}

export default function LocationPreferencesModal({
  isOpen,
  onClose,
  layerType,
  onSelect,
  onSave,
  currentSelection,
}: LocationPreferencesModalProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MapboxMapInstance | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedBoundary, setSelectedBoundary] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reset selection when modal opens/closes or layerType changes
  useEffect(() => {
    if (isOpen) {
      // Initialize from currentSelection if provided
      if (currentSelection) {
        setSelectedBoundary(Array.isArray(currentSelection) ? currentSelection[0] : currentSelection);
      } else {
        setSelectedBoundary(null);
      }
    } else {
      setSelectedBoundary(null);
    }
  }, [isOpen, layerType, currentSelection]);

  useEffect(() => {
    if (!isOpen || !mapContainer.current) return undefined;

    let mounted = true;
    let map: any = null;

    const initMap = async () => {
      try {
        const mapboxgl = await loadMapboxGL();
        if (!mounted || !mapContainer.current) return;

        map = new mapboxgl.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: 8,
        });

        map.on('load', () => {
          if (mounted) {
            setMapLoaded(true);
            mapInstance.current = map as any;
          }
        });

        return () => {
          if (mounted && map) {
            map.remove();
          }
        };
      } catch (error) {
        console.error('Error loading map:', error);
        return undefined;
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        map = null;
      }
      setMapLoaded(false);
    };
  }, [isOpen]);

  const handleBoundarySelect = async (item: any) => {
    // Single selection only - replace current selection
    setSelectedBoundary(item);
    
    // Fetch full boundary data from API
    try {
      let url = '';
      if (layerType === 'cities_and_towns' && item.id) {
        url = `/api/civic/ctu-boundaries?id=${item.id}`;
      } else if (layerType === 'county' && item.id) {
        url = `/api/civic/county-boundaries?id=${item.id}`;
      } else if (layerType === 'districts' && item.id) {
        url = `/api/civic/congressional-districts?id=${item.id}`;
      }
      
      if (url) {
        const response = await fetch(url);
        if (response.ok) {
          const fullData = await response.json();
          setSelectedBoundary({ ...item, fullData });
          
          // Auto-save if onSave callback is provided
          if (onSave) {
            setIsSaving(true);
            try {
              await onSave(fullData);
            } catch (error) {
              console.error('Error auto-saving selection:', error);
            } finally {
              setIsSaving(false);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching boundary data:', error);
    }
  };

  const handleConfirm = async () => {
    if (!selectedBoundary) {
      onSelect(null);
      if (onSave) {
        setIsSaving(true);
        try {
          await onSave(null);
        } catch (error) {
          console.error('Error clearing selection:', error);
        } finally {
          setIsSaving(false);
        }
      }
      onClose();
      return;
    }

    // Use fullData if available, otherwise fetch it
    let fullData = selectedBoundary.fullData;
    
    if (!fullData && selectedBoundary.id) {
      try {
        let url = '';
        if (layerType === 'cities_and_towns') {
          url = `/api/civic/ctu-boundaries?id=${selectedBoundary.id}`;
        } else if (layerType === 'county') {
          url = `/api/civic/county-boundaries?id=${selectedBoundary.id}`;
        } else if (layerType === 'districts') {
          url = `/api/civic/congressional-districts?id=${selectedBoundary.id}`;
        }
        
        if (url) {
          const response = await fetch(url);
          if (response.ok) {
            fullData = await response.json();
          }
        }
      } catch (error) {
        console.error('Error fetching boundary data:', error);
      }
    }

    onSelect(fullData || selectedBoundary);
    
    // Save if onSave callback is provided
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave(fullData || selectedBoundary);
      } catch (error) {
        console.error('Error saving selection:', error);
      } finally {
        setIsSaving(false);
      }
    }
    
    onClose();
  };

  const handleClear = async () => {
    setSelectedBoundary(null);
    onSelect(null);
    
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave(null);
      } catch (error) {
        console.error('Error clearing selection:', error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  if (!isOpen) return null;

  const getLayerConfig = (type: LocationPreferenceType) => {
    switch (type) {
      case 'cities_and_towns':
        return {
          showCTU: true,
          showCounty: false,
          showDistricts: false,
          showStateBoundary: false,
          label: 'Cities & Towns',
        };
      case 'county':
        return {
          showCTU: false,
          showCounty: true,
          showDistricts: false,
          showStateBoundary: false,
          label: 'County',
        };
      case 'districts':
        return {
          showCTU: false,
          showCounty: false,
          showDistricts: true,
          showStateBoundary: false,
          label: 'Districts',
        };
    }
  };

  const layerConfig = getLayerConfig(layerType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-md border border-gray-200 w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        <div className="p-[10px] border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Select {layerConfig.label}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 relative min-h-[400px]">
          <div ref={mapContainer} className="w-full h-full" />
          {mapLoaded && mapInstance.current && (
            <>
              {layerConfig.showStateBoundary && (
                <StateBoundaryLayer
                  map={mapInstance.current}
                  mapLoaded={mapLoaded}
                  visible={true}
                  onBoundarySelect={handleBoundarySelect}
                />
              )}
              {layerConfig.showCounty && (
                <CountyBoundariesLayer
                  map={mapInstance.current}
                  mapLoaded={mapLoaded}
                  visible={true}
                  onBoundarySelect={handleBoundarySelect}
                />
              )}
              {layerConfig.showCTU && (
                <CTUBoundariesLayer
                  map={mapInstance.current}
                  mapLoaded={mapLoaded}
                  visible={true}
                  onBoundarySelect={handleBoundarySelect}
                />
              )}
              {layerConfig.showDistricts && (
                <CongressionalDistrictsLayer
                  map={mapInstance.current}
                  mapLoaded={mapLoaded}
                  visible={true}
                  onBoundarySelect={handleBoundarySelect}
                />
              )}
            </>
          )}
        </div>

        <div className="p-[10px] border-t border-gray-200 space-y-2">
          {selectedBoundary && (
            <div className="p-[10px] bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-xs font-medium text-gray-900 mb-1">Selected:</p>
              <p className="text-xs text-gray-600">
                {selectedBoundary.name || selectedBoundary.feature_name || selectedBoundary.county_name || 'Boundary'}
              </p>
              {isSaving && (
                <p className="text-xs text-gray-500 mt-1">Saving...</p>
              )}
            </div>
          )}
          <div className="flex gap-2">
            {currentSelection && (
              <button
                onClick={handleClear}
                disabled={isSaving}
                className="flex-1 px-[10px] py-[10px] text-xs font-medium text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-[10px] py-[10px] text-xs font-medium text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {onSave ? 'Close' : 'Cancel'}
            </button>
            {!onSave && (
              <button
                onClick={handleConfirm}
                disabled={isSaving}
                className="flex-1 px-[10px] py-[10px] text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedBoundary ? 'Confirm' : 'Clear Selection'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
