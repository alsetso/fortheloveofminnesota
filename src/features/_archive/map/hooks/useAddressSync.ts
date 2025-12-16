'use client';

import { useCallback, useRef, useState } from 'react';
import { Address, UseAddressSyncReturn } from '../types';
import { GeocodingService } from '../services/geocodingService';
import { MAP_CONFIG } from '../config';
import { minnesotaBoundsService } from '../services/minnesotaBoundsService';

interface UseAddressSyncProps {
  onTemporaryAddressChange?: (address: Address | null) => void;
  onAddressPinUpdate?: (coordinates: { lat: number; lng: number } | null) => void;
  onMapFlyTo?: (coordinates: { lat: number; lng: number }, zoom?: number) => void;
}

export function useAddressSync({ 
  onTemporaryAddressChange,
  onAddressPinUpdate,
  onMapFlyTo
}: UseAddressSyncProps): UseAddressSyncReturn {
  const temporaryAddressRef = useRef<Address | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Reverse geocode coordinates to address
  const reverseGeocode = useCallback(async (lng: number, lat: number): Promise<{ success: boolean; address?: Address; error?: string }> => {
    const token = MAP_CONFIG.MAPBOX_TOKEN;
    
    if (!token || token === 'your_mapbox_token_here') {
      // Return mock address for testing
      return {
        success: true,
        address: {
          street: '123 Mock Street',
          city: 'Mock City',
          state: 'TX',
          zip: '77845',
          coordinates: { latitude: lat, longitude: lng }
        }
      };
    }

    try {
      const response = await fetch(
        `${MAP_CONFIG.GEOCODING_BASE_URL}/${lng},${lat}.json?access_token=${token}&types=address`
      );
      
      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const addressComponents = feature.context || [];
        
        // Extract address components
        const street = feature.text || '';
        const city = addressComponents.find((c: Record<string, unknown>) => (c.id as string).startsWith('place'))?.text || '';
        const state = addressComponents.find((c: Record<string, unknown>) => (c.id as string).startsWith('region'))?.text || '';
        const zip = addressComponents.find((c: Record<string, unknown>) => (c.id as string).startsWith('postcode'))?.text || '';

        // Validate that the address state is actually Minnesota
        if (!minnesotaBoundsService.isMinnesotaState(state)) {
          return {
            success: false,
            error: 'This location is not in Minnesota. Please click within Minnesota state boundaries to perform skip tracing operations.'
          };
        }

        const addressData: Address = {
          street,
          city,
          state,
          zip,
          coordinates: { latitude: lat, longitude: lng }
        };

        return {
          success: true,
          address: addressData
        };
      }
      
      return {
        success: false,
        error: 'No address found for coordinates'
      };
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Reverse geocoding failed'
      };
    }
  }, []);

  // Handle map pin dropped - set temporary address and prefill Start Node
  const onMapPinDropped = useCallback(async (coordinates: { lat: number; lng: number }) => {
    if (isSyncing) return { success: false, error: 'Already syncing' };
    
    setIsSyncing(true);
    try {
      const result = await reverseGeocode(coordinates.lng, coordinates.lat);
      if (result.success && result.address) {
        const address = result.address;
        temporaryAddressRef.current = address;
        onTemporaryAddressChange?.(address);
        
        // Update map pin
        onAddressPinUpdate?.(coordinates);
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to geocode address' };
      }
    } catch (error) {
      console.error('Error handling map pin drop:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, reverseGeocode, onTemporaryAddressChange, onAddressPinUpdate]);

  // Handle Start Node address changes - geocode and update map
  const onStartNodeAddressChanged = useCallback(async (address: Omit<Address, 'coordinates'>) => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      const result = await GeocodingService.geocodeAddress(address as Address);
      if (result.success && result.coordinates) {
        const { latitude, longitude } = result.coordinates;
        const coordinates = { lat: latitude, lng: longitude };
        
        // Update temporary address with coordinates
        const updatedAddress: Address = {
          ...address,
          coordinates: result.coordinates
        };
        temporaryAddressRef.current = updatedAddress;
        onTemporaryAddressChange?.(updatedAddress);
        
        // Update map
        onAddressPinUpdate?.(coordinates);
        onMapFlyTo?.(coordinates);
      }
    } catch (error) {
      console.error('Error handling Start Node address change:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, onTemporaryAddressChange, onAddressPinUpdate, onMapFlyTo]);

  // Set temporary address (for external control)
  const setTemporaryAddress = useCallback((address: Address | null) => {
    temporaryAddressRef.current = address;
    onTemporaryAddressChange?.(address);
    
    if (address?.coordinates) {
      const { latitude, longitude } = address.coordinates;
      onAddressPinUpdate?.({ lat: latitude, lng: longitude });
      onMapFlyTo?.({ lat: latitude, lng: longitude });
    } else {
      onAddressPinUpdate?.(null);
    }
  }, [onTemporaryAddressChange, onAddressPinUpdate, onMapFlyTo]);

  // Get temporary address
  const getTemporaryAddress = useCallback(() => {
    return temporaryAddressRef.current;
  }, []);

  return {
    temporaryAddress: temporaryAddressRef.current,
    isSyncing,
    onMapPinDropped,
    onStartNodeAddressChanged,
    setTemporaryAddress,
    getTemporaryAddress
  };
}
