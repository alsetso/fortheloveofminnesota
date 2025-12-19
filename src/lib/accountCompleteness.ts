import { Account } from '@/features/auth';

/**
 * SOURCE OF TRUTH for account onboarding completion
 * 
 * Simplified: Only checks if username is set.
 * Username is required for profile URLs and is the minimum requirement.
 * 
 * This is the PRIMARY source of truth - we check actual data, not flags.
 * 
 * Usage:
 * - After OTP verification: Check completeness to determine if onboarding is needed
 * - On protected routes: Check completeness before allowing access
 * - After onboarding form submission: Verify completeness before closing modal
 */
export function isAccountComplete(account: Account | null): boolean {
  if (!account) return false;
  
  // Only check username - simplest requirement
  return !!account.username;
}

/**
 * Get account completion status with missing fields
 */
export function getAccountCompletionStatus(account: Account | null): {
  isComplete: boolean;
  missingFields: string[];
} {
  if (!account) {
    return {
      isComplete: false,
      missingFields: ['account', 'username'],
    };
  }

  const missingFields: string[] = [];
  if (!account.username) missingFields.push('username');

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

