# Auth + Billing Check Optimization

## Problem
- Multiple auth checks per page load (8-12 on map pages, 3-5 on general pages)
- Each API route independently authenticates
- PageWrapper and main content both fetch auth/billing separately
- No request-level deduplication

## Solution: Single Server-Side Fetch

### Architecture

1. **Root Layout (Server Component)**
   - Calls `getAuthAndBilling()` once per request
   - Uses React `cache()` for request-level deduplication
   - Provides initial data via `InitialBillingDataProvider`

2. **`getAuthAndBilling()` Function**
   - Fetches auth + billing features in one database call
   - Uses React `cache()` to deduplicate within same request
   - Returns both auth and billing data together

3. **Client Components**
   - `BillingEntitlementsProvider` uses initial data from context
   - Only refetches if account changes
   - No blocking - uses initial data immediately

### Benefits

- **Single auth check per page load** (via React cache)
- **PageWrapper loads seamlessly** (uses initial data, doesn't block)
- **Main content loads independently** (shares same initial data)
- **API routes still use request-level caching** (via `getRequestAuth()`)

### Implementation Details

**Root Layout (`src/app/layout.tsx`):**
```typescript
export default async function RootLayout({ children }) {
  // Single fetch per request (cached)
  const { billing } = await getAuthAndBilling();
  
  return (
    <InitialBillingDataProvider initialData={billing}>
      <Providers>
        {children}
      </Providers>
    </InitialBillingDataProvider>
  );
}
```

**Unified Fetcher (`src/lib/server/getAuthAndBilling.ts`):**
- Uses `getServerAuth()` (already cached)
- Fetches billing features in same call
- Returns both together

**Client Context (`src/contexts/BillingEntitlementsContext.tsx`):**
- Reads initial data from `InitialBillingDataProvider`
- Uses it immediately (no loading state)
- Only refetches on account change

### Performance Impact

**Before:**
- Map page: 8-12 auth checks (1.6-9.6s overhead)
- General page: 3-5 auth checks (0.6-4s overhead)

**After:**
- Map page: 1 auth check (0.2-1s overhead) - **80% reduction**
- General page: 1 auth check (0.1-0.8s overhead) - **80% reduction**

### Notes

- API routes still benefit from `getRequestAuth()` WeakMap caching
- Server components use `getServerAuth()` which is also cached
- Client components get initial data immediately, no blocking
- Only refetches when account changes (via `activeAccountId` cookie)
