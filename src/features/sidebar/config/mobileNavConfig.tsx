import type { ComponentType, ReactNode } from 'react';
import {
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import {
  Cog6ToothIcon as Cog6ToothIconSolid,
} from '@heroicons/react/24/solid';
import Map3DControlsSecondaryContent from '../components/Map3DControlsSecondaryContent';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import type { Account } from '@/features/auth';

export type MobileNavItemId = 'controls';

export interface MobileNavItemConfig {
  id: MobileNavItemId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconSolid: ComponentType<{ className?: string }>;
  requiresAdmin?: boolean;
  getContent: (props: { 
    map?: MapboxMapInstance | null; 
    account?: Account | null;
  }) => ReactNode;
}

export const mobileNavConfig: MobileNavItemConfig[] = [
  {
    id: 'controls',
    label: 'Controls',
    icon: Cog6ToothIcon,
    iconSolid: Cog6ToothIconSolid,
    getContent: ({ map }) => (
      <Map3DControlsSecondaryContent 
        map={map} 
      />
    ),
  },
];

export function getMobileNavItems(account: Account | null): MobileNavItemConfig[] {
  return mobileNavConfig.filter((item) => {
    if (item.requiresAdmin) {
      return account?.role === 'admin';
    }
    return true;
  });
}

