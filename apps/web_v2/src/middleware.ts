import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  isAnonymousAllowedPath,
  isSignedInMapPath,
  CAMPAIGN_PATH,
  GAME_PATH,
  LOGGED_IN_HOME_PATH,
  MAP_PATH,
  SETUP_PATH,
  STORY_PATH,
  WELCOME_PATH,
} from '@/lib/routes/routePolicy';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // The static homepage is public and does not need an auth round trip.
  if (request.nextUrl.pathname === '/') return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Retired map URLs → product Map tab (/game).
  if (
    pathname === STORY_PATH ||
    pathname.startsWith(`${STORY_PATH}/`) ||
    pathname === CAMPAIGN_PATH ||
    pathname.startsWith(`${CAMPAIGN_PATH}/`) ||
    pathname === MAP_PATH ||
    pathname.startsWith(`${MAP_PATH}/`)
  ) {
    const dest = request.nextUrl.clone();
    dest.pathname = GAME_PATH;
    dest.search = '';
    return NextResponse.redirect(dest);
  }

  // World maps are client-gated. WKWebView (Despia) often has a session in
  // the JS client before cookies land on this request — bouncing map routes
  // to /welcome here loops with the splash and crashes the shell.
  if (
    !user &&
    !isAnonymousAllowedPath(pathname) &&
    !isSignedInMapPath(pathname)
  ) {
    const dest = request.nextUrl.clone();
    dest.pathname = WELCOME_PATH;
    dest.search = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
    return NextResponse.redirect(dest);
  }

  if (user && (pathname === WELCOME_PATH || pathname === '/login' || pathname === '/signup')) {
    const dest = request.nextUrl.clone();
    // Completeness is client-gated. Send signed-in users to Feed — splash
    // still routes incomplete / unselected accounts to /setup.
    dest.pathname = LOGGED_IN_HOME_PATH;
    dest.search = '';
    return NextResponse.redirect(dest);
  }

  if (!user && pathname === SETUP_PATH) {
    const dest = request.nextUrl.clone();
    dest.pathname = WELCOME_PATH;
    dest.search = '';
    return NextResponse.redirect(dest);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
