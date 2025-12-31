'use client';

import { usePageView } from '@/hooks/usePageView';

/**
 * Consolidated page view tracker for all /gov pages
 */
export default function GovPageViewTracker() {
  usePageView();
  return null;
}

