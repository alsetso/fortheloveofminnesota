'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
}

export default function ComingSoonModal({ isOpen, onClose, feature }: ComingSoonModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-md border border-gray-200 p-[10px] max-w-sm w-full">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900">Coming Soon</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-600 mb-3">
          {feature} is coming soon. Check back later for updates.
        </p>
        <button
          onClick={onClose}
          className="w-full px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

