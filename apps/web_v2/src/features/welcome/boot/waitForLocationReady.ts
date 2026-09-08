import { getFindMeCoordsSnapshot } from '@/map/location/camera/findMeCoordsStore';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';
import { isWithinMinnesota } from '@/map/location/device/minnesotaGate';

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/**
 * Soft wait for an MN location fix during boot — never prompts the OS.
 */
export async function waitForLocationReady(
  phase: () => string,
  budgetMs: number,
  signal: AbortSignal,
): Promise<{ lat: number; lng: number } | null> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (signal.aborted) return null;
    const live = getFindMeCoordsSnapshot().coords;
    if (live && isWithinMinnesota(live) && phase() === 'active') return live;
    if (live && isWithinMinnesota(live) && phase() !== 'finding') return live;
    const cached = getFindMeLastCoords();
    if (cached && isWithinMinnesota(cached) && phase() === 'active') {
      return cached;
    }
    if (phase() === 'idle' || phase() === 'error') {
      if (live && isWithinMinnesota(live)) return live;
      if (cached && isWithinMinnesota(cached)) return cached;
      break;
    }
    await sleep(120, signal).catch(() => undefined);
  }
  const live = getFindMeCoordsSnapshot().coords;
  if (live && isWithinMinnesota(live)) return live;
  const cached = getFindMeLastCoords();
  return cached && isWithinMinnesota(cached) ? cached : null;
}
