'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  UserCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
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
  const [checkingAdmin, setCheckingAdmin] = useState(true);
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
    // Check admin status
    setCheckingAdmin(false);
    
    if (!isAdmin) {
      // Redirect non-admins after a brief delay to show the message
      const timer = setTimeout(() => {
        router.push('/settings');
      }, 2000);
      return () => clearTimeout(timer);
    }
    
    fetchAccounts();
    return undefined;
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

  // Show admin verification and access denied message for non-admins
  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheckIcon className="w-5 h-5 text-red-500" />
            <h2 className="text-sm font-semibold text-foreground">Admin Access Required</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-[10px] border border-red-200 dark:border-red-500/50 rounded-md bg-red-50 dark:bg-red-900/20">
              <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-red-700 dark:text-red-400">Admin Verification Failed</p>
                <p className="text-[10px] text-red-600 dark:text-red-400/80 mt-0.5">
                  Your account role: <span className="font-medium">{currentAccount?.role || 'user'}</span>
                </p>
              </div>
            </div>
            <div className="p-[10px] border border-border-muted dark:border-white/10 rounded-md bg-surface-accent">
              <p className="text-xs text-foreground-muted">
                This page is restricted to administrators only. You will be redirected to settings in a moment.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Admin Verification Header */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-semibold text-foreground">Manage Accounts</h2>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/50">
            <CheckCircleIcon className="w-3 h-3 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">Admin Verified</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-[10px] border border-green-200 dark:border-green-500/50 rounded-md bg-green-50 dark:bg-green-900/20">
          <div className="flex-1">
            <p className="text-xs font-medium text-green-700 dark:text-green-400">Admin Access Granted</p>
            <p className="text-[10px] text-green-600 dark:text-green-400/80 mt-0.5">
              Account role: <span className="font-medium">{currentAccount?.role}</span>
            </p>
          </div>
        </div>
        <p className="text-xs text-foreground-muted mt-2">
          Create and switch between multiple accounts for this user. This page is restricted to administrators only.
        </p>
      </div>

      {/* Create Account Form */}
      {showCreateForm ? (
        <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground">Create New Account</h3>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setCreateError(null);
                setFormData({ username: '', first_name: '', last_name: '', phone: '' });
              }}
              className="text-foreground-muted hover:text-foreground transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          
          <form onSubmit={handleCreateAccount} className="space-y-2">
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-xs font-medium text-foreground">
                Username (optional)
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="username"
                className="w-full px-2 py-1.5 text-xs border border-border-muted dark:border-white/10 rounded-md bg-surface focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/20 text-foreground"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label htmlFor="first_name" className="text-xs font-medium text-foreground">
                  First Name
                </label>
                <input
                  id="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="First"
                  className="w-full px-2 py-1.5 text-xs border border-border-muted dark:border-white/10 rounded-md bg-surface focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/20 text-foreground"
                />
              </div>
              
              <div className="space-y-1.5">
                <label htmlFor="last_name" className="text-xs font-medium text-foreground">
                  Last Name
                </label>
                <input
                  id="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Last"
                  className="w-full px-2 py-1.5 text-xs border border-border-muted dark:border-white/10 rounded-md bg-surface focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/20 text-foreground"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-xs font-medium text-foreground">
                Phone (optional)
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
                className="w-full px-2 py-1.5 text-xs border border-border-muted dark:border-white/10 rounded-md bg-surface focus:outline-none focus:ring-1 focus:ring-foreground/20 focus:border-foreground/20 text-foreground"
              />
            </div>
            
            {createError && (
              <p className="text-[10px] text-red-600 dark:text-red-400">{createError}</p>
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
                className="px-2 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px] flex items-center gap-2 text-xs font-medium text-foreground-muted hover:bg-surface-accent dark:hover:bg-white/10 hover:text-foreground transition-colors"
        >
          <PlusIcon className="w-4 h-4 text-foreground-muted" />
          <span>Create New Account</span>
        </button>
      )}

      {/* Accounts List */}
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md overflow-hidden">
        <div className="px-[10px] py-1.5 text-[10px] font-medium text-foreground-muted uppercase tracking-wide bg-surface-accent border-b border-border-muted dark:border-white/10">
          All Accounts ({accounts.length})
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-4 h-4 border-2 border-border-muted dark:border-white/30 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-[10px] text-center">
            <p className="text-xs text-foreground-muted">No accounts found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-muted dark:divide-white/10">
            {accounts.map((acc) => {
              const isActive = acc.id === activeAccountId;
              const displayName = getDisplayName(acc);
              const isSwitching = switchingAccount === acc.id;
              
              return (
                <button
                  key={acc.id}
                  onClick={() => handleSwitchAccount(acc.id)}
                  disabled={isActive || isSwitching}
                  className="w-full flex items-center gap-2 p-[10px] hover:bg-surface-accent dark:hover:bg-white/10 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex-shrink-0">
                    {acc.image_url ? (
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-accent relative">
                        <Image
                          src={acc.image_url}
                          alt={displayName}
                          fill
                          className="object-cover"
                          unoptimized={acc.image_url.includes('supabase.co')}
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-surface-accent flex items-center justify-center">
                        <UserCircleIcon className="w-5 h-5 text-foreground-muted" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-foreground truncate">
                        {displayName}
                      </p>
                      {isActive && (
                        <CheckIcon className="w-3 h-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {acc.username && (
                        <span className="text-[10px] text-foreground-muted">@{acc.username}</span>
                      )}
                      {acc.role && (
                        <span className={`text-[10px] px-1 py-0.5 rounded ${
                          acc.role === 'admin' 
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium' 
                            : 'text-foreground-muted capitalize'
                        }`}>
                          {acc.role}
                        </span>
                      )}
                      {acc.created_at && (
                        <span className="text-[10px] text-foreground-muted">
                          {formatDate(acc.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {isSwitching && (
                    <div className="w-4 h-4 border-2 border-border-muted dark:border-white/30 border-t-foreground rounded-full animate-spin flex-shrink-0" />
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
