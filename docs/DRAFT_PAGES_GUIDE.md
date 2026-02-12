# Draft/Unpublished Pages Guide

## Overview

Pages in Next.js App Router are automatically accessible if they have a `page.tsx` file. To keep pages unpublished while still maintaining the code, use the draft pages system.

## How It Works

1. **Robots Meta Tag**: Prevents search engines from indexing draft pages
2. **Middleware Blocking**: Blocks access entirely in production (when enabled)
3. **Admin Dashboard Tracking**: Shows draft status in routes dashboard
4. **Code Stays in Repo**: All files remain committed and accessible for development

## Quick Start

### Step 1: Identify Route Dependencies

Use the dependency identifier script to see all related files:

```bash
tsx scripts/identify-route-dependencies.ts /marketplace
```

This will show:
- Page file
- Components used
- Services used
- API routes
- Hooks, types, utils
- Related routes

### Step 2: Mark Route as Draft

Add the route path to `src/lib/routes/draft-pages.ts`:

```typescript
export const DRAFT_ROUTES = [
  '/marketplace',
  '/stories',
  '/feed',
] as const;
```

### Step 3: Use Draft Metadata

In your page's `page.tsx`, use `generateDraftMetadata()`:

```typescript
import { generateDraftMetadata } from '@/lib/utils/metadata';

export const metadata = generateDraftMetadata({
  title: 'Marketplace (Draft)',
  description: 'Coming soon...',
});
```

Or for dynamic metadata:

```typescript
export async function generateMetadata(): Promise<Metadata> {
  return generateDraftMetadata({
    title: 'Marketplace (Draft)',
    description: 'Coming soon...',
  });
}
```

### Step 4: Enable Production Blocking (Optional)

To completely block access to draft pages in production, update `src/lib/routes/draft-pages.ts`:

```typescript
export const DRAFT_CONFIG = {
  blockInProduction: true, // Enable blocking
  allowInDevelopment: true, // Still allow in dev
  showDraftBanner: true,
} as const;
```

**Note:** Middleware blocking is already integrated. Just enable `blockInProduction: true` and it will work automatically.

## What Happens

- ✅ **Page remains in codebase** - No need to delete or comment out
- ✅ **Search engines won't index** - `noindex, nofollow` robots meta
- ✅ **Shows in admin dashboard** - Marked as "draft" with orange badge
- ✅ **Accessible in development** - Can still test locally
- 🔒 **Blocked in production** - Redirects to homepage if `blockInProduction: true`

## Identifying Related Files

When marking a route as draft, you may want to identify all related components, services, and API routes. Use the dependency identifier:

```bash
# Analyze a route
tsx scripts/identify-route-dependencies.ts /marketplace

# Output shows:
# - Page file location
# - All components used
# - All services used  
# - Related API routes
# - Hooks, types, utils
# - Related sibling routes
```

This helps you understand the full scope of what's associated with a draft route.

## Best Practices

1. **Use descriptive draft metadata** - Helps identify what's coming
2. **Keep draft list updated** - Remove routes when they're ready
3. **Document why it's draft** - Add comments in `draft-pages.ts`
4. **Review regularly** - Check admin dashboard for draft routes
5. **Identify dependencies first** - Use the script to see what's affected before marking as draft

## Example: Complete Draft Page

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

The admin dashboard (`/admin/dashboard`) shows:
- Total draft routes count
- Draft badge on routes
- Filter/search by draft status
