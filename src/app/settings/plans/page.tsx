import { getServerAuth } from '@/lib/authServer';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import PlansPageClient from './PlansPageClient';

export const metadata = {
  title: 'Plans | Settings | Love of Minnesota',
  description: 'Compare plans and their features',
};

export default async function PlansPage() {
  const auth = await getServerAuth();
  
  if (!auth) {
    return null;
  }

  const supabase = await createServerClientWithAuth();
  const cookieStore = await cookies();
  const activeAccountIdCookie = cookieStore.get('active_account_id');
  const activeAccountId = activeAccountIdCookie?.value || null;

  let account;

  if (activeAccountId) {
    const result = await supabase
      .from('accounts')
      .select('plan, subscription_status')
      .eq('id', activeAccountId)
      .eq('user_id', auth.id)
      .maybeSingle();
    account = result.data;
  }

  if (!account) {
    const result = await supabase
      .from('accounts')
      .select('plan, subscription_status')
      .eq('user_id', auth.id)
      .limit(1)
      .maybeSingle();
    account = result.data;
  }

  type AccountRow = { plan: string | null; subscription_status: string | null };
  const accountData = account as AccountRow | null;
  return (
    <PlansPageClient
      currentPlanSlug={accountData?.plan || null}
      subscriptionStatus={accountData?.subscription_status || null}
    />
  );
}
