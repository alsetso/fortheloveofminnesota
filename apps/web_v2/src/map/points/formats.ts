import { getFindMeAvatarTapHandler } from '@/map/points/avatarTapHandler';
import type { MapPointFormat, MapPointMarkerHandle } from '@/map/points/types';

function pingPulse(pulseEl: HTMLElement) {
  pulseEl.classList.remove('is-pinging');
  void pulseEl.offsetWidth;
  pulseEl.classList.add('is-pinging');
}

/**
 * Selected-point: blue pulse circle centered on the tap (no pin).
 * Root IS the circle (same w/h) + `anchor: 'center'` so lng/lat = circle middle.
 * Pulse is an absolute child that can expand without shifting the anchor box.
 */
export const selectedPointFormat: MapPointFormat = {
  id: 'selected',
  styleId: 'map-point-format-selected-v4',
  styleText: `
    @keyframes map-point-selected-ping {
      0% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0.55;
      }
      100% {
        transform: translate(-50%, -50%) scale(2.4);
        opacity: 0;
      }
    }
    .map-point-selected {
      position: relative;
      box-sizing: border-box;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background-color: rgba(0, 122, 255, 0.28);
      border: 1.5px solid rgba(0, 122, 255, 0.65);
      pointer-events: none;
      overflow: visible;
    }
    .map-point-selected-pulse {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background-color: rgba(0, 122, 255, 0.28);
      border: 1.5px solid rgba(0, 122, 255, 0.5);
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
      pointer-events: none;
    }
    .map-point-selected-pulse.is-pinging {
      animation: map-point-selected-ping 0.85s ease-out forwards;
    }
  `,
  anchor: 'center',
  offset: [0, 0],
  pitchAlignment: 'viewport',
  rotationAlignment: 'viewport',
  build() {
    const element = document.createElement('div');
    element.className = 'map-point-selected';
    element.setAttribute('aria-hidden', 'true');
    // Inline size so Mapbox’s anchor math runs before stylesheet paint.
    element.style.width = '22px';
    element.style.height = '22px';

    const pulse = document.createElement('div');
    pulse.className = 'map-point-selected-pulse';
    element.appendChild(pulse);

    return { element, parts: { pulse } };
  },
  onCoordsApplied(handle: MapPointMarkerHandle) {
    const pulse = handle.parts.pulse;
    if (pulse) pingPulse(pulse);
  },
};

/**
 * Find Me — Explore surface: clean iOS blue dot (no avatar, non-interactive).
 * Solid `#007AFF` circle + white border + GPS pulse. Used when lockToUser=false.
 */
export const userLocationDotFormat: MapPointFormat = {
  id: 'user-location-dot',
  styleId: 'map-point-format-user-location-dot-v1',
  styleText: `
    @keyframes map-point-user-dot-ping {
      0% {
        transform: translate(-50%, -50%) scale(0.85);
        opacity: 0.55;
      }
      100% {
        transform: translate(-50%, -50%) scale(2.4);
        opacity: 0;
      }
    }
    .map-point-user-dot {
      position: relative;
      pointer-events: none;
      width: 44px;
      height: 44px;
    }
    .map-point-user-dot-pulse {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background-color: rgba(0, 122, 255, 0.18);
      border: 1.5px solid rgba(0, 122, 255, 0.38);
      transform: translate(-50%, -50%) scale(0.85);
      opacity: 0;
      pointer-events: none;
    }
    .map-point-user-dot-pulse.is-pinging {
      animation: map-point-user-dot-ping 0.9s ease-out forwards;
    }
    .map-point-user-dot-inner {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: #007AFF;
      border: 2.5px solid #ffffff;
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 122, 255, 0.15);
      transform: translate(-50%, -50%);
    }
  `,
  anchor: 'center',
  pitchAlignment: 'viewport',
  rotationAlignment: 'viewport',
  build() {
    const element = document.createElement('div');
    element.className = 'map-point-user-dot';
    element.setAttribute('aria-hidden', 'true');

    const pulse = document.createElement('div');
    pulse.className = 'map-point-user-dot-pulse';

    const inner = document.createElement('div');
    inner.className = 'map-point-user-dot-inner';

    element.appendChild(pulse);
    element.appendChild(inner);

    return { element, parts: { pulse } };
  },
  onCoordsApplied(handle: MapPointMarkerHandle) {
    const pulse = handle.parts.pulse;
    if (pulse) pingPulse(pulse);
  },
};

