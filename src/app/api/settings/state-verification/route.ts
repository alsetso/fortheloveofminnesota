import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';

/**
 * POST /api/settings/state-verification
 * Update state verification status for the authenticated user
 * 
 * Body: { state_verified: boolean, account_id?: string }
 * If account_id is provided, it must belong to the authenticated user
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId: contextAccountId }) => {
      try {
        const body = await req.json();
        const { state_verified, account_id } = body;
        
        console.log('[State Verification API] Request received:', {
          userId,
          contextAccountId,
          account_id,
          state_verified,
        });
        
        if (typeof state_verified !== 'boolean') {
          console.error('[State Verification API] Invalid state_verified type:', typeof state_verified);
          return NextResponse.json(
            { error: 'state_verified must be a boolean' },
            { status: 400 }
          );
        }

        if (!userId) {
          console.error('[State Verification API] No userId provided');
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

        // Use createServerClientWithAuth to include user session for RLS policies
        const supabase = await createServerClientWithAuth(req.cookies as any);

        // Use account_id from request body if provided, otherwise use context accountId
        // Verify the account belongs to the user
        let targetAccountId: string | null = null;

        if (account_id) {
          console.log('[State Verification API] Verifying account_id:', account_id);
          // Verify the provided account_id belongs to this user
          const { data: account, error: accountError } = await supabase
            .from('accounts')
            .select('id')
            .eq('id', account_id)
            .eq('user_id', userId)
            .maybeSingle();

          console.log('[State Verification API] Account verification result:', {
            account,
            accountError,
          });

          if (accountError || !account) {
            console.error('[State Verification API] Account verification failed:', {
              accountError,
              account,
              account_id,
              userId,
            });
            return NextResponse.json(
              { error: 'Account not found or access denied', details: accountError?.message },
              { status: 403 }
            );
          }
          type AccountRow = { id: string };
          targetAccountId = (account as AccountRow).id;
        } else if (contextAccountId) {
          console.log('[State Verification API] Using contextAccountId:', contextAccountId);
          // Use accountId from context (from active_account_id cookie)
          targetAccountId = contextAccountId;
        } else {
          console.error('[State Verification API] No account ID available');
          return NextResponse.json(
            { error: 'Account ID required' },
            { status: 400 }
          );
        }

        // Verify account exists and belongs to user before updating
        const { data: existingAccount, error: checkError } = await supabase
          .from('accounts')
          .select('id, user_id')
          .eq('id', targetAccountId)
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[State Verification API] Account check before update:', {
          existingAccount,
          checkError,
          targetAccountId,
          userId,
        });

        if (checkError || !existingAccount) {
          console.error('[State Verification API] Account check failed:', {
            checkError,
            existingAccount,
            targetAccountId,
            userId,
          });
          return NextResponse.json(
            { 
              error: 'Account not found or access denied',
              details: checkError?.message,
            },
            { status: 404 }
          );
        }

        console.log('[State Verification API] Updating account:', {
          targetAccountId,
          state_verified,
          userId,
        });

        // Update state verification
        // Include user_id in WHERE clause to satisfy RLS policy (user_id = auth.uid())
        const updatePayload: Record<string, any> = {
          state_verified: state_verified,
          state_verification_checked_at: new Date().toISOString(),
        };
        const { data, error } = await (supabase as any)
          .from('accounts')
          .update(updatePayload)
          .eq('id', targetAccountId)
          .eq('user_id', userId) // Required for RLS policy check
          .select('state_verified, state_verification_checked_at')
          .maybeSingle();

        console.log('[State Verification API] Update result:', {
          data,
          error,
          targetAccountId,
        });

        if (error) {
          console.error('[State Verification API] Update error:', {
            error,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            targetAccountId,
          });
          return NextResponse.json(
            { 
              error: 'Failed to update state verification',
              details: error.message,
              code: error.code,
            },
            { status: 500 }
          );
        }

        if (!data) {
          console.error('[State Verification API] No data returned after update:', {
            targetAccountId,
            userId,
          });
          return NextResponse.json(
            { 
              error: 'Account not found after update',
              accountId: targetAccountId,
            },
            { status: 404 }
          );
        }

        console.log('[State Verification API] Success:', data);
        return NextResponse.json(data);
      } catch (error) {
        console.error('[State Verification API] Unexpected error:', {
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
          { 
            error: 'Internal server error',
            message: error instanceof Error ? error.message : String(error),
          },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      maxRequestSize: 1024, // Small JSON payload
    }
  );
}
