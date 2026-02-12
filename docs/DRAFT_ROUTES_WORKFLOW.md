# Draft Routes Workflow

Complete workflow for identifying, marking, and managing draft/unpublished routes.

## Step 1: Identify Routes to Mark as Draft

List routes you want to keep working on but not publish:

```bash
# Example: Identify dependencies for a route
tsx scripts/identify-route-dependencies.ts /marketplace
```

This shows:
- Page file location
- Components used
- Services used
- API routes
- Hooks, types, utils
- Related sibling routes

## Step 2: Mark Route as Draft

Edit `src/lib/routes/draft-pages.ts`:

```typescript
export const DRAFT_ROUTES = [
  '/marketplace',  // Add your route here
  '/stories',
  '/feed',
] as const;
```

## Step 3: Update Page Metadata

In the route's `page.tsx`, use draft metadata:

```typescript
import { generateDraftMetadata } from '@/lib/utils/metadata';

export const metadata = generateDraftMetadata({
  title: 'Marketplace (Draft)',
  description: 'Coming soon...',
});
```

## Step 4: Configure Production Blocking (Optional)

In `src/lib/routes/draft-pages.ts`:

```typescript
export const DRAFT_CONFIG = {
  blockInProduction: true,  // Enable to block in production
  allowInDevelopment: true, // Always allow in dev
  showDraftBanner: true,
} as const;
```

## What Happens

### In Development
- ✅ Routes are accessible
- ✅ Can test and develop normally
- ✅ Code remains in repo

### In Production (if `blockInProduction: true`)
- 🔒 Routes redirect to homepage
- 🚫 Search engines won't index (`noindex, nofollow`)
- 📊 Shows as "draft" in admin dashboard

### Code Management
- ✅ All files stay in codebase
- ✅ Can commit changes normally
- ✅ No need to delete or comment out code
- ✅ Easy to publish later (just remove from `DRAFT_ROUTES`)

## Publishing a Draft Route

When ready to publish:

1. Remove route from `DRAFT_ROUTES` array
2. Replace `generateDraftMetadata()` with normal metadata
3. (Optional) Set `blockInProduction: false` if you want to keep blocking other drafts

## Example: Complete Draft Setup

```typescript
// src/lib/routes/draft-pages.ts
export const DRAFT_ROUTES = [
  '/marketplace',  // E-commerce feature - in development
  '/stories',      // Social stories feature - not ready
] as const;

export const DRAFT_CONFIG = {
  blockInProduction: true,
  allowInDevelopment: true,
  showDraftBanner: true,
} as const;
```

```typescript
// src/app/marketplace/page.tsx
import { generateDraftMetadata } from '@/lib/utils/metadata';

export const metadata = generateDraftMetadata({
  title: 'Marketplace | For the Love of Minnesota',
  description: 'Minnesota marketplace - coming soon',
});

export default function MarketplacePage() {
  return (
    <div>
      <h1>Marketplace</h1>
      <p>This page is under development.</p>
    </div>
  );
}
```

## Admin Dashboard

View all draft routes at `/admin/dashboard`:
- Total draft routes count
- Draft badge on routes
- Filter/search by draft status
