/**
 * Location Service
 * 
 * Web-based location service using ONLY navigator.geolocation API.
 * Designed to work on desktop browsers, mobile browsers (iOS Safari first-class),
 * and future native iOS app via WebView replacement.
 * 
 * Architecture:
 * - All location logic lives in this single module
 * - UI components must not call navigator.geolocation directly
 * - Returns normalized location object for consistency
 * - Device-aware accuracy settings (high on mobile, low on desktop)
 * - Future-proof: can be replaced by native iOS CoreLocation without changing consumers
 * 
 * Browser limitations:
 * - Requires HTTPS (or localhost for development)
 * - Must be user-initiated (button click)
 * - iOS Safari may have additional restrictions
 * - Desktop browsers typically use IP-based geolocation (less accurate)
 */

export interface NormalizedLocation {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  timestamp: number; // milliseconds since epoch
  source: 'gps' | 'manual';
}

export interface LocationError {
  code: number;
  message: string;
  type: 'permission_denied' | 'position_unavailable' | 'timeout' | 'unavailable' | 'unknown';
}

export type LocationCallback = (location: NormalizedLocation) => void;
export type LocationErrorCallback = (error: LocationError) => void;

/**
 * Device detection: mobile vs desktop
 * Uses userAgent + viewport to detect mobile devices
 * Do NOT hardcode iOS-specific behavior outside this module
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent;
  const isMobileUA = /iPhone|iPad|iPod|Android/i.test(userAgent);
  const isMobileViewport = window.innerWidth <= 768 && 'ontouchstart' in window;
  
  return isMobileUA || isMobileViewport;
}

/**
 * Check if geolocation is supported in the current browser
 */
export function isLocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Get human-readable error message for location errors
 */
export function getLocationErrorMessage(error: LocationError): string {
  switch (error.type) {
    case 'permission_denied':
      return 'Location access denied. Please enable location services in your browser settings.';
    case 'position_unavailable':
      return 'Location information is unavailable.';
    case 'timeout':
      return 'Location request timed out. Please try again.';
    case 'unavailable':
      return 'Location services are not available on this device.';
    default:
      return 'Unable to retrieve your location.';
  }
}

/**
 * Convert browser GeolocationPositionError to our error format
 */
function convertLocationError(error: GeolocationPositionError): LocationError {
  let type: LocationError['type'] = 'unknown';
  
  if (error.code === error.PERMISSION_DENIED) {
    type = 'permission_denied';
  } else if (error.code === error.POSITION_UNAVAILABLE) {
    type = 'position_unavailable';
  } else if (error.code === error.TIMEOUT) {
    type = 'timeout';
  }

  return {
    code: error.code,
    message: error.message,
    type,
  };
}

/**
 * Get current position once (one-time request)
 * 
 * IMPORTANT: This function MUST be called in response to a user action
 * (e.g., button click). Browsers will block geolocation requests that
 * are not triggered by user interaction.
 * 
 * Accuracy rules:
 * - Mobile: enableHighAccuracy = true (GPS)
 * - Desktop: enableHighAccuracy = false (IP-based, faster)
 * 
 * Timeout and maximumAge are set explicitly for reliability.
 * 
 * @param onLocation - Callback when location is retrieved
 * @param onError - Callback when an error occurs
 * 
 * @example
 * ```typescript
 * getCurrentLocation(
 *   (location) => {
 *     console.log('Location:', location.latitude, location.longitude);
 *   },
 *   (error) => {
 *     console.error('Error:', getLocationErrorMessage(error));
 *   }
 * );
 * ```
 */
export function getCurrentLocation(
  onLocation: LocationCallback,
  onError: LocationErrorCallback
): void {
  if (!isLocationSupported()) {
    onError({
      code: 0,
      message: 'Geolocation is not supported in this browser',
      type: 'unavailable',
    });
    return;
  }

  const isMobile = isMobileDevice();
  
  // Accuracy settings: high on mobile (GPS), low on desktop (IP-based)
  const enableHighAccuracy = isMobile;
  
  // Timeout: 15 seconds for mobile (GPS can take longer), 10 seconds for desktop
  const timeout = isMobile ? 15000 : 10000;
  
  // Maximum age: 0 for fresh position, but allow 5 seconds cache on mobile for performance
  const maximumAge = isMobile ? 5000 : 0;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      try {
        const normalized: NormalizedLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 0,
          timestamp: position.timestamp ?? Date.now(),
          source: 'gps',
        };
        onLocation(normalized);
      } catch (err) {
        onError({
          code: 0,
          message: err instanceof Error ? err.message : 'Unknown error processing position',
          type: 'unknown',
        });
      }
    },
    (error: GeolocationPositionError) => {
      onError(convertLocationError(error));
    },
    {
      enableHighAccuracy,
      timeout,
      maximumAge,
    }
  );
}

/**
 * Create a manual location object (for fallback when GPS is denied)
 * This allows users to manually set their location via map pin or address input
 */
export function createManualLocation(
  latitude: number,
  longitude: number,
  accuracy: number = 0
): NormalizedLocation {
  return {
    latitude,
    longitude,
    accuracy,
    timestamp: Date.now(),
    source: 'manual',
  };
}

