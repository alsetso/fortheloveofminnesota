'use client';

import { ReactNode } from 'react';
import { XMarkIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

interface MapIDMenuProps {
  isOpen: boolean;
  label: string;
  children?: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClose?: () => void;
}

export default function MapIDMenu({ 
  isOpen, 
  label, 
  children,
  onMouseEnter,
  onMouseLeave,
  onClose,
}: MapIDMenuProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Mobile: Full-screen overlay */}
      <aside
        data-map-id-menu
        className="lg:hidden fixed inset-0 bg-white z-[102] flex flex-col transform transition-transform duration-300 ease-out"
      >
        <div className="h-full flex flex-col">
          {/* Mobile Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0 h-14">
            <div className="flex items-center gap-2">
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
                  aria-label="Back"
                  type="button"
                >
                  <ArrowLeftIcon className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-sm font-semibold text-gray-900">{label}</h2>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                aria-label="Close"
                type="button"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Mobile Content */}
          <div className="flex-1 overflow-y-auto p-2">
            {children}
          </div>
        </div>
      </aside>

      {/* Desktop: Positioned sidebar - to the right of main sidebar */}
      <aside
        data-map-id-menu
        className="hidden lg:block fixed left-16 top-0 bottom-0 bg-white border-r border-gray-200 shadow-lg w-64 z-[101] transform transition-transform duration-300 ease-out"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="h-full flex flex-col">
          {/* Navigation area */}
          <nav className="flex-1 flex flex-col overflow-y-auto p-2 border-b border-gray-200">
            <div className="flex-1">
              {/* Header */}
              <div className="mb-3 h-11 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">{label}</h2>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                    aria-label="Close"
                    type="button"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="overflow-y-auto">
                {children}
              </div>
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
}

