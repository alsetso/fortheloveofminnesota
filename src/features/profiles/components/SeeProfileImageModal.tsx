'use client';

import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

interface SeeProfileImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  displayName: string;
  username: string | null;
}

export default function SeeProfileImageModal({
  isOpen,
  onClose,
  imageUrl,
  displayName,
  username,
}: SeeProfileImageModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 pointer-events-auto"
        onClick={onClose}
      />

      {/* Compact Modal */}
      <div className="relative w-full max-w-xs bg-white rounded-lg shadow-xl pointer-events-auto p-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Circular Image Container */}
        <div className="flex flex-col items-center space-y-3">
          <div className="relative w-[200px] h-[200px] rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200">
            <Image
              src={imageUrl}
              alt={displayName}
              width={200}
              height={200}
              className="w-full h-full object-cover rounded-full"
              unoptimized={imageUrl.startsWith('data:') || imageUrl.includes('supabase.co')}
              priority
            />
          </div>

          {/* Name and Username */}
          <div className="text-center space-y-1">
            <h3 className="text-sm font-semibold text-gray-900">
              {displayName}
            </h3>
            {username && (
              <p className="text-xs text-gray-500">
                @{username}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
