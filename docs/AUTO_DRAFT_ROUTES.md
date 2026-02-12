# Auto-Mark Routes Without Metadata as Draft

## Overview

Automatically identify and mark all page routes without metadata as draft. This ensures incomplete/unpublished routes are properly handled.

## Quick Start

### Step 1: Scan Routes (Dry Run)

See which routes would be marked as draft:

```bash
npm run draft:scan
# or
tsx scripts/mark-routes-without-metadata-as-draft.ts --dry-run
```

This will show:
- Total routes found
- Routes without metadata
- What changes would be made

### Step 2: Apply Changes

Mark all routes without metadata as draft:

```bash
npm run draft:apply
# or
tsx scripts/mark-routes-without-metadata-as-draft.ts --apply
```

## What It Does

1. **Scans all routes** - Finds all `page.tsx` files in `src/app`
2. **Identifies missing metadata** - Checks for `export const metadata` or `generateMetadata()`
3. **Adds to DRAFT_ROUTES** - Updates `src/lib/routes/draft-pages.ts`
4. **Adds draft metadata** - Inserts `generateDraftMetadata()` in page files

## Example Output

```
🔍 DRY RUN MODE - No files will be modified

Scanning routes...

📊 Found 75 total routes
📋 Found 12 routes without metadata

Routes without metadata:
  - /marketplace (src/app/marketplace/page.tsx)
  - /stories (src/app/stories/page.tsx)
  - /feed (src/app/feed/page.tsx)
  ...

============================================================

📝 Would update DRAFT_ROUTES to:
export const DRAFT_ROUTES = [
  '/feed',
  '/marketplace',
  '/stories',
  ...
] as const

Updating page files...

   📝 Would add draft metadata to: src/app/marketplace/page.tsx
   📝 Would add draft metadata to: src/app/stories/page.tsx
   ...

Would update 12 page files

💡 Run with --apply to make changes
```

## After Running

1. **Review changes** - Check `src/lib/routes/draft-pages.ts` and updated page files
2. **Test in development** - Routes should still be accessible locally
3. **Enable production blocking** (optional) - Set `blockInProduction: true` in `DRAFT_CONFIG`
4. **Commit changes** - All code stays in repo

## Excluding Routes

If you want to exclude certain routes from being auto-marked as draft:

1. Add metadata to those routes first
2. Or manually remove them from `DRAFT_ROUTES` after running

## Publishing Draft Routes

When ready to publish a route:

1. Remove from `DRAFT_ROUTES` array
2. Replace `generateDraftMetadata()` with proper metadata
3. Commit changes

## Notes

- Routes with `generateDraftMetadata()` are skipped (already draft)
- Routes with `export const metadata` or `generateMetadata()` are skipped (have metadata)
- Only routes with NO metadata are marked as draft
- Script preserves existing `DRAFT_ROUTES` entries
