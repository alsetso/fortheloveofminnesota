# Usage-limit notifications: approach and implementation

## Confidence

**~85–90%** that this approach is right.

- **Why high:** We reuse the same source of truth as enforcement (`get_account_feature_limit` + actual count). The notification runs only after a successful create, so the count is already correct. Dedupe is built into `create_alert` (24h window on `dedupe_key`), so we don’t spam. One small server-side helper keeps logic in one place.
- **Why not 100%:** We use `event_type: 'system'` instead of a dedicated enum value (e.g. `usage_limit_warning`). That’s fine for behavior and avoids a migration; if you want a first-class type for analytics or filtering, add a migration and switch the helper to that type.

---

## Where it’s implemented

| Layer | Location | What it does |
|-------|----------|---------------|
| **Helper** | `src/lib/notifications/usageWarning.ts` | `maybeSendUsageLimitNotification(accountId, featureSlug, currentCountAfterWrite)`: loads plan limit via `getAccountFeatureLimit`, if count-based and usage ≥ 90% of limit (or at limit), creates one in-app notification with `dedupe_key: usage_warning:{featureSlug}:{accountId}`. Never throws. |
| **Maps create** | `src/app/api/maps/route.ts` (POST) | After successful map insert, calls `maybeSendUsageLimitNotification(finalAccountId, MAP_FEATURE_SLUG, (ownedMapsCount ?? 0) + 1)`. |
| **Collections** | Not implemented | Limit is enforced client-side in `CollectionService.createCollection`. To add usage notifications: either move create to `POST /api/accounts/[id]/collections`, enforce limit there, and call the same helper after insert; or add a small server action that only sends the notification when the client reports a new count. |

No other create endpoints (e.g. pins) consume an account-level count limit in the same way; pins are per-map. If you add more count-limited features, add one call to `maybeSendUsageLimitNotification` after the successful create in the same API route that enforces the limit.

---

## Thought process to ensure it works

1. **Don’t break the request**  
   The helper is wrapped in try/catch and never throws. If notification creation fails, we log in development and return; the API still returns 201. The maps route also wraps the call in try/catch so even an unexpected throw from the helper is swallowed—notification is best-effort only; the map is already created.

2. **Same limits as enforcement**  
   We use `getAccountFeatureLimit(accountId, featureSlug)` and the count the caller passes (after the write). So the “at limit” / “near limit” decision matches the same RPC and counts used in `checkMapLimitServer` and the UI.

3. **When we send**  
   Only when: feature has a count limit, not unlimited, and `currentCountAfterWrite >= ceil(limit * 0.9)`. So we warn at 90% and at 100%. No warning below 90%.

4. **Dedupe**  
   `create_alert` already dedupes by `dedupe_key` within 24h. Our key is `usage_warning:{featureSlug}:{accountId}`, so at most one in-app notification per account per feature per 24 hours.

5. **Service role**  
   `createNotification` uses `createServiceClient()`, so the insert is allowed regardless of RLS. The helper is only called from server routes that already have the account id.

6. **Optional later**  
   Add a dedicated `event_type` (e.g. `usage_limit_warning`) in a migration and use it in the helper for clearer analytics and filtering on the notifications page.
