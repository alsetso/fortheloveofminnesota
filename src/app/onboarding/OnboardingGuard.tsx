'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStateSafe } from '@/features/auth';
/**
 * Client-side guard that prevents navigation away from onboarding page
 * until account is onboarded
 */
export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { account } = useAuthStateSafe();
  const [isOnboarded, setIsOnboarded] = useState(false);

  // Check if account is onboarded
  useEffect(() => {
    if (account) {
      const onboarded = account.onboarded === true;
      setIsOnboarded(onboarded);
      
      // If onboarded, redirect away from onboarding page
      if (onboarded && pathname === '/onboarding') {
        // Redirect to profile if username exists
        if (account.username) {
          router.replace(`/${account.username}`);
        } else {
          router.replace('/');
        }
      }
    }
  }, [account, pathname, router]);

  // Prevent browser navigation away from page
  useEffect(() => {
    if (isOnboarded) return;

    let allowNavigation = false;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowNavigation) {
        return; // Allow navigation
      }
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    const handleIntentionalNavigation = () => {
      allowNavigation = true;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('intentional-navigation', handleIntentionalNavigation);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('intentional-navigation', handleIntentionalNavigation);
    };
  }, [isOnboarded]);

  // Intercept Next.js router navigation attempts
  useEffect(() => {
    if (isOnboarded) return;

    const handleRouteChange = (url: string) => {
      // Allow navigation to same route
      if (url === '/onboarding') return;
      
      // Block navigation away from onboarding
      // This is a soft block - we'll rely on middleware for hard redirects
      // But we can show a message or prevent the navigation
      if (pathname === '/onboarding' && url !== '/onboarding') {
        // Cancel the navigation by not calling router.push
        // The middleware will handle redirecting back to /onboarding
        return;
      }
    };

    // Note: Next.js router doesn't have a direct way to intercept all navigation
    // We rely on middleware to redirect back to /onboarding
    // This effect is mainly for the beforeunload handler above
  }, [isOnboarded, pathname]);

  return <>{children}</>;
}
