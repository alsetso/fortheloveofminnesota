'use client';

/**
 * React hook for browser-native geolocation
 * 
 * Usage:
 * ```tsx
 * const { position, error, isWatching, startWatching, stopWatching } = useGeolocation();
 * 
 * return (
 *   <button onClick={startWatching}>
 *     {isWatching ? 'Stop Tracking' : 'Start Tracking'}
 *   </button>
 * );
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  watchGeolocation,
  getCurrentPosition,
  isGeolocationSupported,
  getGeolocationErrorMessage,
  type GeolocationPosition,
  type GeolocationError,
  type GeolocationOptions,
} from '@/utils/geolocation';

export interface UseGeolocationOptions extends GeolocationOptions {
  /**
   * Automatically start watching on mount (default: false)
   * Note: This may not work in all browsers due to permission requirements
   */
  autoStart?: boolean;
}

export interface UseGeolocationReturn {
  /** Current position (null if not available) */
  position: GeolocationPosition | null;
  /** Current error (null if no error) */
  error: GeolocationError | null;
  /** Human-readable error message */
  errorMessage: string | null;
  /** Whether geolocation is currently being watched */
  isWatching: boolean;
  /** Whether geolocation is supported in this browser */
  isSupported: boolean;
  /** Start watching position (must be called from user action) */
  startWatching: () => void;
  /** Stop watching position */
  stopWatching: () => void;
  /** Get current position once (must be called from user action) */
  getCurrent: () => void;
}

/**
 * React hook for geolocation tracking
 * 
 * Privacy: Only requests permission when startWatching() or getCurrent() is called
 * (which should be triggered by user action like a button click)
 */
export function useGeolocation(
  options: UseGeolocationOptions = {}
): UseGeolocationReturn {
  const { autoStart = false, ...geolocationOptions } = options;

  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  
  const watchResultRef = useRef<{ stop: () => void } | null>(null);
  const isSupported = isGeolocationSupported();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchResultRef.current) {
        watchResultRef.current.stop();
      }
    };
  }, []);

  const startWatching = useCallback(() => {
    if (!isSupported) {
      setError({
        code: 0,
        message: 'Geolocation is not supported in this browser',
        type: 'unknown',
      });
      return;
    }

    // Stop any existing watch
    if (watchResultRef.current) {
      watchResultRef.current.stop();
      watchResultRef.current = null;
    }

    setError(null);
    setIsWatching(true);

    const result = watchGeolocation(
      (pos) => {
        setPosition(pos);
        setError(null);
      },
      (err) => {
        setError(err);
        setIsWatching(false);
        if (watchResultRef.current) {
          watchResultRef.current.stop();
          watchResultRef.current = null;
        }
      },
      geolocationOptions
    );

    watchResultRef.current = result;
  }, [isSupported, geolocationOptions]);

  const stopWatching = useCallback(() => {
    if (watchResultRef.current) {
      watchResultRef.current.stop();
      watchResultRef.current = null;
    }
    setIsWatching(false);
  }, []);

  const getCurrent = useCallback(() => {
    if (!isSupported) {
      setError({
        code: 0,
        message: 'Geolocation is not supported in this browser',
        type: 'unknown',
      });
      return;
    }

    setError(null);

    getCurrentPosition(
      (pos) => {
        setPosition(pos);
        setError(null);
      },
      (err) => {
        setError(err);
      },
      geolocationOptions
    );
  }, [isSupported, geolocationOptions]);

  // Auto-start if requested (may not work due to permission requirements)
  useEffect(() => {
    if (autoStart && isSupported && !isWatching) {
      startWatching();
    }
  }, [autoStart, isSupported, isWatching, startWatching]);

  const errorMessage = error ? getGeolocationErrorMessage(error) : null;

  return {
    position,
    error,
    errorMessage,
    isWatching,
    isSupported,
    startWatching,
    stopWatching,
    getCurrent,
  };
}

