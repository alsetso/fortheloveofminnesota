import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { requireAdmin } from '@/lib/security/accessControl';

/**
 * PUT /api/id-verification/[id]/review
 * Admin review of a verification submission (approve or reject)
 * 
 * Body: {
 *   status: 'approved' | 'rejected',
 *   rejection_reason?: string (required if status is 'rejected')
 * }
 * 
 * Security:
 * - Rate limited: 100 requests/minute (authenticated)
 * - Requires admin role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        // Check admin permissions
        const adminCheck = await requireAdmin(cookies());
        if (!adminCheck.success) {
          return adminCheck.error;
        }

        const { id: verificationId } = await params;
        const body = await req.json();
        const { status, rejection_reason } = body;

        if (!status || (status !== 'approved' && status !== 'rejected')) {
          return NextResponse.json(
            { error: 'status must be "approved" or "rejected"' },
            { status: 400 }
          );
        }

        if (status === 'rejected' && !rejection_reason) {
          return NextResponse.json(
            { error: 'rejection_reason is required when status is "rejected"' },
            { status: 400 }
          );
        }

        const supabase = await createServerClientWithAuth(cookies());

        // Fetch verification
        const { data: verification, error: fetchError } = await (supabase as any)
          .schema('id')
          .from('verifications')
          .select('id, status, account_id')
          .eq('id', verificationId)
          .maybeSingle();

        if (fetchError || !verification) {
          return NextResponse.json(
            { error: 'Verification not found' },
            { status: 404 }
          );
        }

        // Update verification
        const updateData: {
          status: 'approved' | 'rejected';
          reviewed_by_account_id: string;
          reviewed_at: string;
          rejection_reason?: string | null;
        } = {
          status,
          reviewed_by_account_id: adminCheck.accountId,
          reviewed_at: new Date().toISOString(),
        };

        if (status === 'rejected') {
          updateData.rejection_reason = rejection_reason;
        } else {
          updateData.rejection_reason = null;
        }

        const { data: updated, error: updateError } = await (supabase as any)
          .schema('id')
          .from('verifications')
          .update(updateData)
          .eq('id', verificationId)
          .select()
          .single();

        if (updateError) {
          console.error('[ID Verification Review] Update error:', updateError);
          return NextResponse.json(
            { error: 'Failed to update verification' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          verification: updated,
        });
      } catch (error) {
        console.error('[ID Verification Review] Error:', error);
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
