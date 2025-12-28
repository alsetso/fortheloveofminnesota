'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
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

const ACTIVE_ACCOUNT_STORAGE_KEY = 'mnuda_active_account_id';

export function AuthStateProvider({ children }: { children: ReactNode }) {
  // Core auth state
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isAccountLoading, setIsAccountLoading] = useState(false);
  
  // Modal state
  const [activeModal, setActiveModal] = useState<AuthModalType>('none');
  const [accountModalTab, setAccountModalTab] = useState<string | null>(null);
  
  // Use AppModalContext for onboarding (separate from account modal)
  const { openOnboarding } = useAppModalContextSafe();
  
  // Track previous account ID to detect changes
  const previousAccountIdRef = useRef<string | null>(null);

  // Load active account ID from localStorage on mount and set cookie
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
      if (stored) {
        setActiveAccountIdState(stored);
        // Set cookie so server-side can access active account ID
        document.cookie = `active_account_id=${stored}; path=/; SameSite=Strict; max-age=31536000`;
      }
    }
  }, []);
  
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
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  // Load active account when user or activeAccountId changes
  useEffect(() => {
    if (!user) {
      setAccount(null);
      setActiveAccountIdState(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
        // Clear the cookie
        document.cookie = 'active_account_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC';
      }
      return;
    }

    const loadAccount = async () => {
      setIsAccountLoading(true);
      try {
        let accountId = activeAccountId;

        // If no active account ID, check localStorage first before defaulting to first account
        if (!accountId && typeof window !== 'undefined') {
          const stored = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
          if (stored) {
            accountId = stored;
            setActiveAccountIdState(stored);
            // Set cookie so server-side can access active account ID
            document.cookie = `active_account_id=${stored}; path=/; SameSite=Strict; max-age=31536000`;
          }
        }

        // If still no account ID, get first account
        if (!accountId) {
          const { needsOnboarding, account: firstAccount } = await checkOnboardingStatus();
          if (firstAccount) {
            accountId = firstAccount.id;
            setActiveAccountIdState(accountId);
            if (typeof window !== 'undefined') {
              localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, accountId);
              // Set cookie so server-side can access active account ID
              document.cookie = `active_account_id=${accountId}; path=/; SameSite=Strict; max-age=31536000`;
            }
          }
          if (needsOnboarding) {
            openOnboarding();
          }
        }

        // Load the active account
        if (accountId) {
          const { data: accountData, error } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountId)
            .eq('user_id', user.id)
            .single();

          if (error || !accountData) {
            // Account not found, reset to first account
            const { account: firstAccount } = await checkOnboardingStatus();
            if (firstAccount) {
              const newAccountId = firstAccount.id;
              setActiveAccountIdState(newAccountId);
              setAccount(firstAccount);
              if (typeof window !== 'undefined') {
                localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, newAccountId);
              }
            } else {
              setAccount(null);
            }
          } else {
            setAccount(accountData as Account);
            // Dispatch event when account loads/changes
            if (typeof window !== 'undefined' && accountId !== previousAccountIdRef.current) {
              previousAccountIdRef.current = accountId;
              window.dispatchEvent(new CustomEvent('account-changed', { detail: { accountId, account: accountData } }));
            }
          }
        } else {
          setAccount(null);
        }
      } catch (error) {
        console.error('[AuthStateContext] Error loading account:', error);
        setAccount(null);
        openOnboarding();
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setAccount(null);
      setActiveAccountIdState(null);
      
      // Clear session storage
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      localStorage.removeItem('freemap_api_usage');
      localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
      
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
          localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
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
      localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, accountId);
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
    if (account?.username) return `/profile/${account.username}`;
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


