'use client';

import { XMarkIcon, ArrowLeftIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import React, { useEffect, useRef, useState } from 'react';

export interface ModalNavProps {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  actions?: React.ReactNode;
  sticky?: boolean;
  disabled?: boolean;
  className?: string;
  infoText?: string;
}

export function ModalNav({
  title,
  onClose,
  onBack,
  actions,
  sticky = false,
  disabled = false,
  className = '',
  infoText,
}: ModalNavProps) {
  const [showInfo, setShowInfo] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);

  const baseClasses = 'flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white';
  const stickyClasses = sticky ? 'sticky top-0 z-10' : '';
  const combinedClasses = `${baseClasses} ${stickyClasses} ${className}`.trim();

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

  return (
    <div className={combinedClasses}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {onBack && (
          <button
            onClick={onBack}
            disabled={disabled}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
            aria-label="Back"
          >
            <ArrowLeftIcon className="w-4 h-4 text-gray-600" />
          </button>
        )}
        <div className="flex items-center gap-1 min-w-0">
          <h2 className="text-base font-semibold text-gray-900 truncate">{title}</h2>
          {infoText && (
            <div className="relative flex-shrink-0">
              <button
                ref={infoButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInfo(!showInfo);
                }}
                className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center"
                title="Information"
              >
                <InformationCircleIcon className="w-3.5 h-3.5" />
              </button>
              {showInfo && (
                <div
                  ref={infoRef}
                  className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-md shadow-lg p-2 min-w-[200px]"
                >
                  <p className="text-xs text-gray-600">
                    {infoText}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        <button
          onClick={onClose}
          disabled={disabled}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <XMarkIcon className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
}


