'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStateSafe } from '@/features/auth';
import { Account } from '@/features/auth/services/memberService';
import { UserPlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface AccountListItem {
  id: string;
  user_id: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  role: 'general' | 'admin';
  onboarded: boolean;
  created_at: string;
  updated_at: string;
  last_visit: string | null;
}

interface AccountsResponse {
  accounts: AccountListItem[];
  total: number;
  limit: number;
  offset: number;
}

export default function ProfilesSecondaryContent() {
  const { account } = useAuthStateSafe();
  const isAdmin = account?.role === 'admin';
  
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'general' as 'general' | 'admin',
  });

  const fetchAccounts = useCallback(async () => {
    if (!isAdmin) return;
    
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/accounts?limit=100');
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Unauthorized. Admin privileges required.');
        }
        throw new Error('Failed to fetch accounts');
      }

      const data: AccountsResponse = await response.json();
      setAccounts(data.accounts || []);
      hasFetchedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [isAdmin]);

  // Only fetch once on mount when admin
  useEffect(() => {
    if (isAdmin && !hasFetchedRef.current && !isFetchingRef.current) {
      fetchAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]); // Only depend on isAdmin, not fetchAccounts

  const handleManualRefresh = useCallback(async () => {
    // Manual refresh - reset the fetched flag to allow refetch
    hasFetchedRef.current = false;
    await fetchAccounts();
  }, [fetchAccounts]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create account');
      }

      const newAccount = await response.json();
      setAccounts((prev) => [newAccount, ...prev]);
      setFormData({
        email: '',
        username: '',
        first_name: '',
        last_name: '',
        phone: '',
        role: 'general',
      });
      setShowCreateForm(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-600">Admin access required.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-600">Loading accounts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="bg-white border border-red-200 rounded-md p-[10px]">
          <p className="text-xs text-red-600">{error}</p>
          <button
            onClick={handleManualRefresh}
            className="mt-2 text-xs text-gray-600 hover:text-gray-900 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Accounts ({accounts.length})
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className="w-3 h-3" />
          </button>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md border border-gray-200 transition-colors"
          >
            <UserPlusIcon className="w-3 h-3" />
            Create
          </button>
        </div>
      </div>

      {/* Create Account Form */}
      {showCreateForm && (
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          <h3 className="text-xs font-semibold text-gray-900">Create New Account</h3>
          <form onSubmit={handleCreateAccount} className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="username"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="First"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="Last"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'general' | 'admin' })}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="general">General</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {createError && (
              <div className="text-xs text-red-600">{createError}</div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateError(null);
                  setFormData({
                    email: '',
                    username: '',
                    first_name: '',
                    last_name: '',
                    phone: '',
                    role: 'general',
                  });
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md border border-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Accounts List */}
      {accounts.length > 0 ? (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-white border border-gray-200 rounded-md p-[10px] space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {acc.first_name || acc.last_name
                        ? `${acc.first_name || ''} ${acc.last_name || ''}`.trim()
                        : acc.username || acc.email || 'Unnamed'}
                    </p>
                    {acc.role === 'admin' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-700 bg-gray-100 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                  {acc.email && (
                    <p className="text-xs text-gray-500 truncate">{acc.email}</p>
                  )}
                  {acc.username && acc.username !== acc.email && (
                    <p className="text-xs text-gray-500 truncate">@{acc.username}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                <span>Created: {formatDate(acc.created_at)}</span>
                {acc.last_visit && (
                  <span>Last visit: {formatDate(acc.last_visit)}</span>
                )}
                {acc.onboarded && (
                  <span className="text-green-600">Onboarded</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-600">No accounts found.</p>
        </div>
      )}
    </div>
  );
}

