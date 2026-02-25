import type { Account } from '@/features/auth';

/** All onboarding steps (MVP + extended steps used in OnboardingClient). */
export type OnboardingStep =
  | 'welcome'
  | 'username'
  | 'profile_photo'
  | 'name'
  | 'bio'
  | 'traits'
  | 'owns_business'
  | 'contact'
  | 'location'
  | 'review';

export interface OnboardingState {
  currentStep: OnboardingStep;
  redirectUrl?: string;
}

/**
 * Determines if account has incomplete billing
 * Incomplete = has stripe_customer_id but no active subscription or plan selected
 */
export function hasIncompleteBilling(account: Account | null): boolean {
  if (!account) return false;
  
  // Must have stripe_customer_id to check billing
  if (!account.stripe_customer_id) return false;
  
  // Check if subscription is active/trialing
  const hasActiveSubscription = 
    account.subscription_status === 'active' || 
    account.subscription_status === 'trialing';
  
  // Check if plan is selected (not null and not hobby)
  const hasSelectedPlan = account.plan && account.plan !== 'hobby';
  
  // Incomplete if no active subscription AND no selected plan
  return !hasActiveSubscription && !hasSelectedPlan;
}

/**
 * MVP: Only username is required. Profile photo is optional.
 */
export function hasCompletedMandatorySteps(account: Account | null): boolean {
  if (!account) return false;
  return !!account.username;
}

/**
 * MVP: 3 steps only — welcome → username → profile_photo.
 * All other fields (location, name, bio, etc.) deferred to settings.
 */
export function determineOnboardingStep(account: Account | null): OnboardingState {
  if (!account) {
    return { currentStep: 'welcome' };
  }
  if (!account.username) {
    return { currentStep: 'username' };
  }
  if (!account.image_url) {
    return { currentStep: 'profile_photo' };
  }
  return { currentStep: 'profile_photo' };
}

/**
 * Checks if user should be redirected to onboarding
 */
export function shouldRedirectToOnboarding(account: Account | null): boolean {
  if (!account) return true;
  
  // If onboarded, don't redirect
  if (account.onboarded === true) return false;
  
  // If mandatory steps incomplete, redirect
  return !hasCompletedMandatorySteps(account);
}
