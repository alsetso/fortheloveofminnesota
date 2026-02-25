import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import type { Plan, BillingMode } from '@/features/auth/services/memberService';

/**
 * Normalized subscription state object
 */
export interface SubscriptionState {
  plan: Plan;
  billingMode: BillingMode;
  isActive: boolean;
  isComped: boolean;
  isTrial: boolean;
  subscriptionStatus: string | null;
}

/**
 * Get account subscription state
 * 
 * Loads the account from Supabase and returns a normalized subscription state object.
 * Use this helper in protected routes, dashboards, and feature-gated components.
 * 
 * Uses React cache() to deduplicate requests within the same render.
 * Returns default values if user is not authenticated or account doesn't exist.
 * 
 * @returns Normalized subscription state object
 * 
 * @example
 * ```ts
 * // In a server component
 * const subscriptionState = await getAccountSubscriptionState();
 * 
 * if (subscriptionState.plan === 'hobby') {
 *   return <LimitedAccessView />;
 * }
 * 
 * if (subscriptionState.plan === 'contributor') {
 *   return <FullAccessView />;
 * }
 * ```
 */
export const getAccountSubscriptionState = cache(async (): Promise<SubscriptionState> => {
  const cookieStore = await cookies();
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return default state if environment variables are missing
    return {
      plan: 'hobby',
      billingMode: 'standard',
      isActive: false,
      isComped: false,
      isTrial: false,
      subscriptionStatus: null,
    };
  }
  
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server components can't set cookies - no-op
        },
      },
    }
  );
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    // Return default state for unauthenticated users
    return {
      plan: 'hobby',
      billingMode: 'standard',
      isActive: false,
      isComped: false,
      isTrial: false,
      subscriptionStatus: null,
    };
  }

  // Get active account with subscription fields (respects account dropdown)
  const activeAccountId = cookieStore.get('active_account_id')?.value || null;

  const accountQuery = activeAccountId
    ? supabase
        .from('accounts')
        .select('plan, billing_mode, subscription_status, stripe_customer_id')
        .eq('id', activeAccountId)
        .eq('user_id', user.id)
        .maybeSingle()
    : supabase
        .from('accounts')
        .select('plan, billing_mode, subscription_status, stripe_customer_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

  const { data: account, error: accountError } = (await accountQuery) as {
    data: { plan: string; billing_mode: string; subscription_status: string | null; stripe_customer_id: string | null } | null;
    error: any;
  };

  if (accountError || !account) {
    // Return default state if account doesn't exist
    return {
      plan: 'hobby',
      billingMode: 'standard',
      isActive: false,
      isComped: false,
      isTrial: false,
      subscriptionStatus: null,
    };
  }

  // Check if subscription exists (for comped accounts)
  let hasSubscription = false;
  if (account.stripe_customer_id) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_customer_id', account.stripe_customer_id)
      .maybeSingle();
    hasSubscription = !!subscription;
  }

  // Normalize plan (ensure it's 'hobby' or 'contributor')
  // Note: professional, business, plus plans have been archived - migrated to contributor
  const plan: Plan = account.plan === 'contributor' ? 'contributor' : 'hobby';
  
  // Normalize billing mode (ensure it's 'standard' or 'trial')
  const billingMode: BillingMode = account.billing_mode === 'trial' ? 'trial' : 'standard';
  
  // Determine if subscription is active
  const subscriptionStatus = account.subscription_status || null;
  const isActive = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
  
  // Determine if account is comped (has subscription but status might be inactive)
  // Comped accounts have a subscription but may not be actively paying
  const isComped = hasSubscription && !isActive;
  
  // Determine if in trial
  const isTrial = billingMode === 'trial' || subscriptionStatus === 'trialing';

  return {
    plan,
    billingMode,
    isActive,
    isComped,
    isTrial,
    subscriptionStatus,
  };
});

/**
 * Feature gating helper functions
 * 
 * Use these in server components, loaders, middleware, or RLS-safe queries
 */

/**
 * Check if user has access to a feature based on plan
 * 
 * @param _requiredPlan - Minimum plan required ('hobby' or 'contributor') - reserved for future use
 * @returns 'limited_access' for hobby plan, 'full_access' for contributor plan, or null if not authenticated
 */
export async function getFeatureAccess(_requiredPlan: Plan = 'hobby'): Promise<'limited_access' | 'full_access' | null> {
  const state = await getAccountSubscriptionState();
  
  if (!state.isActive && !state.isComped) {
    return null; // Not authenticated or no subscription
  }
  
  if (state.plan === 'hobby') {
    return 'limited_access';
  }
  
  if (state.plan === 'contributor') {
    return 'full_access';
  }
  
  return 'limited_access'; // Default to limited
}

/**
 * Check if user has contributor plan access
 * 
 * @returns true if user has contributor plan and active subscription
 */
export async function hasProAccess(): Promise<boolean> {
  const state = await getAccountSubscriptionState();
  return state.plan === 'contributor' && (state.isActive || state.isComped);
}

/**
 * Check if user has active subscription
 * 
 * @returns true if user has an active subscription (active or trialing)
 */
export async function hasActiveSubscription(): Promise<boolean> {
  const state = await getAccountSubscriptionState();
  return state.isActive;
}


