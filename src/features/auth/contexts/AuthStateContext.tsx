'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  
  // Account data (authenticated user's account)
  account: Account | null;
  
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
  
  // Modal methods
  openModal: (modal: AuthModalType, tab?: string) => void;
  closeModal: () => void;
  
  // Computed helpers
  getProfileUrl: () => string | null;
}

const AuthStateContext = createContext<AuthStateContextType | undefined>(undefined);

export function AuthStateProvider({ children }: { children: ReactNode }) {
  // Core auth state
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isAccountLoading, setIsAccountLoading] = useState(false);
  
  // Modal state
  const [activeModal, setActiveModal] = useState<AuthModalType>('none');
  const [accountModalTab, setAccountModalTab] = useState<string | null>(null);
  
  // Use AppModalContext for onboarding (separate from account modal)
  const { openOnboarding } = useAppModalContextSafe();
  
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

  // Load authenticated account when user changes
  useEffect(() => {
    if (!user) {
      setAccount(null);
      return;
    }

    const loadAccount = async () => {
      setIsAccountLoading(true);
      try {
        // Use centralized onboarding check (ensures account exists)
        const { needsOnboarding, account } = await checkOnboardingStatus();
        setAccount(account);
        
        // Open onboarding if needed
        if (needsOnboarding) {
          openOnboarding();
        }
      } catch (error) {
        console.error('[AuthStateContext] Error loading account:', error);
        setAccount(null);
        // On error, assume onboarding is needed
        openOnboarding();
      } finally {
        setIsAccountLoading(false);
      }
    };

    loadAccount();
  }, [user]);

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
      
      // Clear session storage
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      localStorage.removeItem('freemap_api_usage');
    } finally {
      setIsLoading(false);
    }
  };

  // Account methods
  const refreshAccount = async () => {
    if (!user) return;
    
    setIsAccountLoading(true);
    try {
      const accountData = await AccountService.getCurrentAccount();
      setAccount(accountData);
    } catch (error) {
      console.error('[AuthStateContext] Error refreshing account:', error);
    } finally {
      setIsAccountLoading(false);
    }
  };

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
      openModal: () => {},
      closeModal: () => {},
      getProfileUrl: () => null,
    };
  }
  
  return context;
}

