'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect if app is running as standalone iOS app (added to home screen)
 * vs running in Safari browser
 * 
 * Returns true when:
 * - Running in standalone mode (display-mode: standalone)
 * - AND on iOS device (iPhone/iPad)
 * 
 * This is needed because iOS standalone apps show the status bar
 * (clock, signal, battery) which overlaps with header content
 */
export function useIOSStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running in standalone mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    
    // iOS Safari specific check (returns true when added to home screen)
    const isIOSStandalone = (window.navigator as any).standalone === true;
    
    // Check if iOS device
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    
    // Combined check: standalone mode AND iOS device
    setIsStandalone((isStandaloneMode || isIOSStandalone) && isIOS);
  }, []);

  return isStandalone;
}
