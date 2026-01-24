import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { stripe } from '@/lib/stripe';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * Ensure Stripe Customer Exists
 * 
 * POST /api/billing/ensure-customer
 * 
 * Creates a Stripe customer if one doesn't exist for the account
 * Returns the customer ID
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll();
              },
            },
          },
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user || user.id !== userId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

        if (!user.email) {
          return NextResponse.json(
            { error: 'User email is required' },
            { status: 400 }
          );
        }

        // Get active account ID from cookie
        const activeAccountIdCookie = request.cookies.get('active_account_id');
        const activeAccountId = activeAccountIdCookie?.value || null;

        let account;
        if (activeAccountId) {
          const { data, error } = await supabase
            .from('accounts')
            .select('id, stripe_customer_id')
            .eq('id', activeAccountId)
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (error) {
            return NextResponse.json(
              { error: 'Failed to fetch account' },
              { status: 500 }
            );
          }
          account = data;
        } else {
          const { data, error } = await supabase
            .from('accounts')
            .select('id, stripe_customer_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
          
          if (error) {
            return NextResponse.json(
              { error: 'Failed to fetch account' },
              { status: 500 }
            );
          }
          account = data;
        }

        if (!account) {
          return NextResponse.json(
            { error: 'Account not found' },
            { status: 404 }
          );
        }

        // If customer already exists, verify and return
        if (account.stripe_customer_id) {
          try {
            const customer = await stripe.customers.retrieve(account.stripe_customer_id);
            if (customer && !customer.deleted) {
              return NextResponse.json({
                customerId: account.stripe_customer_id,
              });
            }
          } catch (error) {
            // Customer doesn't exist in Stripe, create new one
            if (process.env.NODE_ENV === 'development') {
              console.log('Customer not found in Stripe, creating new one');
            }
          }
        }

        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id,
            accountId: account.id,
          },
        });

        // Save customer ID to database
        const { error: updateError } = await supabase
          .from('accounts')
          .update({ stripe_customer_id: customer.id })
          .eq('id', account.id);

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to save customer ID' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          customerId: customer.id,
        });
      } catch (error) {
        // Always log errors, but don't expose sensitive details in production
        if (process.env.NODE_ENV === 'development') {
          console.error('Error ensuring customer:', error);
        } else {
          console.error('Error ensuring customer:', error instanceof Error ? error.message : 'Unknown error');
        }
        return NextResponse.json(
          { error: 'Failed to ensure customer' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'strict',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
