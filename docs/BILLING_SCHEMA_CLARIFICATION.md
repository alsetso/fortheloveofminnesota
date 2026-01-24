# Billing Schema Implementation - Clarification Document

## Understanding Confirmed

### Current State
✅ **Analyzed existing plan structure**: Plans are currently hardcoded as text enums (`hobby`, `contributor`, `plus`, `business`, `gov`) stored in `accounts.plan` column.

✅ **Identified feature gating locations**: Found 28+ files with hardcoded plan checks using patterns like:
- `account.plan === 'contributor' || account.plan === 'plus'`
- `hasProAccess()` function checks
- Direct plan comparisons in components

✅ **Documented current features**: Identified features currently restricted by plan:
- Unlimited maps, visitor analytics, video uploads, extended text, collections, etc.
- Features are currently gated via binary checks (hobby vs. contributor/plus)

✅ **Understood admin infrastructure**: Admin access is controlled via `accounts.role = 'admin'` with existing helpers in `src/lib/adminHelpers.ts` and `src/lib/security/accessControl.ts`.

### Target State
✅ **New plan structure**: 
- `hobby` ($0/month) - Free
- `contributor` ($20/month) - Replaces current contributor
- `professional` ($60/month) - Replaces current `plus`
- `business` ($200/month) - Existing, but needs feature assignment

✅ **Feature-based system**: Instead of checking `plan === 'contributor'`, check `hasFeature('unlimited_maps')`. Features are stored in database and can be assigned to plans via admin UI.

✅ **Inheritance model**: Higher-tier plans automatically inherit all features from lower-tier plans (contributor < professional < business).

✅ **Admin UI requirement**: Create `/admin/billing` route where admins can:
- View/edit plans and their prices
- Create/edit features
- Assign features to plans via drag-and-drop or checkboxes
- See visual representation of which features each plan has

## What the Next AI Agent Should Do

### Phase 1: Database Schema (Priority 1)
1. Create Supabase migration file: `supabase/migrations/XXX_create_billing_schema.sql`
2. Implement:
   - `billing.plans` table with seed data for 4 plans
   - `billing.features` table with seed data for all current features
   - `billing.plan_features` junction table
   - SQL functions for feature checking and inheritance
   - RLS policies (public read, admin write)
3. Update `accounts.plan` constraint to include `'professional'` and handle `'plus'` migration

### Phase 2: API Routes (Priority 2)
1. Create admin API routes in `/app/api/admin/billing/`:
   - Plans CRUD operations
   - Features CRUD operations  
   - Plan-feature assignment operations
2. Create public API routes in `/app/api/billing/`:
   - User features endpoint
   - Feature check endpoint
3. All routes must:
   - Use existing admin authentication helpers
   - Include proper error handling
   - Follow existing API patterns in codebase

### Phase 3: Admin UI (Priority 3)
1. Create `/app/admin/billing/page.tsx` with:
   - Plan management section (list, edit, toggle active)
   - Feature management section (list, create, edit, delete)
   - Plan-feature assignment interface (visual, interactive)
2. Use existing design system components
3. Implement proper loading states, error handling, and success notifications

### Phase 4: Feature Access Utilities (Priority 4)
1. Create `src/lib/billing/featureAccess.ts` with:
   - `hasFeatureAccess(featureSlug)` function
   - `getUserFeatures()` function
   - Helper functions for multiple feature checks
2. Update `src/lib/subscriptionServer.ts`:
   - Add feature-based checking functions
   - Keep existing functions for backward compatibility
   - Document migration path

### Phase 5: Component Migration (Priority 5)
1. Update components to use feature checks instead of plan checks
2. Start with high-priority files:
   - `src/lib/subscriptionServer.ts`
   - `src/features/upgrade/components/PaymentScreen.tsx`
   - `src/features/upgrade/components/UpgradeContent.tsx`
   - `src/features/settings/components/SettingsPageClient.tsx`
3. Gradually migrate remaining 28+ files
4. Maintain backward compatibility during transition

## Key Implementation Details

### Feature Inheritance Logic
- Plans have a `display_order` field (1, 2, 3, 4)
- When checking features for a plan, include features from all plans with lower `display_order`
- Implemented via recursive SQL function: `billing.get_plan_features(plan_slug)`

### Migration Strategy
- Support both old system (plan checks) and new system (feature checks) during transition
- Migrate `plus` plan users to `professional` plan
- Update `accounts.plan` constraint to reflect new plan structure
- Ensure no user loses access during migration

### Admin Security
- All admin routes must use `requireAdmin()` from `src/lib/security/accessControl.ts`
- RLS policies ensure only admins can modify billing data
- Public read access for plans/features (needed for frontend feature checks)

### Stripe Integration
- Store Stripe price IDs in `billing.plans` table
- Update checkout flows to reference these IDs
- Ensure webhook handlers can update plan assignments

## Success Metrics

The implementation is successful when:
1. ✅ Admin can view and edit plans/features in UI
2. ✅ Admin can assign features to plans via UI
3. ✅ Feature inheritance works (higher plans get lower plan features)
4. ✅ Frontend components can check features using `hasFeatureAccess('feature_slug')`
5. ✅ All existing feature restrictions continue to work
6. ✅ New features can be added without code changes
7. ✅ Plan prices/features can be changed without code changes

## Files Reference

**Detailed prompt**: `docs/BILLING_SCHEMA_IMPLEMENTATION_PROMPT.md`
- Contains complete SQL schemas
- Contains API route specifications
- Contains component update patterns
- Contains migration strategy

**This clarification**: `docs/BILLING_SCHEMA_CLARIFICATION.md`
- Confirms understanding
- Provides implementation phases
- Lists success criteria

## Questions for Product Owner

Before implementation, confirm:
1. Should `plus` plan users be migrated to `professional` automatically?
2. What should happen to `gov` plan? Keep it or migrate to `business`?
3. Should feature usage be tracked (analytics on which features are used)?
4. Are there any features not yet identified that should be in the initial seed data?

---

**Status**: ✅ Ready for implementation
**Next Action**: Begin with Phase 1 (Database Schema) in `supabase/migrations/`
