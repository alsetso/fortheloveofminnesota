'use client';

import { useState } from 'react';
import { MapPinIcon, Square3Stack3DIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface FloatingActionMenuProps {
  onCreatePin: () => void;
  onCreateArea: () => void;
  disabled?: boolean;
}

export function FloatingActionMenu({
  onCreatePin,
  onCreateArea,
  disabled = false,
}: FloatingActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  const handleCreatePin = () => {
    setIsOpen(false);
    onCreatePin();
  };

  const handleCreateArea = () => {
    setIsOpen(false);
    onCreateArea();
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <div className="relative">
        {/* Action Buttons */}
        {isOpen && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 mb-2 flex flex-col gap-2 items-center">
            {/* Create Pin Button */}
            <button
              onClick={handleCreatePin}
              disabled={disabled}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-900 rounded-full shadow-lg border border-gray-200 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MapPinIcon className="w-5 h-5 text-gray-700" />
              <span className="text-sm font-medium">Create Pin</span>
            </button>

            {/* Create Area Button */}
            <button
              onClick={handleCreateArea}
              disabled={disabled}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-900 rounded-full shadow-lg border border-gray-200 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Square3Stack3DIcon className="w-5 h-5 text-gray-700" />
              <span className="text-sm font-medium">Draw Area</span>
            </button>
          </div>
        )}

        {/* Main FAB Button */}
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`pointer-events-auto w-14 h-14 rounded-full shadow-xl transition-all flex items-center justify-center ${
            isOpen
              ? 'bg-gray-700 hover:bg-gray-800 text-white rotate-45'
              : 'bg-gold-500 hover:bg-gold-600 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label={isOpen ? 'Close menu' : 'Open create menu'}
        >
          {isOpen ? (
            <XMarkIcon className="w-6 h-6" />
          ) : (
            <PlusIcon className="w-6 h-6" />
          )}
        </button>
      </div>
    </div>
  );
}


