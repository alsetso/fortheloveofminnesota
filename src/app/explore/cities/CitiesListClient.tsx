'use client';

import { usePageView } from '@/hooks/usePageView';

export default function CitiesListClient() {
  // Track page view
  usePageView();
  
  return null;
}

