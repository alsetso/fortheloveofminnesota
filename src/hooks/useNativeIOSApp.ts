'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect if app is running in a native iOS app (WKWebView)
 * vs running in Safari browser or PWA
 * 
 * Returns true when:
 * - On iOS device (iPhone/iPad)
 * - AND running in WKWebView (native app) not Safari
 * 
 * Detection methods:
 * 1. Check for custom window property set by native app (most reliable)
 * 2. Check User-Agent for WebView patterns
 * 3. Check for absence of Safari-specific features
 */
export function useNativeIOSApp(): boolean {
  const [isNativeApp, setIsNativeApp] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);

    if (!isIOS) {
      setIsNativeApp(false);
      return;
    }

    // Method 1: Check for custom property set by native app
    // Native app can set: window.__NATIVE_IOS_APP__ = true
    if ((window as any).__NATIVE_IOS_APP__ === true) {
      setIsNativeApp(true);
      return;
    }

    // Method 2: Check User-Agent for WebView patterns
    // Native apps using WKWebView typically have different User-Agent patterns
    // Safari includes "Safari" in UA, WebView doesn't (or has different pattern)
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua);
    const isWebView = /(iPhone|iPad|iPod).*AppleWebKit(?!.*Safari)/.test(ua);
    
    // Method 3: Check for Safari-specific features that WebView might not have
    // Safari has specific APIs that WebView might not expose
    const hasSafariFeatures = 
      'safari' in window ||
      (window as any).safari !== undefined;

    // If it's iOS but not Safari and looks like WebView, it's likely a native app
    if (isWebView || (!isSafari && !hasSafariFeatures && isIOS)) {
      setIsNativeApp(true);
      return;
    }

    setIsNativeApp(false);
  }, []);

  return isNativeApp;
}
