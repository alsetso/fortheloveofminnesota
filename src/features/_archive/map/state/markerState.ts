import type { Marker } from 'mapbox-gl';

/**
 * Marker registry - typed strongly
 */
export class MarkerRegistry {
  private markers = new Map<string, Marker>();

  /**
   * Add marker to registry
   */
  add(id: string, marker: Marker): void {
    this.markers.set(id, marker);
  }

  /**
   * Remove marker from registry
   */
  remove(id: string): void {
    this.markers.delete(id);
  }

  /**
   * Get marker by ID
   */
  get(id: string): Marker | undefined {
    return this.markers.get(id);
  }

  /**
   * Check if marker exists
   */
  has(id: string): boolean {
    return this.markers.has(id);
  }

  /**
   * Get all markers
   */
  getAll(): Map<string, Marker> {
    return new Map(this.markers);
  }

  /**
   * Clear all markers
   */
  clear(): void {
    this.markers.clear();
  }

  /**
   * Get marker count
   */
  size(): number {
    return this.markers.size;
  }

  /**
   * Iterate over markers
   */
  forEach(
    callback: (marker: Marker, id: string, map: Map<string, Marker>) => void
  ): void {
    this.markers.forEach(callback);
  }

  /**
   * Get all marker IDs
   */
  keys(): string[] {
    return Array.from(this.markers.keys());
  }

  /**
   * Get all markers as array
   */
  values(): Marker[] {
    return Array.from(this.markers.values());
  }
}

/**
 * Create a new marker registry instance
 */
export function createMarkerRegistry(): MarkerRegistry {
  return new MarkerRegistry();
}



