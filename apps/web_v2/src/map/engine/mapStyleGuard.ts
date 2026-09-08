import type { Map as MapboxMap } from 'mapbox-gl';

/**
 * Mapbox throws `this.style.getOwnSource` / `getOwnLayer` when style is null
 * (mid setStyle, teardown, or before first load). Guard every style API call.
 */
export function isMapStyleReady(map: MapboxMap | null | undefined): boolean {
  if (!map) return false;
  if ((map as MapboxMap & { _removed?: boolean })._removed) return false;
  try {
    // style can be null even when `ready` React state is true (reload race).
    const style = map.getStyle?.();
    if (!style) return false;
    return typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true;
  } catch {
    return false;
  }
}

/**
 * Resolve once the map style can accept camera / marker work.
 * `ready` alone is not enough — style can still be null mid setStyle.
 */
export function waitForMapStyleReady(
  map: MapboxMap,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<void> {
  if (isMapStyleReady(map)) return Promise.resolve();

  const timeoutMs = options?.timeoutMs ?? 20_000;
  const signal = options?.signal;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    let settled = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      map.off('style.load', onEvent);
      map.off('idle', onEvent);
      signal?.removeEventListener('abort', onAbort);
      if (err) reject(err);
      else resolve();
    };

    const onEvent = () => {
      if (isMapStyleReady(map)) finish();
    };

    const onAbort = () => {
      finish(new DOMException('Aborted', 'AbortError'));
    };

    const timer = setTimeout(() => {
      finish(new Error('Timed out waiting for map style'));
    }, timeoutMs);

    map.on('style.load', onEvent);
    map.on('idle', onEvent);
    signal?.addEventListener('abort', onAbort, { once: true });

    // May become ready between the initial check and listener attach.
    onEvent();
  });
}

export function safeGetSource(map: MapboxMap, sourceId: string) {
  if (!isMapStyleReady(map)) return undefined;
  try {
    return map.getSource(sourceId);
  } catch {
    return undefined;
  }
}

export function safeGetLayer(map: MapboxMap, layerId: string) {
  if (!isMapStyleReady(map)) return undefined;
  try {
    return map.getLayer(layerId);
  } catch {
    return undefined;
  }
}
