'use client';

import { useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { useActiveAccount } from '../contexts/ActiveAccountContext';
import type { AccountData, AccountTabId } from '../types';

/**
 * Hook to fetch and manage account data (account, email)
 * Used by AccountModal and other components that need account data
 * Now uses the active account from ActiveAccountContext
 */
export function useAccountData(
  isOpen: boolean,
  activeTab?: AccountTabId
): AccountData {
  const { user } = useAuth();
  const { activeAccount, loading: accountLoading } = useActiveAccount();

  // Return account data from active account context
  return {
    account: activeAccount,
    userEmail: user?.email || '',
    loading: accountLoading,
    error: null,
  };
}


