import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';
import { z } from 'zod';

const VALID_PLANS = ['hobby', 'contributor', 'plus', 'testing'] as const;

const updateAccountBillingSchema = z.object({
  plan: z.enum(VALID_PLANS).optional(),
  subscription_status: z.string().max(50).optional(),
  billing_mode: z.string().max(50).optional(),
  stripe_customer_id: z.string().max(255).nullable().optional(),
});

const uuidSchema = z.string().uuid();

/**
 * PATCH /api/admin/billing/accounts/[id]/plan
 * Admin-only: override any billing field on an account.
 * Logs to admin_audit_log.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { accountId: adminAccountId }) => {
      try {
        const { id } = await params;

        const idValidation = uuidSchema.safeParse(id);
        if (!idValidation.success) {
          return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
        }

        const body = await req.json();
        const validation = updateAccountBillingSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid request', details: validation.error.issues },
            { status: 400 }
          );
        }

        const updates = validation.data;
        if (Object.keys(updates).length === 0) {
          return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        // Auto-derive subscription_status from plan if only plan is provided
        if (updates.plan && updates.subscription_status === undefined) {
          updates.subscription_status = updates.plan === 'hobby' ? 'inactive' : 'active';
        }

        const supabase = await createServerClientWithAuth(cookies()) as any;

        // Fetch old values for audit
        const { data: oldAccount } = await supabase
          .from('accounts')
          .select('id, plan, subscription_status, billing_mode, stripe_customer_id')
          .eq('id', id)
          .single();

        if (!oldAccount) {
          return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const { data, error } = await supabase
          .from('accounts')
          .update(updates)
          .eq('id', id)
          .select('id, username, image_url, plan, subscription_status, billing_mode, stripe_customer_id')
          .single();

        if (error) {
          console.error('[Admin Billing API] Error overriding account:', error);
          return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
        }

        // Audit log
        if (adminAccountId) {
          await supabase.from('admin_audit_log').insert({
            admin_account_id: adminAccountId,
            action: 'update',
            target_table: 'accounts',
            target_id: id,
            old_value: oldAccount,
            new_value: updates,
          });
        }

        return NextResponse.json({ account: data });
      } catch (error) {
        console.error('[Admin Billing API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    {
      requireAdmin: true,
      rateLimit: 'admin',
    }
  );
}
