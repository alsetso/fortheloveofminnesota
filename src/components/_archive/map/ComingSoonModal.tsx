'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ComingSoonModal({ isOpen, onClose }: ComingSoonModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
        <div
          className="bg-white rounded-md shadow-xl max-w-sm w-full pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Coming Soon
              </h3>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              This feature is currently under development. You&apos;ll be able to save your pins and areas soon!
            </p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-xs font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

