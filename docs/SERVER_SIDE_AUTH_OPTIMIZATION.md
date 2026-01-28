# Server-Side Auth Optimization

## Problem
- Multiple redundant authentication checks on every page (8-12 on map pages, 3-5 on general pages)
- Client-side auth fetching in PageWrapper and AuthStateProvider
- PageWrapper refreshes on client-side navigation

## Solution: Global Server-Side Auth

### Architecture

1. **Root Layout (Server Component)**
   - Fetches auth + billing once per request via `getAuthAndBilling()`
   - Uses React `cache()` for request-level deduplication
   - Passes initial auth data to `Providers` component

2. **Providers (Client Component)**
   - Accepts `initialAuth` prop from layout
   - Passes to `AuthStateProvider` to skip client-side fetch

3. **AuthStateProvider (Client Component)**
   - Accepts `initialAuth` prop
   - If provided, skips initial client-side auth fetch
   - Still fetches User object for full context, but knows user exists (faster)
   - Only does full auth check if no initial data provided

4. **PageWrapper (Client Component)**
   - Accepts `initialAuth` prop (for future optimization)
   - Uses `useAuthStateSafe()` which reads from context
   - Context now uses server-provided initial data

### Implementation

**Layout (`src/app/layout.tsx`):**
```typescript
export default async function RootLayout({ children }) {
  // Single fetch per request (cached)
  const { auth, billing } = await getAuthAndBilling();
  
  return (
    <Providers initialAuth={auth}>
      {children}
    </Providers>
  );
}
```

**AuthStateProvider (`src/features/auth/contexts/AuthStateContext.tsx`):**
```typescript
export function AuthStateProvider({ children, initialAuth }) {
  // If initialAuth provided, skip timeout and know user exists
  const [isLoading, setIsLoading] = useState(!initialAuth?.userId);
  
  useEffect(() => {
    if (initialAuth?.userId) {
      // Quick fetch - we know user exists
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } else {
      // Full check with timeout
      // ... existing logic
    }
  }, [initialAuth?.userId]);
}
```

### Benefits

- **Single auth check per page load** (via React cache in layout)
- **No redundant client-side fetching** (AuthStateProvider uses initial data)
- **Faster initial load** (no 2s timeout if user is authenticated)
- **Global auth state** (available to all components via context)

### Performance Impact

**Before:**
- Map page: 8-12 auth checks (1.6-9.6s overhead)
- General page: 3-5 auth checks (0.6-2.5s overhead)
- Client-side fetch in PageWrapper + AuthStateProvider

**After:**
- All pages: 1 auth check (server-side, cached per request)
- Client-side: Only fetches User object if initialAuth provided (fast)
- No redundant checks

### Future Optimization: Full Server-Side PageWrapper

To make PageWrapper truly server-side (no refresh on navigation):

1. Convert pages to server components
2. Use `PageWrapperWithAuth` (server component wrapper)
3. Pass server-fetched data to client PageWrapper

**Example:**
```typescript
// page.tsx (server component)
export default async function MyPage() {
  return (
    <PageWrapperWithAuth>
      <MyPageClient />
    </PageWrapperWithAuth>
  );
}
```

This requires splitting each page into server wrapper + client component, which is a larger refactor.

### Current State

✅ Auth is now global (fetched once in layout)
✅ No redundant client-side auth fetching
✅ AuthStateProvider uses server-provided initial data
⚠️ PageWrapper is still client component (refreshes on navigation, but uses cached auth)

The key optimization is complete: auth is fetched once server-side and shared globally via context.
