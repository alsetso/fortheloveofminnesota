'use client';

import { useCallback } from 'react';
import { AvatarPickerModal } from './AvatarPickerModal';
import { useAvatarMe } from './useAvatarMe';
import {
  ONBOARDING_AVATAR_SLUGS,
  getWarmedChosenAvatarId,
} from '@/features/setup/setupAvatarStore';

/**
 * Mounts in GameDock. On first game load, if the account has no avatar set,
 * forces the picker modal before the player is shown on the map.
 *
 * Also checks getWarmedChosenAvatarId() — set synchronously by selectSetupAvatar
 * during the profile phase — so the gate doesn't re-fire for users who just
 * completed setup even if useAvatarMe hasn't re-fetched from /api/avatar/me yet.
 *
 * After selection, refreshes avatar state so playerAvatarRuntime picks up
 * the new GLB URL immediately.
 */
export function AvatarPickerGate() {
  const { loading, data, refresh } = useAvatarMe();

  const handleSelect = useCallback(async (modelId: string) => {
    const res = await fetch('/api/avatar/select', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_model_id: modelId }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      throw new Error(json.error ?? 'Failed to save avatar');
    }
    await refresh();
  }, [refresh]);

  if (loading || !data) return null;

  // Avatar already set on server — skip the gate.
  // Also bail if selectSetupAvatar ran during profile setup and confirmed the
  // PATCH: the gate should not ask again just because useAvatarMe hasn't
  // re-fetched yet.
  if (data.avatar_model_id ?? getWarmedChosenAvatarId()) return null;

  return (
    <AvatarPickerModal
      currentModelId={null}
      onSelect={handleSelect}
      dismissable={false}
      slugAllowlist={ONBOARDING_AVATAR_SLUGS}
    />
  );
}
