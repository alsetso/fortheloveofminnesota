'use client';

/**
 * useLocation Hook
 * 
 * React hook for location services using the locationService module.
 * 
 * Features:
 * - User-initiated only (never requests on mount)
 * - Handles all permission states (allowed, denied, unavailable)
 * - Returns normalized location object
 * - Future-proof: can be replaced by native iOS CoreLocation
 * 
 * Usage:
 * ```tsx
 * const { location, error, isLoading, requestLocation } = useLocation();
 * 
 * return (
 *   <button onClick={requestLocation}>
 *     {isLoading ? 'Getting location...' : 'Get My Location'}
 *   </button>
 * );
 * ```
 */

import { useState, useCallback } from 'react';
import {
  getCurrentLocation,
  isLocationSupported,
  getLocationErrorMessage,
  createManualLocation,
  type NormalizedLocation,
  type LocationError,
} from '../services/locationService';

export interface UseLocationReturn {
  /** Current location (null if not available) */
  location: NormalizedLocation | null;
  /** Current error (null if no error) */
  error: LocationError | null;
  /** Human-readable error message */
  errorMessage: string | null;
  /** Whether location request is in progress */
  isLoading: boolean;
  /** Whether location services are supported */
  isSupported: boolean;
  /** Request current location (must be called from user action) */
  requestLocation: () => void;
  /** Clear location and error state */
  clearLocation: () => void;
  /** Set manual location (for fallback when GPS is denied) */
  setManualLocation: (latitude: number, longitude: number, accuracy?: number) => void;
}

/**
 * React hook for location services
 * 
 * Privacy: Only requests permission when requestLocation() is called
 * (which must be triggered by user action like a button click)
 */
export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<NormalizedLocation | null>(null);
  const [error, setError] = useState<LocationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isSupported = isLocationSupported();

  const requestLocation = useCallback(() => {
    if (!isSupported) {
      setError({
        code: 0,
        message: 'Location services are not supported in this browser',
        type: 'unavailable',
      });
      return;
    }

    setError(null);
    setIsLoading(true);

    getCurrentLocation(
      (loc) => {
        setLocation(loc);
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setLocation(null);
        setIsLoading(false);
      }
    );
  }, [isSupported]);

  const clearLocation = useCallback(() => {
    setLocation(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const setManualLocation = useCallback((latitude: number, longitude: number, accuracy: number = 0) => {
    const manualLoc = createManualLocation(latitude, longitude, accuracy);
    setLocation(manualLoc);
    setError(null);
    setIsLoading(false);
  }, []);

  const errorMessage = error ? getLocationErrorMessage(error) : null;

  return {
    location,
    error,
    errorMessage,
    isLoading,
    isSupported,
    requestLocation,
    clearLocation,
    setManualLocation,
  };
}

