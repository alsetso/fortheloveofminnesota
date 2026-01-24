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
  
  if (!auth || !(auth as any).accountId) {
    return false;
  }

  const cookieStore = await cookies();
  const supabase = await createServerClientWithAuth(cookieStore);

  const { data: account, error } = await supabase
    .from('accounts')
    .select('plan, subscription_status')
    .eq('id', (auth as any).accountId)
    .single();

  if (error || !account) {
    return false;
  }

  // Check if user has Contributor, Professional, or Business plan
  const accountData = account as any;
  const hasContributorAccess = 
    accountData.plan === 'contributor' || 
    accountData.plan === 'professional' || 
    accountData.plan === 'business' ||
    accountData.plan === 'plus'; // Legacy plus plan also has access

  // Check if subscription is active
  const isActive = 
    accountData.subscription_status === 'active' || 
    accountData.subscription_status === 'trialing';

  return hasContributorAccess && isActive;
}
