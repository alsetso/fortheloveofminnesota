/**
 * State Verification Utility
 * Checks if user's current location is in Minnesota using browser geolocation and reverse geocoding
 */

import { MAP_CONFIG } from '@/features/map/config';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';

export interface StateVerificationResult {
  verified: boolean;
  error?: string;
  coordinates?: { lat: number; lng: number };
}

/**
 * Check if user is currently in Minnesota using browser geolocation
 * Uses native geolocation API and reverse geocoding to verify state
 */
export async function verifyMinnesotaLocation(): Promise<StateVerificationResult> {
  // Check if geolocation is available
  if (!navigator.geolocation) {
    return {
      verified: false,
      error: 'Geolocation is not supported by your browser',
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // First check: verify coordinates are within Minnesota bounds
        const withinBounds = MinnesotaBoundsService.isWithinMinnesota({
          lat: latitude,
          lng: longitude,
        });

        if (!withinBounds) {
          resolve({
            verified: false,
            coordinates: { lat: latitude, lng: longitude },
            error: 'Location is outside Minnesota boundaries',
          });
          return;
        }

        // Second check: reverse geocode to verify state
        try {
          const token = MAP_CONFIG.MAPBOX_TOKEN;
          if (!token || token === 'your_mapbox_token_here') {
            // If no token, rely on bounds check only
            resolve({
              verified: true,
              coordinates: { lat: latitude, lng: longitude },
            });
            return;
          }

          const url = `${MAP_CONFIG.GEOCODING_BASE_URL}/${longitude},${latitude}.json`;
          const params = new URLSearchParams({
            access_token: token,
            types: 'region',
            limit: '1',
          });

          const response = await fetch(`${url}?${params}`);
          if (!response.ok) {
            // If geocoding fails, rely on bounds check
            resolve({
              verified: true,
              coordinates: { lat: latitude, lng: longitude },
            });
            return;
          }

          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            const context = feature.context || [];
            
            // Check for state in context
            const stateContext = context.find((c: any) => 
              c.id?.startsWith('region.') || 
              c.short_code?.startsWith('US-')
            );

            if (stateContext) {
              const stateCode = stateContext.short_code || '';
              const stateName = stateContext.text || '';
              
              const isMinnesota = 
                stateCode === 'US-MN' || 
                MinnesotaBoundsService.isMinnesotaState(stateName);

              resolve({
                verified: isMinnesota,
                coordinates: { lat: latitude, lng: longitude },
                error: isMinnesota ? undefined : 'Location is not in Minnesota',
              });
              return;
            }
          }

          // If no state context found, rely on bounds check
          resolve({
            verified: true,
            coordinates: { lat: latitude, lng: longitude },
          });
        } catch (error) {
          // If geocoding fails, rely on bounds check
          resolve({
            verified: true,
            coordinates: { lat: latitude, lng: longitude },
          });
        }
      },
      (error) => {
        let errorMessage = 'Unable to determine location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location permissions.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        resolve({
          verified: false,
          error: errorMessage,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}
