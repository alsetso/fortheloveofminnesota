# Subscription Schema Recommendation

## Current State

**accounts table:**
- `plan` TEXT - Stores plan slug (hobby, contributor, testing, etc.) - denormalized cache
- `stripe_subscription_id` TEXT - Stripe subscription ID (string, not FK)
- `subscription_status` TEXT - Stripe subscription status
- `billing_mode` TEXT - standard or trial

**subscriptions table:**
- `id` UUID PRIMARY KEY
- `stripe_customer_id` TEXT UNIQUE - Links to accounts.stripe_customer_id (one-to-one)
- `subscription_id` TEXT UNIQUE - Stripe subscription ID
- `status` TEXT - Subscription status
- `price_id` TEXT - Stripe price ID (maps to billing.plans)

## Recommendation: Add `active_subscription_id` Foreign Key

### Why This Approach?

1. **Relational Integrity**: Proper foreign key ensures data consistency
2. **Fast Joins**: Can JOIN subscriptions table directly without string matching
3. **Denormalized Cache**: Keep `accounts.plan` for fast lookups (no JOIN needed)
4. **Best of Both Worlds**: Fast lookups + proper relational structure

### Proposed Schema Change

```sql
-- Add foreign key to subscriptions table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS active_subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_accounts_active_subscription_id 
  ON public.accounts(active_subscription_id) 
  WHERE active_subscription_id IS NOT NULL;

-- Update webhook to set both plan (cache) and active_subscription_id (FK)
-- This maintains backward compatibility while adding proper relational link
```

### Benefits

1. **Fast Plan Lookups**: `accounts.plan` still works for simple queries (no JOIN)
2. **Relational Queries**: Can JOIN subscriptions for detailed subscription data
3. **Data Integrity**: Foreign key ensures subscription exists
4. **Flexibility**: Can still use `stripe_subscription_id` for Stripe API calls
5. **Backward Compatible**: Existing code using `accounts.plan` continues to work

### Migration Strategy

1. Add `active_subscription_id` column (nullable initially)
2. Backfill from existing `stripe_subscription_id` → find matching `subscriptions.subscription_id` → set `active_subscription_id`
3. Update webhook to set both `plan` and `active_subscription_id`
4. Gradually migrate queries to use JOIN when needed, keep `plan` for simple lookups

### Usage Pattern

```typescript
// Fast lookup (no JOIN needed)
const plan = account.plan; // 'hobby', 'contributor', etc.

// Detailed subscription data (with JOIN)
const accountWithSubscription = await supabase
  .from('accounts')
  .select(`
    *,
    active_subscription:subscriptions!active_subscription_id(*)
  `)
  .eq('id', accountId)
  .single();
```

## Alternative: Keep Current Approach

If you prefer to keep current structure:
- `accounts.plan` - denormalized cache
- `accounts.stripe_subscription_id` - string reference
- Join via `stripe_customer_id` when needed

**Pros**: Simpler, no migration needed
**Cons**: No relational integrity, string-based joins

## Recommendation

**Add `active_subscription_id` FK** - Provides relational integrity while maintaining fast lookups via denormalized `plan` column.
