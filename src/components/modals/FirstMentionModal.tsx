'use client';

import { useEffect } from 'react';
import { XMarkIcon, MapPinIcon } from '@heroicons/react/24/outline';
import confetti from 'canvas-confetti';

interface FirstMentionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FirstMentionModal({ isOpen, onClose }: FirstMentionModalProps) {
  // Trigger confetti when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Left side confetti
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      
      // Right side confetti
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-lg shadow-xl animate-slide-up pointer-events-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 text-center">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <MapPinIcon className="w-8 h-8 text-red-600" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Your First Mention! 🎉
          </h2>

          {/* Description */}
          <p className="text-sm text-gray-600 mb-6">
            You've added your first mention to the map. Keep sharing your favorite spots and memories across Minnesota!
          </p>

          {/* CTA Button */}
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
          >
            Continue Exploring
          </button>
        </div>
      </div>
    </div>
  );
}

