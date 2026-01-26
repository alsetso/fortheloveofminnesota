/**
 * Request-scoped auth caching for API routes
 * Reduces redundant auth checks within the same request lifecycle
 */

import { NextRequest } from 'next/server';
import { optionalAuth } from './accessControl';

interface CachedAuth {
  userId?: string | null;
  accountId?: string | null;
  cached: boolean;
}

const apiAuthCache = new WeakMap<NextRequest, CachedAuth>();

/**
 * Get cached auth for API request, or fetch and cache if not present
 */
export async function getRequestAuth(request: NextRequest): Promise<CachedAuth> {
  const cached = apiAuthCache.get(request);
  if (cached) {
    return cached;
  }

  const auth = await optionalAuth();
  const result: CachedAuth = {
    userId: auth.userId || undefined,
    accountId: auth.accountId || undefined,
    cached: true,
  };
  
  apiAuthCache.set(request, result);
  return result;
}
