import { useEffect, useRef } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';

type PinColor = 'white' | 'red';

interface UsePinMarkerOptions {
  map: MapboxMapInstance | null;
  coordinates: { lat: number; lng: number } | null;
  color?: PinColor;
  enabled?: boolean;
}

export function usePinMarker({ 
  map, 
  coordinates, 
  color = 'white',
  enabled = true 
}: UsePinMarkerOptions) {
  const markerRef = useRef<any>(null);
  const mapboxRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled || !map || !coordinates || (map as any).removed) {
      // Remove marker if disabled or no coordinates
      if (markerRef.current) {
        try {
          markerRef.current.remove();
        } catch {
          // Ignore cleanup errors
        }
        markerRef.current = null;
      }
      return;
    }

    const createOrUpdateMarker = async () => {
      try {
        // Lazy load mapbox
        if (!mapboxRef.current) {
          const mapbox = await import('mapbox-gl');
          mapboxRef.current = mapbox;
        }

        const mapbox = mapboxRef.current;
        const mapboxMap = map as any;

        // Remove existing marker
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }

        // Create marker element
        const el = document.createElement('div');
        el.className = 'map-click-pin-marker';
        
        const isRed = color === 'red';
        const bgColor = isRed ? '#ef4444' : '#ffffff';
        const borderColor = isRed ? '#ef4444' : 'rgba(0, 0, 0, 0.2)';
        const dotColor = isRed ? '#ffffff' : '#000000';

        // Add pulsing animation for white pins
        if (!isRed) {
          const styleId = 'map-click-pin-marker-style';
          if (!document.head.querySelector(`#${styleId}`)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
              @keyframes pulse-white {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
              }
              .map-click-pin-marker { animation: pulse-white 1.5s ease-in-out infinite; }
            `;
            document.head.appendChild(style);
          }
        }

        el.style.cssText = `
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background-color: ${bgColor};
          border: 1.5px solid ${borderColor};
          cursor: pointer;
          pointer-events: none;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        `;

        // Add dot
        const dot = document.createElement('div');
        dot.className = 'map-click-pin-dot';
        dot.style.cssText = `
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: ${dotColor};
          position: absolute;
        `;
        el.appendChild(dot);

        // Create marker
        const marker = new mapbox.Marker({
          element: el,
          anchor: 'center',
        })
          .setLngLat([coordinates.lng, coordinates.lat])
          .addTo(mapboxMap);

        markerRef.current = marker;
      } catch (err) {
        console.error('[usePinMarker] Error creating marker:', err);
      }
    };

    createOrUpdateMarker();

    return () => {
      if (markerRef.current) {
        try {
          markerRef.current.remove();
        } catch {
          // Ignore cleanup errors
        }
        markerRef.current = null;
      }
    };
  }, [map, coordinates, color, enabled]);

  return {
    remove: () => {
      if (markerRef.current) {
        try {
          markerRef.current.remove();
        } catch {
          // Ignore cleanup errors
        }
        markerRef.current = null;
      }
    },
  };
}
