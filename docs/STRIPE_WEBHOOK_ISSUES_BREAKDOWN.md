# Stripe Webhook Issues Breakdown

## Current Status
- ✅ Stripe webhook returns 200 success
- ✅ Subscriptions table is being populated correctly
- ❌ `checkout=success` URL parameter disappears immediately
- ❌ No records appearing in `stripe_events` table

---

## Expected Flow

### 1. User Completes Checkout
1. User clicks "Start Free Trial" → redirected to Stripe Checkout
2. User completes payment → Stripe redirects to `success_url` with `?checkout=success`
3. **Expected**: URL should show `/onboarding?step=plans&substep=3&checkout=success`
4. **Expected**: Confetti animation triggers
5. **Expected**: After 1 second, `checkout=success` param is cleaned from URL

### 2. Stripe Webhook Processing
1. Stripe sends `checkout.session.completed` event to `/api/stripe/webhook`
2. **Expected**: Event is logged to `stripe_events` table immediately
3. **Expected**: Subscription data is upserted to `subscriptions` table
4. **Expected**: Account record is updated (`plan`, `subscription_status`, `billing_mode`)
5. **Expected**: Event record is marked as `processed: true`

---

## Issues Identified

### Issue 1: URL Parameter Disappearing Immediately

**Location**: `src/components/onboarding/PlanSelectorStepper.tsx`

**Problem**: The `checkout=success` parameter is being removed before the 1-second delay completes.

**Root Causes**:
1. **`updateSubStepUrl` function (lines 94-99)**: Creates new URL from `window.location.href` and preserves existing params, but if called after checkout redirect, it may overwrite the URL before the cleanup timeout fires.
2. **Multiple re-renders**: Component may re-render after Stripe redirect, causing `useEffect` to run multiple times or other logic to reset the URL.
3. **Router navigation**: `router.replace()` in `updateSubStepUrl` may be clearing params if called elsewhere.

**Code Locations**:
- Line 94-99: `updateSubStepUrl` function
- Line 102-117: `useEffect` that handles `checkout=success` cleanup
- Lines 229, 371, 554, 591, 642, 671, 756, 901, 904, 974, 978: All places `updateSubStepUrl` is called

**Potential Fix**:
- Ensure `updateSubStepUrl` explicitly preserves `checkout` parameter when updating URL
- Add guard to prevent `updateSubStepUrl` from running if `checkout=success` is present
- Check if any other navigation logic is clearing the URL

---

### Issue 2: `stripe_events` Table Not Receiving Records

**Location**: `src/app/api/stripe/webhook/route.ts`

**Problem**: Events are not being inserted into `stripe_events` table, but webhook returns 200.

**Root Causes**:
1. **Silent error swallowing (lines 294-298, 310-313)**: Errors are only logged in `development` mode. In production, if the insert fails, we see no error logs.
2. **RLS Policy**: The `stripe_events` table has RLS enabled. The service role should bypass RLS, but need to verify the client is using service role key correctly.
3. **Database constraint violation**: The `stripe_event_id` column has `UNIQUE` constraint. If duplicate events are sent, insert will fail silently.
4. **Missing error logging**: Production errors are not being logged, making debugging impossible.

**Code Locations**:
- Line 258: `createServiceClient()` - creates Supabase client
- Lines 281-292: Insert into `stripe_events` table
- Lines 294-298: Error handling (only logs in dev)
- Lines 310-313: Catch block (only logs in dev)

**Database Schema**:
- Table: `public.stripe_events` (created in migration `412_create_stripe_events_table.sql`)
- RLS Policy: "Service role can manage all events" (line 100-104 of migration)
- Function: `link_stripe_event_to_account` (lines 48-74 of migration)

**Potential Fixes**:
1. **Always log errors** (not just in development):
   ```typescript
   if (logError) {
     console.error('[WEBHOOK] Failed to log Stripe event:', logError);
     // Also log to external service or database for production debugging
   }
   ```

2. **Verify service role client**: Ensure `createServiceClient()` is using `SUPABASE_SERVICE_ROLE_KEY` correctly (already verified - this was the missing env var issue).

3. **Handle duplicate events**: Check for existing `stripe_event_id` before insert, or use `upsert` instead of `insert`.

4. **Add production logging**: Use structured logging (e.g., Vercel logs, Sentry) to capture errors in production.

---

