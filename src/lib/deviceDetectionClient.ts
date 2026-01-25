'use client';

/**
 * Client-side device detection utilities
 * These complement server-side detection by providing actual screen dimensions
 */

export interface ClientDeviceInfo {
  /** Actual screen width in pixels */
  screenWidth: number;
  /** Actual screen height in pixels */
  screenHeight: number;
  /** Viewport width in pixels */
  viewportWidth: number;
  /** Viewport height in pixels */
  viewportHeight: number;
  /** True if screen width is considered small (< 768px) */
  isSmallScreen: boolean;
  /** True if screen width is considered medium (768px - 1024px) */
  isMediumScreen: boolean;
  /** True if screen width is considered large (> 1024px) */
  isLargeScreen: boolean;
  /** Device pixel ratio */
  devicePixelRatio: number;
  /** True if device has touch capability */
  hasTouch: boolean;
  /** User agent string */
  userAgent: string;
}

/**
 * Get current client device information including actual screen dimensions
 * This can be sent to the server via API if needed
 */
export function getClientDeviceInfo(): ClientDeviceInfo {
  if (typeof window === 'undefined') {
    // Server-side fallback
    return {
      screenWidth: 0,
      screenHeight: 0,
      viewportWidth: 0,
      viewportHeight: 0,
      isSmallScreen: false,
      isMediumScreen: false,
      isLargeScreen: false,
      devicePixelRatio: 1,
      hasTouch: false,
      userAgent: '',
    };
  }

  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Standard breakpoints
  const isSmallScreen = viewportWidth < 768;
  const isMediumScreen = viewportWidth >= 768 && viewportWidth < 1024;
  const isLargeScreen = viewportWidth >= 1024;

  return {
    screenWidth,
    screenHeight,
    viewportWidth,
    viewportHeight,
    isSmallScreen,
    isMediumScreen,
    isLargeScreen,
    devicePixelRatio,
    hasTouch,
    userAgent: navigator.userAgent,
  };
}

/**
 * Send device information to server via API
 * Useful for analytics or server-side decision making
 */
export async function sendDeviceInfoToServer(
  endpoint: string = '/api/device-info',
  additionalData?: Record<string, unknown>
): Promise<void> {
  const deviceInfo = getClientDeviceInfo();
  
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...deviceInfo,
        ...additionalData,
      }),
    });
  } catch (error) {
    // Silently fail - device info is not critical
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to send device info to server:', error);
    }
  }
}
