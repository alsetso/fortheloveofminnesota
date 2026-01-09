'use client';

import { useState, useRef, useEffect, useMemo, type ChangeEvent, type FormEvent, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EnvelopeIcon, CheckIcon, ExclamationCircleIcon, ShareIcon, MapIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { useAuthStateSafe } from '@/features/auth';
import { useAccountData } from '@/features/account/hooks/useAccountData';
import ProfileCard from '@/features/profiles/components/ProfileCard';
import type { ProfileAccount } from '@/types/profile';
import { cleanAuthParams } from '@/lib/urlParams';
import { getDisplayName } from '@/types/profile';

type AuthState = 'email' | 'code-sent' | 'verifying' | 'success' | 'error';

function isValidEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default function HeroSignInForm() {
  const router = useRouter();
  const { user, signInWithOtp, verifyOtp, isLoading: authLoading } = useAuthStateSafe();
  const { account, userEmail } = useAccountData(!!user, 'profile');
  
  // Auth state
  const [authState, setAuthState] = useState<AuthState>('email');
  
  // Convert Account to ProfileAccount format
  const profileAccount: ProfileAccount | null = useMemo(() => {
    if (!account) return null;
    
    return {
      id: account.id,
      username: account.username,
      first_name: account.first_name,
      last_name: account.last_name,
      email: userEmail,
      phone: account.phone,
      image_url: account.image_url,
      cover_image_url: account.cover_image_url,
      bio: account.bio,
      city_id: account.city_id,
      view_count: account.view_count || 0,
      traits: account.traits,
      user_id: account.user_id,
      created_at: account.created_at,
    };
  }, [account, userEmail]);
  
  // Form state
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  
  // Refs for auto-focus
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect when authenticated
  useEffect(() => {
    if (!authLoading && user && authState === 'success') {
      router.push('/live');
    }
  }, [authLoading, user, authState, router]);

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError('');
    setMessage('');
    setMessageType(null);
    setIsEmailValid(value.length > 0 && isValidEmail(value));
  };

  const handleEmailKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isEmailValid && !loading && !otpSent) {
      e.preventDefault();
      handleSendOtp(e as any);
    }
  };

  const handleEmailBlur = () => {
    if (email && !isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
    }
  };

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
    setAuthState('email');

    try {
      await signInWithOtp(email.trim().toLowerCase());
      setAuthState('code-sent');
      setMessage('');
      setMessageType(null);
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } catch (error: unknown) {
      console.error('OTP error:', error);
      setAuthState('error');
      setMessage(error instanceof Error ? error.message : 'Failed to send code. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeInput = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(0, 1);
    if (!digit) return;

    const newOtp = otp.split('');
    newOtp[index] = digit;
    const updatedOtp = newOtp.join('').slice(0, 6);
    setOtp(updatedOtp);
    setMessage('');
    setMessageType(null);

    if (index < 5 && digit) {
      codeInputRefs.current[index + 1]?.focus();
    }

    if (updatedOtp.length === 6) {
      setTimeout(() => {
        handleVerifyOtpWithCode(updatedOtp);
      }, 100);
    }
  };

  const handleCodeKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
    
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      codeInputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length > 0) {
      setOtp(pastedData);
      setMessage('');
      setMessageType(null);
      
      const focusIndex = Math.min(pastedData.length - 1, 5);
      setTimeout(() => {
        codeInputRefs.current[focusIndex]?.focus();
        if (pastedData.length === 6) {
          setTimeout(() => {
            handleVerifyOtpWithCode(pastedData);
          }, 100);
        }
      }, 0);
    }
  };

  const handleVerifyOtp = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (otp.length !== 6) {
      setMessage('Please enter the complete 6-digit code');
      setMessageType('error');
      return;
    }

    await handleVerifyOtpWithCode(otp);
  };

  const handleVerifyOtpWithCode = async (code: string) => {
    if (code.length !== 6) {
      setMessage('Please enter the complete 6-digit code');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    setAuthState('verifying');

    try {
      await verifyOtp(email.trim().toLowerCase(), code, 'email');
      setAuthState('success');
      setMessage('Verification successful');
      setMessageType('success');
      cleanAuthParams(router);
    } catch (error: unknown) {
      setAuthState('code-sent');
      setMessage(error instanceof Error ? error.message : 'Invalid code. Please try again.');
      setMessageType('error');
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setOtp('');
    setMessage('');
    setMessageType(null);
    
    setLoading(true);
    setEmailError('');
    setAuthState('email');

    try {
      await signInWithOtp(email.trim().toLowerCase());
      setAuthState('code-sent');
      setMessage('');
      setMessageType(null);
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } catch (error: unknown) {
      console.error('OTP error:', error);
      setAuthState('error');
      setMessage(error instanceof Error ? error.message : 'Failed to send code. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setAuthState('email');
    setOtp('');
    setMessage('');
    setMessageType(null);
    setEmailError('');
    setTimeout(() => emailInputRef.current?.focus(), 100);
  };

  const otpSent = authState === 'code-sent' || authState === 'verifying' || authState === 'success';
  const isVerifying = authState === 'verifying';
  const isSuccess = authState === 'success';

  // Show profile card if authenticated
  if (!authLoading && user && profileAccount) {
    const displayName = getDisplayName(profileAccount);
    
    const handleShare = async () => {
      if (!profileAccount.username) return;
      
      const url = `${window.location.origin}/profile/${profileAccount.username}`;
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: `${displayName}'s Profile`,
            text: `Check out ${displayName}'s profile - For the Love of Minnesota`,
            url,
          });
        } catch (err) {
          // User cancelled or error occurred
          console.log('Share cancelled');
        }
      } else {
        // Fallback: copy to clipboard
        try {
          await navigator.clipboard.writeText(url);
          alert('Profile link copied to clipboard!');
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      }
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3">
        {/* Left Column: Profile Card */}
        <div className="bg-white rounded-md border border-gray-200 p-[10px]">
          <p className="text-[10px] text-gray-500 mb-2">Click cover or profile photo to change</p>
          <ProfileCard 
            account={profileAccount} 
            isOwnProfile={true}
            showViewProfile={false}
          />
        </div>
        
        {/* Right Column: Action Buttons */}
        <div className="bg-[#f4f2ef] rounded-md p-[10px]">
          <div className="flex flex-col gap-2">
            {profileAccount.username && (
              <>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <ShareIcon className="w-3.5 h-3.5" />
                  <span>Share Profile</span>
                </button>
                
                <Link
                  href={`/profile/${profileAccount.username}`}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                  <span>View Profile</span>
                </Link>
              </>
            )}
            
            <Link
              href="/live"
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Live Map</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-md border border-gray-200 p-[10px] space-y-3">
      {/* Success Message */}
      {isSuccess && (
        <div className="px-[10px] py-[10px] bg-green-50 border border-green-200 rounded-md text-xs text-green-800 flex items-start gap-2">
          <CheckIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Verification successful</div>
            <div className="text-[10px] mt-0.5">Signing you in...</div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {message && messageType === 'error' && (
        <div className="px-[10px] py-[10px] bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-start gap-2">
          <ExclamationCircleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      {/* Email Input */}
      <div>
        <label htmlFor="hero-email" className="block text-xs font-medium text-gray-900 mb-1.5">
          Enter your email address to access the Minnesota Live Map
        </label>
        <form onSubmit={handleSendOtp}>
          <div className="relative">
            <div className="absolute left-[10px] top-1/2 -translate-y-1/2 text-gray-400">
              <EnvelopeIcon className="w-3.5 h-3.5" />
            </div>
            {otpSent ? (
              <>
                <input
                  id="hero-email"
                  type="email"
                  readOnly
                  value={email}
                  className="w-full pl-8 pr-20 py-[10px] border border-gray-200 rounded-md text-xs text-gray-600 bg-gray-50"
                />
                <button
                  type="button"
                  onClick={handleChangeEmail}
                  className="absolute right-[10px] top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Change
                </button>
              </>
            ) : (
              <>
                <input
                  ref={emailInputRef}
                  id="hero-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  onKeyDown={handleEmailKeyDown}
                  className={`w-full pl-8 pr-10 py-[10px] border rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors ${
                    emailError 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                      : isEmailValid
                      ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                      : 'border-gray-200 focus:ring-gray-500 focus:border-gray-500'
                  }`}
                  placeholder="your.email@example.com"
                />
                {isEmailValid && !emailError && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="absolute right-[10px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Send verification code"
                  >
                    {loading ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <PaperAirplaneIcon className="w-3 h-3" />
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </form>
        {emailError && !otpSent && (
          <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
            <ExclamationCircleIcon className="w-3 h-3" />
            {emailError}
          </p>
        )}
        {!otpSent && (
          <p className="mt-1.5 text-[10px] text-gray-500">
            By continuing you accept our{' '}
            <Link href="/terms" className="text-blue-600 hover:underline">
              terms and conditions
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-blue-600 hover:underline">
              privacy policy
            </Link>
            .
          </p>
        )}
      </div>

      {/* Code Input - 6 Separate Inputs */}
      {otpSent && (
        <div>
          <label className="block text-xs font-medium text-gray-900 mb-1.5">
            Verification Code
          </label>
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <input
                key={index}
                ref={(el) => {
                  codeInputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                required
                value={otp[index] || ''}
                onChange={(e) => handleCodeInput(index, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(index, e)}
                onPaste={handleCodePaste}
                disabled={isVerifying || isSuccess}
                className={`w-[30px] max-w-[30px] h-10 px-0 border rounded-md text-center text-sm font-mono font-semibold text-gray-900 focus:outline-none focus:ring-1 transition-colors ${
                  isSuccess
                    ? 'border-green-300 bg-green-50'
                    : messageType === 'error'
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : otp.length === 6
                    ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                    : 'border-gray-200 focus:ring-gray-500 focus:border-gray-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label={`Code digit ${index + 1}`}
              />
            ))}
            {isSuccess && otp.length === 6 && (
              <div className="flex-shrink-0 text-green-600 ml-1">
                <CheckIcon className="w-4 h-4" />
              </div>
            )}
          </div>
          <p className="mt-1.5 text-xs text-gray-600 flex items-center gap-1">
            <EnvelopeIcon className="w-3 h-3" />
            Code sent to <span className="font-medium text-gray-900">{email}</span>
          </p>
        </div>
      )}

      {/* Primary Action Button - Only show for OTP verification */}
      {otpSent && (
        <form onSubmit={handleVerifyOtp}>
          <button
            type="submit"
            disabled={
              loading || 
              isSuccess ||
              otp.length !== 6
            }
            className="w-full flex justify-center items-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading || isVerifying ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying...
              </>
            ) : isSuccess ? (
              <>
                <CheckIcon className="w-3 h-3" />
                Signed In
              </>
            ) : (
              <>
                Verify & Sign In
                <CheckIcon className="w-3 h-3" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Resend Code Link */}
      {otpSent && !isSuccess && (
        <button
          type="button"
          onClick={handleResendCode}
          disabled={loading}
          className="w-full text-xs text-gray-600 hover:text-gray-900 transition-colors pt-2 disabled:opacity-50"
        >
          Resend Code
        </button>
      )}
    </div>
  );
}

