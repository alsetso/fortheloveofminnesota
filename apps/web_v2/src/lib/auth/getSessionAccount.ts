import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SELECTED_ACCOUNT_COOKIE } from '@/lib/auth/selectedAccount';

export type SessionAccount = {
  accountId: string;
  userId: string;
  plan: string | null;
  /** public.accounts.role — `general` | `admin` | `contributor` */
  role: string | null;
};

type AccountPick = {
  id: string;
  plan: string | null;
  role: string | null;
};

/**
 * Resolve the signed-in auth user → active public.accounts row.
 * When the user owns multiple accounts, honors `ftlomn_selected_account_id`.
 * Returns null when unsigned, no account row, or multi-account without a valid selection.
 */
export async function getSessionAccount(): Promise<SessionAccount | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('accounts')
    .select('id, plan, role')
    .eq('user_id', user.id);

  if (error || !data?.length) return null;

  const rows = data as AccountPick[];
  let picked: AccountPick | undefined;

  if (rows.length === 1) {
    picked = rows[0];
  } else {
    const cookieStore = await cookies();
    const selectedId = cookieStore.get(SELECTED_ACCOUNT_COOKIE)?.value ?? null;
    picked = selectedId ? rows.find((row) => row.id === selectedId) : undefined;
  }

  if (!picked?.id) return null;

  return {
    accountId: picked.id,
    userId: user.id,
    plan: picked.plan ?? null,
    role: picked.role ?? null,
  };
}
