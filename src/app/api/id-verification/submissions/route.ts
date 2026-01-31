import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/id-verification/submissions
 * Get all verification submissions for the authenticated user's account
 * 
 * Query params:
 * - account_id?: string (optional, defaults to active account)
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 */
export async function GET(request: NextRequest) {
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

        const supabase = await createServerClientWithAuth(cookies());
        const { searchParams } = new URL(req.url);
        const accountIdParam = searchParams.get('account_id');

        // Use account_id from query if provided, otherwise use context accountId
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

        // Fetch verifications for this account
        const { data: verifications, error } = await (supabase as any)
          .schema('id')
          .from('verifications')
          .select('*')
          .eq('account_id', targetAccountId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[ID Verification Submissions] Error:', error);
          return NextResponse.json(
            { error: 'Failed to fetch submissions' },
            { status: 500 }
          );
        }

        // Generate signed URLs for document URLs (private bucket)
        type VerificationRow = {
          id: string;
          state_id_front_url?: string | null;
          state_id_back_url?: string | null;
          proof_of_address_url?: string | null;
          [key: string]: any;
        };
        const verificationsWithUrls = await Promise.all(
          ((verifications || []) as VerificationRow[]).map(async (verification: VerificationRow) => {
            const docTypes = [
              'state_id_front_url',
              'state_id_back_url',
              'billing_statement_front_url',
              'billing_statement_back_url',
            ] as const;

            const signedUrls: Record<string, string | null> = {};

            for (const docType of docTypes) {
              const path = verification[docType];
              if (path) {
                // Path is stored as: {account_id}/{verification_id}/{document_type}/{filename}
                // or: {account_id}/temp/{document_type}/{filename} for new uploads
                // Use path as-is since it's already the storage path
                const filePath = path;

                const { data: urlData } = await supabase.storage
                  .from('id-verification-documents')
                  .createSignedUrl(filePath, 3600);

                signedUrls[docType] = urlData?.signedUrl || null;
              } else {
                signedUrls[docType] = null;
              }
            }

            return {
              ...verification,
              signed_urls: signedUrls,
            };
          })
        );

        return NextResponse.json({
          submissions: verificationsWithUrls,
        });
      } catch (error) {
        console.error('[ID Verification Submissions] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: 'authenticated',
    }
  );
}
