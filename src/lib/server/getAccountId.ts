import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import type { ServerAuthUser } from '@/lib/authServer';

/**
 * Gets the account ID for the current user
 * Uses active_account_id cookie if valid, otherwise falls back to first account
 * 
 * @param auth - Authenticated user object
 * @param supabase - Supabase client with auth
 * @returns Account ID string
 * @throws Error if no account found
 */
export async function getAccountIdForUser(
  auth: ServerAuthUser,
  supabase: Awaited<ReturnType<typeof createServerClientWithAuth>>
): Promise<string> {
  const cookieStore = await cookies();
  const activeAccountIdCookie = cookieStore.get('active_account_id');
  const activeAccountId = activeAccountIdCookie?.value || null;

  if (activeAccountId) {
    // Verify the active account belongs to this user
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', activeAccountId)
      .eq('user_id', auth.id)
      .single();

    if (!accountError && account) {
      return (account as { id: string }).id;
    }
    // Active account ID in cookie is invalid, fall back to first account
  }

  // No active account ID in cookie or invalid, get first account
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', auth.id)
    .limit(1)
    .maybeSingle();

  if (accountError || !account) {
    throw new Error('Account not found. Please complete your profile setup.');
  }

  return (account as { id: string }).id;
}

