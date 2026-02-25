# New User Sign-In & Verification Flow

This document describes the flow for a new user after they sign in and verify their account for the first time.

---

## 1. Sign-In (WelcomeModal)

**Location:** `src/features/account/components/WelcomeModal.tsx`

1. User opens the app and clicks "Sign In" or "Get Started"
2. **WelcomeModal** opens (via `AppModalContext` → `openWelcome`)
3. User enters email → `handleSendOtp` → `signInWithOtp(email)` (Supabase Auth)
4. Supabase sends a 6-digit OTP to the user's email
5. User enters the 6-digit code → `handleVerifyOtpWithCode` → `verifyOtp(email, code, 'email')`
6. On success:
   - `authState` set to `'success'`
   - Email stored in `localStorage` (`user_email`)
   - Modal closes after 500ms (`handleClose`)

---

## 2. Account Creation

**Two possible paths:**

### A. Supabase trigger (primary)

When `verifyOtp` succeeds, Supabase creates a new row in `auth.users` (for first-time sign-ups).

**Trigger:** `on_auth_user_created` (in `supabase/migrations/265_recreate_accounts_table_complete.sql`)

- Fires: `AFTER INSERT ON auth.users`
- Calls: `handle_new_user()`
- Creates a minimal `accounts` row:
  - `user_id` = new user's ID
  - `role` = `'general'`
  - `last_visit` = NOW()
  - `username` = NULL
  - `onboarded` = false (table default)

### B. Client-side fallback

If the trigger hasn't run yet (e.g. race), `AccountService.ensureAccountExists()` creates the account:

**Location:** `src/features/auth/services/memberService.ts` (lines 248–287)

- Called from `checkOnboardingStatus()` → `AccountService.ensureAccountExists()`
- If no account exists: `INSERT` into `accounts` with `user_id`, `role: 'general'`

---

## 3. Redirect to Onboarding

**Three mechanisms** can send the user to `/onboarding`:

### A. Middleware (server-side)

**Location:** `src/middleware.ts` (lines 393–409)

```
If user is authenticated AND pathname !== '/onboarding':
  → getUserAccountData() fetches account (role, onboarded, username)
  → If onboarded === false → redirect to /onboarding
```

### B. AuthStateContext (client-side)

**Location:** `src/features/auth/contexts/AuthStateContext.tsx` (lines 314–336)

When loading the active account:
- If no `accountId` → `checkOnboardingStatus()` runs
- `checkOnboardingStatus` → `ensureAccountExists()` + `isAccountComplete(account)`
- `isAccountComplete` = `!!account.username` (see `src/lib/accountCompleteness.ts`)
- If `needsOnboarding` → `router.push('/onboarding')`

### C. SimpleNav (client-side)

**Location:** `src/components/layout/SimpleNav.tsx` (lines 37–46)

```
useEffect:
  If user && account && !isAccountComplete(account):
    → router.push('/onboarding')
```

`isAccountComplete(account)` = `!!account.username` (username is the only required field).

---

## 4. Onboarding Page

**Location:** `src/app/onboarding/page.tsx`

- Server component
- Requires auth → redirects to `/` if not authenticated
- If `account.onboarded === true` → redirects to `/`
- Renders `OnboardingGuard` + `OnboardingBanner` + `OnboardingClient`

### OnboardingGuard

**Location:** `src/app/onboarding/OnboardingGuard.tsx`

- Prevents navigation away until `account.onboarded === true`
- `beforeunload` handler warns if user tries to leave
- When onboarded: redirects to `/{username}` or `/`

### OnboardingBanner

**Location:** `src/components/onboarding/OnboardingBanner.tsx`

- Full-screen overlay with stepper
- Wraps `OnboardingClient`
- Shows step-specific heading/subtext

### OnboardingClient

**Location:** `src/features/account/components/OnboardingClient.tsx`

**Steps (MVP – 3 steps):**

| Step            | Required | Description                                      |
|-----------------|----------|--------------------------------------------------|
| `welcome`       | —        | Intro screen                                     |
| `username`      | Yes      | Choose username (3–30 chars, real-time check)    |
| `profile_photo` | No       | Upload profile photo (optional)                   |

**Step logic:** `determineOnboardingStep()` in `src/lib/onboardingService.ts`

- No username → `username`
- No `image_url` → `profile_photo`
- Both set → `profile_photo` (can still add photo)

---

## 5. Completing Onboarding

**Location:** `OnboardingClient.tsx` (lines 967–1031)

When user clicks "Finish" / "Complete":

1. Validates `account.username` is set
2. Updates `accounts` → `onboarded: true`
3. Calls `refreshAccount()` to refresh auth state
4. `router.push(redirectTo || '/')` → typically `/`
5. `OnboardingGuard` sees `onboarded === true` → allows navigation

---

## 6. After Onboarding

- Middleware no longer redirects to `/onboarding` (onboarded = true)
- User can use the app normally
- Profile URL: `/{username}`

---

## Flow Diagram

```
[User] → Enter email → [WelcomeModal]
         ↓
[Supabase] → Send OTP email
         ↓
[User] → Enter 6-digit code → verifyOtp()
         ↓
[Supabase] → auth.users INSERT → handle_new_user() → accounts INSERT (username=null, onboarded=false)
         ↓
[WelcomeModal] → Close (user authenticated)
         ↓
[AuthStateContext] → loadAccount → checkOnboardingStatus → needsOnboarding=true
         OR
[SimpleNav] → user && account && !isAccountComplete → push('/onboarding')
         OR
[Middleware] → onboarded=false → redirect('/onboarding')
         ↓
[/onboarding] → OnboardingGuard + OnboardingBanner + OnboardingClient
         ↓
[User] → welcome → username (required) → profile_photo (optional)
         ↓
[User] → Complete → UPDATE accounts SET onboarded=true
         ↓
[OnboardingClient] → router.push('/')
         ↓
[User] → Home page, full access
```

---

## Key Files

| Purpose              | File(s)                                                                 |
|----------------------|-------------------------------------------------------------------------|
| Sign-in modal         | `src/features/account/components/WelcomeModal.tsx`                      |
| Auth context          | `src/features/auth/contexts/AuthStateContext.tsx`                      |
| Account creation      | `supabase/migrations/265_...` (trigger), `memberService.ts` (fallback)   |
| Account completeness  | `src/lib/accountCompleteness.ts`                                        |
| Onboarding check      | `src/lib/onboardingCheck.ts`                                            |
| Middleware redirect   | `src/middleware.ts`                                                     |
| SimpleNav redirect   | `src/components/layout/SimpleNav.tsx`                                  |
| Onboarding page       | `src/app/onboarding/page.tsx`                                           |
| Onboarding UI         | `OnboardingGuard`, `OnboardingBanner`, `OnboardingClient`             |
| Step logic            | `src/lib/onboardingService.ts`                                         |
