'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { XMarkIcon, ArrowRightIcon, CheckIcon, ExclamationCircleIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { cleanAuthParams } from '@/lib/urlParams';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HomepageStats {
  last24Hours: {
    unique_visitors: number;
    total_views: number;
    accounts_viewed: number;
  };
  last7Days: {
    unique_visitors: number;
    total_views: number;
    accounts_viewed: number;
  };
  last30Days: {
    unique_visitors: number;
    total_views: number;
    accounts_viewed: number;
  };
}

type WelcomeStep = 'choose' | 'signin';

function isValidEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const router = useRouter();
  const { user, signInWithOtp, verifyOtp, isLoading: authLoading } = useAuthStateSafe();
  
  // Step state
  const [step, setStep] = useState<WelcomeStep>('choose');
  
  // Sign in state
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info' | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  
  // Stats state
  const [stats, setStats] = useState<HomepageStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Fetch stats when modal opens
  useEffect(() => {
    if (isOpen && !stats) {
      const fetchStats = async () => {
        setStatsLoading(true);
        try {
          const response = await fetch('/api/analytics/homepage-stats');
          if (response.ok) {
            const data = await response.json();
            setStats(data);
          }
        } catch {
          // Silent fail - stats are optional
        } finally {
          setStatsLoading(false);
        }
      };
      fetchStats();
    }
  }, [isOpen, stats]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('choose');
      setEmail('');
      setOtp('');
      setOtpSent(false);
      setMessage('');
      setMessageType(null);
      setEmailError('');
      setIsEmailValid(false);
    }
  }, [isOpen]);

  // Close modal and redirect if user is authenticated
  useEffect(() => {
    if (!authLoading && user && isOpen) {
      onClose();
    }
  }, [authLoading, user, isOpen, onClose]);

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

  const handleSendOtp = async (e: React.FormEvent) => {
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
      setOtpSent(true);
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
      setMessageType('success');
      cleanAuthParams(router);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Invalid code');
      setMessageType('error');
      setLoading(false);
    }
  };


  const handleClose = () => {
    if (!user) {
      router.push('/');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div 
        className="relative w-full max-w-sm rounded-md bg-white border border-gray-200 transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
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

          {/* Step: Choose */}
          {step === 'choose' && (
            <>
              <div className="text-center mb-3">
                <h1 className="text-sm font-semibold text-gray-900 mb-1">Welcome</h1>
                <p className="text-xs text-gray-600">Join the Minnesota community</p>
              </div>

              {/* Community Stats */}
              {statsLoading ? (
                <div className="mb-3 p-2.5 bg-gray-50 rounded-md border border-gray-200">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-1">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        <div className="h-2.5 bg-gray-200 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 h-2.5 bg-gray-200 rounded animate-pulse w-3/4 mx-auto" />
                </div>
              ) : stats && (
                <div className="mb-3 p-2.5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-md border border-gray-200">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {stats.last24Hours.unique_visitors.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-gray-500">Today</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {stats.last7Days.unique_visitors.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-gray-500">This Week</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {stats.last30Days.unique_visitors.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-gray-500">This Month</div>
                    </div>
                  </div>
                  <div className="mt-1.5 text-[10px] text-gray-500 text-center">
                    Minnesotans exploring the map
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => setStep('signin')}
                  className="w-full flex justify-center items-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
                >
                  Sign In with Email
                  <ArrowRightIcon className="w-3 h-3" />
                </button>
              </div>
            </>
          )}

          {/* Step: Sign In */}
          {step === 'signin' && (
            <>
              {/* Progress Indicator */}
              <div className="mb-3 flex items-center justify-center gap-2">
                <div className={`flex items-center gap-1 ${!otpSent ? 'text-gray-900' : 'text-gray-400'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
                    !otpSent ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {!otpSent ? '1' : <CheckIcon className="w-3 h-3" />}
                  </div>
                  <span className="text-[10px] font-medium">Email</span>
                </div>
                <div className="w-6 h-0.5 bg-gray-200" />
                <div className={`flex items-center gap-1 ${otpSent ? 'text-gray-900' : 'text-gray-400'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
                    otpSent ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    2
                  </div>
                  <span className="text-[10px] font-medium">Code</span>
                </div>
              </div>

              <div className="text-center mb-3">
                <h1 className="text-sm font-semibold text-gray-900 mb-1">
                  {!otpSent ? 'Sign In' : 'Verify Code'}
                </h1>
                <p className="text-xs text-gray-600">
                  {!otpSent ? 'Enter your email to receive a code' : 'Enter the 6-digit code'}
                </p>
              </div>

              {!otpSent ? (
                <form className="space-y-3" onSubmit={handleSendOtp}>
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

                  <button
                    type="submit"
                    disabled={loading || !isEmailValid}
                    className="w-full flex justify-center items-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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

                  <button
                    type="button"
                    onClick={() => setStep('choose')}
                    className="w-full text-xs text-gray-600 hover:text-gray-900 transition-colors pt-2"
                  >
                    ← Back
                  </button>
                </form>
              ) : (
                <form className="space-y-3" onSubmit={handleVerifyOtp}>
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

                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp('');
                      setMessage('');
                    }}
                    className="w-full text-xs text-gray-600 hover:text-gray-900 transition-colors pt-2"
                  >
                    Use different email
                  </button>
                </form>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
