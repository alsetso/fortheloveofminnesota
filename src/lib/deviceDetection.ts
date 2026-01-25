import type { NextRequest } from 'next/server';

/**
 * Device detection result from server-side analysis
 */
export interface DeviceInfo {
  /** True if the request is from a mobile device (phone/tablet) */
  isMobile: boolean;
  /** True if the request is from a tablet device */
  isTablet: boolean;
  /** True if the request is from a desktop device */
  isDesktop: boolean;
  /** True if the request is from a web browser (not a native app) */
  isWebBrowser: boolean;
  /** True if the request is from a native iOS app */
  isNativeIOSApp: boolean;
  /** True if the request is from a native Android app */
  isNativeAndroidApp: boolean;
  /** True if the request is from any native app */
  isNativeApp: boolean;
  /** Detected device platform */
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  /** User-Agent string (sanitized) */
  userAgent: string;
  /** Inferred screen size category (based on device type, not actual screen size) */
  inferredScreenSize: 'small' | 'medium' | 'large';
}

/**
 * Server-side device detection from HTTP headers
 * 
 * Limitations:
 * - Screen size cannot be detected server-side (requires client-side JavaScript)
 * - Native apps can be detected via custom User-Agent patterns or custom headers
 * - Desktop screen size detection is not possible server-side
 * 
 * For actual screen size detection, use client-side JavaScript:
 * - window.innerWidth
 * - window.matchMedia()
 * - Send screen size via API if needed
 */
export function detectDevice(request: NextRequest): DeviceInfo {
  const userAgent = request.headers.get('user-agent') || '';
  const acceptHeader = request.headers.get('accept') || '';
  
  // Check for custom headers that native apps might send
  const customAppHeader = request.headers.get('x-app-version');
  const customPlatformHeader = request.headers.get('x-platform');
  
  // Normalize user agent for easier matching
  const ua = userAgent.toLowerCase();
  
  // Detect iOS
  const isIOS = /iphone|ipad|ipod/.test(ua);
  
  // Detect Android
  const isAndroid = /android/.test(ua);
  
  // Detect tablet (more specific checks)
  const isTablet = /ipad/.test(ua) || 
                   (isAndroid && !/mobile/.test(ua)) ||
                   /tablet/.test(ua);
  
  // Detect mobile (phone, not tablet)
  const isMobilePhone = (isIOS && !/ipad/.test(ua)) || 
                       (isAndroid && /mobile/.test(ua));
  
  // Detect desktop
  const isDesktop = !isIOS && !isAndroid && (
    /windows|macintosh|linux/.test(ua) && 
    !/mobile|tablet|android|iphone|ipad|ipod/.test(ua)
  );
  
  // Detect web browser vs native app
  // Native apps typically:
  // 1. Have custom User-Agent strings (e.g., "MyApp/1.0.0")
  // 2. Send custom headers (x-app-version, x-platform)
  // 3. Don't have standard browser User-Agent patterns
  
  const hasBrowserPattern = /mozilla|webkit|chrome|safari|firefox|edge|opera/.test(ua);
  const hasCustomAppHeader = !!customAppHeader;
  const hasCustomPlatformHeader = !!customPlatformHeader;
  
  // Native iOS app detection:
  // - Custom User-Agent that doesn't match browser patterns
  // - Custom headers indicating native app
  // - iOS device but no Safari/WebKit browser indicators (unlikely but possible)
  const isNativeIOSApp = isIOS && (
    hasCustomAppHeader ||
    hasCustomPlatformHeader ||
    (customPlatformHeader?.toLowerCase() === 'ios') ||
    (!hasBrowserPattern && ua.length > 0 && ua.length < 100) // Suspiciously short/non-browser UA
  );
  
  // Native Android app detection:
  const isNativeAndroidApp = isAndroid && (
    hasCustomAppHeader ||
    hasCustomPlatformHeader ||
    (customPlatformHeader?.toLowerCase() === 'android') ||
    (!hasBrowserPattern && ua.length > 0 && ua.length < 100)
  );
  
  const isNativeApp = isNativeIOSApp || isNativeAndroidApp;
  const isWebBrowser = !isNativeApp && hasBrowserPattern;
  
  // Determine platform
  let platform: 'ios' | 'android' | 'desktop' | 'unknown';
  if (isIOS) {
    platform = 'ios';
  } else if (isAndroid) {
    platform = 'android';
  } else if (isDesktop) {
    platform = 'desktop';
  } else {
    platform = 'unknown';
  }
  
  // Infer screen size based on device type
  // Note: This is an inference, not actual screen size
  // Actual screen size requires client-side JavaScript
  let inferredScreenSize: 'small' | 'medium' | 'large';
  if (isMobilePhone) {
    inferredScreenSize = 'small';
  } else if (isTablet) {
    inferredScreenSize = 'medium';
  } else {
    inferredScreenSize = 'large';
  }
  
  return {
    isMobile: isMobilePhone,
    isTablet,
    isDesktop,
    isWebBrowser,
    isNativeIOSApp,
    isNativeAndroidApp,
    isNativeApp,
    platform,
    userAgent: userAgent.substring(0, 200), // Sanitize length
    inferredScreenSize,
  };
}

/**
 * Helper to check if request is from a mobile browser (not native app)
 */
export function isMobileBrowser(request: NextRequest): boolean {
  const info = detectDevice(request);
  return info.isMobile && info.isWebBrowser;
}

/**
 * Helper to check if request is from a native iOS app
 */
export function isNativeIOSApp(request: NextRequest): boolean {
  const info = detectDevice(request);
  return info.isNativeIOSApp;
}

/**
 * Helper to check if request is from any web browser
 */
export function isWebBrowser(request: NextRequest): boolean {
  const info = detectDevice(request);
  return info.isWebBrowser;
}