/**
 * Find Me — Game surface: account photo (or initials) + light pulse.
 * Marker stays viewport-upright at all times — no heading wedge.
 * `.has-photo` tones down the blue halo so the face reads first.
 */
export const userLocationFormat: MapPointFormat = {
  id: 'user-location',
  styleId: 'map-point-format-user-location-v6',
  styleText: `
    @keyframes map-point-user-loc-ping {
      0% {
        transform: translate(-50%, -50%) scale(0.92);
        opacity: 0.5;
      }
      100% {
        transform: translate(-50%, -50%) scale(2.2);
        opacity: 0;
      }
    }
    .map-point-user-loc {
      position: relative;
      pointer-events: none;
      width: 56px;
      height: 56px;
    }
    .map-point-user-loc-halo {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background-color: rgba(0, 122, 255, 0.12);
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
    .map-point-user-loc.has-photo .map-point-user-loc-halo {
      background-color: rgba(0, 0, 0, 0.06);
    }
    .map-point-user-loc-pulse {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background-color: rgba(0, 122, 255, 0.18);
      border: 1.5px solid rgba(0, 122, 255, 0.4);
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.92);
      opacity: 0;
      pointer-events: none;
    }
    .map-point-user-loc.has-photo .map-point-user-loc-pulse {
      background-color: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.55);
    }
    .map-point-user-loc-pulse.is-pinging {
      animation: map-point-user-loc-ping 0.85s ease-out forwards;
    }
    .map-point-user-loc-avatar {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      background-color: #e8f1ff;
      border: 3px solid #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
      transform: translate(-50%, -50%);
      cursor: pointer;
      pointer-events: auto;
      -webkit-tap-highlight-color: transparent;
    }
    .map-point-user-loc-avatar img {
      display: none;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .map-point-user-loc-avatar img.is-on {
      display: block;
    }
    .map-point-user-loc-fallback {
      display: flex;
      width: 100%;
      height: 100%;
      align-items: center;
      justify-content: center;
      background-color: rgba(0, 122, 255, 0.16);
      color: #007AFF;
      font: 700 13px/1 system-ui, -apple-system, sans-serif;
      letter-spacing: 0.02em;
    }
    .map-point-user-loc-fallback.is-off {
      display: none;
    }
    .map-point-user-loc-mode {
      position: absolute;
      top: calc(50% + 26px);
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      background-color: rgba(0, 0, 0, 0.52);
      color: #ffffff;
      font: 600 9px/1 system-ui, -apple-system, sans-serif;
      letter-spacing: 0.03em;
      padding: 2px 5px 2.5px;
      border-radius: 4px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.18s ease;
    }
    .map-point-user-loc-mode.is-visible {
      opacity: 1;
    }
  `,
  anchor: 'center',
  pitchAlignment: 'viewport',
  rotationAlignment: 'viewport',
  build() {
    const element = document.createElement('div');
    element.className = 'map-point-user-loc';
    element.setAttribute('aria-hidden', 'true');

    const halo = document.createElement('div');
    halo.className = 'map-point-user-loc-halo';

    const pulse = document.createElement('div');
    pulse.className = 'map-point-user-loc-pulse';

    const avatar = document.createElement('div');
    avatar.className = 'map-point-user-loc-avatar';
    avatar.setAttribute('role', 'button');
    avatar.setAttribute('aria-label', 'Open account');
    avatar.tabIndex = 0;
    avatar.addEventListener('click', (e) => {
      e.stopPropagation();
      getFindMeAvatarTapHandler()?.();
    });
    avatar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        getFindMeAvatarTapHandler()?.();
      }
    });

    const fallback = document.createElement('span');
    fallback.className = 'map-point-user-loc-fallback';
    fallback.textContent = '?';

    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    // Prefer high-res decode for profile photos on retina.
    img.setAttribute('loading', 'eager');

    avatar.appendChild(img);
    avatar.appendChild(fallback);

    const modeLabel = document.createElement('div');
    modeLabel.className = 'map-point-user-loc-mode';

    element.appendChild(halo);
    element.appendChild(pulse);
    element.appendChild(avatar);
    element.appendChild(modeLabel);

    return {
      element,
      parts: { pulse, avatar, avatarImg: img, avatarFallback: fallback, modeLabel },
    };
  },
  onCoordsApplied(handle: MapPointMarkerHandle) {
    const pulse = handle.parts.pulse;
    if (pulse) pingPulse(pulse);
  },
};
