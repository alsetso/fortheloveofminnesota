/**
 * Map Style Preloader Service
 * Preloads map styles to enable instant switching
 * 
 * Performance optimizations:
 * - Caches style JSON in localStorage (7-day TTL)
 * - Preloads style definitions (sprites/glyphs loaded automatically by Mapbox GL JS)
 * - Falls back to API if cache is stale or missing
 */

import { MAP_CONFIG } from '../config';

type MapStyle = 'streets' | 'satellite' | 'light' | 'dark';

interface PreloadedStyle {
  styleUrl: string;
  loaded: boolean;
  error?: Error;
  cached?: boolean;
}

interface CachedStyleData {
  styleData: any;
  timestamp: number;
  version: string; // Style version from Mapbox
}

const STYLE_CACHE_PREFIX = 'mapbox_style_';
const STYLE_CACHE_VERSION = '1.0';
const STYLE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

class MapStylePreloader {
  private preloadedStyles: Map<MapStyle, PreloadedStyle> = new Map();
  private preloadPromises: Map<MapStyle, Promise<void>> = new Map();
  
  /**
   * Get cache key for a style
   */
  private getCacheKey(style: MapStyle): string {
    return `${STYLE_CACHE_PREFIX}${style}`;
  }
  
  /**
   * Check if cached style data is still valid
   */
  private isCacheValid(cached: CachedStyleData | null): boolean {
    if (!cached) return false;
    const age = Date.now() - cached.timestamp;
    return age < STYLE_CACHE_TTL;
  }
  
  /**
   * Load style from localStorage cache
   */
  private loadFromCache(style: MapStyle): CachedStyleData | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const cacheKey = this.getCacheKey(style);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const parsed: CachedStyleData = JSON.parse(cached);
      return this.isCacheValid(parsed) ? parsed : null;
    } catch (error) {
      console.debug(`[MapStylePreloader] Failed to load cache for ${style}:`, error);
      return null;
    }
  }
  
  /**
   * Save style to localStorage cache
   */
  private saveToCache(style: MapStyle, styleData: any): void {
    if (typeof window === 'undefined') return;
    
    try {
      const cacheKey = this.getCacheKey(style);
      const cached: CachedStyleData = {
        styleData,
        timestamp: Date.now(),
        version: styleData.version || STYLE_CACHE_VERSION,
      };
      localStorage.setItem(cacheKey, JSON.stringify(cached));
    } catch (error) {
      // localStorage quota exceeded or disabled - silently fail
      console.debug(`[MapStylePreloader] Failed to save cache for ${style}:`, error);
    }
  }

  /**
   * Preload a map style by fetching its style JSON
   * Checks localStorage cache first, then falls back to API
   */
  private async preloadStyle(style: MapStyle): Promise<void> {
    if (this.preloadedStyles.has(style) && this.preloadedStyles.get(style)!.loaded) {
      return; // Already loaded
    }

    if (this.preloadPromises.has(style)) {
      return this.preloadPromises.get(style)!; // Already preloading
    }

    const styleUrl = MAP_CONFIG.STRATEGIC_STYLES[style];
    if (!styleUrl) {
      console.warn(`[MapStylePreloader] No style URL configured for ${style}`);
      return;
    }

    const preloadPromise = (async () => {
      try {
        // Check cache first
        const cached = this.loadFromCache(style);
        if (cached) {
          // Sprites are loaded automatically by Mapbox GL JS when style is used
          // No need to preload them manually
          
          this.preloadedStyles.set(style, {
            styleUrl,
            loaded: true,
            cached: true,
          });

          this.preloadPromises.delete(style);
          return;
        }

        // Extract style ID from Mapbox style URL
        // Format: mapbox://styles/mapbox/streets-v12 or mapbox://styles/mapbox/satellite-streets-v12
        // The URL format is: mapbox://styles/mapbox/STYLE_ID
        const styleMatch = styleUrl.match(/mapbox:\/\/styles\/mapbox\/([^/]+)/);
        if (!styleMatch) {
          throw new Error(`Invalid style URL: ${styleUrl}`);
        }

        const styleId = styleMatch[1];
        const apiUrl = `https://api.mapbox.com/styles/v1/mapbox/${styleId}?access_token=${MAP_CONFIG.MAPBOX_TOKEN}`;

        // Fetch style JSON from API
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`Failed to preload style: ${response.statusText}`);
        }

        const styleData = await response.json();
        
        // Cache the style JSON
        this.saveToCache(style, styleData);

        // Note: Sprites and glyphs are loaded automatically by Mapbox GL JS
        // when the style is actually used. No need to preload them manually.
        // Manual preloading causes CORS errors and 404s.

        this.preloadedStyles.set(style, {
          styleUrl,
          loaded: true,
          cached: false,
        });

        this.preloadPromises.delete(style);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.preloadedStyles.set(style, {
          styleUrl,
          loaded: false,
          error: err,
        });
        this.preloadPromises.delete(style);
        console.warn(`[MapStylePreloader] Failed to preload ${style}:`, err);
      }
    })();

    this.preloadPromises.set(style, preloadPromise);
    return preloadPromise;
  }

  /**
   * Preload all map styles
   */
  async preloadAllStyles(): Promise<void> {
    const styles: MapStyle[] = ['streets', 'satellite', 'light', 'dark'];
    await Promise.all(styles.map(style => this.preloadStyle(style)));
  }
  
  /**
   * Clear cached styles (useful for testing or cache invalidation)
   */
  clearCache(): void {
    if (typeof window === 'undefined') return;
    
    const styles: MapStyle[] = ['streets', 'satellite', 'light', 'dark'];
    styles.forEach(style => {
      try {
        const cacheKey = this.getCacheKey(style);
        localStorage.removeItem(cacheKey);
      } catch (error) {
        console.debug(`[MapStylePreloader] Failed to clear cache for ${style}:`, error);
      }
    });
  }

  /**
   * Preload specific styles
   */
  async preloadStyles(styles: MapStyle[]): Promise<void> {
    await Promise.all(styles.map(style => this.preloadStyle(style)));
  }

  /**
   * Check if a style is preloaded
   */
  isPreloaded(style: MapStyle): boolean {
    return this.preloadedStyles.has(style) && this.preloadedStyles.get(style)!.loaded;
  }

  /**
   * Get preload status for all styles
   */
  getPreloadStatus(): Record<MapStyle, boolean> {
    return {
      streets: this.isPreloaded('streets'),
      satellite: this.isPreloaded('satellite'),
      light: this.isPreloaded('light'),
      dark: this.isPreloaded('dark'),
    };
  }
}

// Singleton instance
export const mapStylePreloader = new MapStylePreloader();

