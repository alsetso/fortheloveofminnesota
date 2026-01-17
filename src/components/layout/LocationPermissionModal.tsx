'use client';

import { XMarkIcon, MapPinIcon } from '@heroicons/react/24/outline';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAllow: () => void;
}

/**
 * Modal for requesting location permission
 * iOS-style bottom sheet popup
 */
export default function LocationPermissionModal({ isOpen, onClose, onAllow }: LocationPermissionModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[61] bg-white shadow-2xl transition-all duration-300 ease-out flex flex-col rounded-t-3xl"
        style={{
          maxWidth: '600px',
          width: 'calc(100% - 2rem)',
          maxHeight: '50vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-12 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MapPinIcon className="w-5 h-5 text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-900">Location Permission</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 -mr-1 transition-colors text-gray-500 hover:text-gray-900"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-3">
            <p className="text-xs text-gray-600">
              We need your location to center the map on your current position. Your location data is only used to improve your map experience and is never shared.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={onAllow}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Allow Location Access
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
