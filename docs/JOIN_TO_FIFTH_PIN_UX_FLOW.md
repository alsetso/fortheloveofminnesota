# Join → 5th pin: UX flow (current)

Focus: **UI/frontend and user experience from join through 5th pin entered.**

---

## 1. Join (signup / sign-in)

| Step | Where | What happens |
|------|--------|--------------|
| Entry | `/signup` or `/login` | Single CTA: "Get Started" or "Sign In" → `openWelcome()` |
| Auth | **WelcomeModal** (global) | Email input → Send Code → 6-digit OTP → Verify. `signInWithOtp` / `verifyOtp`. On success: store email, `router.refresh()`, modal can close. |
| Account | Client (e.g. **AuthStateProvider** / account load) | If user has no `accounts` row, **AccountService.ensureAccountExists()** creates one (`user_id`, `role: 'general'`). New account has `onboarded = false` (or null). |
| Redirect | **Middleware** | If `user` and `account.onboarded === false` → redirect to `/onboarding`. (If no account yet, `onboarded` is null so no redirect until account exists.) |

**Files:** `src/app/signup/page.tsx`, `src/app/login/page.tsx`, `src/features/account/components/WelcomeModal.tsx`, `src/features/auth/services/memberService.ts` (ensureAccountExists), `src/middleware.ts`.

---

## 2. Onboarding (MVP: 3 steps)

| Step | Route | What happens |
|------|--------|--------------|
| Page | `/onboarding` | **OnboardingBanner** (full-screen) → **OnboardingClient**. Server passes `initialAccount` from `getAccountForOnboarding()`. |
| Steps (order) | — | **welcome** → **username** → **profile_photo**. (Location, name, bio, traits, business, contact, review deferred.) |
| Mandatory for “complete” | `onboardingService` | **username** only. Profile photo is optional. |
| Completion | OnboardingClient | On “Next” from profile_photo (or skip photo): calls onboard logic (sets `onboarded: true`), then **redirect to `redirectTo`** = **`/`** (home). |

**Files:** `src/app/onboarding/page.tsx`, `src/components/onboarding/OnboardingBanner.tsx`, `src/features/account/components/OnboardingClient.tsx`, `src/lib/onboardingService.ts`, `src/app/api/accounts/onboard/route.ts`.

---

## 3. After onboarding (where they land)

- Redirect: **`/`** (home) always.
- Home (`/`): **LandingPage** (landing-style). Primary CTA: **/maps** (e.g. “Explore the map” → `router.push('/maps')`). No feed on home for MVP.
- Pin path: User goes to **/maps** to add pins (canonical path for MVP).

---

## 4. Where pins can be created (MVP: use /maps)

| Entry | Route | Notes |
|-------|--------|--------|
| **Maps page (canonical)** | **/maps** | **LiveMap**; map click + pin flow. This is the primary path for “add pin” in MVP. |
| Contribute | `/contribute` | Still available; not the primary CTA. |
| Map by id | `/map/[id]` | Still available; not the primary CTA. |

**Backend note:** Pin creation in these flows currently writes to **maps.pins** (and RPC), not `public.map_pins`. For a “single default map” spine, you’d either point one of these flows at `public.map_pins` or keep one canonical map and count pins there.

**Files:** `src/app/contribute/ContributePageClient.tsx`, `src/app/contribute/ContributePageContent.tsx`, `src/app/map/[id]/page.tsx`, `src/app/map/[id]/components/MapIDBox.tsx` (handleCreatePin), `src/app/map/[id]/components/ContributeOverlay.tsx`, `src/features/homepage/components/LiveMap.tsx`, `src/components/layout/CreateMentionContent.tsx`, `src/app/api/maps/[id]/pins/route.ts`.

---

## 5. Auth gating on “add pin”

- **ContributeOverlay**, **ContributePageContent**, **CreateMentionContent**, **MapEntityPopup**, etc. call **openWelcome()** when the user is not signed in (so they can’t complete “add pin” until they’ve gone through join + onboarding).
- No in-app “pin count” or “5th pin” milestone is implemented yet; you’d add that in the same create-pin success path (e.g. after POST succeeds, check count and show message or redirect).

---

## 6. Summary: join → 5th pin (MVP)

1. **Join:** Signup/Login → WelcomeModal (email + OTP) → verify → refresh → ensureAccountExists creates account → middleware redirects to `/onboarding` when `onboarded === false`.
2. **Onboarding:** welcome → username → profile_photo (3 steps). Username required; photo optional. On finish → redirect to **`/`** (home).
3. **Home:** Landing page with primary CTA to **/maps**.
4. **First–fifth pin:** User goes to **/maps**, uses map click + pin form. No UI yet for “you’ve added 5 pins.”

**Gaps / improvements to consider**

- **Discoverability:** Home has no map and no obvious “add your first pin” CTA; consider a post-onboarding prompt or shortcut to `/contribute` or the default map.
- **Single default map:** If all pins should live on one “default” map, either (a) use one fixed map id (e.g. live map) everywhere and optionally surface “your pins” from that map, or (b) add a flow that writes to `public.map_pins` and treat that as the spine.
- **5th-pin moment:** After a successful pin create, call an API or count client-side (e.g. pins by this account on the default map) and show a one-time message or lightweight celebration at 5 pins.
