'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { isDespia } from '@/lib/despia/despia';
import { syncDespiaDevice } from '@/lib/despia/syncDevice';
import {
  clearAccountSelectionStorage,
  persistMultiAccountHint,
  persistSelectedAccountId,
  resolveSelectedAccount,
} from '@/lib/auth/selectedAccount';
import type { AuthStatus } from './authStatus';

export type { AuthStatus } from './authStatus';

export type AccountRow = {
  id: string;
  user_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  bio: string | null;
  traits: string[] | null;
  city_id: string | null;
  county_id: string | null;
  onboarded: boolean | null;
  status: string | null;
  plan: string | null;
  search_visibility: boolean | null;
  account_taggable: boolean | null;
  hide_followers: boolean | null;
  hide_following: boolean | null;
  hide_level: boolean | null;
  hide_streak: boolean | null;
  hide_discovers: boolean | null;
  /** Public header label: `full_name` (default) or `username`. */
  profile_name_display: 'full_name' | 'username' | null;
  state_verified: boolean | null;
  state_verification_checked_at: string | null;
  /** public.accounts.role — `general` | `admin` | `contributor` */
  role: string | null;
  /** Number of interactive map demo steps completed (0–11). Gate releases at 11. */
  account_demo_steps: number | null;
  /** True when the user explicitly chose to skip the demo onboarding. */
  skipped_demo: boolean | null;
  /** UUID of the Terms of Service version the account last accepted. */
  terms_version_id: string | null;
  /** UUID of the Privacy Policy version the account last accepted. */
  privacy_version_id: string | null;
};

type AuthContextValue = {
  user: User | null;
  /** Active account for shell / map / APIs. Null until selected when multi-account. */
  account: AccountRow | null;
  /** All public.accounts rows owned by the signed-in auth user. */
  accounts: AccountRow[];
  /**
   * Session identity for boot gating.
   * `unknown` until getSession settles — never invent `anon` from a timeout.
   */
  authStatus: AuthStatus;
  /** True only while authStatus === 'unknown' (not during OTP / account fetch). */
  isLoading: boolean;
  /** True while fetching public.accounts for the current session user. */
  accountLoading: boolean;
  /** Auth user owns >1 account and none is selected yet. */
  needsAccountSelection: boolean;
  /** Account id currently being switched into (selector loading affordance). */
  selectingAccountId: string | null;
  selectAccount: (accountId: string) => void;
  clearAccountSelection: () => void;
  /** OTP for existing users only — never creates an auth user. */
  signInWithOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string, type: 'email') => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /**
   * New account: name + password. Sets password_set metadata.
   * Returns whether a session was established (false when email confirm is required).
   */
  signUpWithPassword: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<{ sessionCreated: boolean }>;
  /** After setup password step — update password + password_set flag. */
  setPassword: (password: string) => Promise<void>;
  /** Re-fetch auth user (e.g. after email confirm / metadata update). */
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  /** Optimistically replace the cached account row (after edit / upload). */
  applyAccount: (row: AccountRow | null) => void;
  /**
   * True when the last accounts fetch for a signed-in user failed (network /
   * RLS error). False once a fetch succeeds or while a fetch is in flight.
   */
  accountFetchFailed: boolean;
  /** Re-attempt loading accounts for the currently signed-in user. */
  retryAccountFetch: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ACCOUNT_SELECT =
  'id, user_id, username, first_name, last_name, email, phone, image_url, bio, traits, city_id, county_id, onboarded, status, plan, search_visibility, account_taggable, hide_followers, hide_following, hide_level, hide_streak, hide_discovers, profile_name_display, state_verified, state_verification_checked_at, role, account_demo_steps, skipped_demo, terms_version_id, privacy_version_id';

async function fetchAccounts(userId: string): Promise<AccountRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select(ACCOUNT_SELECT)
    .eq('user_id', userId)
    .order('username', { ascending: true, nullsFirst: false });
  // Throw so loadAccounts can distinguish a network/RLS failure from a
  // genuine "user has no accounts yet" empty result.
  if (error) throw error;
  return (data as AccountRow[] | null) ?? [];
}

