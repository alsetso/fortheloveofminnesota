'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from '@/features/auth';
import { AccountService, Account } from '@/features/auth';
import { supabase } from '@/lib/supabase';

interface ActiveAccountContextType {
  activeAccount: Account | null;
  activeAccountId: string | null;
  setActiveAccountId: (accountId: string | null) => Promise<void>;
  loading: boolean;
  refreshActiveAccount: () => Promise<void>;
}

const ActiveAccountContext = createContext<ActiveAccountContextType | undefined>(undefined);

const ACTIVE_ACCOUNT_STORAGE_KEY = 'mnuda_active_account_id';

export function ActiveAccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  // Load active account ID from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
      if (stored) {
        setActiveAccountIdState(stored);
      }
    }
  }, []);

  // Load active account when user or activeAccountId changes
  const loadActiveAccount = useCallback(async () => {
    if (!user) {
      setActiveAccount(null);
      setActiveAccountIdState(null);
      setLoading(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
      }
      return;
    }

    setLoading(true);

    try {
      let accountId = activeAccountId;

      // If no active account ID is set, get the first account for the user
      if (!accountId) {
        const firstAccount = await AccountService.getCurrentAccount();
        if (firstAccount) {
          accountId = firstAccount.id;
          setActiveAccountIdState(accountId);
          if (typeof window !== 'undefined') {
            localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, accountId);
          }
        }
      }

      // Load the active account
      if (accountId) {
        const { data: account, error } = await supabase
          .from('accounts')
          .select('*')
          .eq('id', accountId)
          .eq('user_id', user.id) // Ensure user owns this account
          .single();

        if (error || !account) {
          // Account not found or user doesn't own it, reset to first account
          const firstAccount = await AccountService.getCurrentAccount();
          if (firstAccount) {
            const newAccountId = firstAccount.id;
            setActiveAccountIdState(newAccountId);
            setActiveAccount(firstAccount);
            if (typeof window !== 'undefined') {
              localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, newAccountId);
            }
          } else {
            setActiveAccount(null);
            setActiveAccountIdState(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
            }
          }
        } else {
          setActiveAccount(account as Account);
        }
      } else {
        setActiveAccount(null);
      }
    } catch (error) {
      console.error('[ActiveAccountContext] Error loading active account:', error);
      setActiveAccount(null);
    } finally {
      setLoading(false);
    }
  }, [user, activeAccountId]);

  useEffect(() => {
    loadActiveAccount();
  }, [loadActiveAccount]);

  const setActiveAccountId = useCallback(async (accountId: string | null) => {
    if (!user) return;

    // If setting to null, get first account
    if (!accountId) {
      const firstAccount = await AccountService.getCurrentAccount();
      if (firstAccount) {
        accountId = firstAccount.id;
      } else {
        setActiveAccountIdState(null);
        setActiveAccount(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
        }
        return;
      }
    }

    // Verify user owns this account
    const { data: account, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single();

    if (error || !account) {
      throw new Error('Account not found or you do not have access to it');
    }

    setActiveAccountIdState(accountId);
    setActiveAccount(account as Account);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, accountId);
    }
  }, [user]);

  const refreshActiveAccount = useCallback(async () => {
    await loadActiveAccount();
  }, [loadActiveAccount]);

  return (
    <ActiveAccountContext.Provider
      value={{
        activeAccount,
        activeAccountId,
        setActiveAccountId,
        loading,
        refreshActiveAccount,
      }}
    >
      {children}
    </ActiveAccountContext.Provider>
  );
}

export function useActiveAccount() {
  const context = useContext(ActiveAccountContext);
  if (context === undefined) {
    throw new Error('useActiveAccount must be used within ActiveAccountProvider');
  }
  return context;
}

