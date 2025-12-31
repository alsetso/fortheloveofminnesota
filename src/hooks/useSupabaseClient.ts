'use client';

import { useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Shared Supabase client hook for browser components
 * Creates a single client instance per component tree
 */
export function useSupabaseClient() {
  return useMemo(
    () => createBrowserClient<Database>(supabaseUrl, supabaseAnonKey),
    []
  );
}

