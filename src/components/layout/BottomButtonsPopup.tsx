'use client';

import { useEffect, useRef, useState } from 'react';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

export type BottomButtonType = 'create' | 'home' | 'settings' | 'analytics' | 'location' | 'collections' | 'account' | 'search' | 'members';

interface BottomButtonsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  type: BottomButtonType | null;
  height?: 'half' | 'full';
  children: React.ReactNode;
  infoText?: string;
  darkMode?: boolean; // New prop for dark mode styling
  containerRelative?: boolean; // If true, position relative to container instead of viewport
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
  darkMode = false,
  containerRelative = false
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
      case 'members':
        return 'Members';
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

  const positionClass = containerRelative ? 'absolute' : 'fixed';
  const backdropClass = containerRelative ? 'absolute' : 'fixed';
  const maxHeightValue = containerRelative 
    ? (height === 'full' ? '100%' : '80vh')
    : (height === 'full' ? '100vh' : '50vh');
  const heightValue = containerRelative 
    ? (height === 'full' ? '100%' : 'auto')
    : (height === 'full' ? '100vh' : 'auto');

  return (
    <>
      {/* Backdrop - only show if not containerRelative (containerRelative uses external backdrop) */}
      {!containerRelative && (
        <div
          className={`${backdropClass} inset-0 z-[59] bg-black/20 transition-opacity duration-300`}
          onClick={handleClose}
        />
      )}
      
      {/* Popup */}
      <div
        ref={popupRef}
        className={`${positionClass} z-[60] shadow-2xl transition-all duration-300 ease-out flex flex-col
          bottom-0 left-1/2 -translate-x-1/2
          rounded-t-3xl ${
            darkMode 
              ? 'bg-black' 
              : 'bg-white'
          }`}
        style={{
          transform: 'translate(-50%, 100%)',
          maxHeight: maxHeightValue,
          height: heightValue,
          maxWidth: containerRelative ? '100%' : '600px',
          width: containerRelative ? '100%' : 'calc(100% - 2rem)',
          paddingBottom: containerRelative ? '0' : 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0">
          <div className={`w-12 h-1 rounded-full ${darkMode ? 'bg-white/40' : 'bg-gray-300'}`} />
        </div>

        {/* Content - Scrollable */}
        <div ref={contentRef} className="flex-1 overflow-y-auto min-h-0 scrollbar-hide">
          {children}
        </div>
      </div>
    </>
  );
}
