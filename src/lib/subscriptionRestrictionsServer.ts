import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';

/**
 * Check if user has Contributor, Professional, or Business plan with active subscription (server-side)
 * 
 * @returns true if user has contributor/professional/business plan with active subscription
 */
export async function hasContributorOrHigherAccess(): Promise<boolean> {
  const auth = await getServerAuth();
  
  if (!auth || !auth.accountId) {
    return false;
  }

  const cookieStore = await cookies();
  const supabase = await createServerClientWithAuth(cookieStore);

  const { data: account, error } = await supabase
    .from('accounts')
    .select('plan, subscription_status')
    .eq('id', auth.accountId)
    .single();

  if (error || !account) {
    return false;
  }

  // Check if user has Contributor, Professional, or Business plan
  const hasContributorAccess = 
    account.plan === 'contributor' || 
    account.plan === 'professional' || 
    account.plan === 'business' ||
    account.plan === 'plus'; // Legacy plus plan also has access

  // Check if subscription is active
  const isActive = 
    account.subscription_status === 'active' || 
    account.subscription_status === 'trialing';

  return hasContributorAccess && isActive;
}
