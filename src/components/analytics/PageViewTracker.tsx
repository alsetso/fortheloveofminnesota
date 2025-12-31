'use client';

import { usePageView } from '@/hooks/usePageView';
import { usePathname } from 'next/navigation';

interface PageViewTrackerProps {
  page_url?: string; // Optional - defaults to current pathname
}

/**
 * Client component to track page views
 * Automatically uses current pathname if page_url not provided
 */
export default function PageViewTracker({ page_url }: PageViewTrackerProps) {
  const pathname = usePathname();
  const url = page_url || pathname || '/';
  
  usePageView({ page_url: url });
  return null;
}

