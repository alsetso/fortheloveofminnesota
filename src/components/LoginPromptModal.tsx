'use client';

import { useRouter } from 'next/navigation';
import { XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginPromptModal({ isOpen, onClose }: LoginPromptModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleLogin = () => {
    router.push('/?modal=welcome');
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
        <div
          className="pointer-events-auto bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="text-center">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-black/10 mb-3">
                  <svg
                    className="w-6 h-6 text-black"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
              </div>

              <h3 className="text-lg font-black text-black mb-2">
                Get Started
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Sign in to create and manage pins on the community map
              </p>

              {/* Login button */}
              <button
                onClick={handleLogin}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-900 transition-colors shadow-lg hover:shadow-xl"
              >
                Sign In to Continue
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}






