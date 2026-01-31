import type { Account } from '@/features/auth';

export type OnboardingStep = 'profile_photo' | 'username' | 'plans' | 'name' | 'bio' | 'traits' | 'owns_business' | 'contact' | 'maps' | 'location' | 'review';

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
 * Determines if account has completed mandatory steps 1-3
 * Step 1: Profile photo (image_url)
 * Step 2: Username
 * Step 3: Plans/Billing (stripe_customer_id + plan selected)
 */
export function hasCompletedMandatorySteps(account: Account | null): boolean {
  if (!account) return false;
  
  const hasPhoto = !!account.image_url;
  const hasUsername = !!account.username;
  const hasCustomerId = !!account.stripe_customer_id;
  const hasPlan = !!account.plan && account.plan !== 'hobby';
  
  return hasPhoto && hasUsername && hasCustomerId && hasPlan;
}

/**
 * Determines the current onboarding step based on account state
 */
export function determineOnboardingStep(account: Account | null): OnboardingState {
  if (!account) {
    return { currentStep: 'profile_photo' };
  }
  
  // Step 1: Profile photo
  if (!account.image_url) {
    return { currentStep: 'profile_photo' };
  }
  
  // Step 2: Username
  if (!account.username) {
    return { currentStep: 'username' };
  }
  
  // Step 3: Plans/Billing
  // If has customer ID but incomplete billing, redirect to plan selection (substep 2)
  if (account.stripe_customer_id && hasIncompleteBilling(account)) {
    return { 
      currentStep: 'plans',
      plansSubStep: 2, // Select a plan
      redirectUrl: '/onboarding?step=plans&substep=2'
    };
  }
  
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
  
  // Steps 1-3 complete, proceed to step 4 (optional steps)
  return { currentStep: 'name' };
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
