'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/features/ui/hooks/useToast';

/**
 * Client component that checks for blocked route query parameter
 * and shows a "coming soon" toast when a user is redirected from a disabled system
 */
export function BlockedRouteToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { info } = useToast();
  
  useEffect(() => {
    const blocked = searchParams.get('blocked');
    
    if (blocked) {
      const systemName = decodeURIComponent(blocked);
      
      // Show toast
      info(`${systemName} Coming Soon`, 'This feature is currently unavailable.');
      
      // Clean up URL by removing the query parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('blocked');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [searchParams, router, info]);
  
  return null;
}
