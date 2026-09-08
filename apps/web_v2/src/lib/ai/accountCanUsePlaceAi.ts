import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Place AI (territory unit enhancement) is open to:
 * - accounts.role === 'admin'
 * - active rows in admin.staff for the account (`public.is_active_staff`)
 */
export async function accountCanUsePlaceAi(input: {
  accountId: string;
  role: string | null;
}): Promise<boolean> {
  if (input.role === 'admin') return true;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc('is_active_staff', {
      p_account_id: input.accountId,
    });
    if (error) {
      console.error('[accountCanUsePlaceAi staff]', error.message);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error('[accountCanUsePlaceAi]', err);
    return false;
  }
}
