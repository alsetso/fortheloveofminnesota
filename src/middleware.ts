import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/types/supabase';
import type { AccountRole } from '@/features/auth/services/memberService';
import { detectDevice } from '@/lib/deviceDetection';
import { isDraftRoute, DRAFT_CONFIG } from '@/lib/routes/draft-pages';

// Route protection configuration
const ROUTE_PROTECTION: Record<string, { 
  auth: boolean; 
  roles?: AccountRole[];
}> = {
  '/account/settings': { auth: true },
  '/map-test': { auth: true },
  '/admin': { auth: true, roles: ['admin'] },
  '/analytics': { auth: true, roles: ['admin'] },
  '/billing': { auth: true },
};

/**
 * Check if account has required field (username only)
 */
function isAccountComplete(account: {
  username: string | null;
} | null): boolean {
  if (!account) return false;
  
  // Only check username - simplified requirement
  return !!account.username;
}

/**
 * Get user account data (role, onboarded status, and completeness)
 * Checks active_account_id cookie first, then falls back to first account
 */
async function getUserAccountData(
  supabase: ReturnType<typeof createServerClient>, 
  userId: string,
  req: NextRequest
): Promise<{
  role: AccountRole | null;
  onboarded: boolean | null;
  isComplete: boolean;
}> {
  // Get active account ID from cookie (set by client when switching accounts)
  const activeAccountIdCookie = req.cookies.get('active_account_id');
  const activeAccountId = activeAccountIdCookie?.value || null;

  let account, accountError;
  
  if (activeAccountId) {
    // Verify the active account belongs to this user before using it
    const { data, error } = await supabase
      .from('accounts')
      .select('role, onboarded, username')
      .eq('id', activeAccountId)
      .eq('user_id', userId)
      .maybeSingle();
    account = data;
    accountError = error;
  } else {
    // Fallback to first account if no active account ID in cookie
    const { data, error } = await supabase
      .from('accounts')
      .select('role, onboarded, username')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    account = data;
    accountError = error;
  }

  // If account doesn't exist or query fails, allow access (account will be created)
  if (accountError || !account) {
    if (accountError && accountError.code !== 'PGRST116') {
      console.warn('[middleware] Account lookup error:', accountError);
    }
    return {
      role: null,
      onboarded: null,
      isComplete: false,
    };
  }

  // Normalize role value
  let roleValue: string;
  if (typeof account.role === 'string') {
    roleValue = account.role.toLowerCase().trim();
  } else {
    roleValue = String(account.role).toLowerCase().trim();
  }

  const validRoles: AccountRole[] = ['general', 'admin'];
  const role: AccountRole | null = validRoles.includes(roleValue as AccountRole) 
    ? (roleValue as AccountRole) 
    : null;

  // Check if account is complete (all required fields filled)
  const isComplete = isAccountComplete(account);
  
  // Check onboarded status
  const onboarded = account.onboarded === true ? true : false;
  
  return {
    role,
    onboarded,
    isComplete,
  };
}

/**
 * Check if path matches protected route pattern
 */
