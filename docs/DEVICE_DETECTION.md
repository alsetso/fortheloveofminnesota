# Device Detection Guide

This guide explains how to detect device type, screen size, and whether requests are from web browsers vs native apps on the server side.

## Server-Side Detection

### Basic Usage

```typescript
import { detectDevice, isMobileBrowser, isNativeIOSApp } from '@/lib/deviceDetection';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Get complete device information
  const deviceInfo = detectDevice(request);
  
  // Or use helper functions
  const isMobile = isMobileBrowser(request);
  const isIOSApp = isNativeIOSApp(request);
  
  // Use the information
  if (deviceInfo.isMobile && deviceInfo.isWebBrowser) {
    // Mobile device in browser
  }
  
  if (deviceInfo.isDesktop && deviceInfo.inferredScreenSize === 'small') {
    // Desktop with small screen (inferred, not actual)
  }
  
  return Response.json({ deviceInfo });
}
```

### In Middleware

```typescript
// src/middleware.ts
import { detectDevice } from '@/lib/deviceDetection';

export async function middleware(req: NextRequest) {
  const deviceInfo = detectDevice(req);
  
  // Add device info to headers for downstream use
  const response = NextResponse.next();
  response.headers.set('X-Device-Type', deviceInfo.platform);
  response.headers.set('X-Is-Mobile', String(deviceInfo.isMobile));
  response.headers.set('X-Is-Native-App', String(deviceInfo.isNativeApp));
  
  return response;
}
```

### In API Routes

```typescript
// src/app/api/example/route.ts
import { detectDevice } from '@/lib/deviceDetection';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const deviceInfo = detectDevice(request);
  
  // Different responses based on device
  if (deviceInfo.isNativeIOSApp) {
    return Response.json({ message: 'iOS app detected' });
  }
  
  if (deviceInfo.isMobile && deviceInfo.isWebBrowser) {
    return Response.json({ message: 'Mobile browser detected' });
  }
  
  return Response.json({ message: 'Desktop or other' });
}
```

## Client-Side Detection (for Actual Screen Size)

Server-side detection cannot know actual screen dimensions. Use client-side detection and optionally send it to the server:

```typescript
'use client';

import { getClientDeviceInfo, sendDeviceInfoToServer } from '@/lib/deviceDetectionClient';
import { useEffect } from 'react';

export function MyComponent() {
  useEffect(() => {
    // Get actual screen dimensions
    const deviceInfo = getClientDeviceInfo();
    
    console.log('Screen width:', deviceInfo.screenWidth);
    console.log('Is small screen:', deviceInfo.isSmallScreen);
    
    // Optionally send to server for analytics
    sendDeviceInfoToServer('/api/device-info');
  }, []);
  
  return <div>...</div>;
}
```

## Combined Server + Client Detection

The `/api/device-info` endpoint combines both:

```typescript
// Client sends actual screen size
const response = await fetch('/api/device-info', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(getClientDeviceInfo()),
});

const { deviceInfo } = await response.json();

// deviceInfo.analysis.isDesktopSmallScreen - desktop with small screen
// deviceInfo.analysis.isMobileBrowser - mobile device in browser
// deviceInfo.analysis.isMobileNativeApp - mobile device in native app
```

## Detection Capabilities

### What Server-Side Can Detect:
- ✅ Mobile vs Desktop vs Tablet
- ✅ iOS vs Android vs Desktop platform
- ✅ Web browser vs Native app (via User-Agent patterns and custom headers)
- ❌ Actual screen dimensions (requires client-side)

### What Client-Side Can Detect:
- ✅ Actual screen width/height
- ✅ Actual viewport width/height
- ✅ Device pixel ratio
- ✅ Touch capability
- ✅ Screen size category (small/medium/large)

## Native App Detection

To detect native iOS/Android apps, they should send custom headers:

```typescript
// In your native app HTTP requests
headers: {
  'X-App-Version': '1.0.0',
  'X-Platform': 'ios', // or 'android'
  'User-Agent': 'MyApp/1.0.0 (iOS)', // Custom User-Agent
}
```

The server will detect these and set `isNativeIOSApp` or `isNativeAndroidApp` accordingly.

## Limitations

1. **Screen Size**: Server cannot know actual screen size. Use client-side detection and send to server if needed.
2. **Desktop Small Screen**: Server cannot distinguish between a small laptop window and a large desktop. Client-side detection is required.
3. **User-Agent Spoofing**: User-Agent strings can be spoofed, but this is rare in practice.
4. **Native App Detection**: Relies on custom headers or User-Agent patterns. Apps must send these headers.

## Best Practices

1. Use server-side detection for initial routing/rendering decisions
2. Use client-side detection for responsive UI adjustments
3. Send client-side info to server only when needed (analytics, A/B testing)
4. Cache device info on client to avoid repeated API calls
5. Don't rely solely on User-Agent - use multiple signals when possible
