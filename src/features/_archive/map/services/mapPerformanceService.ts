/**
 * Map Performance Service
 * Provides optimizations for faster map loading and better strategic performance
 */

import { MAP_CONFIG } from '../config';

export class MapPerformanceService {
  private static instance: MapPerformanceService;
  private preloadedTiles: Set<string> = new Set();
  private isPreloading = false;

  static getInstance(): MapPerformanceService {
    if (!MapPerformanceService.instance) {
      MapPerformanceService.instance = new MapPerformanceService();
    }
    return MapPerformanceService.instance;
  }

  /**
   * Preload critical tiles for Minnesota region
   * DISABLED BY DEFAULT to prevent excessive API calls and billing charges.
   * Mapbox will load tiles on-demand as users navigate, which is more cost-effective.
   * 
   * To enable: Set NEXT_PUBLIC_ENABLE_TILE_PRELOAD=true in .env.local
   * WARNING: This will significantly increase API usage and costs
   */
  async preloadMinnesotaTiles(mapInstance: import('mapbox-gl').Map): Promise<void> {
    // Check if preloading is enabled via environment variable
    const preloadEnabled = process.env.NEXT_PUBLIC_ENABLE_TILE_PRELOAD === 'true';
    
    if (!preloadEnabled) {
      // Preloading disabled - Mapbox will load tiles on-demand (more cost-effective)
      return;
    }

    if (this.isPreloading) return;
    this.isPreloading = true;

    try {
      // Preload tiles for strategic zoom levels (5-8 only) around Minnesota
      // Severely limited to prevent excessive API calls
      const minnesotaBounds = [
        [-97.5, 43.5], // Southwest corner
        [-89.5, 49.5]  // Northeast corner
      ];

      // Limit preloading to zoom levels 5-8 only (reduced from 5-10)
      const minZoom = 5;
      const maxZoom = 8; // Reduced from 10

      // Calculate tile coordinates for different zoom levels
      for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
        const tiles = this.calculateTilesForBounds(minnesotaBounds, zoom);
        
        // Severely limit number of tiles per zoom level (reduced from 50 to 10)
        const maxTilesPerZoom = 10;
        const tilesToPreload = tiles.slice(0, maxTilesPerZoom);
        
        for (const tile of tilesToPreload) {
          // Validate tile coordinates before attempting to load
          if (!this.isValidTile(tile)) {
            continue;
          }

          const tileKey = `${tile.z}/${tile.x}/${tile.y}`;
          if (!this.preloadedTiles.has(tileKey)) {
            try {
              // Preload tile by requesting it with timeout
              const preloadResult = await Promise.race([
                this.preloadTile(mapInstance, tile),
                new Promise<boolean>((resolve) => 
                  setTimeout(() => resolve(false), 2000) // Reduced timeout
                )
              ]);
              
              // Only add to cache if preload was successful
              if (preloadResult !== false) {
                this.preloadedTiles.add(tileKey);
              }
            } catch (error) {
              // Silently fail - tile might not exist or be out of bounds
            }
          }
        }
      }
    } catch (error) {
      // Silently handle preloading errors - not critical for map functionality
      console.debug('Tile preloading completed with some failures (this is normal)');
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Calculate tile coordinates for given bounds and zoom level
   */
  private calculateTilesForBounds(bounds: number[][], zoom: number): Array<{x: number, y: number, z: number}> {
    const tiles: Array<{x: number, y: number, z: number}> = [];
    
    const [sw, ne] = bounds;
    const [swLng, swLat] = sw;
    const [neLng, neLat] = ne;

    // Convert lat/lng to tile coordinates
    const swTile = this.lngLatToTile(swLng, swLat, zoom);
    const neTile = this.lngLatToTile(neLng, neLat, zoom);

    // Generate all tiles in the bounds
    for (let x = swTile.x; x <= neTile.x; x++) {
      for (let y = neTile.y; y <= swTile.y; y++) {
        tiles.push({ x, y, z: zoom });
      }
    }

    return tiles;
  }

  /**
   * Convert longitude/latitude to tile coordinates
   */
  private lngLatToTile(lng: number, lat: number, zoom: number): {x: number, y: number} {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const y = Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    return { x, y };
  }

  /**
   * Validate tile coordinates
   */
  private isValidTile(tile: {x: number, y: number, z: number}): boolean {
    const maxCoord = Math.pow(2, tile.z);
    return (
      tile.z >= 0 && tile.z <= 22 &&
      tile.x >= 0 && tile.x < maxCoord &&
      tile.y >= 0 && tile.y < maxCoord
    );
  }

  /**
   * Preload a single tile
   * Returns true if tile loaded successfully, false otherwise
   */
  private async preloadTile(mapInstance: import('mapbox-gl').Map, tile: {x: number, y: number, z: number}): Promise<boolean> {
    return new Promise((resolve) => {
      // Validate tile before attempting to load
      if (!this.isValidTile(tile)) {
        resolve(false); // Invalid tile, silently fail
        return;
      }

      const source = mapInstance.getSource('mapbox') as { tiles?: string[] };
      if (source && source.tiles) {
        // Tile is already available
        resolve(true);
        return;
      }

      // Extract style ID from the map's style URL
      // Mapbox style URLs are like: mapbox://styles/mapbox/streets-v12
      const styleUrl = mapInstance.getStyle().sprite || '';
      let styleId = 'streets-v12'; // Default fallback
      
      // Try to extract style ID from sprite URL or style name
      const styleMatch = styleUrl.match(/mapbox\/([^/]+)/);
      if (styleMatch) {
        styleId = styleMatch[1];
      } else {
        // Fallback: try to get from style name or use config default
        const styleName = mapInstance.getStyle().name;
        if (styleName && styleName.includes('streets')) {
          styleId = 'streets-v12';
        } else if (styleName && styleName.includes('satellite')) {
          styleId = 'satellite-v9';
        }
      }
      
      // Create a temporary request to preload the tile
      // Use standard resolution first (more reliable)
      const tileUrl = `https://api.mapbox.com/styles/v1/mapbox/${styleId}/tiles/${tile.z}/${tile.x}/${tile.y}?access_token=${MAP_CONFIG.MAPBOX_TOKEN}`;
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        resolve(false); // Timeout, silently fail
      }, 3000);
      
      img.onload = () => {
        clearTimeout(timeout);
        resolve(true); // Successfully loaded
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        // Silently resolve with false - tile might not exist at this zoom level or coordinates
        // This is expected behavior and not an error
        resolve(false); // Failed to load, but not an error
      };
      
      img.src = tileUrl;
    });
  }

  /**
   * Optimize map rendering performance
   */
  optimizeMapRendering(mapInstance: import('mapbox-gl').Map): void {
    // Disable unnecessary layers for better performance
    const style = mapInstance.getStyle();
    if (style && style.layers) {
      style.layers.forEach((layer) => {
        // Optimize symbol layers
        if (layer.type === 'symbol') {
          mapInstance.setLayoutProperty(layer.id, 'text-allow-overlap', false);
          mapInstance.setLayoutProperty(layer.id, 'text-ignore-placement', false);
          mapInstance.setLayoutProperty(layer.id, 'icon-allow-overlap', false);
        }
        
        // Optimize raster layers
        if (layer.type === 'raster') {
          mapInstance.setPaintProperty(layer.id, 'raster-opacity', 0.9);
        }
      });
    }

    // Set performance-focused options
    mapInstance.setRenderWorldCopies(MAP_CONFIG.PERFORMANCE.RENDER_WORLD_COPIES);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    preloadedTiles: number;
    isPreloading: boolean;
  } {
    return {
      preloadedTiles: this.preloadedTiles.size,
      isPreloading: this.isPreloading,
    };
  }

  /**
   * Clear preloaded tiles cache
   */
  clearCache(): void {
    this.preloadedTiles.clear();
    this.isPreloading = false;
  }
}

export const mapPerformanceService = MapPerformanceService.getInstance();
