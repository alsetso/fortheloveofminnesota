'use client';

import { useState, useRef, FormEvent, KeyboardEvent, ClipboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import {
  EnvelopeIcon,
  CheckIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

interface EmailVerificationFormProps {
  title: string;
  subtitle: string;
  emailPlaceholder?: string;
  buttonText?: string;
  verifyButtonText?: string;
  onSuccess?: () => void;
  sendOtpMethod: (email: string) => Promise<void>;
}

export default function EmailVerificationForm({
  title,
  subtitle,
  emailPlaceholder = 'your.email@example.com',
  buttonText = 'Send Verification Code',
  verifyButtonText = 'Verify & Continue',
  onSuccess,
  sendOtpMethod,
}: EmailVerificationFormProps) {
  const router = useRouter();
  const { verifyOtp } = useAuth();
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [authState, setAuthState] = useState<'email' | 'code-sent' | 'verifying' | 'success' | 'error'>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);
  const [emailError, setEmailError] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError('');
    
    if (value.length > 0) {
      const valid = isValidEmail(value);
      setIsEmailValid(valid);
      if (!valid && value.length > 3) {
        setEmailError('Please enter a valid email address');
      }
    } else {
      setIsEmailValid(false);
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
      await sendOtpMethod(email.trim().toLowerCase());
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
      
      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1000);
      }
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
      await sendOtpMethod(email.trim().toLowerCase());
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

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        {/* Title & Subtitle */}
        <div className="text-center mb-3">
          <h1 className="text-sm font-semibold text-gray-900 mb-1">
            {otpSent ? 'Verify Code' : title}
          </h1>
          <p className="text-xs text-gray-600">
            {otpSent 
              ? `Enter the 6-digit code sent to ${email}`
              : subtitle
            }
          </p>
        </div>

        {/* Success Message */}
        {isSuccess && (
          <div className="mb-3 px-[10px] py-[10px] bg-green-50 border border-green-200 rounded-md text-xs text-green-800 flex items-start gap-2">
            <CheckIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Verification successful</div>
              <div className="text-[10px] mt-0.5">Redirecting...</div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {message && messageType === 'error' && (
          <div className="mb-3 px-[10px] py-[10px] bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-start gap-2">
            <ExclamationCircleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        {/* Email Input */}
        <div className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-gray-900 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute left-[10px] top-1/2 -translate-y-1/2 text-gray-400">
                <EnvelopeIcon className="w-3.5 h-3.5" />
              </div>
              {otpSent ? (
                <>
                  <input
                    id="email"
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
                    placeholder={emailPlaceholder}
                  />
                  {isEmailValid && !emailError && (
                    <div className="absolute right-[10px] top-1/2 -translate-y-1/2 text-green-600">
                      <CheckIcon className="w-3.5 h-3.5" />
                    </div>
                  )}
                </>
              )}
            </div>
            {emailError && !otpSent && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <ExclamationCircleIcon className="w-3 h-3" />
                {emailError}
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

          {/* Primary Action Button */}
          <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
            <button
              type="submit"
              disabled={
                loading || 
                isSuccess ||
                (otpSent ? otp.length !== 6 : !isEmailValid)
              }
              className="w-full flex justify-center items-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading || isVerifying ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {otpSent ? 'Verifying...' : 'Sending...'}
                </>
              ) : isSuccess ? (
                <>
                  <CheckIcon className="w-3 h-3" />
                  Verified
                </>
              ) : otpSent ? (
                <>
                  {verifyButtonText}
                  <CheckIcon className="w-3 h-3" />
                </>
              ) : (
                buttonText
              )}
            </button>
          </form>

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
      </div>
    </div>
  );
}

