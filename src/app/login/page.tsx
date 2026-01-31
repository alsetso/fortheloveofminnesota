'use client';

import PageWrapper from '@/components/layout/PageWrapper';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

export default function LoginPage() {
  const { openWelcome } = useAppModalContextSafe();

  return (
    <PageWrapper>
      <div className="flex flex-col items-center justify-center min-h-full py-12 px-[10px]">
        <div className="w-full max-w-sm mx-auto space-y-3">
          <div className="text-center space-y-1.5 mb-6">
            <h1 className="text-sm font-semibold text-gray-900">Sign In</h1>
            <p className="text-xs text-gray-600">
              Sign in with email verification to access your account
            </p>
          </div>
          
          <button
            onClick={openWelcome}
            className="w-full flex justify-center items-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}