## Code Flow Analysis

### URL Parameter Flow
```
Stripe redirect → /onboarding?step=plans&substep=3&checkout=success
  ↓
useEffect detects checkout=success (line 102-117)
  ↓
setCheckoutSuccess(true) (line 105)
  ↓
setTimeout(1000ms) → cleanup URL (line 107-110)
  ↓
BUT: Something calls updateSubStepUrl(2) before timeout?
  ↓
URL becomes /onboarding?step=plans&substep=2 (checkout param lost)
```

### Webhook Event Flow
```
Stripe sends event → POST /api/stripe/webhook
  ↓
Verify signature (line 241-251)
  ↓
Log event to stripe_events (line 281-292)
  ↓
IF logError → silently ignored in production (line 294-298) ❌
  ↓
Process subscription update (line 431)
  ↓
Update subscriptions table ✅
  ↓
Update accounts table ✅
  ↓
Return 200 ✅
```

---

## Verification Steps

### For URL Parameter Issue:
1. Add console.log to `updateSubStepUrl` to see when it's called
2. Add console.log to `useEffect` cleanup to see if timeout fires
3. Check if any other navigation logic runs after Stripe redirect
4. Verify `router.replace()` is not clearing params

### For stripe_events Issue:
1. **Check Vercel function logs** for any errors during webhook execution
2. **Query database directly**:
   ```sql
   SELECT * FROM stripe_events ORDER BY created_at DESC LIMIT 10;
   ```
3. **Check for duplicate events**:
   ```sql
   SELECT stripe_event_id, COUNT(*) 
   FROM stripe_events 
   GROUP BY stripe_event_id 
   HAVING COUNT(*) > 1;
   ```
4. **Verify RLS policies**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'stripe_events';
   ```
5. **Test insert manually** (as service role):
   ```sql
   INSERT INTO stripe_events (
     stripe_event_id, 
     event_type, 
     event_data, 
     stripe_customer_id
   ) VALUES (
     'test_evt_123',
     'test.event',
     '{}'::jsonb,
     'test_cus_123'
   );
   ```

---

## Recommended Fixes

### Fix 1: Preserve URL Parameters
```typescript
const updateSubStepUrl = (substep: 1 | 2 | 3 | 4) => {
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('step', 'plans');
  currentUrl.searchParams.set('substep', substep.toString());
  // Explicitly preserve checkout parameter if present
  const checkoutParam = currentUrl.searchParams.get('checkout');
  if (checkoutParam) {
    // Don't update URL if checkout param exists - let cleanup handle it
    return;
  }
  router.replace(currentUrl.pathname + currentUrl.search, { scroll: false });
};
```

### Fix 2: Always Log Errors
```typescript
if (logError) {
  // Always log errors, not just in development
  console.error('[WEBHOOK] Failed to log Stripe event to database:', {
    error: logError,
    event_id: event.id,
    event_type: event.type,
    customer_id: customerIdForLog,
  });
  
  // Optionally: Send to error tracking service (Sentry, etc.)
}
```

### Fix 3: Handle Duplicate Events
```typescript
// Check if event already exists before inserting
const { data: existingEvent } = await supabase
  .from('stripe_events')
  .select('id')
  .eq('stripe_event_id', event.id)
  .single();

if (existingEvent) {
  eventRecordId = existingEvent.id;
  // Update existing record instead of inserting
} else {
  // Insert new record
  const { data: eventRecord, error: logError } = await supabase
    .from('stripe_events')
    .insert({...})
    .select('id')
    .single();
}
```

---

## Files to Review

1. **`src/app/api/stripe/webhook/route.ts`** (lines 254-313): Event logging logic
2. **`src/components/onboarding/PlanSelectorStepper.tsx`** (lines 94-117): URL parameter handling
3. **`supabase/migrations/412_create_stripe_events_table.sql`**: Table schema and RLS policies
4. **Vercel Function Logs**: Check for runtime errors during webhook execution

---

## Next Steps

1. ✅ Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel (already done)
2. 🔍 Check Vercel function logs for webhook execution errors
3. 🔍 Query `stripe_events` table directly to see if any records exist
4. 🔧 Fix error logging to always output (not just dev mode)
5. 🔧 Fix URL parameter preservation in `updateSubStepUrl`
6. 🔧 Add duplicate event handling
7. 🧪 Test end-to-end flow after fixes
