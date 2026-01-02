# Welcome Modal & Sign-In Flow

## Modal Structure

```
┌─────────────────────────────────────┐
│  [X]                                │
│                                     │
│         [Heart Icon]                 │
│    "For the Love of Minnesota"      │
│                                     │
│  ┌───────────────────────────────┐ │
│  │                               │ │
│  │      Modal Content            │ │
│  │      (3 Steps)                │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

## Step Flow

### STEP 1: Intro (`step === 'intro'`)
**First screen user sees**

```
┌─────────────────────────────────────┐
│  [X]                                │
│                                     │
│         [Heart Icon]                 │
│    "For the Love of Minnesota"      │
│                                     │
│    Welcome to Minnesota             │
│  A living map of Minnesota—pin...   │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 📍 Drop Pins on the Map      │ │
│  │    Archive special places...  │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ ❤️ Build Collections         │ │
│  │    Organize your mentions...  │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ 👥 Join the Community         │ │
│  │    Connect with neighbors...  │ │
│  └───────────────────────────────┘ │
│                                     │
│  [Get Started →]                    │
│                                     │
└─────────────────────────────────────┘
```

**User Action:** Click "Get Started" → Goes to Step 2

---

### STEP 2: Choose (`step === 'choose'`)
**Sign in or sign up selection**

```
┌─────────────────────────────────────┐
│  [X]                                │
│                                     │
│         [Heart Icon]                 │
│    "For the Love of Minnesota"      │
│                                     │
│    Sign In or Sign Up               │
│    Enter your email to get started  │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  Today    This Week  This Month│ │
│  │   123       456        789     │ │
│  │ Minnesotans exploring the map  │ │
│  └───────────────────────────────┘ │
│                                     │
│  [Continue with Email →]             │
│                                     │
│  [← Back]                           │
│                                     │
└─────────────────────────────────────┘
```

**User Action:** Click "Continue with Email" → Goes to Step 3

---

### STEP 3: Sign In (`step === 'signin'`)
**Two sub-steps: Email → Code**

#### 3A: Email Input (`!otpSent`)

```
┌─────────────────────────────────────┐
│  [X]                                │
│                                     │
│         [Heart Icon]                 │
│    "For the Love of Minnesota"      │
│                                     │
│  [1] Email  ────────  [2] Code      │
│                                     │
│    Sign In                          │
│    Enter your email to receive code │
│                                     │
│  Email Address                      │
│  ┌───────────────────────────────┐ │
│  │ ✉️ your.email@example.com    │ │
│  └───────────────────────────────┘ │
│                                     │
│  [Send Code →]                      │
│                                     │
│  [← Back]                           │
│                                     │
└─────────────────────────────────────┘
```

**User Action:** Enter email → Click "Send Code" → OTP sent to email

#### 3B: Code Verification (`otpSent === true`)

```
┌─────────────────────────────────────┐
│  [X]                                │
│                                     │
│         [Heart Icon]                 │
│    "For the Love of Minnesota"      │
│                                     │
│  [✓] Email  ────────  [2] Code      │
│                                     │
│    Verify Code                      │
│    Enter the 6-digit code           │
│                                     │
│  Verification Code                  │
│  ┌───────────────────────────────┐ │
│  │        0 0 0 0 0 0            │ │
│  └───────────────────────────────┘ │
│  ✉️ Sent to your.email@example.com │
│                                     │
│  [Verify ✓]                         │
│                                     │
│  [Use different email]              │
│                                     │
└─────────────────────────────────────┘
```

**User Action:** Enter 6-digit code → Click "Verify" → Authenticated

---

## Post-Sign-In Flow

### After Successful Authentication

```
User Signs In
     │
     ├─→ WelcomeModal detects user
     │   (useEffect: user && isOpen)
     │
     ├─→ Modal closes automatically
     │   (onClose())
     │
     └─→ Account Completeness Check
         │
         ├─→ Account Complete?
         │   │
         │   ├─→ YES → User sees homepage
         │   │         (no modals)
         │   │
         │   └─→ NO → OnboardingModal opens
         │             (cannot be closed until complete)
         │
         └─→ OnboardingModal
             │
             ├─→ User fills form
             │   (username, etc.)
             │
             └─→ Account complete
                 → Modal closes
                 → User sees homepage
```

---

## Modal States & Triggers

### When Welcome Modal Opens

1. **Initial page load (no user)**
   - `useHomepageState` detects no user
   - Calls `openWelcomeModal()`
   - Modal shows Step 1 (intro)

2. **User clicks "Sign In" button**
   - `AccountDropdown` → `handleSignIn()`
   - Calls `openWelcome()`
   - Modal shows Step 1 (intro)

3. **User logs out**
   - `useHomepageState` detects user change
   - Calls `openWelcomeModal()`
   - Modal shows Step 1 (intro)

### When Welcome Modal Closes

1. **User authenticates successfully**
   - `useEffect` detects `user && isOpen`
   - Calls `onClose()` automatically

2. **User clicks [X] button**
   - Calls `handleClose()`
   - If no user: redirects to `/`
   - Calls `onClose()`

3. **User clicks backdrop**
   - Calls `handleClose()`
   - Same behavior as [X]

---

## Onboarding Modal Flow

### After Sign-In (If Account Incomplete)

```
┌─────────────────────────────────────┐
│  [X] (disabled if incomplete)      │
│                                     │
│  [Logo] Complete Your Profile       │
│        Please complete your profile │
│                                     │
│  ┌───────────────────────────────┐ │
│  │                               │ │
│  │   Onboarding Form             │ │
│  │   (username, etc.)            │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

**Behavior:**
- Cannot close until account complete
- Backdrop click disabled
- Close button disabled
- After completion: auto-closes after 500ms

---

## Component Files

- **WelcomeModal:** `src/features/account/components/WelcomeModal.tsx`
- **OnboardingModal:** `src/features/account/components/OnboardingModal.tsx`
- **GlobalModals:** `src/components/modals/GlobalModals.tsx`
- **State Management:** `src/features/homepage/hooks/useHomepageState.ts`
- **Modal Context:** `src/contexts/AppModalContext.tsx`

---

## Key Features

1. **3-Step Flow:** Intro → Choose → Sign In (Email → Code)
2. **Stats Display:** Shows community stats on "Choose" step
3. **Email Validation:** Real-time validation with visual feedback
4. **OTP Flow:** Email-based authentication with 6-digit code
5. **Auto-Close:** Closes when user authenticates
6. **Onboarding Gate:** Incomplete accounts see onboarding modal
7. **Compact Design:** Follows feed design system (compact, minimal)

