/**
 * Schema-to-System Mapping Utility
 * 
 * Enforces consistent mapping between database schemas and admin systems.
 * Ensures all queries use correct schema based on system visibility.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';
import type { SystemVisibility } from './systemVisibility';

/**
 * Get schema name for a system
 * Returns the schema_name from admin.system_visibility
 */
export async function getSchemaForSystem(systemName: string): Promise<string | null> {
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
  
  const { data, error } = await (supabase.rpc as any)('get_schema_for_system', {
    p_system_name: systemName,
  });
  
  if (error || !data) {
    return null;
  }
  
  return data as string;
}

/**
 * Get system for a schema name
 * Returns the system from admin.system_visibility where schema_name matches
 */
export async function getSystemForSchema(schemaName: string): Promise<SystemVisibility | null> {
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
  
  const { data, error } = await (supabase.rpc as any)('get_system_for_schema', {
    p_schema_name: schemaName,
  });
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  return data[0] as SystemVisibility;
}

/**
 * Check if a schema is accessible (system is visible and enabled)
 */
export async function isSchemaAccessible(schemaName: string, userId?: string): Promise<boolean> {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return true; // Default to accessible if Supabase not configured
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
  
  const { data, error } = await (supabase.rpc as any)('is_schema_accessible', {
    p_schema_name: schemaName,
    p_user_id: userId || null,
  });
  
  if (error) {
    console.error('Error checking schema accessibility:', error);
    return true; // Default to accessible on error (backward compatibility)
  }
  
  return data === true;
}

/**
 * Get all accessible schemas for a user
 */
export async function getAccessibleSchemas(userId?: string): Promise<string[]> {
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
  
  const { data, error } = await (supabase.rpc as any)('get_accessible_schemas', {
    p_user_id: userId || null,
  });
  
  if (error) {
    console.error('Error getting accessible schemas:', error);
    return [];
  }
  
  return (data || []).map((row: { schema_name: string }) => row.schema_name);
}
