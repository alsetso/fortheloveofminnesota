import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { AccountRole } from '@/features/auth/services/memberService';
import { Database } from '@/types/supabase';
import { measureAuthCheck } from '@/lib/performance';

export interface ServerAuthUser {
  id: string;
  email: string;
  role: AccountRole | null;
  name: string | null;
}

/**
 * Get the current authenticated user's auth and role information
 * Uses React cache() to deduplicate requests within the same render
 * Returns null if user is not authenticated
 * 
 * This is the primary function to use in server components for checking auth/role
 */
export const getServerAuth = cache(async (): Promise<ServerAuthUser | null> => {
  return measureAuthCheck(async () => {
    const cookieStore = await cookies();
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
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
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return null;
    }

    // Get account role - query by user_id (accounts.id is a separate UUID, user_id references auth.users)
    const { data: accountData, error: accountError } = await supabase
      .from('accounts')
      .select('role, first_name, last_name')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (accountError) {
      console.error('Error fetching account:', accountError);
      // User exists in auth but not in accounts table - return user without role
      return {
        id: user.id,
        email: user.email || '',
        role: null,
        name: user.user_metadata?.name || null,
      };
    }

    if (!accountData) {
      // User exists in auth but not in accounts table - return user without role
      return {
        id: user.id,
        email: user.email || '',
        role: null,
        name: user.user_metadata?.name || null,
      };
    }

    // Type assertion to help TypeScript understand the account structure
    const account: { role: unknown; first_name: string | null; last_name: string | null } = accountData;

    // Ensure role is a string (PostgreSQL enums can sometimes be returned differently)
    // Handle both string and enum types from PostgreSQL
    let roleValue: string;
    if (typeof account.role === 'string') {
      roleValue = account.role.toLowerCase().trim();
    } else {
      // If it's an object (PostgreSQL enum), extract the value
      roleValue = String(account.role).toLowerCase().trim();
    }
    
    // Validate role is one of the expected values
    const validRoles: AccountRole[] = ['general', 'admin'];
    const normalizedRole: AccountRole | null = validRoles.includes(roleValue as AccountRole) 
      ? (roleValue as AccountRole) 
      : null;
    
    // Debug logging for role normalization (only log if there's an issue)
    if (!normalizedRole && account.role) {
      console.warn('Role normalization issue:', {
        original: account.role,
        originalType: typeof account.role,
        normalized: normalizedRole,
        roleValue,
        userId: user.id,
        email: user.email,
      });
    }

    // Construct name from first_name and last_name
    const name = account.first_name || account.last_name
      ? `${account.first_name || ''} ${account.last_name || ''}`.trim()
      : null;

    return {
      id: user.id,
      email: user.email || '',
      role: normalizedRole,
      name,
    };
  });
});

/**
 * Get the current user's role only
 * Convenience function that returns just the role
 */
export const getServerRole = cache(async (): Promise<AccountRole | null> => {
  const auth = await getServerAuth();
  return auth?.role || null;
});

/**
 * Check if the current user is an admin
 * Convenience function for admin checks
 */
export const isServerAdmin = cache(async (): Promise<boolean> => {
  const auth = await getServerAuth();
  return auth?.role === 'admin';
});

/**
 * Require authentication - throws/redirects if not authenticated
 * Use in server components that require auth
 */
export async function requireServerAuth(): Promise<ServerAuthUser> {
  const auth = await getServerAuth();
  
  if (!auth) {
    // In server components, we can't redirect directly
    // The calling component should handle the redirect
    throw new Error('UNAUTHENTICATED');
  }
  
  return auth;
}

/**
 * Require admin role - throws if not admin
 * Use in server components that require admin
 */
export async function requireServerAdmin(): Promise<ServerAuthUser> {
  const auth = await requireServerAuth();
  
  if (auth.role !== 'admin') {
    throw new Error('UNAUTHORIZED');
  }
  
  return auth;
}

