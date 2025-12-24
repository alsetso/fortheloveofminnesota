'use client';

import { usePageView } from '@/hooks/usePageView';

interface LocationPageClientProps {
  locationId: string;
  locationSlug: string;
  type?: 'city' | 'county';
}

export default function LocationPageClient({ locationId, locationSlug, type = 'city' }: LocationPageClientProps) {
  // Track page view
  usePageView();
  
  return null;
}


