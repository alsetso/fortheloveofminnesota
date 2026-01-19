import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const GUEST_ID_KEY = 'guest_id';

/**
 * Get guest ID from localStorage (browser only)
 * Returns null on server or if not set
 */
function getGuestId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(GUEST_ID_KEY);
}

/**
 * Cookie helper functions for browser client
 * These sync cookies between client and server for proper auth persistence
 */
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

function setCookie(name: string, value: string, options: { maxAge?: number; path?: string; sameSite?: string | boolean } = {}) {
  if (typeof document === 'undefined') return;
  const { maxAge = 31536000, path = '/' } = options;
  const sameSite = typeof options.sameSite === 'string' ? options.sameSite : options.sameSite === true ? 'Strict' : 'Lax';
  document.cookie = `${name}=${value}; path=${path}; max-age=${maxAge}; SameSite=${sameSite}`;
}

function deleteCookie(name: string, options: { path?: string } = {}) {
  if (typeof document === 'undefined') return;
  const { path = '/' } = options;
  document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 UTC`;
}

// Use SSR-compatible browser client for proper auth handling in Next.js App Router
// Configure with auto-refresh and cookie handlers to sync auth state between client and server
// Include x-guest-id header for RLS policies to verify guest ownership
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  cookies: {
    getAll() {
      if (typeof document === 'undefined') return [];
      const cookies = document.cookie.split(';').map(cookie => {
        const [name, ...rest] = cookie.trim().split('=');
        return { name, value: rest.join('=') };
      });
      return cookies;
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        if (value) {
          const sameSite = options?.sameSite 
            ? (typeof options.sameSite === 'string' ? options.sameSite : 'Strict')
            : 'Lax';
          setCookie(name, value, {
            maxAge: options?.maxAge,
            path: options?.path || '/',
            sameSite,
          });
        } else {
          deleteCookie(name, { path: options?.path || '/' });
        }
      });
    },
  },
  global: {
    headers: {
      // Note: This is a static header set at client creation time.
      // For dynamic guest ID, we use the custom fetch below.
    },
    fetch: (url, options = {}) => {
      const guestId = getGuestId();
      const headers = new Headers(options.headers);
      
      // Add x-guest-id header for RLS policies
      if (guestId) {
        headers.set('x-guest-id', guestId);
      }
      
      // Use 'include' for same-origin requests to allow cookie transmission
      // For cross-origin Supabase requests, cookies are handled via the Authorization header
      // but we still need credentials for cookie-based session management
      const isSameOrigin = typeof url === 'string' 
        ? new URL(url, window.location.origin).origin === window.location.origin
        : url instanceof URL && url.origin === window.location.origin;
      
      return fetch(url, { 
        ...options, 
        headers,
        credentials: isSameOrigin ? 'include' : 'same-origin',
      });
    },
  },
});

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }
  return user;
};