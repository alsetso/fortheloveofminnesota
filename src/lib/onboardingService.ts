import type { Account } from '@/features/auth';

export type OnboardingStep = 'welcome' | 'profile_photo' | 'username' | 'location' | 'name' | 'bio' | 'traits' | 'owns_business' | 'contact' | 'plans' | 'review';

export type PlansSubStep = 1 | 2 | 3 | 4;

export interface OnboardingState {
  currentStep: OnboardingStep;
  plansSubStep?: PlansSubStep;
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
 * Determines if account has completed mandatory steps 1-2
 * Step 1: Profile photo (image_url)
 * Step 2: Username
 * Note: Plans/Billing is now step 10 (optional, can be completed later)
 */
export function hasCompletedMandatorySteps(account: Account | null): boolean {
  if (!account) return false;
  
  const hasPhoto = !!account.image_url;
  const hasUsername = !!account.username;
  
  return hasPhoto && hasUsername;
}

/**
 * Determines the current onboarding step based on account state
 */
export function determineOnboardingStep(account: Account | null): OnboardingState {
  // Always start with welcome step for new users
  // Welcome step is informational only, no validation needed
  // The UI will handle navigation from welcome to profile_photo
  
  if (!account) {
    return { currentStep: 'welcome' };
  }
  
  // Step 1: Profile photo
  if (!account.image_url) {
    return { currentStep: 'profile_photo' };
  }
  
  // Step 2: Username
  if (!account.username) {
    return { currentStep: 'username' };
  }
  
  // Step 3: Location
  if (!account.city_id) {
    return { currentStep: 'location' };
  }
  
  // Steps 4-8: Optional account information (name, bio, traits, etc.)
  // Check each step in order and return first incomplete one
  if (!account.first_name && !account.last_name) {
    return { currentStep: 'name' };
  }
  
  // Note: bio, traits, owns_business, contact are optional
  // We'll let the UI handle progression through these
  
  // Step 10: Plans/Billing (moved to end, after collecting account info)
  // If no customer ID, start at substep 1
  if (!account.stripe_customer_id) {
    return { 
      currentStep: 'plans',
      plansSubStep: 1 // Setup customer account
    };
  }
  
  // If has customer ID and plan, but subscription not active, go to substep 3
  if (account.stripe_customer_id && account.plan && account.plan !== 'hobby') {
    const hasActiveSubscription = 
      account.subscription_status === 'active' || 
      account.subscription_status === 'trialing';
    
    if (!hasActiveSubscription) {
      return { 
        currentStep: 'plans',
        plansSubStep: 3, // Payment & Terms
        redirectUrl: '/onboarding?step=plans&substep=3'
      };
    }
  }
  
  // All steps complete, but stay on plans step (review only shows after Stripe checkout success)
  // This prevents redirect logic from interfering with plans substep 3
  return { 
    currentStep: 'plans',
    plansSubStep: 3 // Stay on payment & terms step
  };
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
