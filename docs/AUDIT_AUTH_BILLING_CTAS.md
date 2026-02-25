# Full Audit: Auth, Onboarding, Billing, Stripe, Feature Gating & CTAs

**Date:** February 21, 2025  
**Scope:** Authentication, route protection, onboarding, billing schema, pricing page, settings/plans, Stripe integration, permission/feature gating, CTAs for unauthenticated users.

---

## 1. Authentication & Route Protection

### Middleware Protection (src/middleware.ts)

**ROUTE_PROTECTION** (explicit protected routes):
| Route | Auth | Roles |
|-------|------|-------|
| `/account/settings` | Yes | — |
| `/map-test` | Yes | — |
| `/admin` | Yes | admin |
| `/analytics` | Yes | admin |
| `/billing` | Yes | — |

**Note:** `/billing` and `/plans` are redirected to `/maps` in middleware (lines 193–195), so they are effectively unreachable.

**Anonymous-allowed routes** (no auth required):
- `/` (homepage)
- `/maps`
- `/gov`, `/gov/*`
- `/weather`, `/weather/*`
- `/news`, `/news/*`
- `/explore`, `/explore/*`
- `/transportation`, `/transportation/*`
- `/mention/[id]` (mention detail pages)
- `/[username]` (profile pages — single segment, not in excluded list)
- `/contact`, `/privacy`, `/terms`, `/download` (excluded from profile pattern but not explicitly listed — need to verify)
- `/pricing` (not in anonymous list — **requires auth**)
- `/login`, `/signup` (excluded from profile pattern)

**Onboarding redirect:** Authenticated users with `onboarded === false` are redirected to `/onboarding` (except when already on `/onboarding`).

**System visibility:** Routes can be hidden via `system_visibility`; hidden routes redirect to `/` with `?blocked=...`.

### Layout-Level Guards

| Layout | Protection |
|--------|------------|
| `src/app/settings/layout.tsx` | Server-side: redirects to `/login?redirect=/settings` if no user; redirects to `/?modal=welcome` if no account |

### Component-Level Guards

| Component | Location | Behavior |
|-----------|----------|----------|
| `AuthGuard` | `src/components/providers/AuthGuard.tsx` | Client-side: redirects if `requireAuth` and no user; checks `requireRole` |
| `SignInGate` | `src/components/auth/SignInGate.tsx` | Renders sign-in CTA when unauthenticated; used on mention detail and profile pages |
| `MentionDetailGate` | `src/app/mention/[id]/MentionDetailGate.tsx` | Wraps mention detail; shows SignInGate for unauthenticated users |
| `ProfileViewContent` | `src/app/[username]/ProfileViewContent.tsx` | Uses SignInGate for unauthenticated users |

### Routes That May Need Protection

- **`/pricing`** — Not in `isAllowedRouteForAnonymous`; middleware redirects unauthenticated users to `/`. Pricing page is auth-required.
- **`/settings/*`** — Protected by layout (redirect to login).
- **`/billing`** — In ROUTE_PROTECTION but middleware redirects `/billing` → `/maps`. Billing page is effectively unreachable.
- **`/plans`** — Same redirect to `/maps`. Plans page is unreachable.
- **`/ad_center`**, **`/ad_center/credits`** — No explicit protection; middleware would require auth (not in anonymous list).
- **`/people`**, **`/people/search`**, **`/people/users`** — No explicit protection; require auth via middleware.
- **`/feed`**, **`/saved`**, **`/friends`**, **`/collections`**, **`/memories`** — Require auth.
- **`/maps/new`** — Requires auth.
- **`/map/[id]`** — Public map view allowed; create/edit actions require auth.
- **`/stories`**, **`/stories/new`** — Require auth.
- **`/messages`** — Requires auth.
- **`/work`**, **`/realestate`** — Require auth (WorkMapGate, RealEstateMapGate show sign-in for unauthenticated).
- **`/schools`** — Requires auth.
- **`/news/generate`** — Requires auth.
- **`/docs`**, **`/docs/[slug]`** — Not in anonymous list; require auth.

---

## 2. Onboarding Flow

### After First Sign-Up & Email Verification

1. **Sign-in:** WelcomeModal → email → OTP → `verifyOtp()`.
2. **Account creation:** Supabase trigger `handle_new_user()` creates `accounts` row with `user_id`, `role`, `last_visit`; `username` = null, `onboarded` = false, `plan` = default (hobby).
3. **Redirect:** Middleware, AuthStateContext, or SimpleNav redirect to `/onboarding`.
4. **Landing page:** `/onboarding` (OnboardingGuard + OnboardingBanner + OnboardingClient).

### Onboarding Steps (MVP)

