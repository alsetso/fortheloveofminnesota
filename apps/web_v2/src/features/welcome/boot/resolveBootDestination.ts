import type { User } from '@supabase/supabase-js';
import type { AccountRow } from '@/features/auth';
import type { AuthStatus } from '@/features/auth/authStatus';
import {
  isAccountComplete,
  isAccountDeactivated,
  isAuthSetupComplete,
  isDemoComplete,
} from '@/lib/account/accountCompleteness';
import {
  isAnonymousAllowedPath,
  LOGGED_IN_HOME_PATH,
  SETUP_PATH,
  WELCOME_PATH,
  welcomePathWithNext,
} from '@/lib/routes/routePolicy';

/**
 * Routing destinations produced by resolveBootDestination.
 *
 * 'stay'        — auth still unknown or accounts still loading; hold current location.
 * 'welcome'     — needs sign-in / signup.
 * 'setup'       — signed in; needs auth setup, account selection, profile, or demo steps.
 * 'setup_error' — signed in but account fetch failed / no accounts row found;
 *                 show recovery UI (retry + sign out) instead of the setup form.
 * 'world'       — fully ready; stay on /feed|/game|/campaign if already
 *                 there, otherwise go to signed-in home (/feed).
 */
export type BootDestinationKind = 'welcome' | 'setup' | 'setup_error' | 'world' | 'stay';

export type BootDestination = {
  kind: BootDestinationKind;
  /** Path to router.replace, or null to keep current pathname. */
  href: string | null;
  /** Run location / territory / map warm before leaving splash. */
  needsWorldWarm: boolean;
};

type ResolveArgs = {
  authStatus: AuthStatus;
  /** Auth user — used for password_set + email_confirmed gates. */
  user: User | null;
  account: AccountRow | null;
  accountLoading: boolean;
  needsAccountSelection: boolean;
  /** True when loadAccounts failed (network/RLS error or 0 rows after retries). */
  accountFetchFailed: boolean;
  pathname: string | null;
};

const AUTH_ENTRY_PATHS = new Set([WELCOME_PATH, '/login', '/signup']);

/**
 * Single source of truth for routing decisions.
 * Called by AuthBootstrap (splash + post-boot gate) and SetupGate.
 * No other code should independently implement "where does this user go".
 */
export function resolveBootDestination({
  authStatus,
  user,
  account,
  accountLoading,
  needsAccountSelection,
  accountFetchFailed,
  pathname,
}: ResolveArgs): BootDestination {
  if (authStatus === 'unknown') {
    return { kind: 'stay', href: null, needsWorldWarm: false };
  }

  if (authStatus === 'error' || authStatus === 'anon') {
    if (isAnonymousAllowedPath(pathname)) {
      const onAuthEntry = pathname != null && AUTH_ENTRY_PATHS.has(pathname);
      return {
        kind: onAuthEntry ? 'welcome' : 'stay',
        href: null,
        needsWorldWarm: false,
      };
    }
    return {
      kind: 'welcome',
      href: welcomePathWithNext(pathname),
      needsWorldWarm: false,
    };
  }

  // signed_in — wait for first accounts fetch before routing.
  if (accountLoading) {
    return { kind: 'stay', href: null, needsWorldWarm: false };
  }

  // Fetch failed or returned 0 rows even after retries — needs recovery UI.
  if (accountFetchFailed) {
    return {
      kind: 'setup_error',
      href: pathname === SETUP_PATH ? null : SETUP_PATH,
      needsWorldWarm: false,
    };
  }

  // Switcher only — never block Story because a cookie is missing.
  if (needsAccountSelection && !account) {
    return {
      kind: 'setup',
      href: pathname === SETUP_PATH ? null : SETUP_PATH,
      needsWorldWarm: false,
    };
  }

  const needsAuthSetup = !isAuthSetupComplete(user);
  const incompleteProfile =
    !account || isAccountDeactivated(account) || !isAccountComplete(account);
  const needsDemo = account ? !isDemoComplete(account) : false;

  if (needsAuthSetup || incompleteProfile || needsDemo) {
    return {
      kind: 'setup',
      href: pathname === SETUP_PATH ? null : SETUP_PATH,
      needsWorldWarm: false,
    };
  }

  // Complete account → home (/feed). No map warm — feed is not a map surface.
  if (pathname && AUTH_ENTRY_PATHS.has(pathname)) {
    return {
      kind: 'world',
      href: LOGGED_IN_HOME_PATH,
      needsWorldWarm: false,
    };
  }

  if (pathname === SETUP_PATH) {
    return {
      kind: 'world',
      href: LOGGED_IN_HOME_PATH,
      needsWorldWarm: false,
    };
  }

  return { kind: 'world', href: null, needsWorldWarm: false };
}
