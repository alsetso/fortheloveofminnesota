import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';

/**
 * POST /api/accounts/onboard
 * Mark the current account as onboarded
 * Uses active_account_id cookie if available, otherwise uses first account
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClientWithAuth(cookies());
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get active account ID from cookie (same logic as middleware and other server code)
    const activeAccountIdCookie = request.cookies.get('active_account_id');
    const activeAccountId = activeAccountIdCookie?.value || null;

    let account, accountError;
    
    if (activeAccountId) {
      // Verify the active account belongs to this user before using it
      const { data, error } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', activeAccountId)
        .eq('user_id', user.id)
        .maybeSingle();
      account = data;
      accountError = error;
    } else {
      // Fallback to first account if no active account ID in cookie
      const { data, error } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      account = data;
      accountError = error;
    }

    if (accountError || !account) {
      console.error('[Onboard API] Account lookup error:', accountError);
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Type assertion for account
    const accountId = (account as { id: string }).id;

    console.log('[Onboard API] Updating account:', {
      accountId,
      activeAccountIdFromCookie: activeAccountId,
      userId: user.id,
    });

    // Update onboarded status
    // Type assertion needed due to generic index signature in Database type
    const { error: updateError } = await (supabase
      .from('accounts') as any)
      .update({ onboarded: true })
      .eq('id', accountId);

    if (updateError) {
      console.error('[Onboard API] Error updating account:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update account' },
        { status: 500 }
      );
    }

    // Verify the update was successful by fetching the account
    const { data: updatedAccount, error: verifyError } = await supabase
      .from('accounts')
      .select('id, onboarded')
      .eq('id', accountId)
      .single();

    if (verifyError) {
      console.error('[Onboard API] Error verifying update:', verifyError);
    } else {
      const verifiedAccount = updatedAccount as { id: string; onboarded: boolean } | null;
      console.log('[Onboard API] Update verified:', {
        accountId: verifiedAccount?.id,
        onboarded: verifiedAccount?.onboarded,
      });
    }

    const verifiedAccount = updatedAccount as { id: string; onboarded: boolean } | null;
    return NextResponse.json({ success: true, accountId, onboarded: verifiedAccount?.onboarded });
  } catch (error) {
    console.error('[Onboard API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