| Step | Required | Description |
|------|----------|-------------|
| `welcome` | — | Intro |
| `username` | Yes | 3–30 chars, real-time availability |
| `profile_photo` | No | Optional upload |

### Plan Assignment at Onboarding

**None.** Onboarding does not set or assign a plan. New accounts get `plan` = `'hobby'` (table default). No plan selection step in onboarding.

`PlanSelectorStepper` exists (`src/components/onboarding/PlanSelectorStepper.tsx`) but is **not imported or used** anywhere.

### Completion

- User sets username (and optionally photo).
- Clicks Complete → `UPDATE accounts SET onboarded = true`.
- Redirect to `/`.

---

## 3. Billing & Plan Schema

### Supabase Tables

#### public.accounts (billing-related columns)

| Column | Type | Default |
|--------|------|---------|
| `plan` | text | `'hobby'` |
| `subscription_status` | text | null |
| `stripe_customer_id` | text | null |
| `billing_mode` | text | `'standard'` |
| `onboarded` | boolean | false |

**Plan values (from migrations/constraints):** `hobby`, `contributor`, `plus`, `gov`, `testing`

#### billing.plans

| Column | Type |
|--------|------|
| id | uuid |
| slug | text (unique) |
| name | text |
| price_monthly_cents | integer |
| price_yearly_cents | integer |
| display_order | integer |
| is_active | boolean |
| description | text |
| stripe_price_id_monthly | text |
| stripe_price_id_yearly | text |
| is_admin_only | boolean |
| created_at, updated_at | timestamptz |

#### billing.features

| Column | Type |
|--------|------|
| id, slug, name, description, category | — |
| is_active | boolean |

#### billing.plan_features

| Column | Type |
|--------|------|
| plan_id, feature_id | uuid (FKs) |
| limit_value, limit_type | (from feature_limits migrations) |

#### public.subscriptions

| Column | Type |
|--------|------|
| stripe_customer_id | text (unique) |
| subscription_id | text (unique) |
| status | text |
| price_id | text |
| current_period_start, current_period_end | timestamptz |
| trial_end_date | timestamptz |
| cancel_at_period_end | boolean |
| card_brand, card_last4 | text |

#### public.stripe_events

| Column | Type |
|--------|------|
| stripe_event_id | text (unique) |
| event_type | text |
| account_id | uuid (FK accounts) |
| stripe_customer_id, stripe_subscription_id | text |
| event_data | jsonb |
| processed | boolean |
| processing_error | text |

### Where `plan` Is Set

| Location | When |
|----------|------|
| **Table default** | New accounts: `plan = 'hobby'` |
| **Stripe webhook** | `customer.subscription.*`, `checkout.session.completed`, `invoice.*` → `updateAccountFromSubscription()` sets `plan` from price_id via `get_plan_slug_from_price_id()` |
| **Stripe webhook (deleted sub)** | Sets `plan = 'hobby'` |
| **change-plan API** | `POST /api/billing/change-plan` — optimistic update to `accounts.plan` |
| **Admin API** | `PATCH /api/admin/billing/accounts/[id]/plan` — admin can set plan |

---

## 4. Pricing Page (/pricing)

**File:** `src/app/pricing/page.tsx`

### Content

- **Hardcoded plans:** `PLANS` array with 5 tiers: Public ($0), Member ($6/mo), Operator ($20/mo), Organization ($60/mo), Enterprise ($180/mo).
- **No Stripe:** No checkout, no price IDs, no API calls.
- **No Supabase:** No billing data.
- **"Claim" buttons:** Present but have no `onClick` handlers — no behavior.
- **Mocked:** Entire page is static/mocked. Plan names and prices do not match `billing.plans` (hobby, contributor, etc.).

### Access

- Not in `isAllowedRouteForAnonymous` → **requires auth** (middleware redirects unauthenticated users to `/`).

---

## 5. Settings/Plans Page (/settings/plans)

**File:** `src/app/settings/plans/page.tsx` + `PlansPageClient.tsx`

### Data Sources

- **Server:** Fetches `account.plan` and `account.subscription_status` from Supabase (`accounts`).
- **Client:** Fetches plans from `GET /api/billing/plans` (billing.plans + features).
- **Billing audit trail:** Fetches from `accounts`, `subscriptions`, `stripe_events` (Supabase).

### Plan-Gating Logic

- `currentPlanSlug` and `subscriptionStatus` passed from server.
- `PlansPricingCards` and `PlansComparisonTable` show current plan.
- `PlanPaymentModal` opens on "View plan" — handles checkout/change-plan.
- `hasStripeCustomer={!!account?.stripe_customer_id}` used for UI state.

### Live vs Stubbed

- **Live:** Plan data from Supabase, subscription status, Stripe customer ID, plans from billing schema.
- **Stubbed:** None — fully wired to Supabase and Stripe.

