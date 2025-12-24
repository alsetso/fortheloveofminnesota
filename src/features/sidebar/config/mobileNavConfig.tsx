import React from 'react';
import {
  GlobeAltIcon,
  NewspaperIcon,
  QuestionMarkCircleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import {
  GlobeAltIcon as GlobeAltIconSolid,
  NewspaperIcon as NewspaperIconSolid,
  QuestionMarkCircleIcon as QuestionMarkCircleIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
} from '@heroicons/react/24/solid';
import ExploreSecondaryContent from '../components/ExploreSecondaryContent';
import NewsSecondaryContent from '../components/NewsSecondaryContent';
import FAQsSecondaryContent from '../components/FAQsSecondaryContent';
import Map3DControlsSecondaryContent from '../components/Map3DControlsSecondaryContent';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import type { Account } from '@/features/auth';

export type MobileNavItemId = 'explore' | 'news' | 'faqs' | 'controls';

export interface MobileNavItemConfig {
  id: MobileNavItemId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconSolid: React.ComponentType<{ className?: string }>;
  requiresAdmin?: boolean;
  getContent: (props: { 
    map?: MapboxMapInstance | null; 
    account?: Account | null;
    pointsOfInterestVisible?: boolean;
    onPointsOfInterestVisibilityChange?: (visible: boolean) => void;
  }) => React.ReactNode;
}

export const mobileNavConfig: MobileNavItemConfig[] = [
  {
    id: 'explore',
    label: 'Explore',
    icon: GlobeAltIcon,
    iconSolid: GlobeAltIconSolid,
    getContent: ({ map }) => <ExploreSecondaryContent map={map} />,
  },
  {
    id: 'controls',
    label: 'Controls',
    icon: Cog6ToothIcon,
    iconSolid: Cog6ToothIconSolid,
    getContent: ({ map, pointsOfInterestVisible, onPointsOfInterestVisibilityChange }) => (
      <Map3DControlsSecondaryContent 
        map={map} 
        pointsOfInterestVisible={pointsOfInterestVisible}
        onPointsOfInterestVisibilityChange={onPointsOfInterestVisibilityChange}
      />
    ),
  },
  {
    id: 'news',
    label: 'News',
    icon: NewspaperIcon,
    iconSolid: NewspaperIconSolid,
    getContent: () => <NewsSecondaryContent />,
  },
  {
    id: 'faqs',
    label: 'FAQs',
    icon: QuestionMarkCircleIcon,
    iconSolid: QuestionMarkCircleIconSolid,
    getContent: () => <FAQsSecondaryContent />,
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

