'use client';

import { usePageView } from '@/hooks/usePageView';

/**
 * Client component to track homepage views
 * Must be a client component because usePageView requires browser APIs
 */
export default function HomepageViewTracker() {
  usePageView({ page_url: '/' });
  return null;
}

