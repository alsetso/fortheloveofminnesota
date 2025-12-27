# OTP Verification Implementation Guide

Simple, specific guide for implementing one-time pin (OTP) verification with a stepper component in a new project using the same Supabase backend.

## Prerequisites

1. **Supabase Setup**: Same backend with OTP enabled
2. **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Dependencies**:
   - `@supabase/ssr`
   - `@supabase/supabase-js`
   - `@heroicons/react` (for icons)

## Step 1: Create Supabase Client

```typescript
// src/lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

## Step 2: Create Auth Context with OTP Functions

```typescript
// src/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string, type: 'email') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithOtp = async (email: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (email: string, token: string, type: 'email') => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type,
      });
      if (error) throw error;
      
      // Get updated user after verification
      const { data: { user: verifiedUser } } = await supabase.auth.getUser();
      if (verifiedUser) {
        setUser(verifiedUser);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithOtp, verifyOtp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

## Step 3: Email Validation Helper

```typescript
// src/utils/validation.ts
export function isValidEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

## Step 4: OTP Verification Component with Stepper

```typescript
// src/components/OtpVerification.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isValidEmail } from '@/utils/validation';
import {
  CheckIcon,
  ExclamationCircleIcon,
  EnvelopeIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

type Step = 'email' | 'code';

export function OtpVerification() {
  const { signInWithOtp, verifyOtp, user } = useAuth();
  
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);
  const [isEmailValid, setIsEmailValid] = useState(false);

  // Handle email input
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError('');
    setMessage('');
    setMessageType(null);
    setIsEmailValid(value.length > 0 && isValidEmail(value));
  };

  const handleEmailBlur = () => {
    if (email && !isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
    }
  };

  // Send OTP
  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setEmailError('Email address is required');
      return;
    }

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setMessage('');
    setEmailError('');

    try {
      await signInWithOtp(email.trim().toLowerCase());
      setStep('code');
      setMessage('Check your email for the 6-digit code!');
      setMessageType('success');
    } catch (error: unknown) {
      console.error('OTP error:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to send code'}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      setMessage('Please enter the complete 6-digit code');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await verifyOtp(email.trim().toLowerCase(), otp, 'email');
      setMessage('Verification successful!');
      setMessageType('success');
      // User is now authenticated - handle redirect or state update
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Invalid code');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // Reset to email step
  const handleReset = () => {
    setStep('email');
    setOtp('');
    setMessage('');
    setMessageType(null);
  };

  return (
    <div className="w-full max-w-sm mx-auto p-[10px]">
      {/* Stepper Progress Indicator */}
      <div className="mb-3 flex items-center justify-center gap-2">
        {/* Step 1: Email */}
        <div className={`flex items-center gap-1 ${step === 'email' ? 'text-gray-900' : 'text-gray-400'}`}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
            step === 'email' 
              ? 'bg-gray-900 text-white' 
              : 'bg-gray-200 text-gray-500'
          }`}>
            {step === 'code' ? <CheckIcon className="w-3 h-3" /> : '1'}
          </div>
          <span className="text-[10px] font-medium">Email</span>
        </div>
        
        {/* Connector Line */}
        <div className="w-6 h-0.5 bg-gray-200" />
        
        {/* Step 2: Code */}
        <div className={`flex items-center gap-1 ${step === 'code' ? 'text-gray-900' : 'text-gray-400'}`}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
            step === 'code' 
              ? 'bg-gray-900 text-white' 
              : 'bg-gray-200 text-gray-500'
          }`}>
            2
          </div>
          <span className="text-[10px] font-medium">Code</span>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-3">
        <h1 className="text-sm font-semibold text-gray-900 mb-1">
          {step === 'email' ? 'Sign In' : 'Verify Code'}
        </h1>
        <p className="text-xs text-gray-600">
          {step === 'email' 
            ? 'Enter your email to receive a code' 
            : 'Enter the 6-digit code'}
        </p>
      </div>

      {/* Step 1: Email Input */}
      {step === 'email' && (
        <form className="space-y-3" onSubmit={handleSendOtp}>
          {/* Message Display */}
          {message && (
            <div className={`px-[10px] py-[10px] rounded-md text-xs border flex items-start gap-2 ${
              messageType === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800'
                : messageType === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-gray-50 border-gray-200 text-gray-700'
            }`}>
              {messageType === 'success' && <CheckIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
              {messageType === 'error' && <ExclamationCircleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
              <span>{message}</span>
            </div>
          )}

          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-gray-900 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute left-[10px] top-1/2 -translate-y-1/2 text-gray-400">
                <EnvelopeIcon className="w-3.5 h-3.5" />
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                className={`w-full pl-8 pr-[10px] py-[10px] border rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors ${
                  emailError 
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                    : isEmailValid
                    ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                    : 'border-gray-200 focus:ring-gray-500 focus:border-gray-500'
                }`}
                placeholder="your.email@example.com"
              />
              {isEmailValid && !emailError && (
                <div className="absolute right-[10px] top-1/2 -translate-y-1/2 text-green-600">
                  <CheckIcon className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            {emailError && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <ExclamationCircleIcon className="w-3 h-3" />
                {emailError}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !isEmailValid}
            className="w-full flex justify-center items-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending...
              </>
            ) : (
              <>
                Send Code
                <ArrowRightIcon className="w-3 h-3" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Step 2: OTP Input */}
      {step === 'code' && (
        <form className="space-y-3" onSubmit={handleVerifyOtp}>
          {/* Message Display */}
          {message && (
            <div className={`px-[10px] py-[10px] rounded-md text-xs border flex items-start gap-2 ${
              messageType === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800'
                : messageType === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-gray-50 border-gray-200 text-gray-700'
            }`}>
              {messageType === 'success' && <CheckIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
              {messageType === 'error' && <ExclamationCircleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
              <span>{message}</span>
            </div>
          )}

          {/* OTP Input */}
          <div>
            <label htmlFor="otp" className="block text-xs font-medium text-gray-900 mb-1.5">
              Verification Code
            </label>
            <input
              id="otp"
              type="text"
              maxLength={6}
              required
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className={`w-full px-[10px] py-[10px] border rounded-md placeholder-gray-400 focus:outline-none focus:ring-1 text-center text-xs tracking-widest font-mono text-gray-900 transition-colors ${
                messageType === 'error'
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : otp.length === 6
                  ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                  : 'border-gray-200 focus:ring-gray-500 focus:border-gray-500'
              }`}
              placeholder="000000"
            />
            <p className="mt-1.5 text-xs text-gray-600 flex items-center gap-1">
              <EnvelopeIcon className="w-3 h-3" />
              Sent to <span className="font-medium text-gray-900">{email}</span>
            </p>
            {otp.length > 0 && otp.length < 6 && (
              <p className="mt-1 text-[10px] text-gray-500">
                {6 - otp.length} digit{6 - otp.length !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>

          {/* Verify Button */}
          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full flex justify-center items-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying...
              </>
            ) : (
              <>
                Verify
                <CheckIcon className="w-3 h-3" />
              </>
            )}
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleReset}
            className="w-full text-xs text-gray-600 hover:text-gray-900 transition-colors pt-2"
          >
            Use different email
          </button>
        </form>
      )}
    </div>
  );
}
```

## Step 5: Wrap App with AuthProvider

```typescript
// src/app/layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

## Step 6: Use Component in Page

```typescript
// src/app/page.tsx
import { OtpVerification } from '@/components/OtpVerification';

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <OtpVerification />
    </div>
  );
}
```

## Key Implementation Details

1. **Email Validation**: Real-time validation with visual feedback (green checkmark when valid)
2. **OTP Input**: Only accepts digits, auto-focuses, shows remaining digits count
3. **Stepper**: Visual progress indicator showing current step (Email → Code)
4. **Error Handling**: Clear error messages for both email and OTP steps
5. **Loading States**: Disabled buttons with spinner during async operations
6. **State Management**: Local component state for form data, auth context for user session
7. **Auto-formatting**: OTP input strips non-digits automatically
8. **Reset Flow**: "Use different email" button resets to email step

## Supabase Configuration

Ensure your Supabase project has:
- OTP enabled in Authentication settings
- Email provider configured (or custom email hook)
- `otp_length = 6` in `supabase/config.toml`
- `otp_expiry = 3600` (1 hour default)

## Testing Checklist

- [ ] Email validation works (invalid formats show error)
- [ ] OTP sends successfully
- [ ] OTP input only accepts digits
- [ ] Verification succeeds with correct code
- [ ] Verification fails with incorrect code
- [ ] Stepper updates correctly between steps
- [ ] "Use different email" resets flow
- [ ] Loading states work correctly
- [ ] User session persists after verification




