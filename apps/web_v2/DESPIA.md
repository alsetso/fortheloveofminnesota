# Despia — documentation index for FTLOMN iOS

**Product site:** [despia.com](https://despia.com)  
**Docs root:** [setup.despia.com](https://setup.despia.com/introduction)  
**Full index (llms):** [setup.despia.com/llms.txt](https://setup.despia.com/llms.txt)

Despia wraps this Next.js app (`apps/ios`) in a native WKWebView shell. No Xcode in-repo. Native APIs = `despia()` via `despia-native` + `src/lib/despia.ts`.

---

## UI chrome (Own screens — required)

Despia does **not** ship a brand header/footer design system. It defines **frame layout**. All Own iOS UI must follow this.

| Rule | Detail |
|------|--------|
| Root | `position: fixed; inset: 0` — use `.despia-app-root` or `<DespiaAppFrame>` — **not** `100vh` / `100dvh` as the root |
| Safe areas | Spacers `.despia-safe-top` / `.despia-safe-bottom` **or** `calc(base + var(--safe-area-*, env(safe-area-inset-*, 0px)))` via `lib/despia/safeArea.ts` |
| Status bar (Editor) | **Fullscreen Mode ON** + **Auto-Inject Safe Area OFF** — then rebuild the native binary. Auto-Inject + our CSS = ~2× bottom/top padding on tab bar & headers |
| Header / footer | `flex-shrink: 0` — title + optional back up top; primary nav / CTAs at bottom |
| Content | `flex: 1` + scroll **or** stage (map / morph) — body itself must not scroll |
| Touch | Min **2.75rem** targets (`.despia-touch-target`) |
| Viewport | `viewport-fit=cover` (already in root `layout.tsx`) |
| Avoid | Hamburger-as-primary-nav, desktop sidebars as phone chrome, multi-column web footers |

### iPad = larger phone (AppHub)

Despia only mentions iPad in the [user agent](https://setup.despia.com/native-features/user-agent.md) (`ipad` substring). No separate iPad layout system — App Store guidance still forbids website sidebars.

In `apps/ios`, **AppHub** is phone chrome that scales:

| Do | Don’t |
|----|--------|
| Bottom pill nav at **all** widths | Flip to desktop left rail at `lg` (1024px) |
| One centered column (`--hub-content-max`, `.hub-content-column`) | Three-column website (rail \| feed \| rail) |
| Landscape left/right safe areas on shell + nav | Ignore `--safe-area-left/right` |
| Optional `isDespiaIPad()` for rare tweaks | Use `lg:` as “desktop browser” in this app |

`leftSlot` / `rightSlot` on `AppHubLayout` are **ignored** here. Web keeps rails in `apps/web`.

### Own surface (V1 — Game-first)

| Piece | Role |
|-------|------|
| `AppTabShell` | Signed-in host; Game is full-bleed |
| `/game` | Primary loop + dock cards (Account, Wallet, Insights Today/Explore, …) |
| `/today`, `/explore`, `/wallet` | DEV_ONLY full pages — prod redirects to `/game` |
| `/explore-map` | Atlas map (parked polish) — not an Own tab |
| Bottom tab bar | Off for V1 (`APP_TABS` empty) |

**Code:**
- Frame: `src/components/despia/DespiaAppFrame.tsx`
- CSS: `.despia-*` in `src/app/globals.css`
- Tokens: `src/lib/despia/safeArea.ts`
- App shell: `src/features/appShell/`
- Routes: `src/lib/routes/routePolicy.ts`

**Docs:**
- [Safe areas](https://setup.despia.com/native-features/safe-areas.md)
- [Frontend structure](https://setup.despia.com/best-practices/frontend/structure.md)
- [Non-mobile design (App Store)](https://setup.despia.com/store-rejections/common-rejection/non-mobile-design.md)

---

## Must-read for production

| Topic | Doc |
|-------|-----|
| Overview | https://setup.despia.com/introduction |
| User agent / detect runtime | https://setup.despia.com/native-features/user-agent.md |
| Safe areas (CSS) | https://setup.despia.com/native-features/safe-areas.md |
| Mobile structure / scroll | https://setup.despia.com/best-practices/frontend/structure.md |
| Non-mobile design | https://setup.despia.com/store-rejections/common-rejection/non-mobile-design.md |
| Storage vault (auth persist) | https://setup.despia.com/native-features/storage-vault.md |
| Sign In with Apple | https://setup.despia.com/native-features/oauth/apple.md |
| OAuth in WebView | https://setup.despia.com/native-features/oauth/introduction.md |
| App privacy / ATT | https://setup.despia.com/native-features/app-privacy.md |
| External links (Stripe out, etc.) | https://setup.despia.com/native-features/external-links.md |
| Deep linking | https://setup.despia.com/native-features/deeplinking.md |
| Haptics | https://setup.despia.com/native-features/haptic-feedback.md |
| GPS | https://setup.despia.com/native-features/gps-location.md |
| Apple Health / HealthKit | https://setup.despia.com/health-data/apple-health.md |
| Share sheet | https://setup.despia.com/native-features/share-dialog.md |
| OneSignal push | https://setup.despia.com/native-features/onesignal/introduction.md |
| iOS deploy (automatic) | https://setup.despia.com/deployment/apple-ios/automatic.md |
| OTA vs binary rebuild | https://setup.despia.com/best-practices/updates/overview.md |

---

## Billing — RevenueCat (required for IAP)

| Topic | Doc |
|-------|-----|
| RevenueCat + Despia intro | https://setup.despia.com/native-features/revenuecat/introduction.md |
| Schemes / paywall / entitlements reference | https://setup.despia.com/native-features/revenuecat/reference.md |
| Paywalls | https://setup.despia.com/native-features/paywalls.md |
| Direct purchase | https://setup.despia.com/native-features/purchases.md |
| Restore purchases | https://setup.despia.com/native-features/restore-purchase.md |
| Payments overview | https://setup.despia.com/payments/introduction.md |
| RC user session (app_user_id) | https://setup.despia.com/best-practices/backend/revenuecat/user-session.md |
| RC webhooks | https://setup.despia.com/best-practices/backend/revenuecat/webhooks.md |
| RC cron backup sync | https://setup.despia.com/best-practices/backend/revenuecat/cron-jobs.md |
| Identity foundation | https://setup.despia.com/best-practices/backend/user-session.md |

**Dashboard setup (human):** [app.revenuecat.com](https://app.revenuecat.com) → App Store app + entitlements + offerings → paste public SDK keys into **Despia Editor → Integrations → RevenueCat** → **rebuild native binary** (not OTA).

**Code in this app:**
- Client bridge: `src/lib/despia/revenueCat.ts`
- Webhook: `src/app/api/revenuecat/webhook/route.ts`
- Checkout gate: `PlanPaymentModal` uses RC paywall when `isDespia()`

---

## App Store rejection helpers

| Topic | Doc |
|-------|-----|
| ATT / tracking | https://setup.despia.com/store-rejections/common-rejection/tracking-transparency.md |
| ATT roadblock | https://setup.despia.com/roadblocks/deployment/apple-ios/att-and-tracking.md |

Also see repo: `docs/DESPIA_IOS_CHECKLIST.md` (prior review notes).

---

## Auth / splash (this app)

| Topic | Link / path |
|-------|-------------|
| Identity + vault | https://setup.despia.com/best-practices/backend/user-session.md |
| Storage vault | https://setup.despia.com/native-features/storage-vault.md |
| Sign In with Apple | https://setup.despia.com/native-features/oauth/apple.md |
| Session vault (Supabase) | `src/lib/despia/sessionVault.ts` |
| Splash + client gate | `src/features/welcome/` |
| Unauthorized route | `/welcome` |

**Flow:** Splash → vault restore → session? → `/feed` : `/welcome` → `/setup` if incomplete.

## Code entry points

| Concern | File |
|---------|------|
| Runtime gate | `src/lib/despia.ts` |
| Safe-area helpers | `src/lib/despia/safeArea.ts` |
| App frame | `src/components/despia/DespiaAppFrame.tsx` |
| Session vault | `src/lib/despia/sessionVault.ts` |
| RevenueCat helpers | `src/lib/despia/revenueCat.ts` |
| HealthKit (steps) | `src/lib/despia/healthKit.ts` + Account → Steps; in-app vs all-day via `healthStepsSession.ts` + `HealthStepsSessionController`; `requestStepSharing()` permission trigger; mock on web ([Apple Health](https://setup.despia.com/health-data/apple-health.md)) |
| Welcome / splash | `src/features/welcome/` |
| Hub shell | `src/components/app-hub/AppHubShell.tsx` |
| Native iOS detect hook | `src/hooks/useNativeIOSApp.ts` |
| Surface fence | `src/lib/ios/surfacePolicy.ts` |
| User GPS | `src/map/location/geolocation.ts` — one-shot `location://simple`; continuous `location://?buffer=&movement=` + `onLocationChange` (speed/accuracy/course) with poll fallback; denied → `settingsapp://` ([GPS](https://setup.despia.com/native-features/gps-location.md), [Settings](https://setup.despia.com/native-features/app-settings.md)) |
| Production plan | `PRODUCTION.md` |
