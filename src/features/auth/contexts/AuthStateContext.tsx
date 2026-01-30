'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AccountService, Account } from '../services/memberService';
import { isAccountComplete } from '@/lib/accountCompleteness';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { checkOnboardingStatus } from '@/lib/onboardingCheck';

// Display account type (authenticated only)
export type DisplayAccount = Account | null;

// Auth modal types
export type AuthModalType = 'none' | 'welcome' | 'account';

export interface AuthState {
  // Supabase user
  user: User | null;
  
  // Account data (active account)
  account: Account | null;
  activeAccountId: string | null;
  
  // Loading states
  isLoading: boolean;
  isAccountLoading: boolean;
  
  // Computed states
  isAuthenticated: boolean;
  isAccountComplete: boolean;
  
  // Current display account
  displayAccount: DisplayAccount;
  displayName: string;
  
  // Modal state
  activeModal: AuthModalType;
  accountModalTab: string | null;
}

interface AuthStateContextType extends AuthState {
  // Auth methods
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string, type: 'email') => Promise<void>;
  signOut: () => Promise<void>;
  
  // Account methods
  refreshAccount: () => Promise<void>;
  setActiveAccountId: (accountId: string | null) => Promise<void>;
  
  // Modal methods
  openModal: (modal: AuthModalType, tab?: string) => void;
  closeModal: () => void;
  
  // Computed helpers
  getProfileUrl: () => string | null;
}

const AuthStateContext = createContext<AuthStateContextType | undefined>(undefined);

const LAST_SELECTED_ACCOUNT_KEY = 'LAST_SELECTED_ACCOUNT';
const OLD_ACCOUNT_STORAGE_KEY = 'mnuda_active_account_id'; // Legacy key for migration

interface AuthStateProviderProps {
  children: ReactNode;
  /** Initial auth data from server - if provided, skips client-side auth fetch */
  initialAuth?: {
    userId: string | null;
    accountId: string | null;
  } | null;
}

