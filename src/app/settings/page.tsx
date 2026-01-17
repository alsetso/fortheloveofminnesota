import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import SettingsPageClient from '@/features/settings/components/SettingsPageClient';

export const metadata = {
  title: 'Settings | Love of Minnesota',
  description: 'Manage your profile and account settings',
};

export default async function SettingsPage() {
  const supabase = await createServerClientWithAuth();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/settings');
  }

  // Check for active_account_id cookie first
  const cookieStore = await cookies();
  const activeAccountIdCookie = cookieStore.get('active_account_id');
  const activeAccountId = activeAccountIdCookie?.value || null;

  let account, error;

  if (activeAccountId) {
    // Verify the active account belongs to this user before using it
    const result = await supabase
      .from('accounts')
      .select('*')
      .eq('id', activeAccountId)
      .eq('user_id', user.id)
      .maybeSingle();
    account = result.data;
    error = result.error;
  }

  // If no active account ID in cookie or invalid, get first account
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

  // If no account exists, redirect to home (they need to complete onboarding first)
  if (!account) {
    console.warn('[Settings] No account found for user:', user.id);
    redirect('/?modal=welcome');
  }

  return <SettingsPageClient account={account} userEmail={user.email || ''} />;
}
