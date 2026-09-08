import type { ReactNode } from 'react';
import type { ActivityTab } from '@/features/community/pinPostApi';
import { IconBookmark, IconChat, IconHeart, IconMapPin } from '@/features/map/dockCore/core/icons';

export type ActivityTypeMeta = {
  id: ActivityTab;
  label: string;
  /** Shown on the "Select your activity type" row. */
  subtitle: string;
  /** Shown when this type's list is empty. */
  emptyCopy: string;
  icon: ReactNode;
};

/**
 * Every "Your activity" type — selector row order + detail-page copy live here
 * so adding a new type only means adding one entry to this list.
 */
export const ACTIVITY_TYPES: ActivityTypeMeta[] = [
  {
    id: 'pins',
    label: 'Pins',
    subtitle: 'Posts you have shared on the map',
    emptyCopy: 'You have not posted any pins yet',
    icon: <IconMapPin className="h-5 w-5" />,
  },
  {
    id: 'likes',
    label: 'Likes',
    subtitle: 'Posts you have liked',
    emptyCopy: 'Posts you like will show up here',
    icon: <IconHeart className="h-5 w-5" />,
  },
  {
    id: 'comments',
    label: 'Comments',
    subtitle: 'Posts you have commented on',
    emptyCopy: 'Posts you comment on will show up here',
    icon: <IconChat className="h-5 w-5" />,
  },
  {
    id: 'archived',
    label: 'Archive',
    subtitle: 'Pins hidden from the map and from others',
    emptyCopy: 'Archived pins stay here — hidden from the map and from others',
    icon: <IconBookmark className="h-5 w-5" />,
  },
];

export function activityTypeMeta(id: ActivityTab): ActivityTypeMeta {
  return ACTIVITY_TYPES.find((t) => t.id === id) ?? ACTIVITY_TYPES[0]!;
}
