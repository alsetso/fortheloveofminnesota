import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/types/supabase';
import type { AccountRole } from '@/features/auth/services/memberService';

// Route protection configuration
const ROUTE_PROTECTION: Record<string, { 
  auth: boolean; 
  roles?: AccountRole[];
}> = {
  '/account/settings': { auth: true },
  '/account/billing': { auth: true },
  '/map-test': { auth: true },
  '/admin': { auth: true, roles: ['admin'] },
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
 */
async function getUserAccountData(
  supabase: ReturnType<typeof createServerClient>, 
  userId: string
): Promise<{
  role: AccountRole | null;
  onboarded: boolean | null;
  isComplete: boolean;
}> {
  // Try to get account role, onboarded status, and username (only field needed for completion)
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('role, onboarded, username')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

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
  const response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // HSTS - only in production with HTTPS
  if (process.env.NODE_ENV === 'production' && req.nextUrl.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy - basic policy (can be customized per route)
  // Note: This is a basic CSP. You may need to adjust based on your specific needs
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // 'unsafe-inline' needed for Next.js
    "worker-src 'self' blob:", // Mapbox uses blob URLs for Web Workers
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Google Fonts + Tailwind
    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com", // Google Fonts stylesheets
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com", // Google Fonts fonts
    "connect-src 'self' https://*.supabase.co https://*.mapbox.com https://api.mapbox.com",
    "frame-ancestors 'none'",
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);

  const pathname = req.nextUrl.pathname;
  
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
      '/account/billing': 'billing',
      '/account/analytics': 'analytics',
      '/account/change-plan': 'billing', // change-plan opens billing tab
    };
    
    const tab = accountRouteMap[pathname] || 'settings';
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('modal', 'account');
    redirectUrl.searchParams.set('tab', tab);
    
    // Preserve query params (e.g., session_id from Stripe)
    req.nextUrl.searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });
    
    return NextResponse.redirect(redirectUrl);
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

  // MIDDLEWARE ONLY HANDLES AUTHENTICATION, NOT ONBOARDING
  // Onboarding checks are handled at the page level to prevent redirect loops
  // This simplifies the flow and makes it easier to debug

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
    
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('modal', 'account');
    redirectUrl.searchParams.set('tab', 'settings');
    redirectUrl.searchParams.set('redirect', pathname);
    redirectUrl.searchParams.set('message', 'Please sign in to access this page');
    return NextResponse.redirect(redirectUrl);
  }

  // Get account data if we need role check or onboarding check
  let accountData: { role: AccountRole | null; onboarded: boolean | null; isComplete: boolean } | null = null;
  
  if (user && protection?.auth) {
    accountData = await getUserAccountData(supabase, user.id);
    
    // Check account completeness for protected routes
    // Source of truth: isComplete checks actual data (username, first_name, last_name, image_url)
    // Redirect to home with onboarding modal if account is incomplete
    if (accountData && !accountData.isComplete) {
      const redirectUrl = new URL('/', req.url);
      redirectUrl.searchParams.set('modal', 'onboarding');
      return NextResponse.redirect(redirectUrl);
    }
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
        await (supabase
          .from('accounts')
          .update({ last_visit: new Date().toISOString() } as any)
          .eq('user_id', user.id) as any);
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
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