---

## 6. Stripe Integration

### Webhook Handler

**File:** `src/app/api/stripe/webhook/route.ts`

- **URL:** `POST /api/stripe/webhook`
- **Auth:** None (Stripe signature verification).
- **Middleware:** Excluded from middleware processing.

**Events handled:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Fetch subscription, update account |
| `customer.subscription.created` | Update account + subscriptions table |
| `customer.subscription.updated` | Update account + subscriptions table |
| `customer.subscription.deleted` | Set plan=hobby, delete subscription row |
| `customer.subscription.paused` | Update account |
| `customer.subscription.resumed` | Update account |
| `customer.subscription.pending_update_applied` | Update account |
| `customer.subscription.pending_update_expired` | Update account |
| `customer.subscription.trial_will_end` | Update account |
| `invoice.paid` | Fetch subscription, update account |
| `invoice.payment_failed` | Fetch subscription, update account |
| `invoice.payment_action_required` | Fetch subscription, update account |
| `invoice.upcoming` | Fetch subscription, update account |
| `invoice.marked_uncollectible` | Fetch subscription, update account |
| `invoice.payment_succeeded` | Fetch subscription, update account |

**Flow:** Log event to `stripe_events` → extract customer/subscription → `updateAccountFromSubscription()` → upsert `subscriptions`, update `accounts.plan` and `accounts.subscription_status`.

### Checkout & Portal

| API Route | Purpose | Auth |
|-----------|---------|------|
| `POST /api/billing/checkout` | Create Stripe Checkout session | Yes |
| `POST /api/billing/checkout-promo` | Checkout with promo code | Yes |
| `POST /api/billing/checkout-credits` | Credits checkout | Yes |
| `POST /api/billing/create-portal-session` | Stripe Customer Portal | Yes |
| `POST /api/billing/create-subscription` | Create subscription | Yes |
| `POST /api/billing/create-payment` | One-time payment | Yes |
| `POST /api/billing/change-plan` | Upgrade/downgrade | Yes |
| `POST /api/billing/ensure-customer` | Ensure Stripe customer exists | Yes |

### Other Billing APIs

| Route | Purpose |
|-------|---------|
| `GET /api/billing/plans` | List plans (public) |
| `GET /api/billing/usage` | Usage data |
| `GET /api/billing/user-features` | User feature entitlements |
| `GET /api/billing/check-feature` | Check single feature (account_has_feature RPC) |
| `GET /api/billing/payment-history` | Payment history |
| `GET /api/billing/views-usage` | Views usage |
| `GET /api/billing/payment-methods` | Payment methods |
| `GET /api/billing/check-price-id` | Validate price ID |

### Stubbed / Incomplete

- No stubbed endpoints; all appear wired.
- `createServerClientWithAuth` used for auth; `createServiceClient` for webhook (service role).

---

## 7. Permission & Feature Gating

### Server-Side

| Location | Logic |
|----------|-------|
| `src/lib/billing/featureAccess.ts` | `hasFeatureAccess(featureSlug)` — calls `account_has_feature` RPC |
| `src/app/analytics/page.tsx` | `hasFeatureAccess('visitor_identities')` for analytics |
| `src/app/api/billing/check-feature/route.ts` | `account_has_feature` RPC |
| `src/app/api/maps/route.ts` | `accountData?.plan === 'pro' \|\| accountData?.plan === 'plus'` for custom slug |
| `src/app/api/maps/[id]/route.ts` | Same for custom slug |
| `src/lib/subscriptionRestrictionsServer.ts` | `plan === 'contributor' \|\| 'professional' \|\| 'business' \|\| 'plus'` |
| `src/lib/adminHelpers.ts` | `requireAdminApiAccess` |

### Client-Side

| Location | Logic |
|----------|-------|
| `BillingEntitlementsContext` | `hasFeature(slug)` — fetches `/api/billing/user-features` |
| `BillingFeatureGate` | Wraps children; shows fallback if `!hasFeature(featureSlug)` |
| `useBillingEntitlementsSafe` | Hook for `hasFeature`, `getFeature` |
| `MapSettingsSidebar` | `hasFeature('map_publish_to_community')`, `hasFeature('map_members')` |
| `GovTablesClient` | `hasFeature('civic_edits')` |
| `InlineEditField` | `hasFeature('civic_edits')` |

### Plan-Based Checks (Client)

