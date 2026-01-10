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

// Use SSR-compatible browser client for proper auth handling in Next.js App Router
// Configure with auto-refresh to prevent token expiration issues
// Include x-guest-id header for RLS policies to verify guest ownership
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
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
      
      // Supabase uses token-based auth (not cookies), so we don't need credentials
      // Only use credentials for same-origin API routes (handled separately)
      // The service worker already skips cross-origin Supabase requests
      // Explicitly remove credentials to avoid CORS issues with Supabase
      const { credentials, ...restOptions } = options;
      return fetch(url, { 
        ...restOptions, 
        headers,
        credentials: 'omit', // Explicitly omit credentials for Supabase (uses tokens, not cookies)
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