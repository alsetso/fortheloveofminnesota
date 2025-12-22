import { AccountService, Account } from '@/features/auth';
import { isAccountComplete } from './accountCompleteness';

/**
 * Centralized onboarding check
 * 
 * Checks if user needs onboarding by:
 * 1. Ensuring account exists (creates if needed)
 * 2. Checking if account is complete
 * 
 * Returns: { needsOnboarding: boolean, account: Account | null }
 */
export async function checkOnboardingStatus(): Promise<{
  needsOnboarding: boolean;
  account: Account | null;
}> {
  try {
    // Ensure account exists (will create if needed)
    const account = await AccountService.ensureAccountExists();
    
    // Check completeness - this is the source of truth
    const complete = isAccountComplete(account);
    const needsOnboarding = !complete;
    
    // Debug logging (remove in production if needed)
    if (process.env.NODE_ENV === 'development') {
      console.log('[onboardingCheck]', {
        hasAccount: !!account,
        username: account?.username || 'missing',
        complete,
        needsOnboarding,
      });
    }
    
    return {
      needsOnboarding,
      account,
    };
  } catch (error) {
    console.error('[onboardingCheck] Error checking onboarding status:', error);
    // On error, assume onboarding is needed (safer default)
    return {
      needsOnboarding: true,
      account: null,
    };
  }
}

