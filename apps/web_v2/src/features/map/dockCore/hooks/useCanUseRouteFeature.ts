'use client';

import { useEffect, useState } from 'react';
import { useAuthSafe } from '@/features/auth';
import { canUseRouteFeature } from '@/lib/geo/canUseRouteFeature';

/**
 * True on localhost, or when the active account role is admin.
 * Starts false until the client host is known (avoids hydration mismatch).
 */
export function useCanUseRouteFeature(): boolean {
  const { account } = useAuthSafe();
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    setHost(window.location.hostname);
  }, []);

  return canUseRouteFeature({
    host,
    role: account?.role ?? null,
  });
}
