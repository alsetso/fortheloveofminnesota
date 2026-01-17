'use client';

import { useEffect, useRef, useState } from 'react';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

export type BottomButtonType = 'create' | 'home' | 'settings' | 'analytics' | 'location' | 'collections' | 'account';

interface BottomButtonsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  type: BottomButtonType | null;
  height?: 'half' | 'full';
  children: React.ReactNode;
  infoText?: string;
  darkMode?: boolean; // New prop for dark mode styling
}

/**
 * Popup container for bottom buttons (Create, Explore, Account)
 * Supports half and full height designs
 * iOS-style slide-up sheet
 */
export default function BottomButtonsPopup({ 
  isOpen, 
  onClose, 
  type,
  height = 'half',
  children,
  infoText,
  darkMode = false
}: BottomButtonsPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isAtMaxHeight, setIsAtMaxHeight] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);

  // Handle popup open/close animations
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when popup is open
      document.body.style.overflow = 'hidden';
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        if (popupRef.current) {
          popupRef.current.style.transform = 'translate(-50%, 0)';
        }
      });
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
      setIsAtMaxHeight(false);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Check if content reaches max height
  useEffect(() => {
    if (!isOpen || !contentRef.current || !popupRef.current) return;

    const checkMaxHeight = () => {
      if (contentRef.current && popupRef.current) {
        const contentHeight = contentRef.current.scrollHeight;
        const containerHeight = popupRef.current.clientHeight;
        const maxHeight = window.innerHeight; // Always use 100vh
        
        // Check if content is scrollable (reached max height)
        setIsAtMaxHeight(
          contentHeight >= maxHeight || 
          contentRef.current.scrollHeight > contentRef.current.clientHeight
        );
      }
    };

    // Check immediately and after a short delay for content to render
    checkMaxHeight();
    const timeoutId = setTimeout(checkMaxHeight, 100);

    // Use ResizeObserver to watch for content changes
    const resizeObserver = new ResizeObserver(checkMaxHeight);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [isOpen, children, height]);

  // Close info popup when clicking outside
  useEffect(() => {
    if (!showInfo) return;

    const handleClickOutside = (e: MouseEvent) => {
      const clickedButton = 
        infoButtonRef.current && infoButtonRef.current.contains(e.target as Node);
      
      if (
        infoRef.current &&
        !infoRef.current.contains(e.target as Node) &&
        !clickedButton
      ) {
        setShowInfo(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInfo]);

  const handleClose = () => {
    if (popupRef.current) {
      popupRef.current.style.transform = 'translate(-50%, 100%)';
    }
    // Wait for animation to complete
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!isOpen || !type) return null;

  const getTitle = () => {
    switch (type) {
      case 'create':
        return 'Create';
      case 'home':
        return 'Home';
      case 'settings':
        return 'Settings';
      case 'analytics':
        return 'Analytics';
      case 'location':
        return 'User Location';
      case 'collections':
        return 'Collections';
      case 'account':
        return 'Account';
      default:
        return '';
    }
  };

  const getDefaultInfoText = () => {
    switch (type) {
      case 'collections':
        return 'Add mentions to different collections';
      case 'analytics':
        return 'View real-time visit statistics and page analytics';
      case 'settings':
        return 'Customize map styles, layers, and display options';
      default:
        return undefined;
    }
  };

  // Use provided infoText or default based on type
  const displayInfoText = infoText !== undefined ? infoText : getDefaultInfoText();

  const maxHeight = height === 'full' ? '100vh' : '50vh';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[49] bg-black/20 transition-opacity duration-300"
        onClick={handleClose}
      />
      
      {/* Popup */}
      <div
        ref={popupRef}
        className={`fixed z-[50] shadow-2xl transition-all duration-300 ease-out flex flex-col
          bottom-0 left-1/2 -translate-x-1/2
          rounded-t-3xl ${
            darkMode 
              ? 'bg-black' 
              : 'bg-white'
          }`}
        style={{
          transform: 'translate(-50%, 100%)',
          maxHeight: '100vh',
          height: height === 'full' ? '100vh' : 'auto',
          maxWidth: '600px',
          width: 'calc(100% - 2rem)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0">
          <div className={`w-12 h-1 rounded-full ${darkMode ? 'bg-white/40' : 'bg-gray-300'}`} />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 border-b flex-shrink-0 ${
          darkMode 
            ? 'border-white/20' 
            : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-1">
            <h2 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {getTitle()}
            </h2>
            {displayInfoText && (
              <div className="relative">
                <button
                  ref={infoButtonRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInfo(!showInfo);
                  }}
                  className={`p-0.5 transition-colors flex items-center justify-center ${
                    darkMode
                      ? 'text-white/60 hover:text-white'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title="Information"
                >
                  <InformationCircleIcon className="w-3.5 h-3.5" />
                </button>
                {showInfo && (
                  <div
                    ref={infoRef}
                    className={`absolute top-full left-0 mt-1 z-50 rounded-md shadow-lg p-2 min-w-[200px] max-w-[280px] ${
                      darkMode
                        ? 'bg-white/10 border border-white/20 backdrop-blur-md'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <p className={`text-xs ${darkMode ? 'text-white' : 'text-gray-600'}`}>
                      {displayInfoText}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className={`p-1 -mr-1 transition-colors ${
              darkMode
                ? 'text-white/80 hover:text-white'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Large Headline - Shows when at max height */}
        {isAtMaxHeight && (
          <div className={`px-4 py-3 border-b flex-shrink-0 transition-opacity duration-300 ${
            darkMode
              ? 'border-white/20'
              : 'border-gray-200'
          }`} style={{ opacity: isAtMaxHeight ? 1 : 0 }}>
            <h1 className={`text-2xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {getTitle()}
            </h1>
          </div>
        )}

        {/* Content - Scrollable */}
        <div ref={contentRef} className="flex-1 overflow-y-auto min-h-0 scrollbar-transparent">
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
