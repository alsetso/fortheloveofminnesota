// Thin state wrapper for geocoding service
import { useState, useCallback } from 'react';
import { GeocodingService } from '../services/geocodingService';
import { Address, AddressWithCoordinates, GeocodingResult } from '../types';

export interface UseGeocodingReturn {
  geocodeAddress: (address: Address) => Promise<GeocodingResult>;
  geocodeAddresses: (addresses: Address[]) => Promise<GeocodingResult[]>;
  addCoordinatesToAddress: (address: Address) => Promise<AddressWithCoordinates>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useGeocoding(): UseGeocodingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const geocodeAddress = useCallback(async (address: Address): Promise<GeocodingResult> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await GeocodingService.geocodeAddress(address);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Geocoding failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        fullAddress: `${address.street}, ${address.city}, ${address.state} ${address.zip}`,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const geocodeAddresses = useCallback(async (addresses: Address[]): Promise<GeocodingResult[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await GeocodingService.geocodeAddresses(addresses);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Batch geocoding failed';
      setError(errorMessage);
      return addresses.map(address => ({
        success: false,
        error: errorMessage,
        fullAddress: `${address.street}, ${address.city}, ${address.state} ${address.zip}`,
      }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addCoordinatesToAddress = useCallback(async (address: Address): Promise<AddressWithCoordinates> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await GeocodingService.addCoordinatesToAddress(address);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add coordinates';
      setError(errorMessage);
      return {
        ...address,
        fullAddress: `${address.street}, ${address.city}, ${address.state} ${address.zip}`,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    geocodeAddress,
    geocodeAddresses,
    addCoordinatesToAddress,
    isLoading,
    error,
    clearError,
  };
}
