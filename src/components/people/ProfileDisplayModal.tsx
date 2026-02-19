'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { XMarkIcon, UserIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import type { LookupAccount } from './FindAnyoneContent';

interface ProfileDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  /** Initial data from lookup for instant display */
  initialAccount?: LookupAccount | null;
}

interface FetchedAccount {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  bio?: string | null;
  created_at?: string;
}

export default function ProfileDisplayModal({
  isOpen,
  onClose,
  accountId,
  initialAccount,
}: ProfileDisplayModalProps) {
  const [account, setAccount] = useState<FetchedAccount | null>(initialAccount ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !accountId) return;
    setError(null);
    if (initialAccount && initialAccount.id === accountId) {
      setAccount(initialAccount);
      return;
    }
    setLoading(true);
    fetch(`/api/accounts/${accountId}`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Account not found');
        return res.json();
      })
      .then((data: { account: FetchedAccount }) => {
        setAccount(data.account);
      })
      .catch(() => {
        setError('Could not load profile');
        setAccount(null);
      })
      .finally(() => setLoading(false));
  }, [isOpen, accountId, initialAccount?.id]);

  if (!isOpen) return null;

  const displayName = account
    ? [account.first_name, account.last_name].filter(Boolean).join(' ') || account.username || 'Account'
    : '';
  const profileHref = account?.username ? `/${encodeURIComponent(account.username)}` : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Profile"
    >
      <div
        className="border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface w-full max-w-sm shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-[10px] border-b border-border-muted dark:border-white/10">
          <h2 className="text-sm font-semibold text-foreground">Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-foreground-muted hover:text-foreground transition-colors rounded"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-[10px] space-y-3">
          {loading && !account && (
            <p className="text-xs text-foreground-muted">Loading…</p>
          )}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          {account && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-surface-accent dark:bg-white/10 flex items-center justify-center">
                  {account.image_url ? (
                    <Image
                      src={account.image_url}
                      alt=""
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                      unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                    />
                  ) : (
                    <UserIcon className="w-5 h-5 text-foreground-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  {account.username && (
                    <p className="text-xs text-foreground-muted truncate">@{account.username}</p>
                  )}
                </div>
              </div>
              {account.bio && (
                <div>
                  <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide mb-0.5">Bio</p>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{account.bio}</p>
                </div>
              )}
              {profileHref && (
                <Link
                  href={profileHref}
                  onClick={onClose}
                  className="flex items-center gap-1.5 text-xs text-lake-blue hover:underline"
                >
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                  View full profile
                </Link>
              )}
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        className="absolute inset-0 -z-10"
        aria-label="Close"
        onClick={onClose}
      />
    </div>
  );
}
