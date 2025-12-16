'use client';

import { usePageView } from '@/hooks/usePageView';

interface CountyPageClientProps {
  countyId: string;
  countySlug: string;
}

export default function CountyPageClient({ countyId, countySlug }: CountyPageClientProps) {
  // Track page view
  usePageView();
  
  return null;
}

