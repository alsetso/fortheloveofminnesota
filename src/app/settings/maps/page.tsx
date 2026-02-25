import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import MapsSettingsClient from '@/features/settings/components/MapsSettingsClient';

const ALLOWED_PLANS = new Set(['contributor', 'gov']);

export default async function SettingsMapsPage() {
  const supabase = await createServerClientWithAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/settings/maps');
  }

  const cookieStore = await cookies();
  const activeAccountId = cookieStore.get('active_account_id')?.value || null;

  let account: { plan?: string | null; role?: string | null } | null = null;
  if (activeAccountId) {
    const result = await supabase
      .from('accounts')
      .select('plan, role')
      .eq('id', activeAccountId)
      .eq('user_id', user.id)
      .maybeSingle();
    account = result.data as { plan?: string | null; role?: string | null } | null;
  }

  if (!account) {
    const result = await supabase
      .from('accounts')
      .select('plan, role')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    account = result.data as { plan?: string | null; role?: string | null } | null;
  }

  const plan = (account?.plan as string | null)?.toLowerCase() ?? null;
  const role = account?.role as string | null;
  const isAdmin = role === 'admin';

  if (!isAdmin && (!plan || !ALLOWED_PLANS.has(plan))) {
    redirect('/pricing');
  }

  return <MapsSettingsClient />;
}
