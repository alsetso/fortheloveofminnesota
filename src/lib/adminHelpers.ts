import { getServerAuth, requireServerAdmin } from '@/lib/authServer';
import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Check admin access in server components
 * Redirects if not admin
 */
export async function requireAdminAccess() {
  const auth = await getServerAuth();
  
  if (!auth) {
    redirect('/?modal=account&tab=settings&redirect=/admin&message=Please sign in to access admin panel');
  }
  
  if (auth.role !== 'admin') {
    redirect('/?message=Access denied. Admin privileges required.');
  }
  
  return auth;
}

/**
 * Check admin access in API routes
 * Returns 403 response if not admin, or { auth, response: null } if authorized
 */
export async function requireAdminApiAccess(_request: NextRequest): Promise<{ auth: Awaited<ReturnType<typeof getServerAuth>>; response: null } | { auth: null; response: NextResponse }> {
  const auth = await getServerAuth();
  
  if (!auth || auth.role !== 'admin') {
    return {
      auth: null,
      response: NextResponse.json(
        { error: 'Unauthorized. Admin privileges required.' },
        { status: 403 }
      )
    };
  }
  
  return { auth, response: null };
}

/**
 * Require admin role - throws if not admin
 * Use in server components that require admin
 * (Alternative to requireAdminAccess if you want to handle redirects yourself)
 */
export async function requireAdmin() {
  return requireServerAdmin();
}
