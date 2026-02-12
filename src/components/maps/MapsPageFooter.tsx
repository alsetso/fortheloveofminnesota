'use client';

import { ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface MapsPageFooterProps {
  children?: ReactNode;
  onClose?: () => void;
  showCloseIcon?: boolean;
}

/**
 * View-only footer for maps page. Shows pin/location details with close button.
 * No add-pin, no draggable panel—just display selection and dismiss.
 */
export default function MapsPageFooter({
  children,
  onClose,
  showCloseIcon = false,
}: MapsPageFooterProps) {
  if (!children) return null;
  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-[500px] mx-2 mb-2 rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="relative p-3">
          {showCloseIcon && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-2 right-2 p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          <div className={showCloseIcon && onClose ? 'pr-8' : ''}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