/**
 * Slim auth for ios-2 — session + OTP + public.accounts.
 * Supports one auth user → many accounts with an explicit selection step.
 * Never await long work inside onAuthStateChange (deadlocks getSession).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(false);
  const [needsAccountSelection, setNeedsAccountSelection] = useState(false);
  const [selectingAccountId, setSelectingAccountId] = useState<string | null>(null);
  const [accountFetchFailed, setAccountFetchFailed] = useState(false);
  const finishedBoot = useRef(false);
  const lastSyncedDeviceKey = useRef<string | null>(null);
  const legalAcceptInFlight = useRef<string | null>(null);
  const lastVisitInFlight = useRef<string | null>(null);
  const accountsLoadRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);

  const settleBoot = useCallback((status: Exclude<AuthStatus, 'unknown'>) => {
    setAuthStatus(status);
    if (finishedBoot.current) return;
    finishedBoot.current = true;
    setIsLoading(false);
  }, []);

  const applyResolvedAccounts = useCallback((rows: AccountRow[], preferredId?: string | null) => {
    const { account: next } = resolveSelectedAccount(rows, preferredId);
    setAccounts(rows);
    setAccount(next);
    setNeedsAccountSelection(false);
    persistMultiAccountHint(rows.length > 1);
    persistSelectedAccountId(next?.id ?? null);
  }, []);

  const loadAccounts = useCallback(
    async (userId: string) => {
      const inflight = accountsLoadRef.current;
      if (inflight && inflight.userId === userId) return inflight.promise;

      const run = (async () => {
        const MAX_EMPTY_RETRIES = 2;
        const RETRY_DELAY_MS = 1200;

        setAccountLoading(true);
        setAccountFetchFailed(false);

        let rows: AccountRow[] = [];
        let fetchError = false;

        // Retry loop: if the DB trigger to create the accounts row is slightly
        // async (new user sign-up) the first fetch may return []. We give it up
        // to MAX_EMPTY_RETRIES extra attempts before treating it as broken.
        for (let attempt = 0; attempt <= MAX_EMPTY_RETRIES; attempt++) {
          if (attempt > 0) {
            await new Promise<void>((r) => { setTimeout(r, RETRY_DELAY_MS); });
          }
          try {
            rows = await fetchAccounts(userId);
            if (rows.length > 0) break;
          } catch (err) {
            console.error('accounts fetch', err);
            fetchError = true;
            break;
          }
        }

        if (fetchError || rows.length === 0) {
          setAccounts([]);
          setAccount(null);
          setNeedsAccountSelection(false);
          setAccountFetchFailed(true);
        } else {
          applyResolvedAccounts(rows);
        }

        setAccountLoading(false);
      })();

      accountsLoadRef.current = { userId, promise: run };
      try {
        await run;
      } finally {
        if (accountsLoadRef.current?.promise === run) {
          accountsLoadRef.current = null;
        }
      }
    },
    [applyResolvedAccounts],
  );

  const selectAccount = useCallback(
    (accountId: string) => {
      const row = accounts.find((a) => a.id === accountId);
      if (!row) return;
      setSelectingAccountId(accountId);
      persistSelectedAccountId(accountId);
      persistMultiAccountHint(accounts.length > 1);
      // Brief loading affordance on the selector row, then hand off to shell / setup gate.
      window.setTimeout(() => {
        setAccount(row);
        setNeedsAccountSelection(false);
        setSelectingAccountId(null);
      }, 280);
    },
    [accounts],
  );

  const clearAccountSelection = useCallback(() => {
    if (accounts.length <= 1) return;
    persistSelectedAccountId(null);
    setAccount(null);
    setNeedsAccountSelection(true);
    setSelectingAccountId(null);
  }, [accounts.length]);

  const refreshAccount = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setAccounts([]);
      setAccount(null);
      setNeedsAccountSelection(false);
      setAccountLoading(false);
      return;
    }
    await loadAccounts(data.user.id);
  }, [loadAccounts]);

  const retryAccountFetch = useCallback(() => {
    if (!user) return;
    void loadAccounts(user.id);
  }, [user, loadAccounts]);

  const applyAccount = useCallback((row: AccountRow | null) => {
    setAccount(row);
    if (row) {
      setAccounts((prev) => {
        const idx = prev.findIndex((a) => a.id === row.id);
        if (idx === -1) return prev;
        const next = prev.slice();
        next[idx] = row;
        return next;
      });
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let sessionSettled = false;

    // Only reload account rows when identity actually changes. TOKEN_REFRESHED
    // fires every ~hour and carries the same user — no reason to re-fetch rows.
    const IDENTITY_EVENTS = new Set([
      'INITIAL_SESSION',
      'SIGNED_IN',
      'USER_UPDATED',
    ]);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      // Do not await here — blocks INITIAL_SESSION and deadlocks getSession().
      if (nextUser) {
        if (IDENTITY_EVENTS.has(event)) void loadAccounts(nextUser.id);
        if (finishedBoot.current) setAuthStatus('signed_in');
      } else {
        setAccounts([]);
        setAccount(null);
        setNeedsAccountSelection(false);
        setAccountLoading(false);
        setSelectingAccountId(null);
        if (finishedBoot.current) setAuthStatus('anon');
      }
      // WKWebView (Despia) often emits INITIAL_SESSION with a null user
      // before cookies/localStorage hydrate. Do not lock anon from that —
      // getSession() is the authority for a null first event.
      if (sessionSettled) return;
      if (event === 'SIGNED_OUT') {
        sessionSettled = true;
        settleBoot('anon');
        return;
      }
      if (event === 'INITIAL_SESSION' && nextUser) {
        sessionSettled = true;
        settleBoot('signed_in');
      }
    });

    const getSessionBounded = async (ms: number) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('getSession timeout')), ms);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    void (async () => {
      try {
        const { data } = await getSessionBounded(isDespia() ? 8_000 : 3_500);
        if (cancelled) return;
        const sessionUser = data.session?.user ?? null;
        setUser(sessionUser);
        if (!sessionSettled) {
          if (sessionUser) {
            void loadAccounts(sessionUser.id);
            sessionSettled = true;
            settleBoot('signed_in');
          } else if (!isDespia()) {
            setAccounts([]);
            setAccount(null);
            setNeedsAccountSelection(false);
            setAccountLoading(false);
            sessionSettled = true;
            settleBoot('anon');
          }
          // Despia + no user yet: storage may still be hydrating.
          // Wait for SIGNED_IN or the longer timeout retry — do not lock anon.
        }
        // If sessionSettled is already true, onAuthStateChange already handled
        // INITIAL_SESSION and kicked off loadAccounts — nothing to do here.
      } catch (err) {
        console.error('auth getSession', err);
        if (cancelled || sessionSettled) return;
        // Despia: leave unsettled so the hard timeout retry can still win.
        if (isDespia()) return;
        setUser(null);
        setAccounts([]);
        setAccount(null);
        setNeedsAccountSelection(false);
        setAccountLoading(false);
        sessionSettled = true;
        settleBoot('anon');
      }
    })();

    // Safety: never leave splash hanging. Despia WKWebView is slower to
    // hydrate storage — retry getSession instead of inventing error/anon.
    // Bound the retry too: a hung getSession must not block settleBoot forever.
    const timeoutMs = isDespia() ? 10_000 : 4_000;
    const timeout = setTimeout(() => {
      if (cancelled || sessionSettled) return;
      void (async () => {
        try {
          const { data } = await getSessionBounded(2_500);
          if (cancelled || sessionSettled) return;
          const sessionUser = data.session?.user ?? null;
          setUser(sessionUser);
          if (sessionUser) void loadAccounts(sessionUser.id);
          sessionSettled = true;
          settleBoot(sessionUser ? 'signed_in' : 'anon');
        } catch {
          if (cancelled || sessionSettled) return;
          sessionSettled = true;
          settleBoot('anon');
        }
      })();
    }, timeoutMs);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [settleBoot, loadAccounts]);

  // Despia: claim vault app_user_id = accounts.id, upsert user_devices by despia.uuid
  useEffect(() => {
    if (!user?.id || !account?.id) {
      if (!user) lastSyncedDeviceKey.current = null;
      return;
    }
    if (account.user_id !== user.id) return;

    const key = `${user.id}:${account.id}`;
    if (lastSyncedDeviceKey.current === key) return;
    lastSyncedDeviceKey.current = key;

    void syncDespiaDevice({ accountId: account.id, userId: user.id });
  }, [user, account]);

  // First-bind only: record signup acceptance if this account has no legal bind yet.
  // Never silently upgrades versions — PolicyUpdateGate handles reconsent.
  // New accounts are also bound by DB trigger trg_account_legal_signup at created_at.
  useEffect(() => {
    if (!user?.id || !account?.id) return;
    if (typeof window === 'undefined') return;
    if (account.terms_version_id && account.privacy_version_id) return;
    const accountId = account.id;
    const flagKey = `ftlomn_legal_accept_ok:${accountId}`;
    if (sessionStorage.getItem(flagKey) === '1') return;
    if (legalAcceptInFlight.current === accountId) return;
    legalAcceptInFlight.current = accountId;
    void fetch('/api/legal/accept', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'signup', platform: 'ios2' }),
    })
      .then((res) => {
        if (res.ok) sessionStorage.setItem(flagKey, '1');
      })
      .catch(() => {
        /* non-blocking — retry on next mount / account change */
      })
      .finally(() => {
        if (legalAcceptInFlight.current === accountId) {
          legalAcceptInFlight.current = null;
        }
      });
  }, [user, account]);

  // Coarse presence: bump last_visit once per tab session (server throttles to 1h).
  useEffect(() => {
    if (!user?.id || !account?.id) return;
    if (typeof window === 'undefined') return;
    if (account.user_id !== user.id) return;
    const accountId = account.id;
    const flagKey = `ftlomn_last_visit_ok:${accountId}`;
    if (sessionStorage.getItem(flagKey) === '1') return;
    if (lastVisitInFlight.current === accountId) return;
    lastVisitInFlight.current = accountId;
    void fetch('/api/accounts/touch', {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => {
        if (res.ok || res.status === 204) sessionStorage.setItem(flagKey, '1');
      })
      .catch(() => {
        /* non-blocking — retry on next mount */
      })
      .finally(() => {
        if (lastVisitInFlight.current === accountId) {
          lastVisitInFlight.current = null;
        }
      });
  }, [user, account]);

  const signInWithOtp = useCallback(async (email: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) throw error;
  }, []);

  const verifyOtp = useCallback(
    async (email: string, token: string, type: 'email') => {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({ email, token, type });
      if (error) throw error;
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        setAuthStatus('signed_in');
        // Load accounts without blocking OTP success — multi-account users
        // need the setup selector even if this fetch is slow.
        setAccountLoading(true);
        void loadAccounts(data.user.id);
      }
    },
    [loadAccounts],
  );

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      setUser(data.user);
      setAuthStatus('signed_in');
      setAccountLoading(true);
      void loadAccounts(data.user.id);
    }
  }, [loadAccounts]);

  const signUpWithPassword = useCallback(
    async (input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            password_set: true,
            first_name: input.firstName.trim() || null,
            last_name: input.lastName.trim() || null,
          },
        },
      });
      if (error) throw error;
      if (data.session?.user) {
        setUser(data.session.user);
        setAuthStatus('signed_in');
        setAccountLoading(true);
        void loadAccounts(data.session.user.id);
        return { sessionCreated: true };
      }
      return { sessionCreated: false };
    },
    [loadAccounts],
  );

  const setPassword = useCallback(async (password: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    });
    if (error) throw error;
    if (data.user) setUser(data.user);
  }, []);

  const refreshUser = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) setUser(data.user);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    // Local-only: WKWebView often hangs on a remote token revoke. Wipe the
    // client session so a stale Despia account cannot come back this launch.
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 2000);
        }),
      ]);
    } catch {
      /* still clear React + account cookies below */
    }
    lastSyncedDeviceKey.current = null;
    clearAccountSelectionStorage();
    setUser(null);
    setAccounts([]);
    setAccount(null);
    setNeedsAccountSelection(false);
    setSelectingAccountId(null);
    setAccountLoading(false);
    setAccountFetchFailed(false);
    setAuthStatus('anon');
  }, []);

  const value = useMemo(
    () => ({
      user,
      account,
      accounts,
      authStatus,
      isLoading,
      accountLoading,
      needsAccountSelection,
      selectingAccountId,
      selectAccount,
      clearAccountSelection,
      signInWithOtp,
      verifyOtp,
      signInWithPassword,
      signUpWithPassword,
      setPassword,
      refreshUser,
      signOut,
      refreshAccount,
      applyAccount,
      accountFetchFailed,
      retryAccountFetch,
    }),
    [
      user,
      account,
      accounts,
      authStatus,
      isLoading,
      accountLoading,
      needsAccountSelection,
      selectingAccountId,
      selectAccount,
      clearAccountSelection,
      signInWithOtp,
      verifyOtp,
      signInWithPassword,
      signUpWithPassword,
      setPassword,
      refreshUser,
      signOut,
      refreshAccount,
      applyAccount,
      accountFetchFailed,
      retryAccountFetch,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useAuthSafe(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  return {
    user: null,
    account: null,
    accounts: [],
    authStatus: 'unknown',
    isLoading: true,
    accountLoading: false,
    needsAccountSelection: false,
    selectingAccountId: null,
    selectAccount: () => {},
    clearAccountSelection: () => {},
    signInWithOtp: async () => {
      throw new Error('AuthProvider not available');
    },
    verifyOtp: async () => {
      throw new Error('AuthProvider not available');
    },
    signInWithPassword: async () => {
      throw new Error('AuthProvider not available');
    },
    signUpWithPassword: async () => {
      throw new Error('AuthProvider not available');
    },
    setPassword: async () => {
      throw new Error('AuthProvider not available');
    },
    refreshUser: async () => {},
    signOut: async () => {},
    refreshAccount: async () => {},
    applyAccount: () => {},
    accountFetchFailed: false,
    retryAccountFetch: () => {},
  };
}