| Location | Check |
|----------|-------|
| `CreateMentionContent` | `account?.plan === 'contributor' \|\| 'plus'` (video) |
| `CreatePostModal` | `account?.plan === 'contributor' \|\| 'plus' \|\| 'gov'` (video) |
| `ProfileMapsContainer` | `plan === 'contributor' \|\| 'plus'` |
| `MapsSettingsClient` | `FULL_ACCESS_PLANS.has(plan)`, `plan === 'contributor'` |
| `CollectionsManagement` | `plan === 'contributor' \|\| 'plus'` → unlimited collections |
| `ProfileCollectionsList` | Same |
| `ProfileSidebarNav` | `plan === 'contributor' \|\| 'plus'` |
| `ProfilePageClient` | `isProPlan(account.plan)` |
| `AccountSettingsForm` | Gold border for contributor/plus |
| `MapCard`, `MapListItem` | `!map.requiresPro \|\| plan === 'contributor' \|\| 'plus'` |
| `WorkMapGate` | `WORK_REQUIRED_PLANS.includes(account.plan)` |
| `RealEstateMapGate` | `REALESTATE_REQUIRED_PLANS.includes(account.plan)` |
| `mapLimitsByPlan` | Map limits by plan |
| `getPaidPlanBorderClasses` | Gold border for contributor/plus |

### RPC Functions (Supabase)

- `billing.account_has_feature(account_id, feature_slug)` — account-scoped
- `billing.get_effective_plan_slug(account_id)` — effective plan (drops to hobby if inactive)
- `billing.get_account_features_with_limits(account_id)` — features + limits

---

## 8. CTAs for Unauthenticated Users

### Opens Welcome Modal (Sign-In)

| Location | CTA | Behavior |
|----------|-----|----------|
| `AccountDropdown` | "Sign In" | `openWelcome()` |
| `SimpleNav` | "Sign In" | `openWelcome()` |
| `LeftSidebar` | "Sign in" | `openWelcome()` |
| `ProfileTopbar` | "Sign In" | `openWelcome()` |
| `LivePinCard` | "Sign in to like, comment..." | `openWelcome()` |
| `LandingPage` | "Get Started" | `handleGetStarted` → `openWelcome()` |
| `LiveMapLeftSidebar` | "Sign in to contribute" | `openWelcome()` |
| `LocationPinPopup` | "Sign in to add pin" | `openWelcome()` |
| `MapInfo` | "Sign in to add to map" | `openWelcome()` |
| `MapEntityPopup` | "Sign in to see who posted" | `openWelcome()` |
| `MentionLocationSheet` | "Sign in" | `openWelcome()` |
| `MentionDetailGate` | "Sign in to view full images", "Sign in to read more" | `openWelcome()` |
| `SignInGate` | "Sign In or Create Account" | `openWelcome()` |
| `FindAnyoneContent` | "Sign in to search" | `openWelcome()` |
| `WorkMapGate` | "Sign in" | `openWelcome()` |
| `RealEstateMapGate` | "Sign in" | `openWelcome()` |
| `MentionTypeInfoCard` | "Sign in to see all events" | `openWelcome()` |
| `NewPageWrapper` | "Sign In" | `openWelcome()` |
| `MentionsLayer` | (click without auth) | Toast "Must be logged in" + `openWelcome` available |
| `HomepageMap` | `onSignInClick` | `openWelcome()` |

### Redirects to Home with Params

| Location | CTA | Behavior |
|----------|-----|----------|
| `PlanPaymentModal` | "Sign In to Activate", "Sign In to Continue" | `window.location.href = '/?redirect=...&message=...'` |
| `PlansPageClient` (plans page) | "View Details" (no account) | `router.push('/?redirect=/billing?plan=...&message=...')` |
| `PaymentScreen` (upgrade) | (no auth) | `window.location.href = '/?signin=true'` |
| `CreditsPaymentScreen` | (no auth) | `window.location.href = '/?signin=true'` |
| `ErrorContent` | "Sign In" (401) | `router.push('/?redirect=...&message=...')` |

### Shows Error / Blocks

| Location | CTA | Behavior |
|----------|-----|----------|
| `CreatePageForm` | Create page (no auth) | `setError('Please sign in to create pages')` |
| `maps/new` | Create map (no auth) | `setError('Please sign in to create maps')` |
| `JoinMapSidebar` | Join map (no auth) | `setError('Please sign in to join this map')` |
| `GovTablesClient` | (inline edit) | Sign-in prompt |
| `FollowedSchoolsList` | (no auth) | "Sign in to see your schools" (text only) |
| `SchoolCommunityPage` | "Request to Join" (no auth) | "Sign in to Join" button |

### Middleware Redirect

- Any protected route: redirect to `/?redirect=<path>&message=Please sign in to access this page`

### Summary

- **Modal:** Most CTAs use `openWelcome()` (WelcomeModal).
- **Redirect:** Billing/plan flows redirect to `/?redirect=...&message=...`.
- **Error state:** Create/join flows show inline error.
- **No breakage observed:** CTAs either open modal, redirect, or show error; no obvious unhandled paths.
