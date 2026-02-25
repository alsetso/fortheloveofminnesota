/**
 * System Visibility Control
 * 
 * Controls which database schemas/systems are accessible to users.
 * Maps schemas to routes and allows admin control over system visibility.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

export interface SystemVisibility {
  id: string;
  schema_name: string;
  system_name: string;
  primary_route: string;
  is_visible: boolean;
  is_enabled: boolean;
  requires_feature: string | null;
  description: string | null;
  icon: string | null;
  display_order: number;
}

export interface RouteVisibility {
  id: string;
  route_path: string;
  system_id: string;
  is_visible: boolean;
  requires_feature: string | null;
  description: string | null;
}

/**
 * Check if a system (schema) is visible to users
 */
export async function isSystemVisible(schemaName: string): Promise<boolean> {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return true; // Default to visible if Supabase not configured
  }
  
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server components can't set cookies
        },
      },
    }
  );
  
  const { data, error } = await supabase
    .from('system_visibility')
    .select('is_visible, is_enabled')
    .eq('schema_name', schemaName)
    .single() as { data: { is_visible?: boolean; is_enabled?: boolean } | null; error: unknown };
  
  if (error || !data) {
    return true; // Default to visible if not found
  }
  
  return Boolean(data.is_visible && data.is_enabled);
}

/**
 * Check if a specific route is visible
 * Checks route-level visibility first, then falls back to system-level
 * 
 * IMPORTANT: Homepage ('/') is ALWAYS visible regardless of system settings
 */
export async function isRouteVisible(routePath: string, userId?: string): Promise<boolean> {
  // Homepage is ALWAYS accessible - critical for system shutdown scenarios
  if (routePath === '/') {
    return true;
  }
  
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return true;
  }
  
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server components can't set cookies
        },
      },
    }
  );
  
  // Use database function for route visibility check
  const { data, error } = await (supabase.rpc as any)('is_route_visible', {
    route_path: routePath,
    user_id: userId || null,
  });
  
  if (error) {
    console.error('Error checking route visibility:', error);
    // Fail closed: if we can't check visibility, block the route for safety
    // This ensures disabled systems stay disabled even if there's a database error
    return false;
  }
  
  return data === true;
}

/**
 * Get all visible systems for current user
 */
export async function getVisibleSystems(userId?: string): Promise<SystemVisibility[]> {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return [];
  }
  
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server components can't set cookies
        },
      },
    }
  );
  
  // Use database function to get visible systems
  const { data, error } = await (supabase.rpc as any)('get_visible_systems', {
    user_id: userId || null,
  });
  
  if (error) {
    console.error('Error getting visible systems:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Get system for a route path (OPTIMIZED)
 * Uses database function for single-query matching instead of fetching all systems
 */
export async function getSystemForRoute(routePath: string): Promise<SystemVisibility | null> {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server components can't set cookies
        },
      },
    }
  );
  
  // Use optimized database function (single query with priority ordering)
  const { data, error } = await (supabase.rpc as any)('get_system_for_route', {
    p_route_path: routePath,
  });
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  // Function returns array, take first result
  return data[0] as SystemVisibility;
}
