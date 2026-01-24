import { useState, useEffect, useRef } from 'react';
import { MAP_CONFIG } from '@/features/map/config';

interface ReverseGeocodeResult {
  address: string | null;
  isLoading: boolean;
  error: string | null;
}

// In-memory cache - keyed by rounded coordinates (6 decimals = ~10cm precision)
const cache = new Map<string, { address: string | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const inFlightRequests = new Map<string, Promise<string | null>>();

function getCacheKey(lat: number, lng: number): string {
  // Round to 6 decimal places (~10cm precision)
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function useReverseGeocode(lat: number | null, lng: number | null): ReverseGeocodeResult {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!lat || !lng) {
      setAddress(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cacheKey = getCacheKey(lat, lng);
    const cached = cache.get(cacheKey);

    // Check cache
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setAddress(cached.address);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check if request already in flight
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      setIsLoading(true);
      inFlight
        .then((result) => {
          setAddress(result);
          setIsLoading(false);
          setError(null);
        })
        .catch((err) => {
          setError(err.message);
          setIsLoading(false);
        });
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsLoading(true);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const fetchAddress = async () => {
      try {
        const token = MAP_CONFIG.MAPBOX_TOKEN;
        if (!token) {
          throw new Error('Mapbox token not configured');
        }

        const url = `${MAP_CONFIG.GEOCODING_BASE_URL}/${lng},${lat}.json`;
        const params = new URLSearchParams({
          access_token: token,
          types: 'address',
          limit: '1',
        });

        const response = await fetch(`${url}?${params}`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Reverse geocoding failed: ${response.status}`);
        }

        const data = await response.json();
        const result = data.features && data.features.length > 0
          ? data.features[0].place_name || null
          : null;

        // Cache result
        cache.set(cacheKey, { address: result, timestamp: Date.now() });
        inFlightRequests.delete(cacheKey);

        if (!abortController.signal.aborted) {
          setAddress(result);
          setIsLoading(false);
          setError(null);
        }
      } catch (err: any) {
        inFlightRequests.delete(cacheKey);
        if (err.name === 'AbortError') {
          return; // Request was cancelled
        }
        if (!abortController.signal.aborted) {
          setError(err.message || 'Failed to reverse geocode');
          setIsLoading(false);
        }
      }
    };

    // Store promise for deduplication
    const promise = fetchAddress();
    inFlightRequests.set(cacheKey, promise);

    return () => {
      abortController.abort();
    };
  }, [lat, lng]);

  return { address, isLoading, error };
}
