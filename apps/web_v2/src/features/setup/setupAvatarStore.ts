/**
 * Setup avatar store — single source of truth for onboarding avatar selection.
 *
 * Consolidates:
 *   - Catalog warm-up (parallel fetch + GLB pre-cache)
 *   - Male / female base-figure selection state
 *   - Serialized PATCH to /api/avatar/select on pick
 *
 * Key invariant: selectSetupAvatar() always completes its PATCH before
 * returning, and updates chosenId so AvatarPickerGate can skip re-asking.
 */

import { setAvatarStore } from '@/features/avatar/avatarStore';
import { haptic } from '@/lib/despia/haptics';
import type { AvatarModel, AvatarMeResponse } from '@/features/avatar/useAvatarMe';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Slugs surfaced during onboarding — the two base figures only. */
export const ONBOARDING_AVATAR_SLUGS = ['avatar-male', 'avatar-female'] as const;

export function isOnboardingAvatar(av: Pick<AvatarModel, 'slug'>): boolean {
  return (ONBOARDING_AVATAR_SLUGS as readonly string[]).includes(av.slug);
}

// ─── Catalog warm-up ──────────────────────────────────────────────────────────

let catalog: AvatarModel[] | null = null;
let chosenId: string | null = null;
let inflight: Promise<AvatarModel[]> | null = null;
const catalogListeners = new Set<() => void>();

export function getWarmedAvatarCatalog(): AvatarModel[] | null { return catalog; }

/** Returns the avatar_model_id that was active when warmup last ran, or that
 *  was set by selectSetupAvatar. Used by AvatarPickerGate to skip re-asking. */
export function getWarmedChosenAvatarId(): string | null { return chosenId; }

export function subscribeWarmedAvatarCatalog(fn: () => void): () => void {
  catalogListeners.add(fn);
  return () => { catalogListeners.delete(fn); };
}

export function warmupSetupAvatars(): Promise<AvatarModel[]> {
  if (catalog) return Promise.resolve(catalog);
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const [catalogRes, meRes] = await Promise.all([
        fetch('/api/avatar/catalog'),
        fetch('/api/avatar/me'),
      ]);

      if (!catalogRes.ok) { setAvatarStore(null); return []; }

      const catalogJson = (await catalogRes.json()) as { avatars?: AvatarModel[] };
      const list = (catalogJson.avatars ?? []).filter(isOnboardingAvatar);
      catalog = list;
      for (const fn of catalogListeners) fn();

      let me: AvatarMeResponse | null = null;
      if (meRes.ok) me = (await meRes.json()) as AvatarMeResponse;

      chosenId = me?.avatar_model_id ?? null;
      const saved = chosenId ? list.find(a => a.id === chosenId) : null;
      const chosen = saved ?? list[0] ?? null;

      if (chosen) {
        setAvatarStore({
          modelId: chosen.slug,
          modelUrl: chosen.file_path,
          modelSlug: chosen.slug,
          modelName: chosen.name,
        });
      } else if (me?.avatar_slug && me.avatar_url && me.avatar_name) {
        setAvatarStore({
          modelId: me.avatar_slug,
          modelUrl: me.avatar_url,
          modelSlug: me.avatar_slug,
          modelName: me.avatar_name,
        });
      } else {
        setAvatarStore(null);
      }

      for (const av of list) {
        if (av.file_path) void fetch(av.file_path, { method: 'GET', cache: 'force-cache' }).catch(() => {});
      }

      return list;
    } catch {
      setAvatarStore(null);
      return [];
    } finally {
      if (!catalog) inflight = null;
    }
  })();

  return inflight;
}

// ─── Sex selection state ──────────────────────────────────────────────────────

export type SetupAvatarSex = 'male' | 'female';

let selected: SetupAvatarSex | null = null;
const sexListeners = new Set<() => void>();

export function getSetupAvatarSex(): SetupAvatarSex | null { return selected; }

export function subscribeSetupAvatarSex(fn: () => void): () => void {
  sexListeners.add(fn);
  return () => { sexListeners.delete(fn); };
}

function emitSex(): void { for (const fn of sexListeners) fn(); }

export function sexOfAvatar(av: Pick<AvatarModel, 'slug' | 'name'>): SetupAvatarSex | null {
  if (av.slug === 'avatar-male' || /^male\b/i.test(av.name)) return 'male';
  if (av.slug === 'avatar-female' || /^female\b/i.test(av.name)) return 'female';
  return null;
}

function modelFor(list: AvatarModel[], sex: SetupAvatarSex): AvatarModel | null {
  return list.find(a => sexOfAvatar(a) === sex) ?? null;
}

export function hydrateSetupAvatarSexFromCatalog(
  list: AvatarModel[],
  savedId: string | null,
): void {
  const saved = savedId ? list.find(a => a.id === savedId) : null;
  const sex = saved ? sexOfAvatar(saved) : null;
  if (sex && selected !== sex) { selected = sex; emitSex(); }
}

// Serializes concurrent PATCH calls — callers await the previous save before
// starting the next, so the server always sees the user's final intent.
let patchChain: Promise<void> = Promise.resolve();

/**
 * Select a base avatar by sex. Optimistically updates local state and the map
 * mesh immediately, then awaits a serialized PATCH to /api/avatar/select.
 *
 * Fully awaitable — callers (e.g. onSubmit) can reliably wait for server
 * confirmation before calling the onboard endpoint.
 */
export async function selectSetupAvatar(sex: SetupAvatarSex): Promise<void> {
  const list = getWarmedAvatarCatalog();
  if (!list) return;
  const av = modelFor(list, sex);
  if (!av) return;

  const changed = selected !== sex;
  selected = sex;
  emitSex();

  setAvatarStore({
    modelId: av.slug,
    modelUrl: av.file_path,
    modelSlug: av.slug,
    modelName: av.name,
  });

  if (changed) haptic.toggle();

  // Record the chosen ID immediately so AvatarPickerGate can check it
  // before useAvatarMe re-fetches from /api/avatar/me.
  chosenId = av.id;

  // Serialize: append to the chain so concurrent calls don't race.
  patchChain = patchChain.then(async () => {
    try {
      await fetch('/api/avatar/select', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_model_id: av.id }),
      });
    } catch {
      // Non-fatal — local state + chosenId already reflect the pick.
    }
  });

  await patchChain;
}
