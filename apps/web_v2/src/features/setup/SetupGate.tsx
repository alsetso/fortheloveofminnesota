'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import { SETUP_PATH, WELCOME_PATH } from '@/lib/routes/routePolicy';
import { resolveBootDestination } from '@/features/welcome/boot/resolveBootDestination';
import {
  getBootMetaSnapshot,
  subscribeBootMeta,
} from '@/features/welcome/boot/bootMetaStore';

/**
 * Safety-net client gate — calls the same resolveBootDestination used by
 * AuthBootstrap so there is exactly ONE definition of routing logic.
 *
 * This gate ONLY fires after AuthBootstrap has completed the splash sequence
 * (bootDone = true in bootMetaStore). Before that, AuthBootstrap is the sole
 * routing authority. This prevents the two from fighting each other.
 *
 * Its job is purely to catch post-boot route changes where the user somehow
 * lands on a page they shouldn't be on (deep-link, back-button, mid-session
 * account changes, etc).
 */
export default function SetupGate() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    account,
    authStatus,
    accountLoading,
    accountFetchFailed,
    needsAccountSelection,
    selectingAccountId,
  } = useAuthSafe();

  const { bootDone } = useSyncExternalStore(
    subscribeBootMeta,
    getBootMetaSnapshot,
    getBootMetaSnapshot,
  );

  useEffect(() => {
    // Defer entirely to AuthBootstrap until the splash sequence is done.
    if (!bootDone) return;
    // Wait for auth to settle and for any in-flight account operations.
    if (authStatus === 'unknown' || !user) return;
    if (selectingAccountId) return;
    if (accountLoading) return;

    const destination = resolveBootDestination({
      authStatus,
      user,
      account,
      accountLoading,
      needsAccountSelection,
      accountFetchFailed,
      pathname,
    });

    // 'stay' and 'world' with no href need no action from this gate.
    // Only redirect when the resolver gives us a concrete href that differs
    // from where we already are — and exclude /welcome so anon-allowed paths
    // aren't re-entered in a loop.
    if (!destination.href) return;
    if (destination.href === pathname) return;
    if (destination.kind === 'welcome' && pathname === WELCOME_PATH) return;
    if (destination.kind !== 'welcome' && pathname === SETUP_PATH) return;

    router.replace(destination.href);
  }, [
    bootDone,
    authStatus,
    accountLoading,
    accountFetchFailed,
    user,
    account,
    needsAccountSelection,
    selectingAccountId,
    pathname,
    router,
  ]);

  return null;
}
