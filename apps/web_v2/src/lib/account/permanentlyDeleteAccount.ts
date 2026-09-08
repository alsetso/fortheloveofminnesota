/**
 * Permanent delete: delete one account row (CASCADE owned data).
 * Removes auth user only when that was the last account for the login.
 */
import type { createServiceRoleClient } from '@/lib/supabase/server';

type ServiceDb = ReturnType<typeof createServiceRoleClient>;

export async function permanentlyDeleteAccount(
  db: ServiceDb,
  accountId: string,
  userId: string | null,
): Promise<{ authUserRemoved: boolean }> {
  const { error: accountErr } = await db.from('accounts').delete().eq('id', accountId);
  if (accountErr) throw accountErr;

  if (!userId) {
    return { authUserRemoved: true };
  }

  const { count, error: countErr } = await db
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countErr) throw countErr;

  const remaining = count ?? 0;
  if (remaining > 0) {
    return { authUserRemoved: false };
  }

  const { error: authErr } = await db.auth.admin.deleteUser(userId, false);
  if (authErr) throw authErr;
  return { authUserRemoved: true };
}
