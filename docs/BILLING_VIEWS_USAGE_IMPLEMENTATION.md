# Billing Page: Views & Usage Implementation

## Question for Senior Dev

We need to add a "Views & Usage" section to the billing page (`/billing`) that displays a table showing which maps the account has viewed, how many times each map was viewed, and when those views occurred. The data source is `analytics.map_views` which tracks `map_id`, `account_id` (viewer), and `viewed_at` timestamps. The table is already indexed on `account_id`, `map_id`, and `viewed_at` with RLS policies allowing users to view map views for maps they own.

**Key considerations:**
1. **Query strategy**: Should we aggregate at the database level (GROUP BY map_id with COUNT and MAX/MIN viewed_at) or fetch raw rows and aggregate client-side? The existing `idx_map_views_account_map` composite index suggests a query filtering by `account_id` and grouping by `map_id` would be efficient, but we need to join with `map` table to get map names.

2. **Data scope**: Should this show views for maps the account owns, maps they've viewed (as a viewer), or both? The RLS policy "Users can view views of own maps" suggests it's currently scoped to owned maps, but the requirement seems to be showing what maps *this account* has viewed (i.e., where `map_views.account_id = current_account_id`). This would require a different RLS policy or a new query pattern.

3. **Performance**: For accounts with thousands of views, should we implement pagination, date-range filtering (e.g., last 30/90 days), or both? The table could grow large over time, so we need a strategy that scales.

4. **UI placement**: Should this be a new section on the main billing page (below the plans comparison), or a tab/sidebar section? The current billing page has AccountSidebar and PaymentMethodsSidebar—should this be a third sidebar or integrated into the main content area?

5. **Table columns**: Map name, view count, last viewed date, first viewed date (optional), and potentially a link to the map. Should we also show total views across all maps as a summary metric?

6. **Empty state**: What should we display if the account has no map views? A message suggesting they explore maps, or simply hide the section?

7. **Caching strategy**: Given this is billing/account data that doesn't need real-time accuracy, should we cache the aggregated results (e.g., 5-15 minute TTL) to reduce database load, or is the query efficient enough to run on-demand?

The implementation should follow the existing compact, government-style design system (gap-2/gap-3 spacing, text-xs/text-sm typography, border-gray-200 cards) and be type-safe with proper error handling.
