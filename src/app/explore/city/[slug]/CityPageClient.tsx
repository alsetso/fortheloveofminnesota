'use client';

import { usePageView } from '@/hooks/usePageView';

interface CityPageClientProps {
  cityId: string;
  citySlug: string;
}

export default function CityPageClient({ cityId, citySlug }: CityPageClientProps) {
  // Track page view
  usePageView();
  
  return null;
}

