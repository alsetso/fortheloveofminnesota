'use client';

import { CameraIcon } from '@heroicons/react/24/outline';

interface CameraCircleButtonProps {
  onClick: () => void;
  isHidden?: boolean; // Optional - hide button if needed
}

/**
 * Camera Circle Button - Transparent circle element fixed bottom center
 * Triggers camera modal when clicked
 */
export default function CameraCircleButton({ onClick, isHidden = false }: CameraCircleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-4 left-1/2 z-[50] transition-all duration-300 ease-out ${
        isHidden
          ? 'opacity-0 pointer-events-none'
          : 'opacity-100 pointer-events-auto'
      }`}
      style={{
        transform: isHidden 
          ? 'translate(-50%, calc(100% + 1rem))' 
          : 'translate(-50%, 0)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label="Open camera"
    >
      <div
        className="w-20 h-20 rounded-full border-[6px] backdrop-blur-sm hover:border-white transition-colors cursor-pointer flex items-center justify-center"
        style={{
          borderColor: 'rgba(255, 255, 255, 0.8)',
          backgroundColor: 'transparent',
        }}
      >
        <CameraIcon 
          className="w-6 h-6 text-white transition-colors"
        />
      </div>
    </button>
  );
}

