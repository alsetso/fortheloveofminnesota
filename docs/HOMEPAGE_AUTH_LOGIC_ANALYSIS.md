# Homepage Auth & Onboarding Logic Analysis

## Current State: Over-Engineered

### Multiple Layers Checking Same Things

**1. Homepage (`src/app/page.tsx`)**
```typescript
// Simple check: show banner if not authenticated
if (isLoading || !isAuthenticated) {
  return <PromotionalBanner isOpen={true} />;
}
// Otherwise show HomeFeedContent
```

**2. Middleware (`src/middleware.ts`)** - Lines 384-400
```typescript
// Checks onboarding for ALL authenticated users on ALL routes
if (user && pathname !== '/onboarding') {
  const accountData = await getUserAccountData(...);
  if (accountData && accountData.onboarded === false) {
    return NextResponse.redirect('/onboarding');
  }
}
```

**3. ProtectedRouteGuard (`src/components/auth/ProtectedRouteGuard.tsx`)**
```typescript
// Shows banner for anonymous users on protected routes
// Allows: homepage, mention pages, profile pages
// Used on some routes but NOT homepage
```

**4. useHomepageState Hook (`src/features/homepage/hooks/useHomepageState.ts`)**
```typescript
// Complex logic with multiple useEffects:
// - Checks account completeness
// - Opens/closes welcome modal
// - Redirects to onboarding
// - Handles user login/logout
// NOT USED on homepage currently
```

**5. Onboarding Page (`src/app/onboarding/page.tsx`)**
```typescript
// Server-side checks:
// - Redirects if not authenticated
// - Redirects if already onboarded
```

## Current Flow

### Anonymous User → Homepage
1. `page.tsx`: Checks `isAuthenticated` → Shows `PromotionalBanner`
2. User clicks "Get Started" → Opens welcome modal
3. User signs in → Middleware checks onboarding → Redirects to `/onboarding` if incomplete

### Authenticated User → Homepage
1. `page.tsx`: Checks `isAuthenticated` → Shows `HomeFeedContent`
2. **BUT**: Middleware intercepts FIRST → Checks onboarding → Redirects to `/onboarding` if incomplete
3. **Result**: Authenticated users with incomplete onboarding NEVER see homepage

### Authenticated + Onboarded → Homepage
1. Middleware: Passes onboarding check → Allows access
2. `page.tsx`: Shows `HomeFeedContent`

## Problems

1. **Redundant Checks**: Middleware AND page component both check auth
2. **Onboarding Redirect**: Happens in middleware, so incomplete users never see homepage
3. **Unused Hook**: `useHomepageState` has complex logic but isn't used on homepage
4. **Multiple Auth Checks**: `useAuthStateSafe`, middleware, page component all check auth
5. **ProtectedRouteGuard**: Not used on homepage but exists for other routes

## Simplified Logic (Recommended)

### Single Source of Truth: Middleware

**Middleware handles:**
- Auth check → Redirect to `/` with `?redirect=...`
- Onboarding check → Redirect to `/onboarding`
- System visibility → Redirect to `/` with `?blocked=...`

**Homepage (`page.tsx`) handles:**
- Show `PromotionalBanner` if not authenticated
- Show `HomeFeedContent` if authenticated
- **No onboarding check** (middleware handles it)

**Onboarding page handles:**
- Server-side: Redirect if not authenticated
- Server-side: Redirect if already onboarded
- Client-side: Show onboarding flow

### Simplified Homepage Code

```typescript
'use client';

import { Suspense } from 'react';
import { useAuthStateSafe } from '@/features/auth';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import HomeFeedContent from '@/features/homepage/components/HomeFeedContent';
import PromotionalBanner from '@/components/auth/PromotionalBanner';
import { BlockedRouteToast } from '@/components/system/BlockedRouteToast';

export default function Home() {
  const { account, isLoading, isAuthenticated } = useAuthStateSafe();
  
  // Show banner for non-authenticated users
  // Middleware handles onboarding redirect, so if we reach here and are authenticated,
  // user is either onboarded OR onboarding page handles the redirect
  if (isLoading || !isAuthenticated || !account) {
    return <PromotionalBanner isOpen={true} />;
  }

  return (
    <>
      <Suspense fallback={null}>
        <BlockedRouteToast />
      </Suspense>
      <NewPageWrapper
        leftSidebar={<LeftSidebar />}
        rightSidebar={<RightSidebar />}
      >
        <div className="w-full py-6">
          <HomeFeedContent />
        </div>
      </NewPageWrapper>
    </>
  );
}
```

## What Can Be Removed

1. **`useHomepageState` hook** - Complex logic not used on homepage
2. **Onboarding checks in homepage** - Middleware handles it
3. **ProtectedRouteGuard on homepage** - Not needed, homepage handles its own auth check
4. **Multiple auth state checks** - Single `useAuthStateSafe` call is sufficient

## Current Auth States

| State | Homepage Behavior | Middleware Behavior |
|-------|------------------|---------------------|
| Anonymous | Shows `PromotionalBanner` | Allows access (homepage is public) |
| Authenticated + Not Onboarded | **Never reached** (middleware redirects) | Redirects to `/onboarding` |
| Authenticated + Onboarded | Shows `HomeFeedContent` | Allows access |

## Recommendation

**Simplify to:**
1. Middleware: Handle auth redirects and onboarding redirects
2. Homepage: Simple auth check → Banner or Content
3. Remove unused hooks and redundant checks
