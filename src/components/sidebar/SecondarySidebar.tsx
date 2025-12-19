'use client';

import { ReactNode } from 'react';

interface SecondarySidebarProps {
  isOpen: boolean;
  label: string;
  children?: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function SecondarySidebar({ 
  isOpen, 
  label, 
  children,
  onMouseEnter,
  onMouseLeave,
}: SecondarySidebarProps) {
  if (!isOpen) return null;

  return (
    <aside
      className="absolute left-full top-0 h-full bg-white border-r border-gray-200 shadow-lg w-64 z-[150]"
      style={{
        animation: 'slideInRight 0.3s ease-out',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="h-full flex flex-col">
        {/* Navigation area - matches primary sidebar nav area */}
        <nav className="flex-1 flex flex-col overflow-y-auto p-2 border-b border-gray-200">
          <div className="flex-1">
            {/* Header - matches primary sidebar logo height */}
            <div className="mb-3 h-11 flex items-center"> {/* h-11 = 2.75rem = 44px, matches primary sidebar logo area */}
              <h2 className="text-sm font-semibold text-gray-900">{label}</h2>
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
  );
}
