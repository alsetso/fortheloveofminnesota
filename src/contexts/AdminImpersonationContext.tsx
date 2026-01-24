'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuthStateSafe } from '@/features/auth';
import type { Account } from '@/features/auth';

interface AdminImpersonationContextType {
  /** Selected account ID for impersonation (admin only) */
  selectedAccountId: string | null;
  /** Set the selected account ID for impersonation */
  setSelectedAccountId: (accountId: string | null) => void;
  /** All accounts available for selection (admin only) */
  allAccounts: Account[];
  /** Loading state for accounts */
  isLoadingAccounts: boolean;
  /** Refresh the accounts list */
  refreshAccounts: () => Promise<void>;
  /** Check if admin impersonation is active */
  isImpersonating: boolean;
}

const AdminImpersonationContext = createContext<AdminImpersonationContextType | undefined>(undefined);

const ADMIN_SELECTED_ACCOUNT_KEY = 'admin_selected_account_id';

export function AdminImpersonationProvider({ children }: { children: ReactNode }) {
  const { account } = useAuthStateSafe();
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(null);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  const isAdmin = account?.role === 'admin';

  // Load selected account ID from localStorage on mount
  useEffect(() => {
    if (isAdmin && typeof window !== 'undefined') {
      const stored = localStorage.getItem(ADMIN_SELECTED_ACCOUNT_KEY);
      if (stored) {
        try {
          setSelectedAccountIdState(stored);
        } catch (error) {
          console.error('Error loading admin selected account:', error);
        }
      }
    } else if (!isAdmin) {
      // Clear selection if user is no longer admin
      setSelectedAccountIdState(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(ADMIN_SELECTED_ACCOUNT_KEY);
      }
    }
  }, [isAdmin]);

  // Save selected account ID to localStorage when it changes
  useEffect(() => {
    if (isAdmin && typeof window !== 'undefined') {
      if (selectedAccountId) {
        localStorage.setItem(ADMIN_SELECTED_ACCOUNT_KEY, selectedAccountId);
      } else {
        localStorage.removeItem(ADMIN_SELECTED_ACCOUNT_KEY);
      }
    }
  }, [selectedAccountId, isAdmin]);

  // Fetch all accounts for admin selection
  const fetchAllAccounts = async () => {
    if (!isAdmin) {
      setAllAccounts([]);
      return;
    }

    setIsLoadingAccounts(true);
    try {
      // For admins, fetch all accounts (not just their own)
      // First try admin endpoint, fallback to regular endpoint
      let response = await fetch('/api/admin/accounts?limit=1000', {
        credentials: 'include',
      });
      
      // If admin endpoint doesn't exist or fails, use regular endpoint (will only return user's accounts)
      if (!response.ok) {
        response = await fetch('/api/accounts?limit=1000', {
          credentials: 'include',
        });
      }
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setAllAccounts(data.accounts || []);
        }
      }
    } catch (error) {
      console.error('Error fetching accounts for admin selection:', error);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  // Fetch accounts when admin status changes
  useEffect(() => {
    if (isAdmin) {
      fetchAllAccounts();
    } else {
      setAllAccounts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const setSelectedAccountId = (accountId: string | null) => {
    setSelectedAccountIdState(accountId);
  };

  const refreshAccounts = async () => {
    await fetchAllAccounts();
  };

  const isImpersonating = isAdmin && selectedAccountId !== null;

  return (
    <AdminImpersonationContext.Provider
      value={{
        selectedAccountId,
        setSelectedAccountId,
        allAccounts,
        isLoadingAccounts,
        refreshAccounts,
        isImpersonating,
      }}
    >
      {children}
    </AdminImpersonationContext.Provider>
  );
}

export function useAdminImpersonation() {
  const context = useContext(AdminImpersonationContext);
  if (context === undefined) {
    throw new Error('useAdminImpersonation must be used within AdminImpersonationProvider');
  }
  return context;
}

export function useAdminImpersonationSafe() {
  const context = useContext(AdminImpersonationContext);
  return context || {
    selectedAccountId: null,
    setSelectedAccountId: () => {},
    allAccounts: [],
    isLoadingAccounts: false,
    refreshAccounts: async () => {},
    isImpersonating: false,
  };
}
