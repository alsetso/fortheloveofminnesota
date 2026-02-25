# Supabase Billing Data Audit

**Date:** February 21, 2025  
**Scope:** Current state of billing schema, plans, features, plan slug usage in code, accounts.plan constraint, Stripe price IDs, and related migrations.

---

## 1. billing.plans Table

**Every row currently in billing.plans:**

| slug | name | price_monthly_cents | price_yearly_cents | stripe_price_id_monthly | stripe_price_id_yearly | is_active | is_admin_only |
|------|------|---------------------|-------------------|-------------------------|------------------------|-----------|---------------|
| hobby | Hobby | 0 | 1000 | price_1Sw8CoRxPcmTLDu94Bbv8fef | price_1Sw8DARxPcmTLDu9VjBnwDFe | true | false |
| contributor | Contributor | 2000 | 19200 | price_1SVupIRxPcmTLDu9XyFBIHQu | price_1SstviRxPcmTLDu9aipLogDj | true | false |
| professional | Professional | 6000 | 57600 | price_1SsrbCRxPcmTLDu9riI8FSUG | price_1Sstv6RxPcmTLDu99UV0qE3m | true | false |
| business | Business | 18000 | 172800 | price_1SssOURxPcmTLDu9zsipbK83 | price_1SsttwRxPcmTLDu93cANCdIM | false | false |
| testing | Testing | 100 | null | price_1SvlkBRxPcmTLDu9R79ScAQ9 | null | false | true |

**Total rows:** 5

---

## 2. billing.features Table

**Every row in billing.features:**

| slug | name | category | is_active |
|------|------|----------|-----------|
| all_time_historical_data | All-Time Historical Data | analytics | false |
| export_data | Export Data | analytics | false |
| geographic_data | Geographic Data | analytics | false |
| real_time_updates | Real-Time Updates | analytics | false |
| referrer_tracking | Referrer Tracking | analytics | false |
| time_series_charts | Time-Series Charts | analytics | false |
| visitor_analytics | See Count of Views | analytics | true |
| visitor_identities | See Who Viewed Pins | analytics | true |
| business-pin-markers | Business Pins | business | true |
| businessmanager | Business Manager | business | true |
| extended_text | Extended Text | content | false |
| video_uploads | Video Uploads | content | false |
| civic_edits | Civic Editing | gov | false |
| mentions | Mentions | map | false |
| custom_maps | Custom Maps | maps | false |
| map | Custom Maps | maps | false |
| map_members | Map Members | maps | false |
| map_pin | Pins | maps | true |
| map_posts | Posts | maps | false |
| map_publish_to_community | Publish Map to Community | maps | false |
| advanced_profile_features | Advanced Profile Features | profile | false |
| messaging | Messaging | profile | false |
| posts | posts | profile | false |
| profile_gold | Profile | profile | true |
| traits | Traits | profile | false |
| photos | Upload Photos | social | false |
| post | Posts | social | false |
| collections | Collections | tools | true |

**Total rows:** 27

---

## 3. billing.plan_features — Features by Plan Slug

**hobby:**

- collections
- custom_maps
- map_pin
- map_posts
- mentions
- photos
- post
- profile_gold
- visitor_analytics

**contributor:**

- all_time_historical_data
- civic_edits
- collections
- custom_maps
- extended_text
- map
- map_members
- map_pin
- map_posts
- map_publish_to_community
- mentions
- post
- profile_gold
- traits
- video_uploads
- visitor_analytics
- visitor_identities

**professional:**

- advanced_profile_features
- business-pin-markers
- businessmanager
- civic_edits
- collections
- custom_maps
- geographic_data
- map
- map_members
- map_pin
- map_posts
- map_publish_to_community
- mentions
- messaging
- post
- profile_gold
- real_time_updates
- time_series_charts
- visitor_analytics
- visitor_identities

**business:**

- businessmanager
- civic_edits
- collections
- custom_maps
- export_data
- map
- map_members
- map_pin
- map_posts
- map_publish_to_community
- mentions
- messaging
- post
- profile_gold
- referrer_tracking
- visitor_analytics
- visitor_identities

**testing:**

- all_time_historical_data
- civic_edits
- custom_maps
- extended_text
- map_posts
- map_publish_to_community
- mentions
- post
- traits
- video_uploads

---

## 4. Plan Slug Usage in Code

**Schema constraint:** `accounts.plan` allows: `hobby`, `contributor`, `plus`, `gov`, `testing`

**Slugs referenced in code but not in schema constraint:**

| Slug | In Schema? | Files / Notes |
|------|------------|---------------|
| **pro** | No | `src/app/api/maps/route.ts` (277), `src/app/api/maps/[id]/route.ts` (316). Legacy; replaced by contributor in migration 436. |
| **professional** | No | Used in many files: MapIDBox, JoinMapSidebar, MapInfoCard, MapSettingsSidebar, mapLimitsByPlan, MapsSettingsClient, settings/maps, planHelpers, subscriptionRestrictions, etc. |
| **business** | No | Same as professional; used in map permissions, settings, upgrade flows. |

**Slugs in schema (all valid):**

| Slug | Files |
|------|-------|
| hobby | 40+ files |
| contributor | 50+ files |
| plus | 35+ files |
| gov | 25+ files |
| testing | 6 files |

**Summary:** `pro`, `professional`, and `business` are used in code but are not in the current `accounts.plan` CHECK constraint. Migration 524 removed `professional` and `business` from the constraint; `pro` was replaced by `contributor` in migration 436. Code that checks `plan === 'pro'` or `plan === 'professional'` or `plan === 'business'` will never match current accounts.

