import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';

/**
 * POST /api/id-verification/submit
 * Create or update a verification submission
 * 
 * Body: {
 *   account_id?: string,
 *   verification_id?: string (optional, for updating),
 *   state_id_front_url?: string,
 *   state_id_back_url?: string,
 *   billing_statement_front_url?: string,
 *   billing_statement_back_url?: string,
 * }
 * 
 * Security:
 * - Rate limited: 50 requests/minute (authenticated)
 * - Requires authentication
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        if (!userId || !accountId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

        const body = await req.json();
        const {
          account_id: accountIdParam,
          verification_id,
          state_id_front_url,
          state_id_back_url,
          billing_statement_front_url,
          billing_statement_back_url,
        } = body;

        const supabase = await createServerClientWithAuth(cookies());

        // Use account_id from body if provided, otherwise use context accountId
        let targetAccountId = accountId;
        if (accountIdParam) {
          // Verify the account belongs to the user
          const { data: account, error: accountError } = await supabase
            .from('accounts')
            .select('id')
            .eq('id', accountIdParam)
            .eq('user_id', userId)
            .maybeSingle();

          if (accountError || !account) {
            return NextResponse.json(
              { error: 'Account not found or access denied' },
              { status: 403 }
            );
          }
          type AccountRow = { id: string };
          targetAccountId = (account as AccountRow).id;
        }

        // Allow creating verification without documents (will be updated as files are uploaded)
        // Only require documents when updating an existing verification
        if (verification_id) {
          const hasDocuments = 
            state_id_front_url ||
            state_id_back_url ||
            billing_statement_front_url ||
            billing_statement_back_url;

          if (!hasDocuments) {
            return NextResponse.json(
              { error: 'At least one document URL is required when updating' },
              { status: 400 }
            );
          }
        }

        if (verification_id) {
          // Update existing verification (only if status is pending)
          const { data: existing, error: fetchError } = await (supabase as any)
            .schema('id')
            .from('verifications')
            .select('id, status, account_id')
            .eq('id', verification_id)
            .eq('account_id', targetAccountId)
            .maybeSingle();

          if (fetchError || !existing) {
            return NextResponse.json(
              { error: 'Verification not found' },
              { status: 404 }
            );
          }

          if (existing.status !== 'pending') {
            return NextResponse.json(
              { error: 'Cannot update verification that has been reviewed' },
              { status: 400 }
            );
          }

          // Update verification
          const updateData: Record<string, string> = {};
          if (state_id_front_url) updateData.state_id_front_url = state_id_front_url;
          if (state_id_back_url) updateData.state_id_back_url = state_id_back_url;
          if (billing_statement_front_url) updateData.billing_statement_front_url = billing_statement_front_url;
          if (billing_statement_back_url) updateData.billing_statement_back_url = billing_statement_back_url;

          const { data: updated, error: updateError } = await (supabase as any)
            .schema('id')
            .from('verifications')
            .update(updateData)
            .eq('id', verification_id)
            .eq('account_id', targetAccountId)
            .select()
            .single();

          if (updateError) {
            console.error('[ID Verification Submit] Update error:', updateError);
            return NextResponse.json(
              { error: 'Failed to update verification' },
              { status: 500 }
            );
          }

          return NextResponse.json({
            verification: updated,
          });
        } else {
          // Create new verification
          const { data: created, error: createError } = await (supabase as any)
            .schema('id')
            .from('verifications')
            .insert({
              account_id: targetAccountId,
              state_id_front_url: state_id_front_url || null,
              state_id_back_url: state_id_back_url || null,
              billing_statement_front_url: billing_statement_front_url || null,
              billing_statement_back_url: billing_statement_back_url || null,
              status: 'pending',
            })
            .select()
            .single();

          if (createError) {
            console.error('[ID Verification Submit] Create error:', createError);
            return NextResponse.json(
              { error: 'Failed to create verification' },
              { status: 500 }
            );
          }

          return NextResponse.json({
            verification: created,
          }, { status: 201 });
        }
      } catch (error) {
        console.error('[ID Verification Submit] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: 'authenticated',
      maxRequestSize: 1024, // Small JSON payload
    }
  );
}
