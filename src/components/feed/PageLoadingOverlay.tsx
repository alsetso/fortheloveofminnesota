'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useNavigationTracking } from '@/hooks/useNavigationTracking';

interface PageLoadingOverlayProps {
  duration?: number;
  /**
   * Pages that should show the loading overlay
   * If not provided, uses default list of heavy-loading pages
   */
  enabledPages?: string[];
  /**
   * Whether to show only on initial load (not client-side navigation)
   * Default: true
   */
  onlyOnInitialLoad?: boolean;
}

// Default pages that benefit from loading overlay
const DEFAULT_ENABLED_PAGES = [
  '/',
  '/map',
  '/account/analytics',
  '/profile',
  '/post',
];

export default function PageLoadingOverlay({ 
  duration = 1250,
  enabledPages = DEFAULT_ENABLED_PAGES,
  onlyOnInitialLoad = true,
}: PageLoadingOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  
  // Track navigation type
  useNavigationTracking();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Check if current page should show overlay
    const shouldShow = enabledPages.some(page => pathname.startsWith(page));
    
    if (!shouldShow) {
      setIsVisible(false);
      return;
    }

    // If onlyOnInitialLoad is true, check if this is a client-side navigation
    if (onlyOnInitialLoad) {
      // Check sessionStorage to see if we've navigated client-side
      const navigationType = sessionStorage.getItem('navigationType');
      
      // If it's a client-side navigation (not a hard reload), don't show
      if (navigationType === 'client') {
        setIsVisible(false);
        return;
      }

      // Mark that we're showing overlay for this page load
      sessionStorage.setItem('navigationType', 'initial');
    }

    // Show overlay
    setIsVisible(true);

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [pathname, mounted, enabledPages, onlyOnInitialLoad, duration]);

  if (!mounted || !isVisible) return null;

  const overlayContent = (
    <div className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-start pt-12">
      {/* MNUDA Emblem */}
      <div className="mb-6">
        <Image
          src="/word_logo.png"
          alt="For the Love of Minnesota"
          width={120}
          height={24}
          className="w-[120px] h-auto"
          priority
        />
      </div>

      {/* Animated Progress Bar */}
      <div className="w-32 h-0.5 bg-gray-200 rounded-full overflow-hidden relative">
        <div className="absolute h-full w-8 bg-gold-600 rounded-full animate-progress" />
      </div>

      <style jsx>{`
        @keyframes progress {
          0% {
            left: 0%;
          }
          50% {
            left: calc(100% - 2rem);
          }
          100% {
            left: 0%;
          }
        }
        .animate-progress {
          animation: progress 1.25s ease-in-out infinite;
        }
      `}</style>
    </div>
  );

  return createPortal(overlayContent, document.body);
}
