'use client';

import { ReactNode, useState } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface AppFooterProps {
  /** Dynamic popup content shown above the footer header */
  children?: ReactNode;
  /** Footer header label (always visible at bottom) */
  headerLabel?: string;
  /** Controlled open state (optional) */
  isOpen?: boolean;
  /** Called when open state should change (optional, for controlled mode) */
  onOpenChange?: (open: boolean) => void;
}

/**
 * App footer: accordion-style. Click header to open/close content above it.
 */
export default function AppFooter({ children, headerLabel = 'Footer', isOpen: controlledOpen, onOpenChange }: AppFooterProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined && onOpenChange != null;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen;
  const hasContent = children != null;

  return (
    <footer
      className="flex-shrink-0 flex flex-col-reverse border-t border-gray-200 bg-white rounded-tl-md rounded-tr-md overflow-hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
      data-container="app-footer"
      aria-label="App footer"
    >
      {/* Header always at bottom (click toggles accordion) */}
      <div className="flex-shrink-0 flex flex-col">
        <button
          type="button"
          onClick={() => hasContent && setIsOpen(!isOpen)}
          className="flex-shrink-0 flex items-center justify-between gap-2 w-full px-3 h-[50px] min-h-[50px] max-h-[50px] text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors text-left disabled:opacity-50 disabled:cursor-default"
          data-container="app-footer-header"
          aria-label={isOpen ? 'Close footer' : 'Open footer'}
          aria-expanded={isOpen}
          disabled={!hasContent}
        >
          <span>{headerLabel}</span>
          {hasContent && (
            <span className="flex-shrink-0 transition-transform" aria-hidden>
              {isOpen ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronUpIcon className="w-4 h-4" />
              )}
            </span>
          )}
        </button>
        {/* 25px spacer always visible */}
        <div className="h-[25px] flex-shrink-0" aria-hidden />
      </div>
      {/* Accordion content (above header when open) */}
      {hasContent && isOpen && (
        <div
          className="flex-shrink-0 overflow-auto max-h-[40vh] border-b border-gray-200 rounded-tl-md rounded-tr-md bg-white"
          data-container="app-footer-content"
        >
          {children}
        </div>
      )}
    </footer>
  );
}
