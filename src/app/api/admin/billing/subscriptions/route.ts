import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';

/**
 * GET /api/admin/billing/subscriptions
 * Admin-only: fetch all subscriptions with linked account details.
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies()) as any;
        const searchParams = req.nextUrl.searchParams;
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '100');

        let query = supabase
          .from('subscriptions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (status) query = query.eq('status', status);

        const { data: subs, error } = await query;

        if (error) {
          console.error('[Admin Billing API] Error fetching subscriptions:', error);
          return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
        }

        const subscriptions = subs || [];
        const customerIds = [...new Set(subscriptions.map((s: any) => s.stripe_customer_id).filter(Boolean))];
        let accountsMap: Record<string, { id: string; username: string | null; image_url: string | null; user_id: string | null; plan: string | null; subscription_status: string | null; billing_mode: string | null }> = {};

        if (customerIds.length > 0) {
          const { data: accounts } = await supabase
            .from('accounts')
            .select('id, username, image_url, user_id, plan, subscription_status, billing_mode, stripe_customer_id')
            .in('stripe_customer_id', customerIds);

          if (accounts) {
            for (const acc of accounts) {
              if (acc.stripe_customer_id) accountsMap[acc.stripe_customer_id] = acc;
            }
          }
        }

        const merged = subscriptions.map((sub: any) => ({
          ...sub,
          accounts: accountsMap[sub.stripe_customer_id] ?? null,
        }));

        return NextResponse.json({ subscriptions: merged, count: merged.length });
      } catch (error) {
        console.error('[Admin Billing API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { requireAdmin: true, rateLimit: 'admin' }
  );
}

const createSubSchema = z.object({
  stripe_customer_id: z.string().min(1),
  subscription_id: z.string().min(1),
  status: z.string().min(1),
  price_id: z.string().min(1),
  current_period_start: z.string().min(1),
  current_period_end: z.string().min(1),
  cancel_at_period_end: z.boolean().default(false),
  card_brand: z.string().nullable().optional(),
  card_last4: z.string().nullable().optional(),
});

/**
 * POST /api/admin/billing/subscriptions
 * Admin-only: manually create a subscription record.
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { accountId: adminAccountId }) => {
      try {
        const body = await req.json();
        const validation = createSubSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json({ error: 'Invalid request', details: validation.error.issues }, { status: 400 });
        }

        const supabase = await createServerClientWithAuth(cookies()) as any;
        const { data, error } = await supabase
          .from('subscriptions')
          .insert(validation.data)
          .select()
          .single();

        if (error) {
          console.error('[Admin Billing API] Error creating subscription:', error);
          return NextResponse.json({ error: 'Failed to create subscription', details: error.message }, { status: 500 });
        }

        if (adminAccountId) {
          await supabase.from('admin_audit_log').insert({
            admin_account_id: adminAccountId,
            action: 'create',
            target_table: 'subscriptions',
            target_id: data.id,
            old_value: null,
            new_value: validation.data,
          });
        }

        return NextResponse.json({ subscription: data }, { status: 201 });
      } catch (error) {
        console.error('[Admin Billing API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { requireAdmin: true, rateLimit: 'admin' }
  );
}

const updateSubSchema = z.object({
  id: z.string().uuid(),
  status: z.string().min(1).optional(),
  price_id: z.string().min(1).optional(),
  current_period_start: z.string().optional(),
  current_period_end: z.string().optional(),
  cancel_at_period_end: z.boolean().optional(),
  stripe_customer_id: z.string().optional(),
  card_brand: z.string().nullable().optional(),
  card_last4: z.string().nullable().optional(),
});

/**
 * PATCH /api/admin/billing/subscriptions
 * Admin-only: update a subscription record by id.
 */
export async function PATCH(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { accountId: adminAccountId }) => {
      try {
        const body = await req.json();
        const validation = updateSubSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json({ error: 'Invalid request', details: validation.error.issues }, { status: 400 });
        }

        const { id, ...updates } = validation.data;
        if (Object.keys(updates).length === 0) {
          return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const supabase = await createServerClientWithAuth(cookies()) as any;

        const { data: old } = await supabase.from('subscriptions').select('*').eq('id', id).single();

        const { data, error } = await supabase
          .from('subscriptions')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('[Admin Billing API] Error updating subscription:', error);
          return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
        }

        if (adminAccountId) {
          await supabase.from('admin_audit_log').insert({
            admin_account_id: adminAccountId,
            action: 'update',
            target_table: 'subscriptions',
            target_id: id,
            old_value: old,
            new_value: updates,
          });
        }

        return NextResponse.json({ subscription: data });
      } catch (error) {
        console.error('[Admin Billing API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { requireAdmin: true, rateLimit: 'admin' }
  );
}

const deleteSubSchema = z.object({ id: z.string().uuid() });

/**
 * DELETE /api/admin/billing/subscriptions
 * Admin-only: delete a subscription record by id.
 */
export async function DELETE(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { accountId: adminAccountId }) => {
      try {
        const body = await req.json();
        const validation = deleteSubSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const supabase = await createServerClientWithAuth(cookies()) as any;

        const { data: old } = await supabase.from('subscriptions').select('*').eq('id', validation.data.id).single();

        const { error } = await supabase
          .from('subscriptions')
          .delete()
          .eq('id', validation.data.id);

        if (error) {
          console.error('[Admin Billing API] Error deleting subscription:', error);
          return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
        }

        if (adminAccountId) {
          await supabase.from('admin_audit_log').insert({
            admin_account_id: adminAccountId,
            action: 'delete',
            target_table: 'subscriptions',
            target_id: validation.data.id,
            old_value: old,
            new_value: null,
          });
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('[Admin Billing API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { requireAdmin: true, rateLimit: 'admin' }
  );
}
