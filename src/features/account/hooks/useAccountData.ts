'use client';

import { useState, useEffect } from 'react';
import { useAuth, AccountService, Account } from '@/features/auth';
import type { BillingData } from '@/lib/billingServer';
import type { AccountData, AccountTabId } from '../types';

/**
 * Hook to fetch and manage account data (account, email, billing)
 * Used by AccountModal and other components that need account data
 */
export function useAccountData(
  isOpen: boolean,
  activeTab?: AccountTabId
): AccountData {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [billingData, setBillingData] = useState<BillingData | null>(null);
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

          // Fetch billing data if on billing tab
          if (activeTab === 'billing') {
            try {
              const response = await fetch('/api/billing/data');
              if (response.ok) {
                const data = await response.json();
                setBillingData(data);
              }
            } catch (err) {
              console.error('Error fetching billing data:', err);
            }
          }
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
      setBillingData(null);
      setLoading(false);
    }
  }, [isOpen, user, activeTab]);

  // Fetch billing data when switching to billing tab
  useEffect(() => {
    if (isOpen && activeTab === 'billing' && !billingData && account) {
      const fetchBillingData = async () => {
        try {
          const response = await fetch('/api/billing/data');
          if (response.ok) {
            const data = await response.json();
            setBillingData(data);
          }
        } catch (err) {
          console.error('Error fetching billing data:', err);
        }
      };
      fetchBillingData();
    }
  }, [isOpen, activeTab, billingData, account]);

  return {
    account,
    userEmail,
    billingData,
    loading,
    error,
  };
}

