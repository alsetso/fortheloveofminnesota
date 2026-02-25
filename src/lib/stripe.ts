import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
});

// Helper function to create Stripe customer if missing
// Stores the customer ID in the accounts table
export const createStripeCustomerIfMissing = async (
  userId: string, 
  email: string, 
  supabase: any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<string> => {
  // Check if customer already exists
  const { data: account } = await supabase
    .from('accounts')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (account?.stripe_customer_id) {
    return account.stripe_customer_id;
  }

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email: email,
    metadata: {
      userId: userId
    }
  });

  // Store stripe_customer_id in accounts table
  await supabase
    .from('accounts')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  return customer.id;
};
