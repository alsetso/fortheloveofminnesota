'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { setAvatarStore } from './avatarStore';
import {
  clearAvatarCacheMeta,
  primeAvatarGlbCache,
  readAvatarCacheMeta,
  writeAvatarCacheMeta,
} from './avatarLocalCache';

export type AvatarModel = {
  id: string;
  slug: string;
  name: string;
  file_path: string;
  real_world_meters: number;
  sort_order: number;
};

export type AvatarMeResponse = {
  avatar_model_id: string | null;
  avatar_url: string | null;
  avatar_slug: string | null;
  avatar_name: string | null;
  owned_assets: Array<{
    asset_id: string;
    unlocked_at: string;
    slug: string;
    name: string;
    file_path: string;
    attach_point: string;
  }>;
};

// ─── Module-level singleton ───────────────────────────────────────────────────
// Multiple callers (AvatarBootstrap, AvatarPickerGate) share one network request
// and one result. The second mount is a guaranteed no-op.

type AvatarSnap = { loading: boolean; data: AvatarMeResponse | null; error: string | null };

let _snap: AvatarSnap = { loading: true, data: null, error: null };
let _loadPromise: Promise<void> | null = null;

const _listeners = new Set<() => void>();

function _emit(): void {
  for (const fn of _listeners) fn();
}

function _getSnapshot(): AvatarSnap {
  return _snap;
}

function _subscribeSnap(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/**
 * Fetches /api/avatar/me once per session. Subsequent calls while in-flight
 * or after completion are no-ops — all consumers share the promise.
 */
async function _doFetch(): Promise<void> {
  _snap = { ..._snap, loading: true, error: null };
  _emit();
  try {
    const res = await fetch('/api/avatar/me');
    if (!res.ok) throw new Error(`${res.status}`);
    const data = (await res.json()) as AvatarMeResponse;
    _snap = { loading: false, data, error: null };
    if (data.avatar_model_id && data.avatar_url && data.avatar_slug && data.avatar_name) {
      const entry = {
        modelId: data.avatar_slug,
        modelUrl: data.avatar_url,
        modelSlug: data.avatar_slug,
        modelName: data.avatar_name,
      };
      setAvatarStore(entry);
      writeAvatarCacheMeta(entry);
      void primeAvatarGlbCache(data.avatar_url);
    } else {
      setAvatarStore(null);
      clearAvatarCacheMeta();
    }
  } catch (err) {
    _snap = { loading: false, data: null, error: err instanceof Error ? err.message : 'Error' };
  }
  _emit();
}

function _ensureLoaded(): void {
  if (_loadPromise) return;
  _loadPromise = _doFetch();
}

/** Force a fresh fetch (e.g. after avatar selection). Clears the promise gate. */
function _refresh(): Promise<void> {
  _loadPromise = _doFetch();
  return _loadPromise;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches the current account's avatar from /api/avatar/me and hydrates
 * the module-level avatarStore so playerAvatarRuntime can read the URL.
 *
 * Safe to call from multiple components — the network request fires exactly
 * once per session regardless of how many hook instances are mounted.
 *
 * On mount, immediately seeds avatarStore from localStorage (avatarLocalCache
 * Layer 1) so the player's avatar renders without waiting for the network —
 * no male-base fallback flash on repeat sessions.
 *
 * After a successful fetch the metadata is written back to localStorage and
 * the GLB is primed into the Cache API (Layer 2) for offline resilience.
 */
export function useAvatarMe() {
  const snap = useSyncExternalStore(_subscribeSnap, _getSnapshot, _getSnapshot);

  // Instant hydration from cache — runs before the API fetch resolves.
  useEffect(() => {
    const meta = readAvatarCacheMeta();
    if (meta) {
      setAvatarStore({
        modelId: meta.modelId,
        modelUrl: meta.modelUrl,
        modelSlug: meta.modelSlug,
        modelName: meta.modelName,
      });
      void primeAvatarGlbCache(meta.modelUrl);
    }
  // Intentionally empty dep array — runs once on mount only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kick the shared load — idempotent, second caller is a no-op.
  useEffect(() => {
    _ensureLoaded();
  }, []);

  const refresh = useCallback(async () => {
    await _refresh();
  }, []);

  return { ...snap, refresh };
}
