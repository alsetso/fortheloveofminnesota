'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { XMarkIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string; // Optional: which feature triggered the modal
  overlay?: 'center' | 'sidebar'; // Display mode
}

export default function BillingModal({
  isOpen,
  onClose,
  feature,
  overlay = 'center',
}: BillingModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Only lock body scroll for center mode
    if (isOpen && overlay === 'center') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, overlay]);

  const handleEmailClick = () => {
    window.location.href = 'mailto:loveofminnesota@gmail.com?subject=Upgrade';
  };

  if (!mounted || !isOpen) return null;

  // Sidebar overlay mode
  if (overlay === 'sidebar') {
    return (
      <div className="fixed left-0 top-0 bottom-0 z-[52] w-[80vw] lg:w-80 bg-white border-r border-gray-200 shadow-xl flex flex-col">
        <div className="p-[10px] flex-shrink-0 border-b border-gray-200">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-[10px] right-[10px] p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>

          {/* Branding */}
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

          {/* Title */}
          <div className="text-center">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">
              Upgrade to Contributor
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-[10px] space-y-3 overflow-y-auto flex flex-col items-center justify-center">
          <div className="text-center space-y-3">
            {feature && (
              <div className="text-xs text-gray-600 bg-gray-50 rounded-md px-3 py-2 border border-gray-100">
                <span className="font-medium text-gray-900">{feature}</span> requires a Contributor subscription
              </div>
            )}
            
            <p className="text-xs text-gray-600">
              Email us to learn more about Pro features and pricing.
            </p>

            <button
              onClick={handleEmailClick}
              className="w-full flex items-center justify-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
            >
              <EnvelopeIcon className="w-3 h-3" />
              Email to Upgrade
            </button>

            <button
              onClick={onClose}
              className="w-full text-xs text-gray-600 hover:text-gray-900 transition-colors pt-2"
            >
              Maybe later
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-[10px] py-3 bg-gray-50 border-t border-gray-200 flex-shrink-0">
          <p className="text-[10px] text-gray-400 text-center">
            loveofminnesota@gmail.com
          </p>
        </div>
      </div>
    );
  }

  // Center modal mode (default)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className="relative w-full max-w-sm rounded-md bg-white border border-gray-200 transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-[10px]">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-[10px] right-[10px] p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>

          {/* Branding */}
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

          {/* Title */}
          <div className="text-center mb-3">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">
              Upgrade to Contributor
            </h2>
          </div>

          {/* Content */}
          <div className="space-y-3">
            {feature && (
              <div className="text-xs text-gray-600 bg-gray-50 rounded-md px-3 py-2 border border-gray-100">
                <span className="font-medium text-gray-900">{feature}</span> requires a Contributor subscription
              </div>
            )}
            
            <div className="text-center space-y-3">
              <p className="text-xs text-gray-600">
                Email us to learn more about Contributor features and pricing.
              </p>

              <button
                onClick={handleEmailClick}
                className="w-full flex items-center justify-center gap-2 py-[10px] px-[10px] border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors"
              >
                <EnvelopeIcon className="w-3 h-3" />
                Email to Upgrade
              </button>

              <button
                onClick={onClose}
                className="w-full text-xs text-gray-600 hover:text-gray-900 transition-colors pt-2"
              >
                Maybe later
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-[10px] text-gray-400 text-center">
              loveofminnesota@gmail.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

