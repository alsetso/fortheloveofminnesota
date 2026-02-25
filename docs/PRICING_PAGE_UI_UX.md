# Pricing Page — Format and UI/UX (Detail)

This document describes the structure, layout, styling, and interaction patterns of the `/pricing` page so Cursor and developers can maintain consistency.

---

## 1. Page wrapper and chrome

- **Layout component:** `SimplePageLayout` with `hideNav` and `hideFooter` — **no global header or footer**. The page is a standalone pricing view.
- **Container:** `containerMaxWidth="6xl"` (max-w-6xl), centered.
- **Background:** `bg-[#f4f2ef]` (light) / `dark:bg-surface` (dark).
- **Content padding:** `px-4 sm:px-6 lg:px-8 py-8 sm:py-12`.

---

## 2. Pricing header (top of content)

- **Position:** First block inside the layout content, full width, `mb-8`.
- **Layout:** Flex row, `items-center justify-between`.
- **Left:** Logo only.
  - Link to `/` with `aria-label="Home"`.
  - `Image`: `src="/logo.png"`, `alt="For the Love of Minnesota"`, `width={120}` `height={32}`, `className="h-6 w-auto"`, `priority`.
- **Right:** Account area, fixed size `w-10 h-10`, right-aligned.
  - **Logged in:**
    - Avatar: 40×40 circle.
    - If `account.image_url`: `Image` with `object-cover`, `unoptimized` when URL is `data:` or contains `supabase.co`.
    - Else: `UserIcon` (Heroicons outline), `w-5 h-5 text-foreground-muted`.
    - Contributor: outer ring `p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600`. Non-contributor: `border border-border-muted dark:border-white/20`.
    - Inner circle: `bg-surface` so the ring is visible.
  - **Logged out:**
    - Button: same 40×40 circle, `border border-border-muted dark:border-white/20`, `bg-surface`, `aria-label="Sign in"`.
    - On click: `openWelcome()` (sign-in modal).
    - Icon: `UserIcon` `w-5 h-5`, `text-foreground-muted` with `hover:text-foreground hover:bg-surface-accent`.

---

## 3. Main content block (`space-y-10`)

All content below the pricing header lives in a single wrapper with `space-y-10` (vertical rhythm between sections).

---

## 4. Page heading

- **Element:** `<header>` (semantic), `text-center`.
- **Text:** “Simple, transparent pricing”.
- **Typography:** `h1`, `text-2xl sm:text-3xl font-bold text-foreground tracking-tight`.

---

## 5. Billing period toggle

- **Layout:** Centered (`flex justify-center`).
- **Control:** Segmented control (two options in one pill).
  - Container: `inline-flex rounded-lg border border-border-muted dark:border-white/20 bg-surface p-0.5`, `role="group"` `aria-label="Billing period"`.
  - **Monthly** (left): when selected, `bg-foreground text-background`; when not, `text-foreground-muted hover:text-foreground`.
  - **Annual** (right): same logic, inverted.
  - Shared: `px-4 py-2 text-sm font-medium rounded-md transition-colors`.

**Behavior:** Toggle only affects **plan card prices** (monthly vs yearly). The feature comparison table and the rest of the page do not change with billing period.

---

## 6. Plan cards

- **Section:** `<section aria-label="Plans">`, `grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto`.
- **Loading state:** Single spinner, `col-span-2`, `py-12`, `h-8 w-8` circle, `border-2 border-border-muted border-t-foreground` with `animate-spin`.

**Per card:**

- **Container:** `flex flex-col rounded-xl border border-border-muted dark:border-white/20 bg-surface p-6 shadow-sm`.
- **Row 1:** Plan name + optional badge.
  - Plan name: `h2`, `text-lg font-semibold text-foreground`. Use `DISPLAY_NAMES[plan.slug]` (e.g. “Public”, “Contributor”), fallback `plan.name`.
  - Badge: only when **annual** and **contributor** and `price_yearly_cents > 0`: “Save 20%”, `text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400`, `shrink-0`.
  - Layout: `flex items-start justify-between gap-2`.
- **Row 2:** Tagline: `p`, `mt-1 text-sm text-foreground-muted`. From `TAGLINES[plan.slug]` or `plan.description`.
- **Row 3:** Price: `div mt-4`, single `span` with `text-2xl font-bold text-foreground tabular-nums`. Format: `formatMonthly(plan.price_monthly_cents)` or `formatYearly(plan.price_yearly_cents ?? 0)` (e.g. “$0/mo”, “$X/yr”).
- **Row 4 (conditional):** CTA button, only if `getCtaLabel(plan.slug)` is non-null.
  - Full width: `w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors mt-6`.
  - **Current plan:** `bg-surface-accent dark:bg-white/10 text-foreground-muted cursor-default` (no hover action).
  - **Contributor (upgrade):** `bg-foreground text-background hover:opacity-90`.
  - **Hobby (non-current):** `border border-border-muted dark:border-white/20 text-foreground hover:bg-surface-accent`.

**CTA labels (no hardcoding in table):**

