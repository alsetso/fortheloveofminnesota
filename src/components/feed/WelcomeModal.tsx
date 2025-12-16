'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/features/auth';
import { GuestAccountService } from '@/features/auth/services/guestAccountService';
import { buildGuestUrl, cleanAuthParams } from '@/lib/urlParams';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuestContinue?: () => void;
}

function isValidEmail(email: string): boolean {
  if (!email || !email.includes('@')) {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default function WelcomeModal({ isOpen, onClose, onGuestContinue }: WelcomeModalProps) {
  const router = useRouter();
  const { user, signInWithOtp, verifyOtp, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Close modal and redirect if user is authenticated
  useEffect(() => {
    if (!isLoading && user && isOpen) {
      onClose();
      // Redirect will be handled by FeedMapClient when it detects user is authenticated
    }
  }, [isLoading, user, isOpen, onClose]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setEmailError('');
    setMessage('');
  };

  const handleEmailBlur = () => {
    if (email && !isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setMessage('Please enter your email address');
      setEmailError('Email address is required');
      return;
    }

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      setMessage('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setMessage('');
    setEmailError('');

    try {
      await signInWithOtp(email.trim().toLowerCase());
      setOtpSent(true);
      setMessage('Check your email for the 6-digit code!');
    } catch (error: unknown) {
      console.error('OTP error:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to send code'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setMessage('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await verifyOtp(email.trim().toLowerCase(), otp, 'email');
      setMessage('Login successful! Redirecting...');
      // Clean guest parameters from URL when user logs in
      cleanAuthParams(router);
      // User will be set by auth state change listener, useEffect will handle close
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Invalid code');
      setLoading(false);
    }
  };

  const handleContinueAsGuest = async () => {
    // Ensure guest ID exists
    const guestId = GuestAccountService.getGuestId();
    
    // Use guest_id parameter instead of guest=true
    router.push(buildGuestUrl('/', guestId));
    onClose();
    // Notify parent that guest continued (will open guest details modal)
    onGuestContinue?.();
  };

  const handleClose = () => {
    // If user is not signed in, navigate with guest_id parameter
    if (!user) {
      const guestId = GuestAccountService.getGuestId();
      router.push(buildGuestUrl('/', guestId));
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div 
        className="relative w-full max-w-sm rounded-md bg-white border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Content */}
          <div className="p-[10px]">
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-[10px] right-[10px] p-1 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>

            {/* MNUDA Branding */}
            <div className="flex flex-col items-center justify-center mb-3 space-y-2">
              <div className="relative w-8 h-8">
                <Image
                  src="/heart.png"
                  alt="Heart"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <div className="relative w-full max-w-[200px] h-auto">
                <Image
                  src="/mid_text For the love of mn.png"
                  alt="For the Love of Minnesota"
                  width={200}
                  height={50}
                  className="w-full h-auto object-contain"
                  priority
                />
              </div>
            </div>

            {/* Header */}
            <div className="text-center mb-3">
              <h1 className="text-sm font-semibold text-gray-900 mb-1">
                Welcome
              </h1>
              <p className="text-xs text-gray-600">
                {!otpSent ? 'Sign in with your email' : 'Enter verification code'}
              </p>
            </div>

            {/* Form */}
            {!otpSent ? (
              <form className="space-y-3" onSubmit={handleSendOtp}>
                {message && (
                  <div className={`px-[10px] py-[10px] rounded-md text-xs ${
                    message.includes('Check your email') 
                      ? 'bg-gray-50 border border-gray-200 text-gray-700' 
                      : 'bg-gray-50 border border-gray-200 text-gray-700'
                  }`}>
                    {message}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-gray-900 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={handleEmailBlur}
                    className={`w-full px-[10px] py-[10px] border rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 ${
                      emailError ? 'border-gray-300 focus:border-gray-500 focus:ring-gray-500' : 'border-gray-200'
                    }`}
                    placeholder="your.email@example.com"
                  />
                  {emailError && (
                    <p className="mt-1.5 text-xs text-gray-600">{emailError}</p>
                  )}
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending code...
                      </>
                    ) : (
                      <>
                        Send Verification Code
                        <ArrowRightIcon className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form className="space-y-3" onSubmit={handleVerifyOtp}>
                {message && (
                  <div className={`px-[10px] py-[10px] rounded-md text-xs ${
                    message.includes('successful') 
                      ? 'bg-gray-50 border border-gray-200 text-gray-700' 
                      : 'bg-gray-50 border border-gray-200 text-gray-700'
                  }`}>
                    {message}
                  </div>
                )}

                <div>
                  <label htmlFor="otp" className="block text-xs font-medium text-gray-900 mb-1.5">
                    Verification Code
                  </label>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="appearance-none block w-full px-[10px] py-[10px] border border-gray-200 rounded-md placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500 text-center text-xs tracking-widest font-mono text-gray-900"
                    placeholder="000000"
                  />
                  <p className="mt-1.5 text-xs text-gray-600">
                    Enter the 6-digit code sent to <span className="font-medium text-gray-900">{email}</span>
                  </p>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="w-full flex justify-center items-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify Code
                        <ArrowRightIcon className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>

                <div className="text-center pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp('');
                      setMessage('');
                      setEmailError('');
                      setEmail('');
                    }}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Use a different email
                  </button>
                </div>
              </form>
            )}

            {/* Continue as Guest - Hidden when waiting for verification code */}
            {!otpSent && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <button
                  onClick={handleContinueAsGuest}
                  className="flex items-center justify-center w-full px-[10px] py-[10px] bg-white text-gray-700 rounded-md hover:bg-gray-50 transition-colors border border-gray-300 text-xs font-medium"
                >
                  Continue as Guest
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}

