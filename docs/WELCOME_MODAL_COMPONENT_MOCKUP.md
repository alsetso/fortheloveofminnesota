# Welcome Modal Component Mockup
## Exact Visual Layout

---

## Component Structure

```tsx
<Modal>
  <Header>
    <CloseButton />
    <Branding>
      <HeartIcon />
      <LogoText />
    </Branding>
  </Header>
  
  <Content>
    <Title />
    <Subtitle />
    
    <EmailSection>
      <EmailInput />
      <EmailError />
    </EmailSection>
    
    {otpSent && (
      <CodeSection>
        <CodeInput />
        <CodeHelper />
        <ResendButton />
      </CodeSection>
    )}
    
    <StatusMessage />
    
    <Actions>
      <PrimaryButton />
      {otpSent && <SecondaryButton />}
    </Actions>
  </Content>
</Modal>
```

---

## State 1: Email Input (Initial)

```
┌──────────────────────────────────────────────┐
│  [X]                                        │
│                                             │
│         ┌─────┐                             │
│         │ ❤️ │                             │
│         └─────┘                             │
│    For the Love of Minnesota                │
│                                             │
│  ────────────────────────────────────────  │
│                                             │
│  Sign In                                    │
│  Two-factor authentication via email         │
│                                             │
│  Email Address                              │
│  ┌────────────────────────────────────────┐ │
│  │ ✉️  your.email@example.com            │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │     Send Verification Code      →       │ │
│  └────────────────────────────────────────┘ │
│                                             │
└──────────────────────────────────────────────┘
```

**Measurements:**
- Modal width: `max-w-sm` (384px)
- Padding: `p-[10px]` (10px)
- Gap between sections: `space-y-3` (12px)
- Input height: `py-[10px]` (40px total)
- Button height: `py-[10px]` (40px total)

---

## State 2: Code Sent (Email + Code)

```
┌──────────────────────────────────────────────┐
│  [X]                                        │
│                                             │
│         ┌─────┐                             │
│         │ ❤️ │                             │
│         └─────┘                             │
│    For the Love of Minnesota                │
│                                             │
│  ────────────────────────────────────────  │
│                                             │
│  Verify Code                                │
│  Enter the 6-digit code sent to             │
│  your.email@example.com                      │
│                                             │
│  Email Address                              │
│  ┌────────────────────────────────────────┐ │
│  │ ✉️  your.email@example.com  [Change]  │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  Verification Code                           │
│  ┌────────────────────────────────────────┐ │
│  │           0 0 0 0 0 0                  │ │
│  └────────────────────────────────────────┘ │
│  ✉️ Code sent to your.email@example.com     │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │     Verify & Sign In            ✓      │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  [Resend Code]                              │
│                                             │
└──────────────────────────────────────────────┘
```

**Key Changes:**
- Title: "Verify Code"
- Email field: Read-only with "Change" link (right-aligned)
- Code input: Centered, monospace, tracking-widest
- Helper text: Shows email confirmation
- Primary button: "Verify & Sign In" with checkmark icon
- Secondary: "Resend Code" (text link, not button)

---

## State 3: Success (Auto-Closing)

```
┌──────────────────────────────────────────────┐
│  [X]                                        │
│                                             │
│         ┌─────┐                             │
│         │ ❤️ │                             │
│         └─────┘                             │
│    For the Love of Minnesota                │
│                                             │
│  ────────────────────────────────────────  │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │ ✓ Verification successful              │ │
│  │   Signing you in...                    │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  Email Address                              │
│  ┌────────────────────────────────────────┐ │
│  │ ✉️  your.email@example.com            │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  Verification Code                           │
│  ┌────────────────────────────────────────┐ │
│  │        1 2 3 4 5 6            ✓       │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │     ✓ Signed In              (disabled)│ │
│  └────────────────────────────────────────┘ │
│                                             │
└──────────────────────────────────────────────┘
```

**Visual Feedback:**
- Success banner: Green background, checkmark icon
- Code field: Green border + checkmark icon (right side)
- Button: Disabled, shows "Signed In" with checkmark
- Auto-closes after 500ms

---

## Error States

### Invalid Email
```
  Email Address
  ┌────────────────────────────────────────┐
  │ ✉️  invalid.email                      │ │
  └────────────────────────────────────────┘
  ⚠️ Please enter a valid email address
```

### Invalid Code
```
  Verification Code
  ┌────────────────────────────────────────┐
  │           1 2 3 4 5 6                  │ │
  └────────────────────────────────────────┘
  ⚠️ Invalid code. Please try again.
  [Resend Code]
```

### Network Error
```
  ┌────────────────────────────────────────┐
  │ ⚠️ Failed to send code.                │
  │    Please check your connection.       │
  └────────────────────────────────────────┘
```

---

## Code Input Design

