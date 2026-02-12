'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStateSafe } from '@/features/auth';
import PromotionalBanner from './PromotionalBanner';

interface ProtectedRouteGuardProps {
  children: React.ReactNode;
  /** Routes that are allowed for anonymous users */
  allowedRoutes?: string[];
}

/**
 * ProtectedRouteGuard - Shows promotional banner for anonymous users on protected routes
 * 
 * Only allows anonymous access to:
 * - Homepage (/)
 * - Mention detail pages (/mention/[id])
 * - Profile pages (/[username])
 * 
 * All other routes show a full-screen promotional banner forcing signup.
 */
export default function ProtectedRouteGuard({ 
  children, 
  allowedRoutes = ['/', '/mention/', '/'] // Default: homepage, mention pages, and profile pages
}: ProtectedRouteGuardProps) {
  const pathname = usePathname();
  const { account, activeAccountId, isLoading } = useAuthStateSafe();
  const [showBanner, setShowBanner] = useState(false);

  const isAuthenticated = Boolean(account || activeAccountId);

  // Check if current route is allowed for anonymous users
  const isAllowedRoute = (() => {
    if (!pathname) return false;
    
    // Homepage is always allowed
    if (pathname === '/') return true;
    
    // Maps page (shows live map) is temporarily allowed for anonymous users
    if (pathname === '/maps') return true;
    
    // Mention detail pages are allowed
    if (pathname.startsWith('/mention/')) {
      // Extract the ID part and check if it's a valid UUID format
      const mentionId = pathname.split('/mention/')[1]?.split('/')[0];
      if (mentionId && mentionId.length > 0) {
        return true;
      }
    }
    
    // Profile pages (username routes) are allowed
    // Check if pathname matches pattern: /[username] (single segment, not starting with known routes)
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 1) {
      const firstSegment = segments[0];
      // Exclude known routes that aren't usernames
      // Note: 'live' is allowed above, so it's excluded here to prevent username conflicts
      const excludedRoutes = [
        'map', 'maps', 'settings', 'news', 'gov', 'analytics', 
        'billing', 'admin', 'login', 'signup', 'onboarding',
        'contact', 'privacy', 'terms', 'download', 'api', '_next', 'favicon.ico'
      ];
      if (!excludedRoutes.includes(firstSegment.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  })();

  useEffect(() => {
    // Wait for auth to load
    if (isLoading) return;

    // If authenticated, never show banner
    if (isAuthenticated) {
      setShowBanner(false);
      return;
    }

    // If route is allowed, don't show banner
    if (isAllowedRoute) {
      setShowBanner(false);
      return;
    }

    // Otherwise, show banner for protected routes
    setShowBanner(true);
  }, [isLoading, isAuthenticated, isAllowedRoute, pathname]);

  // Show loading state while checking auth
  if (isLoading) {
    return <>{children}</>;
  }

  // If banner should be shown, render it instead of children
  if (showBanner) {
    return <PromotionalBanner isOpen={true} />;
  }

  // Otherwise, render children normally
  return <>{children}</>;
}
