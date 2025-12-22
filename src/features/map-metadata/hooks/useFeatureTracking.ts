/**
 * Hook for tracking map features during hover and capturing on click
 * Implements throttling for performance and proper state management
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ExtractedFeature, queryFeatureAtPoint } from '../services/featureService';

// Use generic map type to avoid Mapbox type conflicts
type MapInstance = any;

// Throttle utility
function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): T {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  const throttled = (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          func(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };

  return throttled as T;
}

interface UseFeatureTrackingOptions {
  /** Throttle interval in ms (default: 50ms = 20 updates/sec) */
  throttleMs?: number;
  /** Whether tracking is enabled */
  enabled?: boolean;
}

interface UseFeatureTrackingReturn {
  /** Current feature under cursor (updates on hover) */
  hoverFeature: ExtractedFeature | null;
  /** Feature captured on last click */
  clickFeature: ExtractedFeature | null;
  /** Clear the click feature */
  clearClickFeature: () => void;
  /** Manually capture current hover as click feature */
  captureHoverAsClick: () => void;
}

export function useFeatureTracking(
  map: MapInstance | null,
  mapLoaded: boolean,
  options: UseFeatureTrackingOptions = {}
): UseFeatureTrackingReturn {
  const { throttleMs = 50, enabled = true } = options;

  // State for UI updates
  const [hoverFeature, setHoverFeature] = useState<ExtractedFeature | null>(null);
  const [clickFeature, setClickFeature] = useState<ExtractedFeature | null>(null);

  // Ref for capturing hover on click (avoids stale closure)
  const hoverFeatureRef = useRef<ExtractedFeature | null>(null);

  // Clear click feature
  const clearClickFeature = useCallback(() => {
    setClickFeature(null);
  }, []);

  // Capture current hover as click
  const captureHoverAsClick = useCallback(() => {
    setClickFeature(hoverFeatureRef.current);
  }, []);

  // Throttled mouse move handler
  const handleMouseMove = useMemo(
    () =>
      throttle((e: any) => {
        if (!map || map.removed) return;

        const featureResult = queryFeatureAtPoint(map, e.point);
        const feature = featureResult && 'feature' in featureResult ? featureResult.feature : featureResult;
        hoverFeatureRef.current = feature;
        setHoverFeature(feature);
      }, throttleMs),
    [map, throttleMs]
  );

  // Click handler - captures hover feature
  const handleClick = useCallback(
    (e: any) => {
      if (!map || map.removed) return;

      // Capture whatever was being hovered
      const feature = hoverFeatureRef.current;
      setClickFeature(feature);
    },
    [map]
  );

  // Register/unregister event handlers
  useEffect(() => {
    if (!map || !mapLoaded || !enabled) return;

    map.on('mousemove', handleMouseMove);
    map.on('click', handleClick);

    return () => {
      if (map && !map.removed) {
        map.off('mousemove', handleMouseMove);
        map.off('click', handleClick);
      }
    };
  }, [map, mapLoaded, enabled, handleMouseMove, handleClick]);

  // Clear state when map changes
  useEffect(() => {
    if (!map || !mapLoaded) {
      setHoverFeature(null);
      setClickFeature(null);
      hoverFeatureRef.current = null;
    }
  }, [map, mapLoaded]);

  return {
    hoverFeature,
    clickFeature,
    clearClickFeature,
    captureHoverAsClick,
  };
}

