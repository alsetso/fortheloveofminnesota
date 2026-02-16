import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';

/**
 * Admin layout gate — server-side role check.
 * Every page under /settings/admin/* inherits this guard.
 * Non-admin users are hard-redirected before any client code runs.
 */
export default async function AdminLayout({
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

  let account;

  if (activeAccountId) {
    const result = await supabase
      .from('accounts')
      .select('id, role')
      .eq('id', activeAccountId)
      .eq('user_id', user.id)
      .maybeSingle();
    account = result.data;
  }

  if (!account) {
    const result = await supabase
      .from('accounts')
      .select('id, role')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    account = result.data;
  }

  if (!account || (account as any).role !== 'admin') {
    redirect('/settings');
  }

  return <>{children}</>;
}
