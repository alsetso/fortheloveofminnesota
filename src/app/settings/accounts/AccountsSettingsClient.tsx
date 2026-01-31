'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { useAuthStateSafe } from '@/features/auth/contexts/AuthStateContext';
import { useToast } from '@/features/ui/hooks/useToast';
import { AccountService } from '@/features/auth';
import type { Account } from '@/features/auth';

export default function AccountsSettingsClient() {
  const router = useRouter();
  const { account: currentAccount } = useSettings();
  const { setActiveAccountId, activeAccountId } = useAuthStateSafe();
  const { success, error: showError } = useToast();
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingAccount, setSwitchingAccount] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    phone: '',
  });

  const isAdmin = currentAccount?.role === 'admin';

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/accounts?limit=100', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch accounts');
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      showError('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/settings');
      return;
    }
    fetchAccounts();
  }, [isAdmin, fetchAccounts, router]);

  const handleSwitchAccount = async (accountId: string) => {
    if (accountId === activeAccountId) return;
    
    setSwitchingAccount(accountId);
    try {
      await setActiveAccountId(accountId);
      router.refresh();
      success('Account switched');
    } catch (error) {
      console.error('Error switching account:', error);
      showError('Failed to switch account');
    } finally {
      setSwitchingAccount(null);
    }
  };

  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username.trim() || null,
          first_name: formData.first_name.trim() || null,
          last_name: formData.last_name.trim() || null,
          phone: formData.phone.trim() || null,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Failed to create account');
      }

      const newAccount = await response.json();
      
      setFormData({
        username: '',
        first_name: '',
        last_name: '',
        phone: '',
      });
      setShowCreateForm(false);
      await fetchAccounts();
      success('Account created');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create account');
      showError(err instanceof Error ? err.message : 'Failed to create account');
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Manage Accounts</h2>
        <p className="text-xs text-gray-600">
          Create and switch between multiple accounts for this user.
        </p>
      </div>

      {/* Create Account Form */}
      {showCreateForm ? (
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900">Create New Account</h3>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setCreateError(null);
                setFormData({ username: '', first_name: '', last_name: '', phone: '' });
              }}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          
          <form onSubmit={handleCreateAccount} className="space-y-2">
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-xs font-medium text-gray-900">
                Username (optional)
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="username"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label htmlFor="first_name" className="text-xs font-medium text-gray-900">
                  First Name
                </label>
                <input
                  id="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="First"
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                />
              </div>
              
              <div className="space-y-1.5">
                <label htmlFor="last_name" className="text-xs font-medium text-gray-900">
                  Last Name
                </label>
                <input
                  id="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Last"
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-xs font-medium text-gray-900">
                Phone (optional)
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              />
            </div>
            
            {createError && (
              <p className="text-[10px] text-red-600">{createError}</p>
            )}
            
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateError(null);
                  setFormData({ username: '', first_name: '', last_name: '', phone: '' });
                }}
                className="px-2 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full bg-white border border-gray-200 rounded-md p-[10px] flex items-center gap-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <PlusIcon className="w-4 h-4 text-gray-500" />
          <span>Create New Account</span>
        </button>
      )}

      {/* Accounts List */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="px-[10px] py-1.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
          All Accounts ({accounts.length})
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-[10px] text-center">
            <p className="text-xs text-gray-600">No accounts found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {accounts.map((acc) => {
              const isActive = acc.id === activeAccountId;
              const displayName = getDisplayName(acc);
              const isSwitching = switchingAccount === acc.id;
              
              return (
                <button
                  key={acc.id}
                  onClick={() => handleSwitchAccount(acc.id)}
                  disabled={isActive || isSwitching}
                  className="w-full flex items-center gap-2 p-[10px] hover:bg-gray-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex-shrink-0">
                    {acc.image_url ? (
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 relative">
                        <Image
                          src={acc.image_url}
                          alt={displayName}
                          fill
                          className="object-cover"
                          unoptimized={acc.image_url.includes('supabase.co')}
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <UserCircleIcon className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {displayName}
                      </p>
                      {isActive && (
                        <CheckIcon className="w-3 h-3 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {acc.username && (
                        <span className="text-[10px] text-gray-500">@{acc.username}</span>
                      )}
                      {acc.role && (
                        <span className="text-[10px] text-gray-500 capitalize">
                          {acc.role}
                        </span>
                      )}
                      {acc.created_at && (
                        <span className="text-[10px] text-gray-500">
                          {formatDate(acc.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {isSwitching && (
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
