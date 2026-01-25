import { NextRequest, NextResponse } from 'next/server';
import { detectDevice } from '@/lib/deviceDetection';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * POST /api/device-info
 * Receives client-side device information (screen size, etc.) and combines
 * with server-side detection for complete device context
 * 
 * This endpoint allows the server to know actual screen dimensions,
 * which cannot be detected server-side alone.
 */
const deviceInfoSchema = z.object({
  screenWidth: z.number().int().min(0).max(10000),
  screenHeight: z.number().int().min(0).max(10000),
  viewportWidth: z.number().int().min(0).max(10000),
  viewportHeight: z.number().int().min(0).max(10000),
  isSmallScreen: z.boolean(),
  isMediumScreen: z.boolean(),
  isLargeScreen: z.boolean(),
  devicePixelRatio: z.number().min(0).max(10),
  hasTouch: z.boolean(),
  userAgent: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        // Get server-side device detection
        const serverDeviceInfo = detectDevice(req);
        
        // Validate and get client-side device info
        const validation = await validateRequestBody(
          req,
          deviceInfoSchema,
          REQUEST_SIZE_LIMITS.json
        );
        
        if (!validation.success) {
          return validation.error;
        }
        
        const clientDeviceInfo = validation.data;
        
        // Combine server and client information
        const combinedInfo = {
          // Server-side detection
          server: {
            isMobile: serverDeviceInfo.isMobile,
            isTablet: serverDeviceInfo.isTablet,
            isDesktop: serverDeviceInfo.isDesktop,
            isWebBrowser: serverDeviceInfo.isWebBrowser,
            isNativeIOSApp: serverDeviceInfo.isNativeIOSApp,
            isNativeAndroidApp: serverDeviceInfo.isNativeAndroidApp,
            isNativeApp: serverDeviceInfo.isNativeApp,
            platform: serverDeviceInfo.platform,
            inferredScreenSize: serverDeviceInfo.inferredScreenSize,
          },
          // Client-side actual measurements
          client: {
            screenWidth: clientDeviceInfo.screenWidth,
            screenHeight: clientDeviceInfo.screenHeight,
            viewportWidth: clientDeviceInfo.viewportWidth,
            viewportHeight: clientDeviceInfo.viewportHeight,
            isSmallScreen: clientDeviceInfo.isSmallScreen,
            isMediumScreen: clientDeviceInfo.isMediumScreen,
            isLargeScreen: clientDeviceInfo.isLargeScreen,
            devicePixelRatio: clientDeviceInfo.devicePixelRatio,
            hasTouch: clientDeviceInfo.hasTouch,
          },
          // Combined analysis
          analysis: {
            // Desktop with small screen (e.g., small laptop window)
            isDesktopSmallScreen: serverDeviceInfo.isDesktop && clientDeviceInfo.isSmallScreen,
            // Mobile device in browser (not native app)
            isMobileBrowser: serverDeviceInfo.isMobile && serverDeviceInfo.isWebBrowser,
            // Mobile device in native app
            isMobileNativeApp: serverDeviceInfo.isMobile && serverDeviceInfo.isNativeApp,
            // Actual screen size category
            actualScreenSize: clientDeviceInfo.isSmallScreen 
              ? 'small' 
              : clientDeviceInfo.isMediumScreen 
                ? 'medium' 
                : 'large',
          },
        };
        
        // Here you could store this in your database, use it for analytics, etc.
        // For now, just return it as confirmation
        
        return NextResponse.json({
          success: true,
          deviceInfo: combinedInfo,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in POST /api/device-info:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public',
      requireAuth: false,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
