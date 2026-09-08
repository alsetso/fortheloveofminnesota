import { NextResponse } from 'next/server';
import { createServiceRoleClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { fetchAccountDeletePreview } from '@/lib/account/accountDeletePreview';

/**
 * GET /api/account/delete-preview
 * Returns insight-style counts of what the user will lose when deleting their account.
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: account, error } = await supabase
      .from('accounts')
      .select('id, username, status')
      .eq('id', session.accountId)
      .eq('user_id', session.userId)
      .maybeSingle();

    if (error || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const service = createServiceRoleClient();
    const preview = await fetchAccountDeletePreview(
      service,
      session.accountId,
      account.username ?? null,
    );

    return NextResponse.json({ preview });
  } catch (err) {
    console.error('[account/delete-preview]', err);
    return NextResponse.json({ error: 'Failed to load preview' }, { status: 500 });
  }
}
