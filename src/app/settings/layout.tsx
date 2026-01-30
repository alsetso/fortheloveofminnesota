import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { getMapLimitByPlan } from '@/lib/billing/mapLimitsByPlan';
import SettingsPageWrapper from './SettingsPageWrapper';

export const metadata = {
  title: 'Settings | Love of Minnesota',
  description: 'Manage your profile and account settings',
};

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClientWithAuth();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/settings');
  }

  const cookieStore = await cookies();
  const activeAccountIdCookie = cookieStore.get('active_account_id');
  const activeAccountId = activeAccountIdCookie?.value || null;

  let account, error;

  if (activeAccountId) {
    const result = await supabase
      .from('accounts')
      .select('*')
      .eq('id', activeAccountId)
      .eq('user_id', user.id)
      .maybeSingle();
    account = result.data;
    error = result.error;
  }

  if (!account && !error) {
    const result = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    account = result.data;
    error = result.error;
  }

  if (error) {
    console.error('[Settings] Error fetching account:', error.message, error.code, error.details);
    redirect('/');
  }

  if (!account) {
    console.warn('[Settings] No account found for user:', user.id);
    redirect('/?modal=welcome');
  }

  const mapLimit = getMapLimitByPlan((account as { plan?: string | null }).plan);

  return (
    <SettingsPageWrapper account={account} userEmail={user.email || ''} mapLimit={mapLimit}>
      {children}
    </SettingsPageWrapper>
  );
}
