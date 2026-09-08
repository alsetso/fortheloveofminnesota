'use client';

import { AvatarPositionView } from '@/map/location/player/AvatarPositionView';
import { CampaignAvatarNameplate } from '@/map/location/player/CampaignAvatarNameplate';

/** Campaign-only 3D scout + nameplate. Loaded only on /campaign. */
export function CampaignLayers() {
  return (
    <>
      <AvatarPositionView />
      <CampaignAvatarNameplate />
    </>
  );
}
