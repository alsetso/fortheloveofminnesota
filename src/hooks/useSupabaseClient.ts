'use client';

import { useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

/**
 * Shared Supabase client hook for browser components
 * Creates a single client instance per component tree with cookie handlers
 * for proper auth state synchronization between client and server
 */
export function useSupabaseClient() {
  return useMemo(
    () => createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
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
    }),
    []
  );
}

