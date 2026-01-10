/**
 * Map Style Preloader Service
 * Preloads map styles to enable instant switching
 */

import { MAP_CONFIG } from '../config';

type MapStyle = 'streets' | 'satellite';

interface PreloadedStyle {
  styleUrl: string;
  loaded: boolean;
  error?: Error;
}

class MapStylePreloader {
  private preloadedStyles: Map<MapStyle, PreloadedStyle> = new Map();
  private preloadPromises: Map<MapStyle, Promise<void>> = new Map();

  /**
   * Preload a map style by fetching its style JSON
   */
  private async preloadStyle(style: MapStyle): Promise<void> {
    if (this.preloadedStyles.has(style) && this.preloadedStyles.get(style)!.loaded) {
      return; // Already loaded
    }

    if (this.preloadPromises.has(style)) {
      return this.preloadPromises.get(style)!; // Already preloading
    }

    const styleUrl = MAP_CONFIG.STRATEGIC_STYLES[style];
    const preloadPromise = (async () => {
      try {
        // Extract style ID from Mapbox style URL
        // Format: mapbox://styles/mapbox/streets-v12 or mapbox://styles/mapbox/satellite-streets-v12
        // The URL format is: mapbox://styles/mapbox/STYLE_ID
        const styleMatch = styleUrl.match(/mapbox:\/\/styles\/mapbox\/([^/]+)/);
        if (!styleMatch) {
          throw new Error(`Invalid style URL: ${styleUrl}`);
        }

        const styleId = styleMatch[1];
        const apiUrl = `https://api.mapbox.com/styles/v1/mapbox/${styleId}?access_token=${MAP_CONFIG.MAPBOX_TOKEN}`;

        // Fetch style JSON to preload
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`Failed to preload style: ${response.statusText}`);
        }

        const styleData = await response.json();

        // Preload sprite and glyphs if available
        if (styleData.sprite) {
          const spriteUrl = typeof styleData.sprite === 'string' 
            ? styleData.sprite 
            : styleData.sprite[0];
          
          // Preload sprite JSON
          try {
            await fetch(`${spriteUrl}.json`);
          } catch (e) {
            // Sprite preload is optional
            console.debug(`[MapStylePreloader] Sprite preload failed for ${style}:`, e);
          }
        }

        this.preloadedStyles.set(style, {
          styleUrl,
          loaded: true,
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
    const styles: MapStyle[] = ['streets', 'satellite'];
    await Promise.all(styles.map(style => this.preloadStyle(style)));
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
    };
  }
}

// Singleton instance
export const mapStylePreloader = new MapStylePreloader();

