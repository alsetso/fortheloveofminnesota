'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleContinueAsGuest = () => {
    router.push('/');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal with Rainbow Border */}
      <div 
        className="relative w-full max-w-2xl rounded-lg p-[3px]"
        style={{
          background: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)',
          backgroundSize: '200% 100%',
          animation: 'rainbow-border 3s linear infinite',
        }}
      >
        <div className="bg-white rounded-lg">
          {/* Content */}
          <div className="p-12">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-3xl font-normal text-gray-900 mb-2">
                Welcome
              </h1>
              <p className="text-sm text-gray-600">
                Choose how you&apos;d like to continue
              </p>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Sign In */}
              <div className="space-y-4">
                <div className="mb-6">
                  <h2 className="text-lg font-normal text-gray-900 mb-1">Sign In</h2>
                  <p className="text-sm text-gray-600">
                    Access your existing account
                  </p>
                </div>
                <Link
                  href="/?modal=account&tab=settings"
                  onClick={onClose}
                  className="flex items-center justify-center w-full h-12 px-6 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm"
                >
                  Sign In
                  <ArrowRightIcon className="w-4 h-4 ml-2" />
                </Link>
              </div>

              {/* Right Column - Create Account & Guest */}
              <div className="space-y-4">
                <div className="mb-6">
                  <h2 className="text-lg font-normal text-gray-900 mb-1">Get Started</h2>
                  <p className="text-sm text-gray-600">
                    Create a new account or continue without one
                  </p>
                </div>
                <Link
                  href="/register"
                  onClick={onClose}
                  className="flex items-center justify-center w-full h-12 px-6 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm mb-3"
                >
                  Create Account
                  <ArrowRightIcon className="w-4 h-4 ml-2" />
                </Link>
                <button
                  onClick={handleContinueAsGuest}
                  className="flex items-center justify-center w-full h-12 px-6 bg-white text-gray-700 rounded-md hover:bg-gray-50 transition-all duration-200 border border-gray-300 font-medium text-sm"
                >
                  Continue as Guest
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rainbow Border Animation */}
      <style jsx global>{`
        @keyframes rainbow-border {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }
      `}</style>
    </div>
  );
}



