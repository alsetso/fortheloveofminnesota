/**
 * Server-side Supabase clients for SSR, SSG, ISR, and Route Handlers
 * 
 * - createServerClient: anon client for public reads (RLS-protected)
 * - createServerClientWithAuth: client with user session from cookies (for RLS with auth)
 * - createServiceClient: service role for build-time operations and admin writes
 */

import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSRClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

/**
 * Server client with anonymous key (RLS-protected)
 * Use for public read operations in SSR/SSG
 * Does NOT include user session - use createServerClientWithAuth() for authenticated operations
 */
export function createServerClient() {
  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Server client with user session from cookies (for RLS with authentication)
 * Use for authenticated operations where RLS policies need to check auth.uid()
 * This is required for admin operations that rely on RLS policies
 * 
 * Uses the same pattern as getServerAuth() to ensure consistency
 * 
 * @param cookieStore Optional cookie store (for API routes, pass request cookies)
 */
export async function createServerClientWithAuth(cookieStore?: ReturnType<typeof cookies>) {
  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }

  // Use provided cookie store or get from next/headers
  const cookieStoreToUse = cookieStore || await cookies();

  // Use createServerClient from @supabase/ssr for cookie-based auth
  return createSSRClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStoreToUse.getAll();
        },
        setAll() {
          // Server components can't set cookies - no-op
        },
      },
    }
  );
}

/**
 * Service client with service role key (bypasses RLS)
 * Use for build-time operations, admin writes, and secure server actions
 * NEVER expose to client-side code
 */
export function createServiceClient() {
  // Check at runtime, not just module load time
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment');
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }

  // Verify service key format (should start with eyJ for JWT)
  if (!serviceKey.startsWith('eyJ') && !serviceKey.startsWith('sb_')) {
    console.warn('Service role key format may be incorrect');
  }

  const client = createClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // Verify client is using service role (service role bypasses RLS)
  // The key itself determines if RLS is bypassed - no additional config needed
  
  return client;
}

