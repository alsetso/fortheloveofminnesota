import { stripe } from '../../../src/lib/stripe';
import { createServiceClient } from '../../../src/lib/supabaseServer';

/**
 * Creates a Stripe customer if one doesn't exist for the account
 * @param accountId - The account UUID
 * @returns The Stripe customer ID
 */
async function ensureStripeCustomer(accountId: string): Promise<string> {
  const supabase = createServiceClient();

  // Get account data
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('stripe_customer_id, user_id')
    .eq('id', accountId)
    .maybeSingle();

  if (accountError) {
    throw new Error(`Failed to fetch account: ${accountError.message}`);
  }

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  // If customer already exists, verify it and return
  if (account.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(account.stripe_customer_id);
      if (customer && !customer.deleted) {
        return account.stripe_customer_id;
      }
    } catch (error) {
      // Customer doesn't exist in Stripe, create a new one
      console.log('Customer not found in Stripe, creating new one');
    }
  }

  // Get user email for customer creation using service client
  const { data: user, error: userError } = await supabase.auth.admin.getUserById(account.user_id);
  
  if (userError || !user.user) {
    throw new Error(`Failed to fetch user: ${userError?.message || 'User not found'}`);
  }

  if (!user.user.email) {
    throw new Error('User email is required to create Stripe customer');
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email: user.user.email,
    metadata: {
      userId: account.user_id,
      accountId: accountId,
    },
  });

  // Store customer ID in accounts table
  const { error: updateError } = await supabase
    .from('accounts')
    .update({ stripe_customer_id: customer.id })
    .eq('id', accountId);

  if (updateError) {
    throw new Error(`Failed to save customer ID: ${updateError.message}`);
  }

  return customer.id;
}

/**
 * Creates a Stripe Checkout Session for subscription purchase
 * 
 * Business logic for creating checkout sessions:
 * - Always ensures a Stripe customer exists before creating the session
 * - Uses the configured price ID from environment variables
 * - Sets up proper success and cancel URLs
 * - Configures the session for subscription mode
 * 
 * @param accountId - The account UUID to create checkout session for
 * @returns The checkout session URL
 * @throws Error if account not found, customer creation fails, or session creation fails
 */
export async function createCheckoutSession(accountId: string): Promise<string> {
  // Ensure Stripe customer exists
  const customerId = await ensureStripeCustomer(accountId);

  // Get price ID from environment
  const priceId = process.env.STRIPE_CONTRIBUTOR_PRICE_ID;
  if (!priceId) {
    throw new Error('STRIPE_CONTRIBUTOR_PRICE_ID environment variable is not configured');
  }

  // Get base URL for success/cancel redirects
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const successUrl = `${baseUrl}/?modal=account&tab=settings&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/?modal=account&tab=settings&canceled=true`;

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    metadata: {
      accountId: accountId,
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return session.url;
}

/**
 * Syncs Stripe subscription data to our database
 * 
 * Fetches the customer's subscription from Stripe and upserts it into:
 * 1. subscriptions table (detailed subscription data)
 * 2. accounts table (subscription_status, plan, billing_mode, stripe_subscription_id)
 * 
 * Handles cases where:
 * - Customer has no subscription (deletes existing record if any)
 * - Customer has multiple subscriptions (uses the most recent active one, or most recent if none active)
 * - Subscription data needs to be updated
 * 
 * @param customerId - The Stripe customer ID
 * @throws Error if customer not found, subscription fetch fails, or database operation fails
 */
export async function syncStripeData(customerId: string): Promise<void> {
  const supabase = createServiceClient();

  // Verify customer exists in Stripe
  try {
    await stripe.customers.retrieve(customerId);
  } catch (error) {
    throw new Error(`Stripe customer not found: ${customerId}`);
  }

  // Fetch all subscriptions for this customer
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 100, // Get all subscriptions
    status: 'all', // Include all statuses
  });

  // If no subscriptions, delete any existing record and update accounts table
  if (subscriptions.data.length === 0) {
    const { error: deleteError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('stripe_customer_id', customerId);

    if (deleteError) {
      console.error('Error deleting subscription record:', deleteError);
      // Don't throw - this is a cleanup operation
    }

    // Update accounts table - no subscription
    const { error: accountUpdateError } = await supabase
      .from('accounts')
      .update({
        subscription_status: 'inactive',
        stripe_subscription_id: null,
        plan: 'hobby',
        billing_mode: 'standard',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId);

    if (accountUpdateError) {
      console.error('Error updating account:', accountUpdateError);
      // Don't throw - this is a cleanup operation
    }
    return;
  }

  // Sort subscriptions: active first, then by created date (most recent first)
  const sortedSubscriptions = subscriptions.data.sort((a, b) => {
    const statusPriority: Record<string, number> = {
      active: 1,
      trialing: 2,
      past_due: 3,
      canceled: 4,
      unpaid: 5,
      incomplete: 6,
      incomplete_expired: 7,
      paused: 8,
    };

    const aPriority = statusPriority[a.status] || 99;
    const bPriority = statusPriority[b.status] || 99;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // If same status, sort by created date (most recent first)
    return b.created - a.created;
  });

  // Use the first subscription (highest priority/most recent)
  const subscription = sortedSubscriptions[0];

  // Get the price ID from the first item
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    throw new Error('Subscription has no price ID');
  }

  // Get payment method details if available
  let cardBrand: string | null = null;
  let cardLast4: string | null = null;

  if (subscription.default_payment_method) {
    try {
      const paymentMethod = typeof subscription.default_payment_method === 'string'
        ? await stripe.paymentMethods.retrieve(subscription.default_payment_method)
        : subscription.default_payment_method;

      if (paymentMethod && paymentMethod.type === 'card' && paymentMethod.card) {
        cardBrand = paymentMethod.card.brand || null;
        cardLast4 = paymentMethod.card.last4 || null;
      }
    } catch (error) {
      // Payment method retrieval failed - continue without card info
      console.warn('Failed to retrieve payment method details:', error);
    }
  }

  // Convert Unix timestamps to ISO strings for database
  const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  // Upsert subscription data
  const { error: upsertError } = await supabase
    .from('subscriptions')
    .upsert(
      {
        stripe_customer_id: customerId,
        subscription_id: subscription.id,
        status: subscription.status,
        price_id: priceId,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: subscription.cancel_at_period_end || false,
        card_brand: cardBrand,
        card_last4: cardLast4,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'stripe_customer_id', // Use stripe_customer_id as the conflict target (unique constraint)
      }
    );

  if (upsertError) {
    throw new Error(`Failed to sync subscription data: ${upsertError.message}`);
  }

  // Also update accounts table with subscription data
  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    trialing: 'trialing',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    unpaid: 'unpaid',
    paused: 'paused',
  };

  const plan = 'contributor'; // If they have a subscription, they're on contributor plan
  const billingMode = subscription.status === 'trialing' ? 'trial' : 'standard';
  const subscriptionStatus = statusMap[subscription.status] || subscription.status;

  const { error: accountUpdateError } = await supabase
    .from('accounts')
    .update({
      subscription_status: subscriptionStatus,
      stripe_subscription_id: subscription.id,
      plan: plan,
      billing_mode: billingMode,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  if (accountUpdateError) {
    throw new Error(`Failed to update account: ${accountUpdateError.message}`);
  }
}

