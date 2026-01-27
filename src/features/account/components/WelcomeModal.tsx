'use client';

import { useState, useEffect, useRef, useCallback, type ChangeEvent, type FormEvent, type KeyboardEvent, type ClipboardEvent } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { XMarkIcon, CheckIcon, ExclamationCircleIcon, EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { useAuthStateSafe } from '@/features/auth';
import { cleanAuthParams } from '@/lib/urlParams';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthState = 'email' | 'code-sent' | 'verifying' | 'success' | 'error';

function isValidEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}


const HAS_VISITED_KEY = 'welcome_modal_has_visited';
const HAS_ATTEMPTED_SIGNIN_KEY = 'welcome_modal_has_attempted_signin';
const STORED_EMAIL_KEY = 'user_email';
// Last known account info for "Welcome Back" feature
const LAST_ACCOUNT_USERNAME_KEY = 'last_account_username';
const LAST_ACCOUNT_IMAGE_KEY = 'last_account_image';

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signInWithOtp, verifyOtp, isLoading: authLoading } = useAuthStateSafe();
  
  // Check if we're on the live page
  const isLivePage = pathname === '/live' || pathname === '/map/live';
  
  // Detect if we're on localhost
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  // Check if user has visited before
  const [hasVisitedBefore, setHasVisitedBefore] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(HAS_VISITED_KEY) === 'true';
  });
  
  // Check if user has attempted sign-in before
  const [hasAttemptedSignin, setHasAttemptedSignin] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(HAS_ATTEMPTED_SIGNIN_KEY) === 'true';
  });
  
  // Allow closing the modal - user can dismiss it and continue as guest
  // We'll still be responsive and show it when needed for authenticated features
  const handleClose = useCallback(() => {
    // Mark as visited when modal is closed
    if (typeof window !== 'undefined' && !hasVisitedBefore) {
      localStorage.setItem(HAS_VISITED_KEY, 'true');
      setHasVisitedBefore(true);
    }
    onClose();
  }, [onClose, hasVisitedBefore]);
  
  // Getting started screen state - always show on open
  const [showGettingStarted, setShowGettingStarted] = useState(true);
  
  // Auth state
  const [authState, setAuthState] = useState<AuthState>('email');
  
  // Form state
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  
  // Last known account info for "Welcome Back" feature
  const [lastAccountUsername, setLastAccountUsername] = useState<string | null>(null);
  const [lastAccountImage, setLastAccountImage] = useState<string | null>(null);
  
  // Refs for auto-focus
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal opens/closes and load stored email
  useEffect(() => {
    if (isOpen) {
      // Always show getting started screen when modal opens
      setShowGettingStarted(true);
      setAuthState('email');
      setOtp('');
      setMessage('');
      setMessageType(null);
      setEmailError('');
      
      // Load stored email and last account info from localStorage
      if (typeof window !== 'undefined') {
        const storedEmail = localStorage.getItem(STORED_EMAIL_KEY);
        if (storedEmail) {
          setEmail(storedEmail);
          setIsEmailValid(isValidEmail(storedEmail));
        } else {
          setEmail('');
          setIsEmailValid(false);
        }
        
        // Load last known account info for "Welcome Back" feature
        const lastUsername = localStorage.getItem(LAST_ACCOUNT_USERNAME_KEY);
        const lastImage = localStorage.getItem(LAST_ACCOUNT_IMAGE_KEY);
        setLastAccountUsername(lastUsername);
        setLastAccountImage(lastImage);
      }
    }
  }, [isOpen]);
  
  // Auto-focus email input when getting started is dismissed
  useEffect(() => {
    if (!showGettingStarted && isOpen) {
      setTimeout(() => emailInputRef.current?.focus(), 100);
    }
  }, [showGettingStarted, isOpen]);

  // Close modal when user is authenticated
  useEffect(() => {
    if (!authLoading && user && isOpen) {
      // Small delay to show success state
      if (authState === 'success') {
        setTimeout(() => {
          handleClose();
        }, 500);
      } else {
        handleClose();
      }
    }
  }, [authLoading, user, isOpen, handleClose, authState]);

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
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

  const handleSendOtp = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!email) {
      setEmailError('Email address is required');
      return;
    }

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    // Mark that user has attempted sign-in
    if (typeof window !== 'undefined' && !hasAttemptedSignin) {
      localStorage.setItem(HAS_ATTEMPTED_SIGNIN_KEY, 'true');
      setHasAttemptedSignin(true);
    }
    
    // Mark as visited
    if (typeof window !== 'undefined' && !hasVisitedBefore) {
      localStorage.setItem(HAS_VISITED_KEY, 'true');
      setHasVisitedBefore(true);
    }

    // Immediate UI feedback: hide Getting Started, show loading, prepare for code input
    setShowGettingStarted(false);
    setLoading(true);
    setMessage('');
    setEmailError('');
    setAuthState('email');

    try {
      await signInWithOtp(email.trim().toLowerCase());
      setAuthState('code-sent');
      setMessage('');
      setMessageType(null);
      // Auto-focus first code input after a brief delay to ensure DOM is ready
      setTimeout(() => {
        codeInputRefs.current[0]?.focus();
      }, 150);
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
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(0, 1);
    if (!digit) return;

    // Update OTP string
    const newOtp = otp.split('');
    newOtp[index] = digit;
    const updatedOtp = newOtp.join('').slice(0, 6);
    setOtp(updatedOtp);
    setMessage('');
    setMessageType(null);

    // Auto-advance to next input
    if (index < 5 && digit) {
      codeInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when 6 digits entered - use updatedOtp directly
    if (updatedOtp.length === 6) {
      setTimeout(() => {
        handleVerifyOtpWithCode(updatedOtp);
      }, 100);
    }
  };

  const handleCodeKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
    
    // Handle arrow keys
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
      // Set the OTP state - this will fill all individual inputs via controlled components
      setOtp(pastedData);
      setMessage('');
      setMessageType(null);
      
      // Focus the last filled input or the last input if all 6 digits pasted
      const focusIndex = Math.min(pastedData.length - 1, 5);
      setTimeout(() => {
        codeInputRefs.current[focusIndex]?.focus();
        // Auto-submit if 6 digits - pass the code directly to avoid state timing issues
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
      const emailToVerify = email.trim().toLowerCase();
      await verifyOtp(emailToVerify, code, 'email');
      
      // Store email in localStorage after successful verification
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORED_EMAIL_KEY, emailToVerify);
      }
      
      setAuthState('success');
      setMessage('Verification successful');
      setMessageType('success');
      cleanAuthParams(router);
      // Auto-close handled by useEffect
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
      // Auto-focus first code input
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

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center pointer-events-none">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 transition-opacity duration-300 pointer-events-auto"
            onClick={handleClose}
          />

          {/* iOS Style Bottom Sheet */}
          <div 
            className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out pointer-events-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pb-6 pt-6 max-h-[85vh] overflow-y-auto">
          {/* Header with Close Button */}
          <div className="flex items-center justify-between mb-4">
            {!showGettingStarted ? (
              <button
                onClick={() => setShowGettingStarted(true)}
                className="p-2 -ml-2 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Back"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
            ) : (
              <div className="text-sm font-bold text-gray-600">
                Sign In
              </div>
            )}
            <div className="flex-1 flex justify-center">
              <div className="relative w-6 h-6">
                <Image
                  src="/heart.png"
                  alt="Heart"
                  width={24}
                  height={24}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 -mr-2 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Content Container - Seamless State Switch */}
          <div className="relative">
            {/* Getting Started Screen */}
            {showGettingStarted && (
              <div className="w-full">
                {/* Branding */}
                <div className="flex flex-col items-center justify-center mb-6">
                  {/* Last Account Image - Show if available */}
                  {lastAccountImage && (
                    <div className="relative w-16 h-16 mb-3 rounded-full overflow-hidden border-2 border-gray-200">
                      <Image
                        src={lastAccountImage}
                        alt={lastAccountUsername || 'Account'}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  
                  <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">
                    {lastAccountUsername ? (
                      <>
                        Welcome Back
                        <br />
                        <span className="text-2xl font-bold text-gray-900">@{lastAccountUsername}</span>
                      </>
                    ) : hasVisitedBefore 
                      ? 'Welcome Back' 
                      : 'Welcome'
                    }
                  </h1>
                </div>

                {/* Show remembered email if available */}
                {email && isValidEmail(email) ? (
                  <div className="space-y-3 mb-4">
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <EnvelopeIcon className="w-5 h-5" />
                      </div>
                      <input
                        type="email"
                        readOnly
                        value={email}
                        className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl text-sm text-gray-600 bg-gray-50"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLastAccountUsername(null);
                        setLastAccountImage(null);
                        setEmail('');
                        setIsEmailValid(false);
                        setShowGettingStarted(false);
                      }}
                      className="w-full text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Choose different email
                    </button>
                    <button
                      onClick={() => handleSendOtp()}
                      disabled={loading}
                      className="w-full flex justify-center items-center gap-2 py-3.5 px-6 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <PaperAirplaneIcon className="w-4 h-4" />
                          Send Code
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowGettingStarted(false)}
                    className="w-full flex justify-center items-center gap-2 py-3.5 px-6 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-[0.98] transition-all shadow-sm"
                  >
                    Continue
                  </button>
                )}
              </div>
            )}

            {/* Sign In Form Screen / Code Input Screen */}
            {!showGettingStarted && (
              <div className="w-full">
                {/* Title & Subtitle */}
                <div className="text-center mb-6">
                  {/* Last Account Image - Show above heading if available (only on email input step) */}
                  {!otpSent && lastAccountImage && (
                    <div className="flex justify-center mb-3">
                      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200">
                        <Image
                          src={lastAccountImage}
                          alt={lastAccountUsername || 'Account'}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    </div>
                  )}
                  
                  <h1 className="text-xl font-bold text-gray-900 mb-2">
                    {otpSent 
                      ? 'Enter Verification Code' 
                      : lastAccountUsername 
                        ? `Welcome Back @${lastAccountUsername}`
                        : hasAttemptedSignin 
                          ? 'Sign In' 
                          : 'We\'ll send you a code!'
                    }
                  </h1>
                  {!otpSent && (
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {hasAttemptedSignin 
                        ? 'Enter your email to receive a verification code'
                        : 'Enter your email to sign in or create an account'
                      }
                    </p>
                  )}
                  {otpSent && (
                    <p className="text-sm text-gray-600">
                      We sent a code to <span className="font-medium text-gray-900">{email}</span>
                    </p>
                  )}
                </div>

                {/* Success Message */}
                {isSuccess && (
                  <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-start gap-2">
                    <CheckIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Verification successful</div>
                      <div className="text-xs mt-0.5">Signing you in...</div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {message && messageType === 'error' && (
                  <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-start gap-2">
                    <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>{message}</span>
                  </div>
                )}

                {/* Email Input */}
                <div className="space-y-3">
                  <form 
                    id="email-form" 
                    onSubmit={(e) => {
                      e.preventDefault();
                      // Prevent auto-submit - only allow button click
                    }}
                  >
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <EnvelopeIcon className="w-5 h-5" />
                      </div>
                      {otpSent ? (
                        <>
                          <input
                            id="email"
                            type="email"
                            readOnly
                            value={email}
                            className="w-full pl-12 pr-24 py-3.5 border border-gray-200 rounded-xl text-sm text-gray-600 bg-gray-50"
                          />
                          <button
                            type="button"
                            onClick={handleChangeEmail}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                          >
                            Change
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="px-1 py-1">
                            <input
                              ref={emailInputRef}
                              id="email"
                              type="email"
                              autoComplete="email"
                              required
                              value={email}
                              onChange={handleEmailChange}
                              onBlur={handleEmailBlur}
                              onKeyDown={(e) => {
                                // Prevent Enter key from auto-submitting
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                }
                              }}
                              className={`w-full pl-12 pr-4 py-3.5 border rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${
                                emailError 
                                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                                  : 'border-gray-200 focus:ring-gray-500 focus:border-gray-500'
                              }`}
                              placeholder="your.email@example.com"
                            />
                          </div>
                        </>
                      )}
                    </div>
                    {!otpSent && isEmailValid && !emailError && (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={loading}
                        className="w-full flex justify-center items-center gap-2 py-3.5 px-6 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm mt-3"
                      >
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <PaperAirplaneIcon className="w-4 h-4" />
                            Send
                          </>
                        )}
                      </button>
                    )}
                  </form>
                  {emailError && !otpSent && (
                    <p className="text-sm text-red-600 flex items-center gap-1.5">
                      <ExclamationCircleIcon className="w-4 h-4" />
                      {emailError}
                    </p>
                  )}
                  {!otpSent && !isEmailValid && (
                    <p className="text-xs text-gray-500 text-center leading-relaxed mt-2">
                      We always use secure two factor email auth login codes
                    </p>
                  )}
                  {!otpSent && (
                    <p className="text-xs text-gray-500 text-center leading-relaxed">
                      By continuing, you agree to our{' '}
                      <Link
                        href="/terms"
                        className="text-gray-700 underline hover:text-gray-900 transition-colors"
                      >
                        Terms
                      </Link>
                      {' '}and{' '}
                      <Link
                        href="/privacy"
                        className="text-gray-700 underline hover:text-gray-900 transition-colors"
                      >
                        Privacy Policy
                      </Link>
                    </p>
                  )}
                </div>

                {/* Code Input - 6 Separate Inputs */}
                {otpSent && (
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Verification Code
                    </label>
                    <div className="flex items-center justify-center gap-2.5">
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
                          className={`w-12 h-14 px-0 border-2 rounded-xl text-center text-lg font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 transition-colors ${
                            isSuccess
                              ? 'border-green-400 bg-green-50'
                              : messageType === 'error'
                              ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                              : otp.length === 6
                              ? 'border-green-400 focus:ring-green-500 focus:border-green-500'
                              : 'border-gray-300 focus:ring-gray-500 focus:border-gray-500'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          aria-label={`Code digit ${index + 1}`}
                        />
                      ))}
                      {isSuccess && otp.length === 6 && (
                        <div className="flex-shrink-0 text-green-600 ml-2">
                          <CheckIcon className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Primary Action Button - Only show for OTP verification */}
                {otpSent && (
                  <div className="space-y-3 mt-6">
                    <form onSubmit={handleVerifyOtp}>
                      <button
                        type="submit"
                        disabled={
                          loading || 
                          isSuccess ||
                          otp.length !== 6
                        }
                        className="w-full flex justify-center items-center gap-2 py-3.5 px-6 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-sm"
                      >
                        {loading || isVerifying ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Verifying...
                          </>
                        ) : isSuccess ? (
                          <>
                            <CheckIcon className="w-5 h-5" />
                            Signed In
                          </>
                        ) : (
                          <>
                            Verify & Sign In
                            <CheckIcon className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </form>

                    {/* Resend Code Link */}
                    {!isSuccess && (
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={loading}
                        className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors py-2 disabled:opacity-50"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
