import type { User } from '@supabase/supabase-js';
import type { AccountRow } from '@/features/auth';

/**
 * Shared completeness rule with web (`apps/web/.../accountCompleteness.ts`).
 * Gate: username + image_url + onboarded === true.
 * Minnesota verification (`state_verified`) is optional and does NOT block this gate.
 */
export function isAccountComplete(account: AccountRow | null | undefined): boolean {
  if (!account) return false;
  return !!account.username && !!account.image_url && account.onboarded === true;
}

export function getAccountCompletionStatus(account: AccountRow | null | undefined): {
  isComplete: boolean;
  missingFields: string[];
} {
  if (!account) {
    return { isComplete: false, missingFields: ['account'] };
  }
  const missingFields: string[] = [];
  if (!account.username) missingFields.push('username');
  if (!account.image_url) missingFields.push('image_url');
  if (account.onboarded !== true) missingFields.push('onboarded');
  return { isComplete: missingFields.length === 0, missingFields };
}

export function isAccountDeactivated(account: AccountRow | null | undefined): boolean {
  return account?.status === 'deactivated';
}

/** All 10 interactive map demo steps must be acknowledged before /game unlocks,
 *  OR the user explicitly skipped the demo. */
export function isDemoComplete(account: AccountRow | null | undefined): boolean {
  if (!account) return false;
  if (account.skipped_demo === true) return true;
  return (account.account_demo_steps ?? 0) >= 10;
}

/** User intentionally set a password (metadata flag — not encrypted_password). */
export function isPasswordSet(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.user_metadata?.password_set === true;
}

/** Inbox proven via OTP / email confirmation. */
export function isEmailVerified(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.email_confirmed_at != null;
}

/** Password known + email confirmed — required before /game. */
export function isAuthSetupComplete(user: User | null | undefined): boolean {
  return isPasswordSet(user) && isEmailVerified(user);
}
