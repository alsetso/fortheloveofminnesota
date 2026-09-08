/**
 * Device hardware screen corner radius (Despia).
 * @see https://setup.despia.com/native-features/screen-radius
 *
 * Runtime injects `--screen-radius` and `despia.screenRadius` (CSS px).
 * Desktop / non-Despia: fall back to a modern-iPhone-ish value so float
 * sheets still look concentric in preview.
 */

const PREVIEW_FALLBACK_PX = 44;

type DespiaScreenRadiusHost = {
  screenRadius?: number;
};

export function readScreenRadiusPx(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return PREVIEW_FALLBACK_PX;
  }

  const fromBridge = (window as Window & { despia?: DespiaScreenRadiusHost }).despia
    ?.screenRadius;
  if (typeof fromBridge === 'number' && Number.isFinite(fromBridge)) {
    return Math.max(0, fromBridge);
  }

  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--screen-radius')
    .trim();
  if (raw) {
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      // Explicit 0 = square screen from Despia; missing var → preview fallback below.
      return parsed;
    }
  }

  return PREVIEW_FALLBACK_PX;
}
