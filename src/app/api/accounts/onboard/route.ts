import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';

/**
 * POST /api/accounts/onboard
 * Mark the current account as onboarded
 */
export async function POST(_request: NextRequest) {
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

    // Get current account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Type assertion for account
    const accountId = (account as { id: string }).id;

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Onboard API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

