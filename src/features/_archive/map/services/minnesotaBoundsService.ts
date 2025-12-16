/**
 * Minnesota Bounds Service
 * Provides validation for Minnesota-only operations
 */

import { MAP_CONFIG } from '../config';

export interface Coordinates {
  lat: number;
  lng: number;
}

export class MinnesotaBoundsService {
  /**
   * Check if coordinates are within Minnesota bounds
   */
  static isWithinMinnesota(coordinates: Coordinates): boolean {
    const { lat, lng } = coordinates;
    const bounds = MAP_CONFIG.MINNESOTA_BOUNDS;
    
    return (
      lat >= bounds.south &&
      lat <= bounds.north &&
      lng >= bounds.west &&
      lng <= bounds.east
    );
  }

  /**
   * Check if the state field indicates Minnesota
   */
  static isMinnesotaState(state: string): boolean {
    if (!state) return false;
    
    const normalizedState = state.trim().toLowerCase();
    return normalizedState === 'minnesota' || normalizedState === 'mn';
  }

  /**
   * Get a user-friendly error message for out-of-bounds clicks
   */
  static getOutOfBoundsMessage(): string {
    return 'This location is not in Minnesota. Please click within Minnesota state boundaries to perform skip tracing operations.';
  }

  /**
   * Get Minnesota bounds for display purposes
   */
  static getMinnesotaBounds() {
    return MAP_CONFIG.MINNESOTA_BOUNDS;
  }

  /**
   * Get the center point of Minnesota
   */
  static getMinnesotaCenter(): Coordinates {
    const bounds = MAP_CONFIG.MINNESOTA_BOUNDS;
    return {
      lat: (bounds.north + bounds.south) / 2,
      lng: (bounds.east + bounds.west) / 2
    };
  }
}

export const minnesotaBoundsService = MinnesotaBoundsService;
