'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useActiveAccount } from '../contexts/ActiveAccountContext';

interface Account {
  id: string;
  user_id: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  role: string;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
  last_visit: string | null;
}

interface AccountsResponse {
  accounts: Account[];
  total: number;
  limit: number;
  offset: number;
}

export default function ProfilesClient() {
  const { activeAccountId, setActiveAccountId, refreshActiveAccount } = useActiveAccount();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [switchingAccount, setSwitchingAccount] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    phone: '',
  });

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/accounts?limit=${limit}&offset=${offset}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        const json = await response.json();
        throw new Error(json.error || 'Failed to load accounts');
      }

      const data: AccountsResponse = await response.json();
      setAccounts(data.accounts);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [offset]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Failed to create account');
      }

      // Reset form and refresh list
      setFormData({
        username: '',
        first_name: '',
        last_name: '',
        phone: '',
      });
      setShowCreateForm(false);
      await fetchAccounts();
      
      // If this is the first account, set it as active
      if (accounts.length === 0) {
        const newAccount = await response.json();
        await setActiveAccountId(newAccount.id);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  const getDisplayName = (account: Account) => {
    if (account.first_name || account.last_name) {
      return [account.first_name, account.last_name].filter(Boolean).join(' ') || account.username || account.email || 'Unknown';
    }
    return account.username || account.email || 'Unknown';
  };

  const handleSwitchAccount = async (accountId: string) => {
    setSwitchingAccount(accountId);
    try {
      await setActiveAccountId(accountId);
      // Refresh active account context to ensure all components update
      await refreshActiveAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch account');
    } finally {
      setSwitchingAccount(null);
    }
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">User Accounts</h3>
          <p className="text-xs text-gray-500 mt-0.5">{total} total</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
        >
          <PlusIcon className="w-3 h-3" />
          New Account
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="p-[10px] bg-gray-50 border border-gray-200 rounded-md space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-900">Create New Account</h4>
            <button
              onClick={() => setShowCreateForm(false)}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </div>

          <form onSubmit={handleCreateAccount} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">First Name</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Last Name</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>

            {createError && (
              <p className="text-xs text-red-600">{createError}</p>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full px-2 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        </div>
      )}

      {/* Accounts List */}
      <div className="space-y-0.5">
        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500">No accounts found</p>
          </div>
        ) : (
          accounts.map((account) => {
            const isActive = account.id === activeAccountId;
            return (
              <div
                key={account.id}
                className={`p-[10px] bg-white border rounded-md transition-colors ${
                  isActive
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {getDisplayName(account)}
                      </p>
                      {isActive && (
                        <span className="flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-medium text-gray-700 bg-gray-200 rounded">
                          <CheckIcon className="w-2.5 h-2.5" />
                          Active
                        </span>
                      )}
                      {account.role === 'admin' && (
                        <span className="px-1 py-0.5 text-[10px] font-medium text-gray-700 bg-gray-100 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {account.email && (
                        <p className="text-xs text-gray-600 truncate">{account.email}</p>
                      )}
                      {account.username && (
                        <p className="text-xs text-gray-500">@{account.username}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Created {formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  {!isActive && (
                    <button
                      onClick={() => handleSwitchAccount(account.id)}
                      disabled={switchingAccount === account.id}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {switchingAccount === account.id ? 'Switching...' : 'Switch'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <p className="text-xs text-gray-500">
            {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </p>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