### Visual Style
- **Font:** Monospace (`font-mono`)
- **Size:** `text-xs` (12px)
- **Tracking:** `tracking-widest` (letter spacing)
- **Alignment:** Center (`text-center`)
- **Padding:** `px-[10px] py-[10px]`
- **Border:** `border-gray-200` → `border-gray-500` (focus) → `border-green-300` (complete)

### Auto-Formatting
```typescript
// Input: "123456"
// Display: "1 2 3 4 5 6" (visual only)
// Store: "123456" (actual value)

const formatCode = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  return digits.split('').join(' '); // Visual spacing
};
```

### States
- **Empty:** Gray border, placeholder "000000"
- **Typing:** Gray border, focus ring
- **Complete (6 digits):** Green border, checkmark icon
- **Error:** Red border, error message below

---

## Email Input Design

### Visual Style
- **Icon:** Envelope icon (left side, `w-3.5 h-3.5`)
- **Padding:** `pl-8 pr-[10px]` (left padding for icon)
- **Validation:** Real-time with visual feedback
  - Invalid: Red border
  - Valid: Green border + checkmark (right side)

### Read-Only State (After Code Sent)
```tsx
<div className="relative">
  <div className="absolute left-[10px] top-1/2 -translate-y-1/2">
    <EnvelopeIcon className="w-3.5 h-3.5 text-gray-400" />
  </div>
  <input
    readOnly
    value={email}
    className="pl-8 pr-20 bg-gray-50 text-gray-600"
  />
  <button
    onClick={handleChangeEmail}
    className="absolute right-[10px] top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:text-gray-900"
  >
    Change
  </button>
</div>
```

---

## Button States

### Primary Button
```tsx
// Default
<button className="w-full py-[10px] px-[10px] bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors">
  Send Verification Code
</button>

// Loading
<button disabled className="... opacity-50 cursor-not-allowed">
  <Spinner className="w-4 h-4" />
  Sending...
</button>

// Success
<button disabled className="...">
  <CheckIcon className="w-3 h-3" />
  Signed In
</button>
```

### Secondary Button (Resend)
```tsx
<button className="w-full text-xs text-gray-600 hover:text-gray-900 transition-colors pt-2">
  Resend Code
</button>
```

---

## Status Messages

### Success Banner
```tsx
<div className="px-[10px] py-[10px] bg-green-50 border border-green-200 rounded-md text-xs text-green-800 flex items-start gap-2">
  <CheckIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
  <div>
    <div className="font-medium">Verification successful</div>
    <div className="text-[10px] mt-0.5">Signing you in...</div>
  </div>
</div>
```

### Error Banner
```tsx
<div className="px-[10px] py-[10px] bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-start gap-2">
  <ExclamationCircleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
  <span>Invalid code. Please try again.</span>
</div>
```

---

## Responsive Behavior

### Mobile (< 640px)
- Modal: Full width minus padding (`w-full p-4`)
- Inputs: Full width
- Buttons: Full width, stacked

### Desktop (≥ 640px)
- Modal: `max-w-sm` (384px)
- Centered on screen
- Backdrop: `bg-black/40`

---

## Animation & Transitions

### Code Input Appearance
```tsx
<motion.div
  initial={{ opacity: 0, height: 0 }}
  animate={{ opacity: 1, height: 'auto' }}
  transition={{ duration: 0.2 }}
>
  <CodeInput />
</motion.div>
```

### Success State
```tsx
<motion.div
  initial={{ scale: 0.95, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ duration: 0.2 }}
>
  <SuccessBanner />
</motion.div>
```

### Modal Close
```tsx
<motion.div
  initial={{ opacity: 1 }}
  animate={{ opacity: 0 }}
  exit={{ opacity: 0, scale: 0.95 }}
  transition={{ duration: 0.2 }}
>
  <Modal />
</motion.div>
```

---

## Accessibility Features

### Focus Management
- Email input auto-focuses on modal open
- Code input auto-focuses when code sent
- Tab order: Email → Code → Submit → Resend

### ARIA Labels
```tsx
<input
  aria-label="Email address"
  aria-describedby="email-error"
  aria-invalid={!!emailError}
/>

<input
  aria-label="Verification code"
  aria-describedby="code-helper code-error"
  aria-invalid={!!codeError}
/>
```

### Live Regions
```tsx
<div role="status" aria-live="polite" aria-atomic="true">
  {message && <StatusMessage />}
</div>
```

---

## Implementation Checklist

- [ ] Remove intro/choose steps
- [ ] Single screen with email + code
- [ ] Progressive disclosure (code appears after email sent)
- [ ] Email becomes read-only after code sent
- [ ] "Change" link to reset email
- [ ] Code input with auto-formatting
- [ ] Visual feedback (green border when complete)
- [ ] Success state with auto-close
- [ ] Error handling with clear messages
- [ ] Resend code functionality
- [ ] Security messaging ("Two-factor authentication")
- [ ] Accessibility (ARIA, focus management)
- [ ] Loading states
- [ ] Rate limiting for resend

