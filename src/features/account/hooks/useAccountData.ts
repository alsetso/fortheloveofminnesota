'use client';

import { useState, useEffect } from 'react';
import { useAuth, AccountService, Account } from '@/features/auth';
import type { AccountData, AccountTabId } from '../types';

/**
 * Hook to fetch and manage account data (account, email)
 * Used by AccountModal and other components that need account data
 */
export function useAccountData(
  isOpen: boolean,
  activeTab?: AccountTabId
): AccountData {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch account data when modal opens
  useEffect(() => {
    if (isOpen && user) {
      const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
          const accountData = await AccountService.getCurrentAccount();
          setAccount(accountData);
          setUserEmail(user.email || '');
        } catch (err) {
          console.error('Error fetching account data:', err);
          setError(err instanceof Error ? err.message : 'Failed to load account data');
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    } else if (!user) {
      setAccount(null);
      setUserEmail('');
      setLoading(false);
    }
  }, [isOpen, user, activeTab]);

  return {
    account,
    userEmail,
    loading,
    error,
  };
}

