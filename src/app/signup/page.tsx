'use client';

import NewPageWrapper from '@/components/layout/NewPageWrapper';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

export default function SignUpPage() {
  const { openWelcome } = useAppModalContextSafe();

  return (
    <NewPageWrapper>
      <div className="flex flex-col items-center justify-center min-h-full py-12 px-[10px]">
        <div className="w-full max-w-sm mx-auto space-y-3">
          <div className="text-center space-y-1.5 mb-6">
            <h1 className="text-sm font-semibold text-gray-900">Sign Up</h1>
            <p className="text-xs text-gray-600">
              Create an account to start exploring Minnesota maps and communities
            </p>
          </div>
          
          <button
            onClick={openWelcome}
            className="w-full flex justify-center items-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
          >
            Get Started
          </button>
          
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            By continuing, you agree to our{' '}
            <a
              href="/terms"
              className="text-gray-700 underline hover:text-gray-900 transition-colors"
            >
              Terms
            </a>
            {' '}and{' '}
            <a
              href="/privacy"
              className="text-gray-700 underline hover:text-gray-900 transition-colors"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </NewPageWrapper>
  );
}