---

## 5. accounts.plan Column

**Constraint:** `accounts_plan_check`

```sql
CHECK ((plan = ANY (ARRAY['hobby'::text, 'contributor'::text, 'plus'::text, 'gov'::text, 'testing'::text])))
```

**Allowed values:** `hobby`, `contributor`, `plus`, `gov`, `testing`

**Default:** `'hobby'::text`

**Nullable:** Yes (is_nullable = YES)

---

## 6. Stripe Price IDs

**Stripe price IDs in billing.plans:**

| Plan | Monthly Price ID | Yearly Price ID |
|------|------------------|-----------------|
| hobby | price_1Sw8CoRxPcmTLDu94Bbv8fef | price_1Sw8DARxPcmTLDu9VjBnwDFe |
| contributor | price_1SVupIRxPcmTLDu9XyFBIHQu | price_1SstviRxPcmTLDu9aipLogDj |
| professional | price_1SsrbCRxPcmTLDu9riI8FSUG | price_1Sstv6RxPcmTLDu99UV0qE3m |
| business | price_1SssOURxPcmTLDu9zsipbK83 | price_1SsttwRxPcmTLDu93cANCdIM |
| testing | price_1SvlkBRxPcmTLDu9R79ScAQ9 | null |

**Conclusion:** Stripe price IDs are set for all plans. The billing schema is wired to Stripe via the webhook and `get_plan_slug_from_price_id()`.

---

## 7. Billing-Related Migrations (Chronological)

| Migration | Summary |
|------------|---------|
| 047_remove_subscription_columns.sql | (if exists) — remove subscription columns |
| 048_create_subscriptions_table.sql | Create subscriptions table (one-to-one with accounts via stripe_customer_id) |
| 049_add_subscription_fields_to_accounts.sql | Add subscription_status, plan, billing_mode, stripe_subscription_id to accounts; plan CHECK (hobby, pro) |
| 262_add_plus_plan_option.sql | Add 'plus' to accounts.plan CHECK |
| 265_recreate_accounts_table_complete.sql | Recreate accounts; plan CHECK (hobby, pro, plus) |
| 412_create_stripe_events_table.sql | Create stripe_events table for webhook events |
| 435_add_business_and_gov_to_accounts_plan.sql | Add business, gov to accounts.plan CHECK |
| 436_replace_pro_with_contributor_plan.sql | Replace 'pro' with 'contributor' in constraint and migrate data |
| 437_create_billing_schema.sql | Create billing schema, plans, features, plan_features; seed hobby, contributor, professional, business |
| 438_update_accounts_plan_for_billing.sql | Add professional to accounts.plan; migrate plus to professional |
| 439_create_billing_helper_functions.sql | Create billing helper functions |
| 440_refresh_postgrest_billing_views.sql | Refresh PostgREST billing views |
| 442_add_feature_emoji_column.sql | Add emoji column to features |
| 443_fix_ambiguous_plan_id.sql | Fix ambiguous plan_id in plan_features |
| 444_cleanup_plan_feature_assignments.sql | Cleanup plan feature assignments |
| 445_fix_plan_feature_assignments_no_duplicates.sql | Fix plan feature duplicates |
| 446_add_is_active_to_insert_feature.sql | Add is_active to insert feature |
| 447_add_emoji_to_update_feature.sql | Add emoji to update feature |
| 460_add_visitor_identities_to_contributor.sql | Add visitor_identities to contributor plan |
| 461_expose_billing_functions_to_postgrest.sql | Expose billing functions to PostgREST |
| 466_add_subscription_check_to_civic_edits.sql | Add subscription check for civic_edits |
| 475_add_feature_limits.sql | Add feature limits (plan_features with limits) |
| 476_update_plan_features_view.sql | Update plan_features view |
| 477_add_upsert_plan_feature_limits_function.sql | Add upsert plan feature limits function |
| 478_create_public_upsert_plan_feature_limits.sql | Create public upsert plan feature limits |
| 479_add_account_scoped_billing_functions.sql | Add account-scoped billing functions (get_effective_plan_slug, account_has_feature, etc.) |
| 480_seed_custom_maps_feature.sql | Seed custom_maps feature with limits |
| 481_seed_civic_edits_feature.sql | Seed civic_edits feature |
| 482_add_category_to_feature_limits_functions.sql | Add category to feature limits functions |
| 499_add_map_publish_to_community_feature.sql | Add map_publish_to_community feature |
| 502_add_owns_business_to_accounts.sql | (if billing-related) |
| 505_add_pins_feature_with_limits.sql | Add pins feature with limits |
| 515_add_plan_slug_from_price_id_function.sql | Add get_plan_slug_from_price_id for webhook |
| 516_add_testing_plan_admin_only.sql | Add testing plan, set is_admin_only |
| 518_create_subscriptions_table_complete.sql | Recreate subscriptions table (complete schema) |
| 519_add_testing_plan_to_accounts_constraint.sql | Add testing to accounts.plan CHECK |
| 522_remove_stripe_subscription_id_from_accounts.sql | Remove stripe_subscription_id from accounts |
| 523_update_billing_functions_remove_stripe_subscription_id.sql | Update billing functions to use subscriptions table instead of stripe_subscription_id |
| 524_simplify_plans_hobby_free_contributor_only.sql | Deactivate professional, business; remove from accounts.plan CHECK; keep hobby, contributor, plus, gov, testing |