function matchesProtectedRoute(pathname: string): { 
  auth: boolean; 
  roles?: AccountRole[];
} | null {
  // Exact matches first (most specific)
  if (ROUTE_PROTECTION[pathname]) {
    return ROUTE_PROTECTION[pathname];
  }

  // Prefix matches (e.g., /admin/articles matches /admin)
  for (const [route, config] of Object.entries(ROUTE_PROTECTION)) {
    if (pathname.startsWith(route)) {
      return config;
    }
  }

  return null;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  
  // Skip ALL middleware processing for Stripe webhook - it needs raw body and no redirects
  // This prevents any redirects (www/non-www, trailing slash, etc.) from interfering
  if (pathname === '/api/stripe/webhook' || pathname === '/api/stripe/webhook/') {
    // Return immediately without any processing to prevent redirects
    return NextResponse.next();
  }
  
  const response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  // Detect device type for server-side decisions
  const deviceInfo = detectDevice(req);
  
  // Add device info to response headers for downstream use (optional)
  response.headers.set('X-Device-Platform', deviceInfo.platform);
  response.headers.set('X-Is-Mobile', String(deviceInfo.isMobile));
  response.headers.set('X-Is-Web-Browser', String(deviceInfo.isWebBrowser));
  response.headers.set('X-Is-Native-App', String(deviceInfo.isNativeApp));
  response.headers.set('X-Inferred-Screen-Size', deviceInfo.inferredScreenSize);

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy - Allow camera access
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=()');
  
  // HSTS - only in production with HTTPS
  if (process.env.NODE_ENV === 'production' && req.nextUrl.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy - basic policy (can be customized per route)
  // Note: This is a basic CSP. You may need to adjust based on your specific needs
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com https://connect.facebook.net", // Stripe.js CDN + Google Analytics + Facebook Pixel
    "script-src-elem 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com https://connect.facebook.net", // Stripe.js script elements + Google Analytics + Facebook Pixel
    "worker-src 'self' blob:", // Mapbox uses blob URLs for Web Workers
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Google Fonts + Tailwind
    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com", // Google Fonts stylesheets
    "img-src 'self' data: https: blob:", // Allow blob URLs for camera previews and Facebook tracking pixel
    "media-src 'self' blob: https:", // Allow blob URLs for video previews and https for Supabase videos
    "font-src 'self' data: https://fonts.gstatic.com", // Google Fonts fonts
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.mapbox.com https://api.mapbox.com https://api.stripe.com https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com https://connect.facebook.net https://svc.metrotransit.org https://api.weather.gov", // Stripe API + Google Analytics + Facebook Pixel
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com", // Stripe Checkout and webhooks
    "frame-ancestors 'none'",
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);

  // Redirect deprecated routes to /maps
  if (pathname === '/plan' || pathname === '/plans' || pathname === '/billing') {
    return NextResponse.redirect(new URL('/maps', req.url));
  }
  
  // Redirect /live to /maps (live route deprecated)
  if (pathname === '/live') {
    const redirectUrl = new URL('/maps', req.url);
    // Preserve query params
    req.nextUrl.searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(redirectUrl);
  }
  // Profile pages removed — canonical URL is /:username; redirect /profile and /profile/* to /:username or /
  if (pathname === '/profile') {
    return NextResponse.redirect(new URL('/', req.url));
  }
  if (pathname.startsWith('/profile/')) {
    const slug = pathname.slice('/profile/'.length).split('/')[0];
    if (slug) {
      return NextResponse.redirect(new URL(`/${encodeURIComponent(slug)}`, req.url));
    }
  }

  // Redirect account pages to / with modal params
  if (pathname.startsWith('/account/')) {
    // Special handling for onboarding - separate modal
    if (pathname === '/account/onboarding') {
      const redirectUrl = new URL('/', req.url);
      redirectUrl.searchParams.set('modal', 'onboarding');
      
      // Preserve query params (e.g., session_id from Stripe)
      req.nextUrl.searchParams.forEach((value, key) => {
        redirectUrl.searchParams.set(key, value);
      });
      
      return NextResponse.redirect(redirectUrl);
    }
    
    // Other account pages go to account modal with tab
    const accountRouteMap: Record<string, string> = {
      '/account/settings': 'settings',
      '/account/analytics': 'analytics',
    };
    
    // Redirect to home page, preserving query params (e.g., session_id from Stripe)
    const redirectUrl = new URL('/', req.url);
    req.nextUrl.searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });
    
    return NextResponse.redirect(redirectUrl);
  }

  // Block draft/unpublished routes in production (if enabled)
  if (isDraftRoute(pathname)) {
    // Always allow in development if configured
    if (process.env.NODE_ENV === 'development' && DRAFT_CONFIG.allowInDevelopment) {
      // Allow access in development
    } else if (DRAFT_CONFIG.blockInProduction && process.env.NODE_ENV === 'production') {
      // Block in production if enabled
      return NextResponse.redirect(new URL('/', req.url));
    }
  }
  
  const protection = matchesProtectedRoute(pathname);

  // Always refresh session for API routes to ensure cookies are set
  // This is critical for authenticated API calls
  const isApiRoute = pathname.startsWith('/api/');

  // Create Supabase client to refresh session
  // Use getAll() pattern like other server-side code to ensure cookies are read correctly
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[middleware] Missing Supabase environment variables');
    return response;
  }
  
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
            });
          });
        },
      },
    }
  );

  // Refresh session for API routes (this ensures cookies are set)
  if (isApiRoute) {
    await supabase.auth.getUser();
    return response;
  }

  // Get session and refresh if needed (getUser triggers refresh, getSession does not)
  // This helps keep sessions alive across requests
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // Check system visibility (if system visibility is enabled)
  // IMPORTANT: This must run AFTER user is fetched so userId is available
  // Note: This requires the system_visibility tables to exist
  // Skip for API routes, static assets, and homepage (homepage is always accessible)
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/_next/') && pathname !== '/') {
    try {
      const { isRouteVisible, getSystemForRoute } = await import('@/lib/admin/systemVisibility');
      const routeVisible = await isRouteVisible(pathname, user?.id || undefined);
      
      if (!routeVisible) {
        // Route is hidden by system visibility settings
        // Get system name to show in toast (using optimized database function)
        const system = await getSystemForRoute(pathname);
        const systemName = system?.system_name || 'This feature';
        const redirectUrl = new URL('/', req.url);
        redirectUrl.searchParams.set('blocked', encodeURIComponent(systemName));
        return NextResponse.redirect(redirectUrl);
      }
    } catch (error) {
      // System visibility check failed - fail closed for safety
      // Block the route unless we're in development and the error suggests the system isn't set up
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isSetupError = errorMessage.includes('does not exist') || 
                          errorMessage.includes('relation') ||
                          errorMessage.includes('schema');
      
      if (process.env.NODE_ENV === 'development' && isSetupError) {
        // In dev, only skip if it's clearly a setup issue (missing tables/functions)
        console.warn('[middleware] System visibility check failed (setup issue):', error);
      } else {
        // Production or non-setup errors: block the route
        console.error('[middleware] System visibility check failed, blocking route:', error);
        return NextResponse.redirect(new URL('/', req.url));
      }
    }
  }

  // ALLOWED ROUTES FOR NON-AUTHENTICATED USERS
  // Homepage, live map, mention detail pages, and profile pages are accessible without auth
  const isAllowedRouteForAnonymous = (() => {
    // Homepage is always allowed
    if (pathname === '/') return true;
    
    // Maps page (shows live map) is allowed for all users
    if (pathname === '/maps') return true;
    
    // Gov, weather, and news are public
    if (pathname === '/gov' || pathname.startsWith('/gov/')) return true;
    if (pathname === '/weather' || pathname.startsWith('/weather/')) return true;
    if (pathname === '/news' || pathname.startsWith('/news/')) return true;
    // Explore (civic dashboard, counties, cities, etc.) is public
    if (pathname === '/explore' || pathname.startsWith('/explore/')) return true;
    
    // Mention detail pages are allowed
    if (pathname.startsWith('/mention/')) {
      const mentionId = pathname.split('/mention/')[1]?.split('/')[0];
      if (mentionId && mentionId.length > 0) {
        return true;
      }
    }
    
    // Profile pages (username routes) are allowed
    // Check if pathname matches pattern: /[username] (single segment, not starting with known routes)
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 1) {
      const firstSegment = segments[0];
      // Exclude known routes that aren't usernames
      const excludedRoutes = [
        'map', 'maps', 'settings', 'news', 'gov', 'explore', 'analytics',
        'billing', 'admin', 'login', 'signup', 'onboarding',
        'contact', 'privacy', 'terms', 'download', 'api', '_next', 'favicon.ico'
      ];
      if (!excludedRoutes.includes(firstSegment.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  })();

  // REDIRECT NON-AUTHENTICATED USERS TO HOMEPAGE
  // Only allow homepage, live map, mention pages, and profile pages for logged-out users
  if (!user && !isAllowedRouteForAnonymous) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // ONBOARDING CHECK: First priority for authenticated users
  // Check onboarding status before any other checks
  // Allow /onboarding route to be accessible (prevents redirect loops)
  if (user && pathname !== '/onboarding') {
    const accountData = await getUserAccountData(supabase, user.id, req);
    
    // If account is not onboarded (onboarded = false), redirect to onboarding page
    if (accountData && accountData.onboarded === false) {
      const redirectUrl = new URL('/onboarding', req.url);
      // Preserve redirect parameter if present
      const redirectParam = req.nextUrl.searchParams.get('redirect');
      if (redirectParam) {
        redirectUrl.searchParams.set('redirect', redirectParam);
      }
      return NextResponse.redirect(redirectUrl);
    }
  }

  // No protection needed for this route
  if (!protection) {
    return response;
  }

  // Check authentication requirement for protected routes
  // Only redirect if there's actually no user
  // If user exists, allow access even if there was an auth error (might be session refresh issue)
  if (protection.auth && !user) {
    // Log auth errors for debugging
    if (authError) {
      const errorMessage = authError.message || '';
      const isSessionError = errorMessage.includes('session') || 
                            errorMessage.includes('Session') ||
                            errorMessage.includes('Auth session missing');
      
      // Only log non-session auth errors in development to avoid exposing auth issues
      if (!isSessionError && process.env.NODE_ENV === 'development') {
        console.warn('[middleware] Auth error:', authError.message);
      }
    }
    
    // Preserve full URL including query parameters (e.g., ?plan=slug)
    const fullPath = pathname + (req.nextUrl.search || '');
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('redirect', fullPath);
    redirectUrl.searchParams.set('message', 'Please sign in to access this page');
    return NextResponse.redirect(redirectUrl);
  }

  // Get account data if we need role check
  // Note: Onboarding check is handled above for all authenticated users
  let accountData: { role: AccountRole | null; onboarded: boolean | null; isComplete: boolean } | null = null;
  
  if (user && protection?.auth) {
    accountData = await getUserAccountData(supabase, user.id, req);
  }

  // Check role requirement
  if (protection.roles && protection.roles.length > 0 && user && accountData) {
    if (!accountData.role || !protection.roles.includes(accountData.role)) {
      const redirectUrl = new URL('/', req.url);
      redirectUrl.searchParams.set('message', `Access denied. Required role: ${protection.roles.join(' or ')}`);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Update last_visit for authenticated users (except for static assets and API routes)
  if (user && protection?.auth && !pathname.startsWith('/api/') && !pathname.startsWith('/_next/')) {
    // Update last_visit asynchronously (don't block response)
    // Use void to explicitly ignore the promise result
    void (async () => {
      try {
        // Type assertion needed due to incomplete Supabase type definitions
        const updateQuery = supabase
          .from('accounts')
          .update({ last_visit: new Date().toISOString() } as never)
          .eq('user_id', user.id);
        await (updateQuery as unknown as Promise<unknown>);
      } catch (error) {
        // Log but don't fail request
        console.error('Failed to update last_visit:', error);
      }
    })();
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/stripe/webhook (Stripe webhook - excluded to prevent redirects)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api/stripe/webhook).*)',
  ],
};
