/**
 * Least-privilege access control utilities
 * Provides helpers for verifying authentication and authorization
 */

import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { Database } from '@/types/supabase';

export interface AccessControlResult {
  allowed: boolean;
  error?: Response;
  userId?: string;
  accountId?: string;
  role?: 'general' | 'admin';
}

/**
 * Require authentication
 */
export async function requireAuth(): Promise<
  | { success: true; userId: string; accountId?: string }
  | { success: false; error: Response }
> {
  try {
    const auth = await getServerAuth();
    
    if (!auth) {
      return {
        success: false,
        error: new Response(
          JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
      };
    }
    
    // Get account ID
    const cookieStore = cookies();
    const supabase = await createServerClientWithAuth(cookieStore);
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', auth.id)
      .maybeSingle();
    
    return {
      success: true,
      userId: auth.id,
      accountId: account?.id,
    };
  } catch (error) {
    return {
      success: false,
      error: new Response(
        JSON.stringify({
          error: 'Authentication failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }
}

/**
 * Require admin role
 */
export async function requireAdmin(): Promise<
  | { success: true; userId: string; accountId: string }
  | { success: false; error: Response }
> {
  const authResult = await requireAuth();
  
  if (!authResult.success) {
    return authResult;
  }
  
  try {
    const cookieStore = cookies();
    const supabase = await createServerClientWithAuth(cookieStore);
    const { data: account } = await supabase
      .from('accounts')
      .select('id, role')
      .eq('user_id', authResult.userId)
      .maybeSingle();
    
    if (!account) {
      return {
        success: false,
        error: new Response(
          JSON.stringify({ error: 'Account not found' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
      };
    }
    
    if (account.role !== 'admin') {
      return {
        success: false,
        error: new Response(
          JSON.stringify({
            error: 'Forbidden',
            message: 'Admin role required',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
      };
    }
    
    return {
      success: true,
      userId: authResult.userId,
      accountId: account.id,
    };
  } catch (error) {
    return {
      success: false,
      error: new Response(
        JSON.stringify({
          error: 'Authorization check failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }
}

/**
 * Require resource ownership
 */
export async function requireOwnership(
  resourceTable: keyof Database['public']['Tables'],
  resourceId: string,
  ownerColumn: 'user_id' | 'account_id' = 'account_id'
): Promise<
  | { success: true; userId: string; accountId: string }
  | { success: false; error: Response }
> {
  const authResult = await requireAuth();
  
  if (!authResult.success) {
    return authResult;
  }
  
  try {
    const cookieStore = cookies();
    const supabase = await createServerClientWithAuth(cookieStore);
    
    // Get resource owner
    const { data: resource, error } = await supabase
      .from(resourceTable)
      .select(ownerColumn)
      .eq('id', String(resourceId))
      .maybeSingle();
    
    if (error || !resource) {
      return {
        success: false,
        error: new Response(
          JSON.stringify({ error: 'Resource not found' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
      };
    }
    
    // Check ownership
    const ownerId = resource[ownerColumn];
    const userAccountId = authResult.accountId;
    
    if (ownerColumn === 'account_id' && ownerId !== userAccountId) {
      return {
        success: false,
        error: new Response(
          JSON.stringify({
            error: 'Forbidden',
            message: 'You do not have permission to access this resource',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
      };
    }
    
    if (ownerColumn === 'user_id' && ownerId !== authResult.userId) {
      return {
        success: false,
        error: new Response(
          JSON.stringify({
            error: 'Forbidden',
            message: 'You do not have permission to access this resource',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        ),
      };
    }
    
    return {
      success: true,
      userId: authResult.userId,
      accountId: authResult.accountId || '',
    };
  } catch (error) {
    return {
      success: false,
      error: new Response(
        JSON.stringify({
          error: 'Ownership check failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }
}

/**
 * Optional authentication (returns user if authenticated, null otherwise)
 */
export async function optionalAuth(): Promise<{
  userId: string | null;
  accountId: string | null;
}> {
  try {
    const auth = await getServerAuth();
    
    if (!auth) {
      return { userId: null, accountId: null };
    }
    
    const cookieStore = cookies();
    const supabase = await createServerClientWithAuth(cookieStore);
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', auth.id)
      .maybeSingle();
    
    return {
      userId: auth.id,
      accountId: account?.id || null,
    };
  } catch {
    return { userId: null, accountId: null };
  }
}