- Logged out: hobby → “Get Started Free”, contributor → “Get Started”.
- Logged in, hobby, not contributor: “Current Plan” (no click).
- Logged in, contributor: “Current Plan” (no click) or “Upgrade to Contributor” (opens payment modal).

**Click behavior:**

- Logged out: any CTA → `openWelcome()`.
- Hobby “Current Plan” or Contributor “Current Plan”: no-op.
- Contributor “Upgrade to Contributor”: set state to open `PlanPaymentModal`.

---

## 7. Feature comparison table

- **Section:** `<section aria-label="Feature comparison">`, `max-w-3xl mx-auto`.
- **Section title:** “Compare plans”, `h2`, `text-sm font-semibold text-foreground mb-4`.
- **Table wrapper:** `overflow-x-auto rounded-lg border border-border-muted dark:border-white/20`.
- **Table:** `table w-full text-left text-sm`.

**Header row:**

- Background: `bg-surface-accent/50`, `border-b border-border-muted dark:border-white/20`.
- Column 1: “Feature”, `py-3 px-4 font-medium text-foreground`.
- Plan columns: one per plan, `py-3 px-4 font-medium text-foreground text-center w-28`. Label: `DISPLAY_NAMES[plan.slug] ?? plan.name` (e.g. “Public”, “Contributor”) — **not** raw `plan.name` for hobby.

**Body rows:**

- **Data source:** Merged feature list from both plans (see “Data rules” below). One row per feature. No hardcoded feature names or limits.
- **Feature column:** `FEATURE_DISPLAY_NAMES[feature.slug] ?? feature.name` (e.g. `profile_gold` → “Gold Profile Border”). `py-3 px-4 text-foreground`.
- **Plan columns:** `py-3 px-4 text-center text-foreground-muted`. Cell value from `getCellValue(plan, feature.slug)`:
  - Plan has no such feature → “—” (em dash).
  - `limit_type === 'boolean'` → “✓”.
  - `limit_type === 'count'` → “Up to {limit_value}” or “Unlimited” if no limit.
  - `limit_type === 'storage_mb'` → “Up to {n} MB” or “✓”.
  - `limit_type === 'unlimited'` → “Unlimited”.
  - Else → “✓”.
- **Row borders:** All rows except the last have `border-b border-border-muted dark:border-white/10`.

**Data rules:**

- Rows = merge of all features from all plans; only features with `is_active === true` (API already filters).
- Sort: by `category` then `name` (localeCompare).
- Plan column order matches `plans` array (hobby first, then contributor when filtered client-side).

---

## 8. Modals and overlays

- **PlanPaymentModal:** Rendered when user clicks “Upgrade to Contributor”. Uses `contributorPlan` or `contributorPlanFromList`, `account`, `currentPlanSlug`, `subscriptionStatus`, `allPlans`. Not part of the visible “format” of the page; triggered by CTA only.

---

## 9. Data and constants (client-only)

- **Plans:** Fetched from `GET /api/billing/plans`, then filtered to `slug === 'hobby' || slug === 'contributor'`. No new API or DB for the table.
- **Display overrides (client-only, no API/DB changes):**
  - `DISPLAY_NAMES`: hobby → “Public”, contributor → “Contributor” (used in cards and table headers).
  - `TAGLINES`: hobby → “Browse & discover your city”, contributor → “Build & own your presence”.
  - `FEATURE_DISPLAY_NAMES`: e.g. `profile_gold` → “Gold Profile Border” (table feature column only).
- **Price formatting:** Cents → “$X/mo” or “$X/yr”; $0 → “$0/mo” or “$0/yr”. `tabular-nums` on price for alignment.

---

## 10. Accessibility and semantics

- Billing toggle: `role="group"` and `aria-label="Billing period"`.
- Plan section: `aria-label="Plans"`.
- Feature section: `aria-label="Feature comparison"`.
- Sign-in button in header: `aria-label="Sign in"`.
- Home link: `aria-label="Home"`.
- Account avatar when decorative: `aria-hidden` (no duplicate label with alt on Image when present).

---

## 11. Responsive behavior

- **Padding:** Increases from `px-4` to `px-6` (sm) to `px-8` (lg); vertical `py-8` to `py-12` (sm).
- **Plan cards:** Single column on small screens, two columns at `md` and up.
- **Table:** Horizontal scroll on small screens via `overflow-x-auto` on wrapper; column widths fixed for plan columns (`w-28`).

---

## 12. File and component reference

- **Page (server):** `src/app/pricing/page.tsx` — renders `PricingPageClient`, sets metadata.
- **Client component:** `src/app/pricing/PricingPageClient.tsx` — all UI above lives here.
- **Layout:** `SimplePageLayout` from `@/components/layout/SimplePageLayout` (nav/footer hidden).
- **Modal:** `PlanPaymentModal` from `@/components/billing/PlanPaymentModal`.
- **Types:** `PlanWithFeatures` from `@/lib/billing/types`; plan features include optional `limit_value`, `limit_type` from API.

This is the single source of truth for the pricing page’s format and UI/UX when editing or extending the page.
