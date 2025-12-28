'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AtlasComingSoonModalProps {
  typeName: string;
}

export default function AtlasComingSoonModal({ typeName }: AtlasComingSoonModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

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

  const handleClose = () => {
    setIsOpen(false);
    router.back();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-md border border-gray-200 p-[10px] max-w-sm w-full">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900">Coming Soon</h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-600 mb-3">
          The {typeName} directory is coming soon. Check back later for updates.
        </p>
        <button
          onClick={handleClose}
          className="w-full px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

