# Archived Pages

This folder contains pages that are temporarily disabled but kept in the codebase for future use.

## How It Works

- Folders prefixed with `_` are ignored by Next.js App Router as routes
- Pages moved here will not be accessible via URL
- All code, components, and logic remain intact
- Easy to restore by moving back to `src/app/`

## Archiving a Page

1. **Check for references first:**
   ```bash
   tsx scripts/check-page-references.ts /page-route
   ```
   This will find all files that reference the route (navigation, links, sitemaps, etc.)

2. **Move the page folder:**
   ```bash
   mv src/app/[page-name] src/app/_archive/[page-name]
   ```

3. **Update references:**
   - Remove from navigation configs (`src/config/navigation.ts`)
   - Remove from sitemaps (`src/app/sitemap-*.xml/route.ts`)
   - Comment out or remove internal links
   - Update any redirects in middleware

4. **Document the archive:**
   - Add entry to "Currently Archived" section below
   - Note the date and reason for archiving

## Restoring a Page

1. Move the folder back from `src/app/_archive/[page-name]/` to `src/app/[page-name]/`
2. Re-add to navigation if needed
3. Update sitemaps if applicable
4. Test the route

## Currently Archived

### account/ (Archived: 2024-12-XX)
- **Routes**: `/account/settings`, `/account/billing`, `/account/analytics`, `/account/notifications`, `/account/onboarding`, `/account/change-plan`
- **Reason**: Account functionality migrated to modal-based UI on `/feed` page
- **Files**: 
  - `src/app/_archive/account/layout.tsx`
  - `src/app/_archive/account/AccountLayoutWrapper.tsx`
  - `src/app/_archive/account/loading.tsx`
  - `src/app/_archive/account/analytics/AnalyticsClient.tsx`
  - `src/app/_archive/account/billing/BillingClient.tsx`
  - `src/app/_archive/account/change-plan/ChangePlanClient.tsx`
  - `src/app/_archive/account/change-plan/layout.tsx`
  - `src/app/_archive/account/notifications/NotificationsClient.tsx`
  - `src/app/_archive/account/onboarding/OnboardingClient.tsx`
  - `src/app/_archive/account/onboarding/layout.tsx`
  - `src/app/_archive/account/onboarding/OnboardingAccountDetails.tsx`
  - `src/app/_archive/account/onboarding/OnboardingStepper.tsx`
  - `src/app/_archive/account/onboarding/OnboardingStepperForm.tsx`
  - `src/app/_archive/account/onboarding/ProfilePreviewModal.tsx`
  - `src/app/_archive/account/onboarding/utils/validation.ts`
  - `src/app/_archive/account/settings/SettingsClient.tsx`
- **References Updated**:
  - Updated imports in `src/components/feed/AccountModal.tsx` to point to archived location
- **Note**: 
  - Middleware redirects (`src/middleware.ts`) still redirect `/account/*` routes to `/feed?modal=account&tab=...`
  - Client components are imported by `AccountModal` from archived location
  - Navigation links in `src/config/navigation.ts` and `src/components/AccountSidebar.tsx` still reference account routes (they redirect via middleware)
  - Account functionality is now accessed via modal on feed page

### business/ (Archived: 2024-12-12)
- **Routes**: `/business`, `/business/directory`, `/business/[id]`
- **Reason**: Temporarily disabled while evaluating feature direction
- **Files**: 
  - `src/app/_archive/business/page.tsx`
  - `src/app/_archive/business/BusinessPageClient.tsx`
  - `src/app/_archive/business/directory/page.tsx`
  - `src/app/_archive/business/[id]/page.tsx`
  - `src/app/_archive/business/[id]/BusinessDetailClient.tsx`
- **References Updated**:
  - Removed from `src/config/navigation.ts` (publicNavItems)
  - Removed from `src/app/sitemap-pages.xml/route.ts`
  - Removed from `src/components/SimpleNav.tsx` (desktop and mobile)
  - Removed from `src/features/ui/components/Footer.tsx`
  - Removed from `src/components/feed/CompactFooter.tsx`
  - Removed from `src/components/app/AppTop.tsx`
  - Removed from `src/components/app/AppTopClient.tsx`
- **Note**: API routes (`/api/businesses/*`) remain active for backward compatibility

