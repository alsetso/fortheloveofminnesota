/**
 * Utility functions for handling onboarding redirects
 */

import { redirect } from 'next/navigation';
import type { Account } from '@/features/auth/services/memberService';

/**
 * Check if user should be redirected to onboarding
 * Returns redirect URL if redirect needed, null otherwise
 */
export function shouldRedirectToOnboarding(account: Account | null): string | null {
  if (!account) {
    // No account means user needs to complete onboarding
    return '/?modal=account&tab=onboarding';
  }
  
  if (account.onboarded === false) {
    return '/?modal=account&tab=onboarding';
  }
  
  return null;
}

/**
 * Redirect to onboarding if user is not onboarded
 * Use this in server components
 */
export function redirectToOnboardingIfNeeded(account: Account | null): void {
  const redirectUrl = shouldRedirectToOnboarding(account);
  if (redirectUrl) {
    redirect(redirectUrl);
  }
}

/**
 * Get redirect URL after onboarding completion
 */
export function getPostOnboardingRedirect(account: Account | null): string {
  return '/';
}




