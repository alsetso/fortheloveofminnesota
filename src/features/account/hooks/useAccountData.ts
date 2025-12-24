'use client';

import { useAuthStateSafe } from '@/features/auth';
import type { AccountData, AccountTabId } from '../types';

/**
 * Hook to fetch and manage account data (account, email)
 * Used by AccountModal and other components that need account data
 */
export function useAccountData(
  isOpen: boolean,
  activeTab?: AccountTabId
): AccountData {
  const { user, account, isAccountLoading } = useAuthStateSafe();

  return {
    account,
    userEmail: user?.email || '',
    loading: isAccountLoading,
    error: null,
  };
}


