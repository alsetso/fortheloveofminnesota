/**
 * outOfRangePin — temporary white ghost pin for out-of-radius taps.
 *
 * Places a white teardrop pin (SVG) at the exact tap [lng, lat] using
 * a Mapbox GL Marker with anchor:'bottom'. The SVG tip is at y=32 of
 * the viewBox, which Mapbox aligns precisely to the geo-coordinate.
 *
 * Auto-clears after AUTO_CLEAR_MS. Calling show() again replaces any
 * existing pin immediately. clearOutOfRangePin() removes it early.
 */

import { loadMapboxGL } from '@/map/engine/mapboxLoader';
import type { Map as MapboxMap } from 'mapbox-gl';

const AUTO_CLEAR_MS = 3_000;
const RING_BLUE     = '#5BA3FF';

let activeMarker: import('mapbox-gl').Marker | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cancelTimer() {
  if (clearTimer !== null) { clearTimeout(clearTimer); clearTimer = null; }
}

/**
 * SVG teardrop pin.
 * ViewBox is 24×32. The tip of the teardrop is at (12, 32) — the exact
 * bottom-center of the element — so `anchor:'bottom'` pins the tip to
 * the geo-coordinate with no CSS offset tricks.
 */
function buildPinElement(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = [
    'pointer-events: none',
    'display: block',
    'width: 28px',
    'height: 36px',
    'opacity: 0',
    'transform: scale(0.5) translateY(10px)',
    'transform-origin: bottom center',
    'transition: opacity 200ms ease, transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
    'will-change: transform, opacity',
  ].join(';');

  el.innerHTML = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 32"
      width="28"
      height="36"
      overflow="visible"
    >
      <!-- Teardrop body — tip is at (12,32), the SVG bottom-center -->
      <path
        d="M12 1C6.48 1 2 5.48 2 11c0 7.74 10 20 10 20s10-12.26 10-20c0-5.52-4.48-10-10-10z"
        fill="#ffffff"
        stroke="${RING_BLUE}"
        stroke-width="1.8"
        stroke-dasharray="3 2"
      />
      <!-- Inner dot matching the ring color -->
      <circle cx="12" cy="11" r="3.5" fill="${RING_BLUE}" opacity="0.75"/>
    </svg>
  `;

  // Pop in on next frame so the browser paints the initial state first
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'scale(1) translateY(0)';
  });

  return el;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Show a temporary ghost pin at the geo-coordinate the user tapped.
 * anchor:'bottom' aligns the SVG tip (bottom-center of element) to [lng,lat].
 */
export async function showOutOfRangePin(
  map: MapboxMap,
  lng: number,
  lat: number,
): Promise<void> {
  cancelTimer();

  if (activeMarker) {
    activeMarker.remove();
    activeMarker = null;
  }

  const mapboxgl = await loadMapboxGL();

  // Guard: map may have been cleaned up during the async import
  if ((map as MapboxMap & { _removed?: boolean })._removed) return;

  const el = buildPinElement();
  const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom', offset: [0, 0] })
    .setLngLat([lng, lat])
    .addTo(map);

  activeMarker = marker;

  clearTimer = setTimeout(clearOutOfRangePin, AUTO_CLEAR_MS);
}

/** Fade out and remove the ghost pin immediately. */
export function clearOutOfRangePin(): void {
  cancelTimer();

  const marker = activeMarker;
  if (!marker) return;
  activeMarker = null;

  const el = marker.getElement();
  if (el) {
    el.style.transition = 'opacity 160ms ease, transform 160ms ease';
    el.style.opacity = '0';
    el.style.transform = 'scale(0.6) translateY(6px)';
    setTimeout(() => marker.remove(), 170);
  } else {
    marker.remove();
  }
}
