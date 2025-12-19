'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/features/ui/components/Logo';
import { useAuth } from '@/features/auth';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

function isValidEmail(email: string): boolean {
  if (!email || !email.includes('@')) {
    return false;
  }
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const router = useRouter();
  const { user, signInWithOtp, verifyOtp, isLoading } = useAuth();

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

    // Validate email before sending OTP
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
      // Wait for auth state to update - user will be set by auth state change listener
      // The useEffect below will handle redirect when user is available
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Invalid code');
      setLoading(false);
    }
  };

  // Redirect if already authenticated (after OTP verification or on page load)
  useEffect(() => {
    if (!isLoading && user) {
      // Get redirect URL from query params
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTo = urlParams.get('redirect') || '/';
      
      // Check onboarding status with timeout
      const checkOnboardingAndRedirect = async () => {
        try {
          // Set timeout to prevent infinite loading
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 3000)
          );
          
          const { AccountService } = await import('@/features/auth');
          const accountPromise = AccountService.getCurrentAccount();
          
          const account = await Promise.race([accountPromise, timeoutPromise]) as Awaited<ReturnType<typeof AccountService.getCurrentAccount>> | null;
          
          // Only redirect to onboarding if explicitly not onboarded
          // If account doesn't exist or is null, just go to redirect URL
          if (account && account.onboarded === false) {
            router.replace('/?modal=account&tab=onboarding');
          } else {
            // If redirect is an account page, convert to feed with modal
            if (redirectTo.startsWith('/account/')) {
              const accountRouteMap: Record<string, string> = {
                '/account/settings': 'settings',
                '/account/billing': 'billing',
                '/account/analytics': 'analytics',
                '/account/notifications': 'notifications',
                '/account/onboarding': 'onboarding',
                '/account/change-plan': 'billing',
              };
              const tab = accountRouteMap[redirectTo] || 'settings';
              router.replace(`/?modal=account&tab=${tab}`);
            } else {
              router.replace(redirectTo);
            }
          }
        } catch (error) {
          console.warn('Error checking onboarding status, redirecting anyway:', error);
          // On error or timeout, just redirect to the intended destination
          // Don't force onboarding - let the destination page handle it
          router.replace(redirectTo);
        }
      };

      checkOnboardingAndRedirect();
    }
  }, [isLoading, user, router]);

  // Show loading state while checking authentication or verifying OTP
  if (isLoading || loading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f4f2ef]">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Don't render login form if user is authenticated (will redirect)
  if (user) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f4f2ef]">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Redirecting...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f4f2ef]">
      <section className="min-h-screen flex items-center bg-[#f4f2ef] py-3">
        <div className="max-w-7xl mx-auto px-[10px] w-full">
          <div className="max-w-md mx-auto">
            {/* Logo */}
            <div className="flex justify-center mb-3">
          <Link href="/" className="hover:opacity-80 transition-opacity">
                <Logo size="lg" variant="default" />
          </Link>
        </div>

            {/* Hero Section */}
            <div className="text-center mb-3">
              <div className="inline-block mb-3">
                <span className="text-xs font-medium tracking-widest uppercase text-gray-700 bg-gray-200 px-[10px] py-[10px] rounded-md">
                  Sign In
                </span>
              </div>
              <h1 className="text-sm font-semibold tracking-tight text-gray-900 mb-3 leading-tight">
                Welcome Back
              </h1>
              <p className="text-xs text-gray-600">
                Enter your email address to continue to your account
        </p>
      </div>

            {/* Form Card */}
            <div className="bg-white rounded-md p-[10px] border border-gray-200">
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
                    <div>
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
                </div>
                {emailError && (
                      <p className="mt-1.5 text-xs text-gray-600">{emailError}</p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                      className="w-full flex justify-center items-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending code...
                        </>
                  ) : (
                        <>
                          Send Verification Code
                          <ArrowRightIcon className="w-5 h-5" />
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
                    <div>
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
                </div>
                    <p className="mt-1.5 text-xs text-gray-600">
                      Enter the 6-digit code sent to <span className="font-medium text-gray-900">{email}</span>
                </p>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                      className="w-full flex justify-center items-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                        </>
                  ) : (
                        <>
                          Verify Code
                          <ArrowRightIcon className="w-5 h-5" />
                        </>
                  )}
                </button>
              </div>

                  <div className="text-center pt-3 border-t border-gray-200">
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
        </div>

            {/* Footer Link */}
            <div className="text-center mt-3">
              <Link
                href="/"
                className="text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back to home
              </Link>
            </div>
      </div>
    </div>
      </section>
    </div>
  );
}



