'use client';

/**
 * User position on the map.
 *
 * `dot`    — Story / atlas: GpsPuckView
 * `avatar` — Campaign / Game: AvatarPositionView
 */

import { AvatarPositionView } from '@/map/location/player/AvatarPositionView';
import { GpsPuckView } from '@/map/location/position/GpsPuckView';
import type { UserMapPositionVariant } from '@/map/location/position/paintUserMapPosition';

export function UserMapPositionView({
  variant = 'avatar',
}: {
  variant?: UserMapPositionVariant;
}) {
  if (variant === 'dot') return <GpsPuckView />;
  return <AvatarPositionView />;
}
