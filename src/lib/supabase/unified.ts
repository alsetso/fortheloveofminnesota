/**
 * Unified Supabase Client Factory
 * Single source of truth for creating Supabase clients
 * Replaces: createServerClient, createServerClientWithAuth, createServiceClient
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';
import type { NextRequest } from 'next/server';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

interface SupabaseClientOptions {
  /** Include user session from cookies (for RLS with auth) */
  auth?: boolean;
  /** Use service role key (bypasses RLS) */
  service?: boolean;
  /** Cookie store (for API routes) */
  cookieStore?: ReturnType<typeof cookies> | Promise<ReturnType<typeof cookies>> | ReadonlyRequestCookies;
}

/**
 * Unified Supabase client factory
 * 
 * @example
 * // Anonymous client (public reads, RLS-protected)
 * const client = createSupabaseClient();
 * 
 * @example
 * // Authenticated client (includes user session)
 * const client = await createSupabaseClient({ auth: true });
 * 
 * @example
 * // Service client (bypasses RLS, admin only)
 * const client = createSupabaseClient({ service: true });
 */
export async function createSupabaseClient(options: SupabaseClientOptions = {}): Promise<SupabaseClient<Database>> {
  const { auth = false, service = false, cookieStore } = options;

  // Service role client (bypasses RLS)
  if (service) {
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }
    return createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  // Anonymous client (no auth)
  if (!auth) {
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

  // Authenticated client (with user session from cookies)
  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  let cookieStoreToUse: ReturnType<typeof cookies> | ReadonlyRequestCookies;
  if (cookieStore) {
    // Check if it's NextRequest.cookies (ReadonlyRequestCookies - has getAll method directly)
    if ('getAll' in cookieStore && typeof cookieStore.getAll === 'function' && !('set' in cookieStore)) {
      cookieStoreToUse = cookieStore as ReadonlyRequestCookies;
    } else {
      cookieStoreToUse = await Promise.resolve(cookieStore as ReturnType<typeof cookies>);
    }
  } else {
    cookieStoreToUse = await cookies();
  }

  return createSSRClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStoreToUse.getAll();
      },
      setAll() {
        // Server components can't set cookies
      },
    },
  });
}

/**
 * Legacy exports for backward compatibility
 * @deprecated Use createSupabaseClient() instead
 */
export async function createServerClient() {
  return createSupabaseClient({ auth: false });
}

export async function createServerClientWithAuth(
  cookieStore?: ReturnType<typeof cookies> | Promise<ReturnType<typeof cookies>> | ReadonlyRequestCookies
) {
  return createSupabaseClient({ auth: true, cookieStore });
}

export function createServiceClient() {
  return createSupabaseClient({ service: true });
}
