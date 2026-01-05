/**
 * Browser-native geolocation utility
 * 
 * Privacy considerations:
 * - Only requests permission after explicit user action (button click)
 * - Uses watchPosition for continuous tracking (more efficient than polling)
 * - Gracefully handles all error states
 * - Provides cleanup to stop tracking and free resources
 * 
 * Browser compatibility:
 * - Modern browsers (Chrome, Firefox, Safari, Edge)
 * - Requires HTTPS (or localhost for development)
 * - Mobile browsers may have additional restrictions
 */

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  timestamp: number; // milliseconds since epoch
}

export interface GeolocationError {
  code: number;
  message: string;
  type: 'permission_denied' | 'position_unavailable' | 'timeout' | 'unknown';
}

export type GeolocationCallback = (position: GeolocationPosition) => void;
export type GeolocationErrorCallback = (error: GeolocationError) => void;

export interface GeolocationOptions {
  enableHighAccuracy?: boolean; // Default: true
  timeout?: number; // Default: 10000ms
  maximumAge?: number; // Default: 0ms (no cache)
}

export interface GeolocationWatchResult {
  watchId: number;
  stop: () => void;
}

/**
 * Check if geolocation is supported in the current browser
 */
export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Get a human-readable error message for geolocation errors
 */
export function getGeolocationErrorMessage(error: GeolocationError): string {
  switch (error.type) {
    case 'permission_denied':
      return 'Location access denied. Please enable location services in your browser settings.';
    case 'position_unavailable':
      return 'Location information is unavailable.';
    case 'timeout':
      return 'Location request timed out. Please try again.';
    default:
      return 'Unable to retrieve your location.';
  }
}

/**
 * Convert browser GeolocationPositionError to our error format
 */
function convertGeolocationError(error: GeolocationPositionError): GeolocationError {
  let type: GeolocationError['type'] = 'unknown';
  
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
 * Convert browser Position to our position format
 * Note: This function is not currently used but kept for potential future use
 */
function convertGeolocationPosition(position: globalThis.GeolocationPosition): GeolocationPosition {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? 0,
    timestamp: position.timestamp ?? Date.now(),
  };
}

/**
 * Watch user's geolocation position
 * 
 * IMPORTANT: This function MUST be called in response to a user action
 * (e.g., button click). Browsers will block geolocation requests that
 * are not triggered by user interaction.
 * 
 * @param onPosition - Callback when position is updated
 * @param onError - Callback when an error occurs
 * @param options - Geolocation options
 * @returns Watch result with stop function
 * 
 * @example
 * ```typescript
 * const { watchId, stop } = watchGeolocation(
 *   (position) => {
 *     console.log('Location:', position.latitude, position.longitude);
 *   },
 *   (error) => {
 *     console.error('Error:', getGeolocationErrorMessage(error));
 *   }
 * );
 * 
 * // Later, stop watching:
 * stop();
 * ```
 */
export function watchGeolocation(
  onPosition: GeolocationCallback,
  onError: GeolocationErrorCallback,
  options: GeolocationOptions = {}
): GeolocationWatchResult {
  if (!isGeolocationSupported()) {
    onError({
      code: 0,
      message: 'Geolocation is not supported in this browser',
      type: 'unknown',
    });
    return {
      watchId: -1,
      stop: () => {},
    };
  }

  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
  } = options;

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      try {
        const converted: GeolocationPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 0,
          timestamp: position.timestamp ?? Date.now(),
        };
        onPosition(converted);
      } catch (err) {
        onError({
          code: 0,
          message: err instanceof Error ? err.message : 'Unknown error processing position',
          type: 'unknown',
        });
      }
    },
    (error: GeolocationPositionError) => {
      onError(convertGeolocationError(error));
    },
    {
      enableHighAccuracy,
      timeout,
      maximumAge,
    }
  );

  return {
    watchId,
    stop: () => {
      navigator.geolocation.clearWatch(watchId);
    },
  };
}

/**
 * Get current position once (does not watch continuously)
 * 
 * IMPORTANT: This function MUST be called in response to a user action.
 * 
 * @param onPosition - Callback when position is retrieved
 * @param onError - Callback when an error occurs
 * @param options - Geolocation options
 * 
 * @example
 * ```typescript
 * getCurrentPosition(
 *   (position) => {
 *     console.log('Current location:', position.latitude, position.longitude);
 *   },
 *   (error) => {
 *     console.error('Error:', getGeolocationErrorMessage(error));
 *   }
 * );
 * ```
 */
export function getCurrentPosition(
  onPosition: GeolocationCallback,
  onError: GeolocationErrorCallback,
  options: GeolocationOptions = {}
): void {
  if (!isGeolocationSupported()) {
    onError({
      code: 0,
      message: 'Geolocation is not supported in this browser',
      type: 'unknown',
    });
    return;
  }

  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
  } = options;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      try {
        const converted: GeolocationPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 0,
          timestamp: position.timestamp ?? Date.now(),
        };
        onPosition(converted);
      } catch (err) {
        onError({
          code: 0,
          message: err instanceof Error ? err.message : 'Unknown error processing position',
          type: 'unknown',
        });
      }
    },
    (error: GeolocationPositionError) => {
      onError(convertGeolocationError(error));
    },
    {
      enableHighAccuracy,
      timeout,
      maximumAge,
    }
  );
}

