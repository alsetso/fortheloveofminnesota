'use client';

import { useState, useRef, useEffect } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';

/**
 * Notifications Dropdown - Coming soon message
 */
export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notifications Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 rounded-full hover:bg-surface-accent dark:hover:bg-white/10 transition-colors flex items-center justify-center"
      >
        <BellIcon className="w-5 h-5 text-foreground" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border-muted dark:border-white/10 rounded-lg shadow-xl flex flex-col max-h-[calc(100vh-4rem)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border-muted dark:border-white/10 flex-shrink-0">
            <h3 className="text-base font-semibold text-foreground">Notifications</h3>
          </div>

          {/* Content - Coming Soon */}
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-dark">
            <div className="p-6 text-center">
              <BellIcon className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Notifications Feature</p>
              <p className="text-xs text-foreground-muted">Coming soon</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
