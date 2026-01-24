/**
 * Least-privilege access control utilities
 * Provides helpers for verifying authentication and authorization
 */

import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { Database } from '@/types/supabase';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

export interface AccessControlResult {
  allowed: boolean;
  error?: Response;
  userId?: string;
  accountId?: string;
  role?: 'general' | 'admin';
}

/**
 * Require authentication
 * @param cookieStore Optional cookie store (for API routes, pass request.cookies or cookies() from next/headers)
 */
export async function requireAuth(
  cookieStore?: ReturnType<typeof cookies> | Promise<ReturnType<typeof cookies>> | ReadonlyRequestCookies
): Promise<
  | { success: true; userId: string; accountId?: string }
  | { success: false; error: Response }
> {
  try {
    // Don't use getServerAuth() in API routes - it uses React cache()
    // Instead, directly get the user from Supabase
    // Use provided cookie store or get from next/headers
    const cookieStoreToUse = cookieStore || await cookies();
    
    const supabase = await createServerClientWithAuth(cookieStoreToUse);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
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
    
    // Get active account ID from cookie (set by client when switching accounts)
    let activeAccountId: string | null = null;
    
    // Handle both ReadonlyRequestCookies (from NextRequest) and cookies() return type
    try {
      const resolvedCookies = await Promise.resolve(cookieStoreToUse);
      const activeAccountIdCookie = resolvedCookies.get('active_account_id');
      activeAccountId = activeAccountIdCookie?.value || null;
    } catch (_error) {
      // If cookie access fails, continue without active account ID
      // Silent fail - will fall back to first account
    }
    
    let accountId: string | undefined;
    
    if (activeAccountId) {
      // Verify the active account belongs to this user before using it
      const { data: activeAccount, error: activeAccountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', activeAccountId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (activeAccount && !activeAccountError) {
        const account = activeAccount as { id: string } | null;
        if (account) {
          accountId = account.id;
        }
      }
    }
    
    // If no active account ID or verification failed, get first account
    if (!accountId) {
      const result = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      
      const account = result.data as { id: string } | null;
      accountId = account?.id ?? undefined;
    }
    
    return {
      success: true,
      userId: user.id,
      accountId,
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
 * @param cookieStore Optional cookie store (for API routes, pass request.cookies or cookies() from next/headers)
 */
export async function requireAdmin(
  cookieStore?: ReturnType<typeof cookies> | Promise<ReturnType<typeof cookies>> | ReadonlyRequestCookies
): Promise<
  | { success: true; userId: string; accountId: string }
  | { success: false; error: Response }
> {
  // Use provided cookie store or get from next/headers
  const cookieStoreToUse = cookieStore || await cookies();
  
  const authResult = await requireAuth(cookieStoreToUse);
  
  if (!authResult.success) {
    return authResult;
  }
  
  try {
    const supabase = await createServerClientWithAuth(cookieStoreToUse);
    
    // First, try to use the accountId from requireAuth (from active_account_id cookie)
    if (authResult.accountId) {
      const { data: accountData, error: accountError } = await supabase
        .from('accounts')
        .select('id, role')
        .eq('id', authResult.accountId)
        .maybeSingle();
      
      const account = accountData as { id: string; role: 'general' | 'admin' } | null;
      
      if (account && !accountError) {
        if (account.role === 'admin') {
          return {
            success: true,
            userId: authResult.userId,
            accountId: account.id,
          };
        } else {
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
      }
    }
    
    // Fallback: Look up account by user_id
    const result = await supabase
      .from('accounts')
      .select('id, role')
      .eq('user_id', authResult.userId)
      .maybeSingle();
    
    const account = result.data as { id: string; role: 'general' | 'admin' } | null;
    
    // If account not found for this user, try to get first admin account as fallback
    if (!account || !account.id || !account.role) {
      const { data: adminAccount, error: adminError } = await supabase
        .from('accounts')
        .select('id, role')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();
      
      const admin = adminAccount as { id: string; role: 'general' | 'admin' } | null;
      if (admin && !adminError && admin.role === 'admin') {
        return {
          success: true,
          userId: authResult.userId,
          accountId: admin.id,
        };
      }
      
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
      .from(resourceTable as string)
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

    const activeAccountId = (await cookieStore).get('active_account_id')?.value || null;

    let accountId: string | null = null;

    if (activeAccountId) {
      const { data: active, error } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', activeAccountId)
        .eq('user_id', auth.id)
        .maybeSingle();

      if (!error && active) {
        accountId = (active as { id: string }).id;
      }
    }

    if (!accountId) {
      const { data: fallback } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', auth.id)
        .limit(1)
        .maybeSingle();

      accountId = fallback ? (fallback as { id: string }).id : null;
    }
    
    return {
      userId: auth.id,
      accountId,
    };
  } catch {
    return { userId: null, accountId: null };
  }
}

