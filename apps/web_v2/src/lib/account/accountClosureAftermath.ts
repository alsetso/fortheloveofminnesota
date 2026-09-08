import type { createServiceRoleClient } from '@/lib/supabase/server';

type ServiceDb = ReturnType<typeof createServiceRoleClient>;

export type AccountClosureAftermath = {
  /** Other account rows for this login (any status). */
  remainingAccountCount: number;
  /** Prefer next active account; else any sibling. */
  suggestedNextAccountId: string | null;
  /** True when auth user was removed (no login left). */
  authUserRemoved: boolean;
};

export async function getAccountClosureAftermath(
  db: ServiceDb,
  userId: string | null,
  closedAccountId: string,
  options?: { authUserRemoved?: boolean },
): Promise<AccountClosureAftermath> {
  if (!userId) {
    return {
      remainingAccountCount: 0,
      suggestedNextAccountId: null,
      authUserRemoved: options?.authUserRemoved ?? true,
    };
  }

  const { data: siblings, error } = await db
    .from('accounts')
    .select('id, status')
    .eq('user_id', userId)
    .neq('id', closedAccountId);

  if (error) throw error;

  const rows = (siblings ?? []) as { id: string; status: string | null }[];
  const active = rows.filter((r) => r.status !== 'deactivated');
  const suggestedNextAccountId = active[0]?.id ?? rows[0]?.id ?? null;

  return {
    remainingAccountCount: rows.length,
    suggestedNextAccountId,
    authUserRemoved: options?.authUserRemoved ?? false,
  };
}
