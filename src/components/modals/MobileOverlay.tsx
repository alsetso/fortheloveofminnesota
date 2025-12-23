'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

const STORAGE_KEY = 'mobile-overlay-dismissed-timestamp';
const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

export default function MobileOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Check if mobile (viewport width < 768px)
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768;
      if (!isMobile) {
        setIsVisible(false);
        return;
      }

      // Check if 60 minutes have passed since last dismissal
      const dismissedTimestamp = localStorage.getItem(STORAGE_KEY);
      if (dismissedTimestamp) {
        const timestamp = parseInt(dismissedTimestamp, 10);
        const now = Date.now();
        const timeSinceDismissal = now - timestamp;
        
        // Show if 60+ minutes have passed
        setIsVisible(timeSinceDismissal >= COOLDOWN_MS);
      } else {
        // No timestamp stored, show overlay
        setIsVisible(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [mounted]);

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  const handleContinue = () => {
    // Store current timestamp
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setIsVisible(false);
  };

  if (!mounted || !isVisible) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-white flex items-center justify-center p-[10px]">
      <div className="flex flex-col items-center gap-3 max-w-sm w-full">
        {/* Branding Image */}
        <div className="w-full flex justify-center">
          <Image
            src="/mid_text For the love of mn.png"
            alt="For the Love of Minnesota"
            width={300}
            height={80}
            className="w-auto h-auto max-w-full"
            unoptimized
            priority
          />
        </div>

        {/* Message */}
        <div className="text-center space-y-1.5">
          <p className="text-sm font-semibold text-gray-900">
            Our site is better on desktop
          </p>
          <p className="text-xs text-gray-600">
            You can continue on mobile, but for the best experience, visit us on a desktop or tablet.
          </p>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          className="w-full px-3 py-2 text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-md transition-colors"
        >
          Continue on Mobile
        </button>
      </div>
    </div>
  );
}

