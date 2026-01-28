import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { stripe } from '@/lib/stripe';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * GET /api/billing/payment-history
 * Retrieves payment history for the authenticated user's account
 * 
 * Security:
 * - Requires authentication
 * - Rate limited: strict
 * - Returns only events for the user's account
 */
export async function GET(request: NextRequest) {
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

        // userId and accountId are guaranteed from security middleware
        // Use accountId from context (already validated)
        const finalAccountId = accountId;
        
        if (!finalAccountId) {
          return NextResponse.json(
            { error: 'Account not found', message: 'No active account selected' },
            { status: 404 }
          );
        }

        // Use accountId from context (already validated)
        // Get account to verify it exists and get stripe_customer_id
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .select('id, stripe_customer_id')
          .eq('id', finalAccountId)
          .eq('user_id', userId)
          .maybeSingle();
        
        if (accountError || !account) {
          return NextResponse.json(
            { error: 'Account not found' },
            { status: 404 }
          );
        }

        if (!account.stripe_customer_id) {
          return NextResponse.json({
            payments: [],
          });
        }

        // Fetch payment data directly from Stripe
        const paymentHistory: Array<{
          id: string;
          eventType: string;
          amount: number | null;
          currency: string;
          description: string;
          status: 'success' | 'failed';
          date: string;
          processed: boolean;
          error: string | null;
          invoiceUrl?: string | null;
          invoicePdf?: string | null;
          receiptUrl?: string | null;
        }> = [];

        try {
          // Fetch Invoices only
          const invoices = await stripe.invoices.list({
            customer: account.stripe_customer_id,
            limit: 20,
          });

          // Store raw data for reference
          const rawData = {
            invoices: invoices.data,
          };

          for (const invoice of invoices.data) {
            // Get description from invoice
            let description = invoice.description || invoice.lines?.data?.[0]?.description || 'Invoice';
            
            // Check if product name includes "Contributor" and simplify it
            const lineItem = invoice.lines?.data?.[0];
            if (lineItem?.description && (lineItem.description.toLowerCase().includes('pro') || lineItem.description.toLowerCase().includes('contributor'))) {
              description = 'Contributor';
            } else if (description.toLowerCase().includes('pro') || description.toLowerCase().includes('contributor')) {
              description = 'Contributor';
            }
            
            paymentHistory.push({
              id: invoice.id,
              eventType: 'invoice',
              amount: invoice.amount_paid ? invoice.amount_paid / 100 : (invoice.amount_due ? invoice.amount_due / 100 : null),
              currency: invoice.currency || 'usd',
              description,
              status: invoice.status === 'paid' ? 'success' : (invoice.status === 'open' || invoice.status === 'draft' ? 'failed' : 'failed'),
              date: new Date(invoice.created * 1000).toISOString(),
              processed: true,
              error: invoice.status === 'open' ? 'Invoice not paid' : (invoice.status === 'void' ? 'Invoice voided' : null),
              invoiceUrl: invoice.hosted_invoice_url || null,
              invoicePdf: invoice.invoice_pdf || null,
              receiptUrl: (invoice as any).receipt_url || null,
            });
          }

          // Sort by date (newest first) and limit to 20
          paymentHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const limitedHistory = paymentHistory.slice(0, 20);

          return NextResponse.json({
            payments: limitedHistory,
            raw: rawData,
          });
        } catch (stripeError: any) {
          // Always log errors, but don't expose sensitive details in production
          if (process.env.NODE_ENV === 'development') {
            console.error('Error fetching payment history from Stripe:', stripeError);
          } else {
            console.error('Error fetching payment history from Stripe:', stripeError.message || 'Unknown error');
          }
          return NextResponse.json(
            { error: stripeError.message || 'Failed to fetch payment history from Stripe' },
            { status: 500 }
          );
        }
      } catch (error) {
        // Always log errors, but don't expose sensitive details in production
        if (process.env.NODE_ENV === 'development') {
          console.error('Error fetching payment history:', error);
        } else {
          console.error('Error fetching payment history:', error instanceof Error ? error.message : 'Unknown error');
        }
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to fetch payment history' },
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
