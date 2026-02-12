# Draft Routes System - Quick Reference

## Problem Solved

Keep working on routes, commit code, but prevent them from being published/accessible in production.

## Solution Overview

1. **Mark routes as draft** → Add to `DRAFT_ROUTES` array
2. **Use draft metadata** → Prevents SEO indexing
3. **Enable blocking** → Middleware redirects in production
4. **Code stays in repo** → Everything remains committed

## Quick Start

### 1. Identify Route Dependencies

```bash
tsx scripts/identify-route-dependencies.ts /your-route
```

Shows all related files (components, services, API routes, etc.)

### 2. Mark as Draft

**File:** `src/lib/routes/draft-pages.ts`

```typescript
export const DRAFT_ROUTES = [
  '/your-route',  // Add here
] as const;
```

### 3. Update Page Metadata

**File:** `src/app/your-route/page.tsx`

```typescript
import { generateDraftMetadata } from '@/lib/utils/metadata';

export const metadata = generateDraftMetadata({
  title: 'Your Route (Draft)',
});
```

### 4. Enable Production Blocking (Optional)

**File:** `src/lib/routes/draft-pages.ts`

```typescript
export const DRAFT_CONFIG = {
  blockInProduction: true,  // Blocks access in production
  allowInDevelopment: true, // Always allow in dev
} as const;
```

## Files Created/Modified

- ✅ `scripts/identify-route-dependencies.ts` - Dependency analyzer
- ✅ `src/middleware.ts` - Draft route blocking (already integrated)
- ✅ `docs/DRAFT_PAGES_GUIDE.md` - Complete guide
- ✅ `docs/DRAFT_ROUTES_WORKFLOW.md` - Step-by-step workflow

## Key Features

- ✅ **No code deletion** - Keep everything in repo
- ✅ **Development access** - Test locally anytime
- ✅ **Production blocking** - Redirects to homepage
- ✅ **SEO protection** - `noindex, nofollow` meta tags
- ✅ **Admin visibility** - Shows in dashboard as "draft"
- ✅ **Easy publishing** - Just remove from array

## Example Routes to Consider

Based on your codebase, these might be candidates:

- `/marketplace` - E-commerce feature
- `/stories` - Social stories
- `/feed` - Feed page
- `/friends` - Social graph
- `/messages` - Messaging
- `/memories` - Memories feature
- `/saved` - Saved items
- `/ad_center` - Ad center (if not ready)

## Next Steps

1. Run dependency analyzer on routes you want to draft
2. Add routes to `DRAFT_ROUTES`
3. Update page metadata
4. Enable `blockInProduction` if desired
5. Commit everything - code stays in repo!
