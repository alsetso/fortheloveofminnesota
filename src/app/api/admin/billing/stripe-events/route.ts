import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';

/**
 * GET /api/admin/billing/stripe-events
 * Admin-only: list Stripe webhook events with optional filters.
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies()) as any;
        const searchParams = req.nextUrl.searchParams;
        const eventType = searchParams.get('event_type') || undefined;
        const processedParam = searchParams.get('processed');
        const processed = processedParam === 'true' ? true : processedParam === 'false' ? false : undefined;
        const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);
        const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

        let query = supabase
          .from('stripe_events')
          .select(
            `id, stripe_event_id, event_type, account_id, stripe_customer_id,
             stripe_subscription_id, processed, processing_error, created_at,
             processed_at, retry_count,
             accounts:account_id(id, username, plan, subscription_status, stripe_customer_id)`,
            { count: 'exact' }
          )
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (eventType) query = query.eq('event_type', eventType);
        if (processed !== undefined) query = query.eq('processed', processed);

        const { data: events, error, count } = await query;

        if (error) {
          console.error('[Admin Stripe Events API] Error:', error);
          return NextResponse.json({ error: 'Failed to fetch stripe events' }, { status: 500 });
        }

        return NextResponse.json({ events: events || [], total: count ?? 0, limit, offset });
      } catch (error) {
        console.error('[Admin Stripe Events API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { requireAdmin: true, rateLimit: 'admin' }
  );
}

const createEventSchema = z.object({
  stripe_event_id: z.string().min(1),
  event_type: z.string().min(1),
  account_id: z.string().uuid().nullable().optional(),
  stripe_customer_id: z.string().nullable().optional(),
  stripe_subscription_id: z.string().nullable().optional(),
  event_data: z.record(z.string(), z.unknown()).default({}),
  processed: z.boolean().default(false),
  processing_error: z.string().nullable().optional(),
});

/**
 * POST /api/admin/billing/stripe-events
 * Admin-only: manually create a stripe event record.
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { accountId: adminAccountId }) => {
      try {
        const body = await req.json();
        const validation = createEventSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json({ error: 'Invalid request', details: validation.error.issues }, { status: 400 });
        }

        const supabase = await createServerClientWithAuth(cookies()) as any;
        const { data, error } = await supabase
          .from('stripe_events')
          .insert(validation.data)
          .select()
          .single();

        if (error) {
          console.error('[Admin Stripe Events API] Error creating event:', error);
          return NextResponse.json({ error: 'Failed to create event', details: error.message }, { status: 500 });
        }

        if (adminAccountId) {
          await supabase.from('admin_audit_log').insert({
            admin_account_id: adminAccountId,
            action: 'create',
            target_table: 'stripe_events',
            target_id: data.id,
            old_value: null,
            new_value: validation.data,
          });
        }

        return NextResponse.json({ event: data }, { status: 201 });
      } catch (error) {
        console.error('[Admin Stripe Events API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { requireAdmin: true, rateLimit: 'admin' }
  );
}

const updateEventSchema = z.object({
  id: z.string().uuid(),
  processed: z.boolean().optional(),
  processing_error: z.string().nullable().optional(),
  processed_at: z.string().nullable().optional(),
  retry_count: z.number().int().nonnegative().optional(),
  account_id: z.string().uuid().nullable().optional(),
  stripe_customer_id: z.string().nullable().optional(),
  stripe_subscription_id: z.string().nullable().optional(),
  event_type: z.string().min(1).optional(),
});

/**
 * PATCH /api/admin/billing/stripe-events
 * Admin-only: update a stripe event record (e.g. mark processed, clear error).
 */
export async function PATCH(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { accountId: adminAccountId }) => {
      try {
        const body = await req.json();
        const validation = updateEventSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json({ error: 'Invalid request', details: validation.error.issues }, { status: 400 });
        }

        const { id, ...updates } = validation.data;
        if (Object.keys(updates).length === 0) {
          return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        const supabase = await createServerClientWithAuth(cookies()) as any;
        const { data: old } = await supabase.from('stripe_events').select('*').eq('id', id).single();

        const { data, error } = await supabase
          .from('stripe_events')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('[Admin Stripe Events API] Error updating event:', error);
          return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
        }

        if (adminAccountId) {
          await supabase.from('admin_audit_log').insert({
            admin_account_id: adminAccountId,
            action: 'update',
            target_table: 'stripe_events',
            target_id: id,
            old_value: old,
            new_value: updates,
          });
        }

        return NextResponse.json({ event: data });
      } catch (error) {
        console.error('[Admin Stripe Events API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { requireAdmin: true, rateLimit: 'admin' }
  );
}

const deleteEventSchema = z.object({ id: z.string().uuid() });

/**
 * DELETE /api/admin/billing/stripe-events
 * Admin-only: delete a stripe event record.
 */
export async function DELETE(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { accountId: adminAccountId }) => {
      try {
        const body = await req.json();
        const validation = deleteEventSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const supabase = await createServerClientWithAuth(cookies()) as any;
        const { data: old } = await supabase.from('stripe_events').select('*').eq('id', validation.data.id).single();

        const { error } = await supabase
          .from('stripe_events')
          .delete()
          .eq('id', validation.data.id);

        if (error) {
          console.error('[Admin Stripe Events API] Error deleting event:', error);
          return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
        }

        if (adminAccountId) {
          await supabase.from('admin_audit_log').insert({
            admin_account_id: adminAccountId,
            action: 'delete',
            target_table: 'stripe_events',
            target_id: validation.data.id,
            old_value: old,
            new_value: null,
          });
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('[Admin Stripe Events API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { requireAdmin: true, rateLimit: 'admin' }
  );
}
