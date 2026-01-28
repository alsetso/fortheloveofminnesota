import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * POST /api/accounts/onboard
 * Mark the current account as onboarded
 * Uses active_account_id cookie if available, otherwise uses first account
 * 
 * Security:
 * - Rate limited: 60 requests/minute (strict) - prevent abuse
 * - Requires authentication
 * - Sensitive operation - account status change
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // userId and accountId are guaranteed from security middleware
        // Use accountId from context if available, otherwise get from cookie
        const finalAccountId = accountId || request.cookies.get('active_account_id')?.value || null;

        if (!finalAccountId) {
          return NextResponse.json(
            { error: 'Account not found', message: 'No active account selected' },
            { status: 404 }
          );
        }

        // Verify the account belongs to this user
        // userId is guaranteed when requireAuth: true
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .select('id')
          .eq('id', finalAccountId)
          .eq('user_id', userId!)
          .maybeSingle();

        if (accountError || !account) {
          console.error('[Onboard API] Account lookup error:', accountError);
          return NextResponse.json(
            { error: 'Account not found' },
            { status: 404 }
          );
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[Onboard API] Updating account:', {
            accountId: finalAccountId,
            userId,
          });
        }

        // Update onboarded status
        // Type assertion needed due to generic index signature in Database type
        const { error: updateError } = await (supabase
          .from('accounts') as any)
          .update({ onboarded: true })
          .eq('id', finalAccountId);

        if (updateError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Onboard API] Error updating account:', updateError);
          }
          return NextResponse.json(
            { error: 'Failed to update account' },
            { status: 500 }
          );
        }

        // Verify the update was successful by fetching the account
        const { data: updatedAccount, error: verifyError } = await supabase
          .from('accounts')
          .select('id, onboarded')
          .eq('id', finalAccountId)
          .single();

        if (verifyError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Onboard API] Error verifying update:', verifyError);
          }
        } else {
          const verifiedAccount = updatedAccount as { id: string; onboarded: boolean } | null;
          if (process.env.NODE_ENV === 'development') {
            console.log('[Onboard API] Update verified:', {
              accountId: verifiedAccount?.id,
              onboarded: verifiedAccount?.onboarded,
            });
          }
        }

        const verifiedAccount = updatedAccount as { id: string; onboarded: boolean } | null;
        return NextResponse.json({ success: true, accountId: finalAccountId, onboarded: verifiedAccount?.onboarded });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Onboard API] Error:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'strict', // 10 requests/minute - prevent abuse
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

