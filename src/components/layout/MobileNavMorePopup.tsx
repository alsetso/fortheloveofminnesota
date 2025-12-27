'use client';

import { useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface MobileNavMorePopupProps {
  isOpen: boolean;
  onClose: () => void;
  items: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconSolid?: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    isActive?: boolean;
  }>;
}

export default function MobileNavMorePopup({ isOpen, onClose, items }: MobileNavMorePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Set to visible immediately (no animation)
      if (popupRef.current) {
        popupRef.current.style.transform = 'translateY(0)';
      }
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    if (popupRef.current) {
      popupRef.current.style.transform = 'translateY(100%)';
    }
    setTimeout(() => {
      onClose();
    }, 200);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Popup */}
      <div
        ref={popupRef}
        className="fixed bottom-16 left-0 right-0 z-[60] bg-white rounded-t-2xl transition-transform duration-200 ease-out border-t border-gray-200 flex flex-col"
        style={{
          transform: 'translateY(0)',
          height: '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar - Top only */}
        <div className="flex items-center justify-center pt-2 pb-1">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">More</h2>
          <button
            onClick={handleClose}
            className="p-1.5 -mr-1.5 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          <div className="py-2 flex flex-wrap items-center justify-center">
            {items.map((item) => {
              const Icon = item.isActive && item.iconSolid ? item.iconSolid : item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.onClick();
                    handleClose();
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 flex-1 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <Icon className={`w-5 h-5 ${item.isActive ? 'text-gray-900' : 'text-gray-500'}`} />
                  <span className={`text-[10px] font-medium ${item.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

