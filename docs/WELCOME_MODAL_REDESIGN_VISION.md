# Welcome Modal Redesign Vision
## Single-Step Professional OTP Authentication

---

## Design Principles

1. **Single Screen:** Email + Code visible in one view (no multi-step navigation)
2. **Security-First:** OTP as 2FA for every login (not just sign-up)
3. **Professional:** Government-style minimalism, compact, functional
4. **Progressive Disclosure:** Code field appears after email sent, but both remain visible
5. **Clear State:** Visual feedback for each step without hiding previous inputs

---

## Modal Structure

```
┌─────────────────────────────────────────────┐
│  [X]                                        │
│                                             │
│         [Heart Icon]                        │
│    "For the Love of Minnesota"              │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │                                       │ │
│  │      Email Input (always visible)     │ │
│  │                                       │ │
│  │      Code Input (appears after send) │ │
│  │                                       │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

---

## State 1: Initial (Email Only)

```
┌─────────────────────────────────────────────┐
│  [X]                                        │
│                                             │
│         [Heart Icon]                        │
│    "For the Love of Minnesota"              │
│                                             │
│    Sign In                                  │
│    Two-factor authentication via email      │
│                                             │
│  Email Address                              │
│  ┌───────────────────────────────────────┐ │
│  │ ✉️ your.email@example.com            │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  [Send Verification Code]                   │
│                                             │
└─────────────────────────────────────────────┘
```

**Key Elements:**
- Title: "Sign In" (not "Sign In or Sign Up" - OTP handles both)
- Subtitle: "Two-factor authentication via email" (security messaging)
- Email input with icon
- Single CTA: "Send Verification Code"
- No stats, no feature cards, no intro steps

---

## State 2: Code Sent (Email + Code Visible)

```
┌─────────────────────────────────────────────┐
│  [X]                                        │
│                                             │
│         [Heart Icon]                        │
│    "For the Love of Minnesota"              │
│                                             │
│    Verify Code                              │
│    Enter the 6-digit code sent to           │
│    your.email@example.com                    │
│                                             │
│  Email Address                              │
│  ┌───────────────────────────────────────┐ │
│  │ ✉️ your.email@example.com  [Change]   │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Verification Code                          │
│  ┌───────────────────────────────────────┐ │
│  │        0 0 0 0 0 0                    │ │
│  └───────────────────────────────────────┘ │
│  ✉️ Code sent to your.email@example.com    │
│                                             │
│  [Verify & Sign In]                         │
│                                             │
│  [Resend Code]                              │
│                                             │
└─────────────────────────────────────────────┘
```

**Key Elements:**
- Title changes to "Verify Code"
- Email field becomes read-only with "Change" link
- Code input appears below (auto-focus)
- Shows confirmation: "Code sent to [email]"
- Primary CTA: "Verify & Sign In"
- Secondary: "Resend Code" (if needed)

---

## State 3: Loading/Verifying

```
┌─────────────────────────────────────────────┐
│  [X]                                        │
│                                             │
│         [Heart Icon]                        │
│    "For the Love of Minnesota"              │
│                                             │
│    Verifying...                             │
│                                             │
│  Email Address                              │
│  ┌───────────────────────────────────────┐ │
│  │ ✉️ your.email@example.com  [Change]   │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Verification Code                          │
│  ┌───────────────────────────────────────┐ │
│  │        1 2 3 4 5 6                    │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  [⏳ Verifying...] (disabled)              │
│                                             │
└─────────────────────────────────────────────┘
```

**Key Elements:**
- Loading state on button
- Inputs remain visible but disabled
- Clear feedback: "Verifying..."

---

## State 4: Success (Auto-Close)

```
┌─────────────────────────────────────────────┐
│  [X]                                        │
│                                             │
│         [Heart Icon]                        │
│    "For the Love of Minnesota"              │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ ✓ Verification successful             │ │
│  │   Signing you in...                   │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Email Address                              │
│  ┌───────────────────────────────────────┐ │
│  │ ✉️ your.email@example.com            │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  Verification Code                          │
│  ┌───────────────────────────────────────┐ │
│  │        1 2 3 4 5 6  ✓                 │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  [✓ Signed In] (disabled)                  │
│                                             │
└─────────────────────────────────────────────┘
```

**Key Elements:**
- Success message banner
- Checkmark on code field
- Button shows "Signed In" with checkmark
- Auto-closes after 500ms (smooth transition)

---

## Error States

### Invalid Email
```
  Email Address
  ┌───────────────────────────────────────┐
  │ ✉️ invalid.email                      │ │
  └───────────────────────────────────────┘
  ⚠️ Please enter a valid email address
```

### Code Error
```
  Verification Code
  ┌───────────────────────────────────────┐
  │        1 2 3 4 5 6                    │ │
  └───────────────────────────────────────┘
  ⚠️ Invalid code. Please try again.
  [Resend Code]
```

### Network Error
```
  ┌───────────────────────────────────────┐
  │ ⚠️ Failed to send code.               │
  │    Please check your connection.      │
  └───────────────────────────────────────┘
