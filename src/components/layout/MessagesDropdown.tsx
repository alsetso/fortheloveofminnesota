'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

/**
 * Messages Dropdown - Simplified placeholder
 * Shows "coming soon" message while messaging functionality is being built
 */
export default function MessagesDropdown() {
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
      {/* Messages Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 rounded-full hover:bg-surface-accent dark:hover:bg-white/10 transition-colors flex items-center justify-center"
      >
        <ChatBubbleLeftRightIcon className="w-5 h-5 text-foreground" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border-muted dark:border-white/10 rounded-lg shadow-xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border-muted dark:border-white/10">
            <h3 className="text-base font-semibold text-foreground">Messages</h3>
          </div>

          {/* Content */}
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <ChatBubbleLeftRightIcon className="w-12 h-12 text-foreground-muted mb-3" />
            <p className="text-sm text-foreground-muted">
              No messages functionality coming soon
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
