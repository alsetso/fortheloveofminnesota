'use client';

import { ReactNode } from 'react';
import { XMarkIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

interface SecondarySidebarProps {
  isOpen: boolean;
  label: string;
  children?: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClose?: () => void;
}

export default function SecondarySidebar({ 
  isOpen, 
  label, 
  children,
  onMouseEnter,
  onMouseLeave,
  onClose,
}: SecondarySidebarProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Mobile: Full-screen overlay */}
      <aside
        data-secondary-sidebar
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
            {children || (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Secondary navigation and elements for {label}
                </p>
                <div className="space-y-2">
                  <div className="text-xs text-gray-600 font-medium">Quick Links</div>
                  <div className="space-y-1">
                    <a href="#" className="block text-xs text-gray-600 hover:text-gray-900 py-1.5 px-2 rounded hover:bg-gray-50">
                      Sub-item 1
                    </a>
                    <a href="#" className="block text-xs text-gray-600 hover:text-gray-900 py-1.5 px-2 rounded hover:bg-gray-50">
                      Sub-item 2
                    </a>
                    <a href="#" className="block text-xs text-gray-600 hover:text-gray-900 py-1.5 px-2 rounded hover:bg-gray-50">
                      Sub-item 3
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Desktop: Positioned sidebar */}
      <aside
        data-secondary-sidebar
        className="hidden lg:block absolute left-full top-0 h-full bg-white border-r border-gray-200 shadow-lg w-64 z-40 transform transition-transform duration-300 ease-out"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="h-full flex flex-col">
          {/* Navigation area - matches primary sidebar nav area */}
          <nav className="flex-1 flex flex-col overflow-y-auto p-2 border-b border-gray-200">
            <div className="flex-1">
              {/* Header - matches primary sidebar logo height */}
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
                {children || (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">
                      Secondary navigation and elements for {label}
                    </p>
                    <div className="space-y-2">
                      <div className="text-xs text-gray-600 font-medium">Quick Links</div>
                      <div className="space-y-1">
                        <a href="#" className="block text-xs text-gray-600 hover:text-gray-900 py-1.5 px-2 rounded hover:bg-gray-50">
                          Sub-item 1
                        </a>
                        <a href="#" className="block text-xs text-gray-600 hover:text-gray-900 py-1.5 px-2 rounded hover:bg-gray-50">
                          Sub-item 2
                        </a>
                        <a href="#" className="block text-xs text-gray-600 hover:text-gray-900 py-1.5 px-2 rounded hover:bg-gray-50">
                          Sub-item 3
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </nav>

          {/* Footer area - matches primary sidebar footer */}
          <div className="p-2 border-t border-gray-200">
            {/* Footer content can be added here */}
          </div>
        </div>
      </aside>
    </>
  );
}