export function AuthStateProvider({ children, initialAuth }: AuthStateProviderProps) {
  const router = useRouter();
  
  // Core auth state
  // If initialAuth is provided, start with user loaded (but we still need to fetch User object)
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(
    initialAuth?.accountId || null
  );
  
  // Loading states - if initialAuth provided, start as not loading (will be set correctly after initial fetch)
  const [isLoading, setIsLoading] = useState(!initialAuth?.userId);
  const [isAccountLoading, setIsAccountLoading] = useState(false);
  
  // Modal state
  const [activeModal, setActiveModal] = useState<AuthModalType>('none');
  const [accountModalTab, setAccountModalTab] = useState<string | null>(null);
  
  // Onboarding is now handled via page redirect, not modal
  // Removed: const { openOnboarding } = useAppModalContextSafe();
  
  // Track previous account ID to detect changes
  const previousAccountIdRef = useRef<string | null>(null);
  // Track if we've loaded from localStorage on initial mount
  const hasLoadedFromStorageRef = useRef(false);
  // Track if we've completed initial auth check to distinguish between "loading" and "signed out"
  const hasCheckedAuthRef = useRef(false);

  // Load last selected account from localStorage on mount
  // This runs before user/auth loads, so we'll use it in the account loading effect
  
  // Computed states
  const isAuthenticated = !!user;
  const accountComplete = isAccountComplete(account);
  
  // Display account
  const displayAccount: DisplayAccount = account;
  const displayName = account 
    ? AccountService.getDisplayName(account)
    : '';

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const initAuth = async () => {
      // If we have initial auth data, we know user is authenticated
      // Still need to fetch User object for full context, but can skip if already have it
      if (initialAuth?.userId) {
        try {
          // Quick fetch to get User object - should be fast since we know user exists
          const { data: { user: authUser }, error } = await supabase.auth.getUser();
          
          if (!mounted) return;

          if (error || !authUser) {
            setUser(null);
            setIsLoading(false);
          } else {
            setUser(authUser);
            setIsLoading(false);
          }
        } catch {
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
        }
      } else {
        // No initial auth - do full check with timeout
        try {
          timeoutId = setTimeout(() => {
            if (mounted) {
              setUser(null);
              setIsLoading(false);
            }
          }, 2000);

          const { data: { user: authUser }, error } = await supabase.auth.getUser();
          
          clearTimeout(timeoutId);
          if (!mounted) return;

          if (error || !authUser) {
            setUser(null);
          } else {
            setUser(authUser);
          }
          
          setIsLoading(false);
        } catch {
          clearTimeout(timeoutId);
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [initialAuth?.userId]);

  // Load active account when user or activeAccountId changes
  useEffect(() => {
    // Only clear localStorage if user is actually signed out (not just initial load)
    if (!user && hasCheckedAuthRef.current && !isLoading) {
      // User was loaded but is now null - they signed out
      setAccount(null);
      setActiveAccountIdState(null);
      hasLoadedFromStorageRef.current = false;
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LAST_SELECTED_ACCOUNT_KEY);
        localStorage.removeItem(OLD_ACCOUNT_STORAGE_KEY);
        // Clear the cookie
        document.cookie = 'active_account_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
      }
      return;
    }
    
    // Mark that we've checked auth status
    if (!isLoading) {
      hasCheckedAuthRef.current = true;
    }
    
    // If user is not loaded yet, don't proceed (but don't clear localStorage)
    if (!user) {
      return;
    }

    const loadAccount = async () => {
      setIsAccountLoading(true);
      try {
        let accountId = activeAccountId;
        let accountData: Account | null = null;

        // On initial load (first time user is loaded), always check localStorage first
        // This ensures we use the last selected account even if activeAccountId state is null
        if (!hasLoadedFromStorageRef.current && typeof window !== 'undefined') {
          hasLoadedFromStorageRef.current = true;
          
          // Check all localStorage keys to debug
          const allKeys = Object.keys(localStorage);
          let stored = localStorage.getItem(LAST_SELECTED_ACCOUNT_KEY);
          
          // Migration: If new key doesn't exist, check old key
          if (!stored) {
            const oldStored = localStorage.getItem(OLD_ACCOUNT_STORAGE_KEY);
            if (oldStored) {
              // Migrate to new key
              localStorage.setItem(LAST_SELECTED_ACCOUNT_KEY, oldStored);
              stored = oldStored;
            }
          }
          
          if (stored) {
            // Find account by ID (we always store ID now)
            const { data: accountById, error: idError } = await supabase
              .from('accounts')
              .select('*')
              .eq('id', stored)
              .eq('user_id', user.id)
              .maybeSingle();

            if (accountById) {
              accountId = accountById.id;
              accountData = accountById as Account;
            } else {
              // Fallback: try as username (for migration from old system that stored username)
              const { data: accountByUsername, error: usernameError } = await supabase
                .from('accounts')
                .select('*')
                .eq('username', stored)
                .eq('user_id', user.id)
                .maybeSingle();

              if (accountByUsername) {
                accountId = accountByUsername.id;
                accountData = accountByUsername as Account;
              } else if (process.env.NODE_ENV === 'development') {
                console.warn('[AuthStateContext] Account not found by ID or username:', stored, { idError, usernameError });
              }
            }
          }
        } else if (!accountId && typeof window !== 'undefined') {
          // If not initial load but no activeAccountId, check localStorage
          const stored = localStorage.getItem(LAST_SELECTED_ACCOUNT_KEY);
          if (stored) {
            // Find account by ID (we always store ID now)
            const { data: accountById } = await supabase
              .from('accounts')
              .select('*')
              .eq('id', stored)
              .eq('user_id', user.id)
              .maybeSingle();

            if (accountById) {
              accountId = accountById.id;
              accountData = accountById as Account;
            } else {
              // Fallback: try as username (for migration)
              const { data: accountByUsername } = await supabase
                .from('accounts')
                .select('*')
                .eq('username', stored)
                .eq('user_id', user.id)
                .maybeSingle();

              if (accountByUsername) {
                accountId = accountByUsername.id;
                accountData = accountByUsername as Account;
              }
            }
          }
        }

        // If still no account, get first account (only if no stored account found)
        if (!accountId) {
          const { needsOnboarding, account: firstAccount } = await checkOnboardingStatus();
          if (firstAccount) {
            accountId = firstAccount.id;
            accountData = firstAccount;
            // Only save to localStorage if we don't already have a stored value
            // This prevents overwriting the user's last selection
            if (typeof window !== 'undefined') {
              const existingStored = localStorage.getItem(LAST_SELECTED_ACCOUNT_KEY);
              if (!existingStored) {
                // Always store account ID
                localStorage.setItem(LAST_SELECTED_ACCOUNT_KEY, firstAccount.id);
              }
              // Set cookie so server-side can access active account ID
              document.cookie = `active_account_id=${accountId}; path=/; SameSite=Strict; max-age=31536000`;
            }
          }
          if (needsOnboarding) {
            // Redirect to onboarding page instead of opening modal
            router.push('/onboarding');
          }
        }

        // Load the active account if we don't already have it
        if (accountId && !accountData) {
          const { data: accountDataFromDb, error } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountId)
            .eq('user_id', user.id)
            .single();

          if (error || !accountDataFromDb) {
            // Account not found, reset to first account
            const { account: firstAccount } = await checkOnboardingStatus();
            if (firstAccount) {
              accountId = firstAccount.id;
              accountData = firstAccount;
              setActiveAccountIdState(accountId);
              setAccount(firstAccount);
              if (typeof window !== 'undefined') {
                // Always store account ID
                localStorage.setItem(LAST_SELECTED_ACCOUNT_KEY, firstAccount.id);
                document.cookie = `active_account_id=${accountId}; path=/; SameSite=Strict; max-age=31536000`;
              }
            } else {
              setAccount(null);
            }
          } else {
            accountData = accountDataFromDb as Account;
          }
        }

        // Set the account and activeAccountId
        if (accountData && accountId) {
          setActiveAccountIdState(accountId);
          setAccount(accountData);
          // Dispatch event when account loads/changes
          if (typeof window !== 'undefined' && accountId !== previousAccountIdRef.current) {
            const isFirstLoad = previousAccountIdRef.current === null;
            previousAccountIdRef.current = accountId;
            window.dispatchEvent(new CustomEvent('account-changed', { detail: { accountId, account: accountData } }));
            
            // Handle redirect parameter after login
            if (isFirstLoad && typeof window !== 'undefined') {
              const urlParams = new URLSearchParams(window.location.search);
              const redirectParam = urlParams.get('redirect');
              
              if (redirectParam) {
                // Clean redirect parameter and navigate
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete('redirect');
                newUrl.searchParams.delete('message');
                router.replace(newUrl.pathname + newUrl.search);
                
                // Navigate to the redirect URL
                router.push(redirectParam);
              }
            }
          }
        } else {
          setAccount(null);
        }
      } catch (error) {
        console.error('[AuthStateContext] Error loading account:', error);
        setAccount(null);
        // Redirect to onboarding page instead of opening modal
        router.push('/onboarding');
      } finally {
        setIsAccountLoading(false);
      }
    };

    loadAccount();
  }, [user, activeAccountId]);

  // Auth methods
  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithOtp = async (email: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email: string, token: string, type: 'email') => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type });
      if (error) throw error;
      
      const { data: { user: verifiedUser } } = await supabase.auth.getUser();
      if (verifiedUser) {
        setUser(verifiedUser);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      // Store last account info before signing out (for "Welcome Back" feature)
      if (account && typeof window !== 'undefined') {
        if (account.username) {
          localStorage.setItem('last_account_username', account.username);
        }
        if (account.image_url) {
          localStorage.setItem('last_account_image', account.image_url);
        }
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setAccount(null);
      setActiveAccountIdState(null);
      
      // Clear session storage
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      localStorage.removeItem('freemap_api_usage');
      localStorage.removeItem(LAST_SELECTED_ACCOUNT_KEY);
      
      // Clear the active account cookie
      if (typeof window !== 'undefined') {
        document.cookie = 'active_account_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Account methods
  const refreshAccount = async () => {
    if (!user || !activeAccountId) return;
    
    setIsAccountLoading(true);
    try {
      const { data: accountData, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', activeAccountId)
        .eq('user_id', user.id)
        .single();

      if (!error && accountData) {
        setAccount(accountData as Account);
      }
    } catch (error) {
      console.error('[AuthStateContext] Error refreshing account:', error);
    } finally {
      setIsAccountLoading(false);
    }
  };

  const setActiveAccountId = useCallback(async (accountId: string | null) => {
    if (!user) return;

    if (!accountId) {
      const firstAccount = await AccountService.getCurrentAccount();
      if (firstAccount) {
        accountId = firstAccount.id;
      } else {
        setActiveAccountIdState(null);
        setAccount(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(LAST_SELECTED_ACCOUNT_KEY);
          // Clear the cookie
          document.cookie = 'active_account_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
          window.dispatchEvent(new CustomEvent('account-changed', { detail: { accountId: null, account: null } }));
        }
        return;
      }
    }

    // Only update if actually changing
    if (accountId === activeAccountId) return;

    // Verify user owns this account before switching
    const { data: accountData, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single();

    if (error || !accountData) {
      throw new Error('Account not found or you do not have access to it');
    }

    // Only update activeAccountIdState - useEffect will load the account
    setActiveAccountIdState(accountId);
    if (typeof window !== 'undefined') {
      // Always store account ID (more reliable than username - IDs are always present and unique)
      localStorage.setItem(LAST_SELECTED_ACCOUNT_KEY, accountId);
      
      // Verify it was set (only log in development)
      if (process.env.NODE_ENV === 'development') {
        const verify = localStorage.getItem(LAST_SELECTED_ACCOUNT_KEY);
        if (verify !== accountId) {
          console.warn('[AuthStateContext] localStorage verification failed:', { accountId, stored: verify });
        }
      }
      
      // Set cookie so server-side can access active account ID
      // Use SameSite=Strict for security, path=/ to make it available site-wide
      document.cookie = `active_account_id=${accountId}; path=/; SameSite=Strict; max-age=31536000`; // 1 year
    }
    // useEffect automatically loads account when activeAccountId changes
  }, [user, activeAccountId]);

  // Modal methods
  const openModal = (modal: AuthModalType, tab?: string) => {
    setActiveModal(modal);
    setAccountModalTab(tab || null);
  };

  const closeModal = () => {
    // Prevent closing account modal if account is incomplete
    if (activeModal === 'account' && !accountComplete && user) {
      return;
    }
    
    setActiveModal('none');
    setAccountModalTab(null);
  };

  // Helpers
  const getProfileUrl = () => {
    if (account?.username) return `/${account.username}`;
    return null;
  };

  const value: AuthStateContextType = {
    // State
    user,
    account,
    activeAccountId,
    isLoading,
    isAccountLoading,
    isAuthenticated,
    isAccountComplete: accountComplete,
    displayAccount,
    displayName,
    activeModal,
    accountModalTab,
    
    // Methods
    signIn,
    signUp,
    signInWithOtp,
    verifyOtp,
    signOut,
    refreshAccount,
    setActiveAccountId,
    openModal,
    closeModal,
    getProfileUrl,
  };

  return (
    <AuthStateContext.Provider value={value}>
      {children}
    </AuthStateContext.Provider>
  );
}

export function useAuthState(): AuthStateContextType {
  const context = useContext(AuthStateContext);
  
  if (context === undefined) {
    throw new Error('useAuthState must be used within an AuthStateProvider');
  }
  
  return context;
}

// Safe hook that returns defaults outside provider (for SSR safety)
export function useAuthStateSafe(): AuthStateContextType {
  const context = useContext(AuthStateContext);
  
  if (context === undefined) {
    // Return safe defaults
    return {
      user: null,
      account: null,
      activeAccountId: null,
      isLoading: true,
      isAccountLoading: false,
      isAuthenticated: false,
      isAccountComplete: false,
      displayAccount: null,
      displayName: '',
      activeModal: 'none',
      accountModalTab: null,
      signIn: async () => { throw new Error('AuthStateProvider not available'); },
      signUp: async () => { throw new Error('AuthStateProvider not available'); },
      signInWithOtp: async () => { throw new Error('AuthStateProvider not available'); },
      verifyOtp: async () => { throw new Error('AuthStateProvider not available'); },
      signOut: async () => { throw new Error('AuthStateProvider not available'); },
      refreshAccount: async () => {},
      setActiveAccountId: async () => {},
      openModal: () => {},
      closeModal: () => {},
      getProfileUrl: () => null,
    };
  }
  
  return context;
}


