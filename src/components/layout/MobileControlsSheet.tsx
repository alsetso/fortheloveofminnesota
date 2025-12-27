'use client';

import { useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface MobileSecondarySheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function MobileSecondarySheet({ isOpen, onClose, title, children }: MobileSecondarySheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden';
      // Set to visible immediately (no animation)
      if (sheetRef.current) {
        sheetRef.current.style.transform = 'translateY(0)';
      }
      if (backdropRef.current) {
        backdropRef.current.style.opacity = '1';
      }
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    if (sheetRef.current) {
      sheetRef.current.style.transform = 'translateY(100%)';
    }
    if (backdropRef.current) {
      backdropRef.current.style.opacity = '0';
    }
    // Wait for animation to complete
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={handleClose}
        className="lg:hidden fixed inset-0 bg-black/40 z-50 transition-opacity duration-300"
        style={{ opacity: 1 }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out flex flex-col"
        style={{
          transform: 'translateY(0)',
          height: '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar */}
        <div className="flex items-center justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button
            onClick={handleClose}
            className="p-1.5 -mr-1.5 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