```

---

## Visual Specifications

### Typography
- **Title:** `text-sm font-semibold text-gray-900`
- **Subtitle:** `text-xs text-gray-600`
- **Labels:** `text-xs font-medium text-gray-900`
- **Input Text:** `text-xs text-gray-900`
- **Helper Text:** `text-[10px] text-gray-500`

### Spacing
- **Modal Padding:** `p-[10px]`
- **Section Gap:** `space-y-3` (12px)
- **Input Gap:** `gap-2` (8px)
- **Button Padding:** `py-[10px] px-[10px]`

### Colors
- **Background:** `bg-white`
- **Border:** `border border-gray-200`
- **Input Border:** `border-gray-200` → `border-gray-500` (focus)
- **Success:** `border-green-300` / `text-green-600`
- **Error:** `border-red-300` / `text-red-600`
- **Button:** `bg-gray-900 hover:bg-gray-800 text-white`

### Icons
- **Size:** `w-3.5 h-3.5` (14px)
- **Color:** `text-gray-400` → `text-gray-600` (focus)
- **Success Check:** `w-3.5 h-3.5 text-green-600`

---

## Interaction Flow

```
User Opens Modal
     │
     ├─→ State 1: Email Input
     │   │
     │   ├─→ User enters email
     │   │   → Real-time validation
     │   │   → Green border if valid
     │   │
     │   └─→ User clicks "Send Verification Code"
     │       → Loading state
     │       → API call: signInWithOtp(email)
     │       │
     │       ├─→ Success
     │       │   → State 2: Show code input
     │       │   → Email becomes read-only
     │       │   → Auto-focus code input
     │       │
     │       └─→ Error
     │           → Show error message
     │           → Keep email input active
     │
     └─→ State 2: Code Input Visible
         │
         ├─→ User enters code
         │   → Auto-format (numbers only)
         │   → Visual feedback (green when 6 digits)
         │
         └─→ User clicks "Verify & Sign In"
             → Loading state
             → API call: verifyOtp(email, code)
             │
             ├─→ Success
             │   → State 4: Success message
             │   → Auto-close after 500ms
             │   → User authenticated
             │
             └─→ Error
                 → Show error message
                 → Keep code input active
                 → Show "Resend Code" option
```

---

## Code Input Behavior

### Auto-Formatting
- Only accepts digits (0-9)
- Max length: 6 characters
- Auto-format with spaces: `1 2 3 4 5 6` (visual only, stores as `123456`)
- Auto-submit when 6 digits entered (optional UX enhancement)

### Visual Feedback
- Empty: `border-gray-200`
- Typing: `border-gray-500` (focus)
- Complete (6 digits): `border-green-300` + checkmark icon
- Error: `border-red-300` + error message

---

## Security Messaging

### Initial State
- Subtitle: "Two-factor authentication via email"
- Reinforces security-first approach

### Code Sent State
- Confirmation: "Code sent to [email]"
- Clear indication of where code was sent

### Resend Functionality
- Rate limiting: Max 3 resends per 5 minutes
- Cooldown timer: "Resend available in 2:34"
- Prevents abuse

---

## Accessibility

1. **Focus Management:**
   - Email input auto-focuses on open
   - Code input auto-focuses when code sent
   - Tab order: Email → Code → Submit → Resend

2. **Screen Readers:**
   - ARIA labels on all inputs
   - Live regions for status messages
   - Error announcements

3. **Keyboard Navigation:**
   - Enter submits form
   - Escape closes modal (if allowed)
   - Tab cycles through inputs

---

## Edge Cases

### Email Already in Use (Sign Up)
- OTP flow handles both sign-in and sign-up
- No separate "sign up" flow needed
- `shouldCreateUser: true` in OTP config

### Code Expired
- Show error: "Code expired. Please request a new one."
- Auto-enable "Resend Code" button

### Multiple Devices
- User can request code on multiple devices
- Only latest code is valid
- Previous codes invalidated

### Network Issues
- Retry logic for failed requests
- Clear error messaging
- "Resend Code" as fallback

---

## Comparison: Current vs. Redesigned

### Current (3 Steps)
1. Intro → Feature cards, stats
2. Choose → Stats, "Continue with Email"
3. Sign In → Email → Code (separate views)

**Issues:**
- Too many steps
- Unnecessary intro/choose screens
- Stats distract from security focus
- Not clear it's 2FA

### Redesigned (1 Step)
1. Sign In → Email + Code (single view)

**Benefits:**
- Faster to authenticate
- Clear security messaging
- Professional, minimal design
- No unnecessary navigation
- Progressive disclosure (code appears when needed)

---

## Implementation Notes

### State Management
```typescript
type AuthState = 
  | 'email'      // Email input active
  | 'code-sent'  // Code sent, waiting for input
  | 'verifying'  // Code submitted, verifying
  | 'success'    // Verified, auto-closing
  | 'error';     // Error state
```

### Key Functions
- `handleEmailSubmit()` → Send OTP
- `handleCodeSubmit()` → Verify OTP
- `handleResendCode()` → Resend OTP
- `handleChangeEmail()` → Reset to email state

### Auto-Close Logic
- On successful verification:
  1. Show success state (500ms)
  2. Call `onClose()`
  3. User is authenticated
  4. Onboarding modal opens if account incomplete

---

## Design System Compliance

✅ Follows Feed Design System:
- Compact spacing (`gap-2`, `p-[10px]`)
- Minimal typography (`text-xs`, `text-sm`)
- Flat design (no shadows, gradients)
- Gray color palette
- Subtle hover states
- Government-style minimalism

