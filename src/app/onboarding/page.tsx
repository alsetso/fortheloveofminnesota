import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import OnboardingGuard from './OnboardingGuard';
import OnboardingBanner from '@/components/onboarding/OnboardingBanner';
import { StripeProvider } from '@/components/providers/StripeProvider';
import type { Account } from '@/features/auth';

/**
 * Get account data for onboarding check
 */
async function getAccountForOnboarding(): Promise<Account | null> {
  const cookieStore = await cookies();
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
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
          // Server components can't set cookies
        },
      },
    }
  );
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return null;
  }

  // Get active account ID from cookie
  const activeAccountIdCookie = cookieStore.get('active_account_id');
  const activeAccountId = activeAccountIdCookie?.value || null;

  let accountData: Account | undefined;
  
  if (activeAccountId) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', activeAccountId)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (!error && data) {
      accountData = data;
    }
  }
  
  // Fallback to first account if no active account ID
  if (!accountData) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    
    if (!error && data) {
      accountData = data;
    }
  }

  return accountData ?? null;
}

export default async function OnboardingPage() {
  const cookieStore = await cookies();
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    redirect('/');
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
          // Server components can't set cookies
        },
      },
    }
  );
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    // Not authenticated - redirect to home
    redirect('/');
  }

  // Get account and check if onboarding is complete
  const account = await getAccountForOnboarding();
  
  if (account && account.onboarded === true) {
    redirect('/');
  }

  // Note: Incomplete billing check moved to client-side to prevent redirect loops
  // The OnboardingBanner component will handle this after account loads

  return (
    <OnboardingGuard>
      <StripeProvider>
        <OnboardingBanner
          initialAccount={account}
          redirectTo="/"
        />
      </StripeProvider>
    </OnboardingGuard>
  );
}
