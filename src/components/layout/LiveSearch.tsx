'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserIcon, MapPinIcon } from '@heroicons/react/24/outline';
import ProfilePhoto from '../shared/ProfilePhoto';
import type { Account } from '@/features/auth';

interface LiveMapMemberAccount {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  search_visibility?: boolean;
  onboarded?: boolean | null;
}

interface LiveMapMember {
  id: string;
  map_id: string;
  account_id: string;
  role: string;
  joined_at: string;
  account: LiveMapMemberAccount | null;
}

type PinPeriod = '24h' | '7d' | 'all';
type PeopleFilter = 'active' | 'all';

interface LiveMapPin {
  id: string;
  map_id: string;
  caption: string | null;
  description: string | null;
  full_address: string | null;
  emoji: string | null;
  image_url: string | null;
  media_url?: string | null;
  created_at: string;
  view_count?: number | null;
  lat?: number;
  lng?: number;
  account_id?: string | null;
  account?: { id: string; username: string | null } | null;
}

type Tab = 'accounts' | 'pins';

function getRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 604800)}w ago`;
  if (diffSeconds < 31536000) return `${Math.floor(diffSeconds / 2592000)}mo ago`;
  return `${Math.floor(diffSeconds / 31536000)}y ago`;
}

function pinTitle(pin: LiveMapPin): string {
  const text = (pin.caption ?? pin.description ?? pin.full_address ?? '').trim();
  return text || 'Pin';
}

/**
 * Full-screen search overlay below the app header. Shows when #search.
 * People: all live map members. Pins: live map pins with 24h / 7d / all time filter.
 */
function isAccountReady(account: LiveMapMemberAccount | null): boolean {
  return !!(
    account &&
    account.id &&
    account.username != null &&
    account.username !== '' &&
    account.onboarded === true
  );
}

export default function LiveSearch() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>('accounts');
  const [members, setMembers] = useState<LiveMapMember[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [pins, setPins] = useState<LiveMapPin[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsError, setPinsError] = useState<string | null>(null);
  const [pinPeriod, setPinPeriod] = useState<PinPeriod>('all');
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>('all');

  const fetchLiveMembers = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const res = await fetch('/api/maps/live/members', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) {
          setMembers([]);
          return;
        }
        if (res.status === 403) {
          setMembers([]);
          return;
        }
        setAccountsError('Failed to load members');
        setMembers([]);
        return;
      }
      const data = await res.json();
      const list: LiveMapMember[] = data.members ?? [];
      setMembers(list);
    } catch {
      setAccountsError('Failed to load members');
      setMembers([]);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const fetchLivePins = useCallback(async () => {
    setPinsLoading(true);
    setPinsError(null);
    try {
      const params = new URLSearchParams();
      if (pinPeriod !== 'all') params.set('period', pinPeriod);
      const res = await fetch(`/api/maps/live/pins${params.toString() ? `?${params}` : ''}`, { credentials: 'include' });
      if (!res.ok) {
        setPinsError('Failed to load pins');
        setPins([]);
        return;
      }
      const data = await res.json();
      setPins(data.pins ?? []);
    } catch {
      setPinsError('Failed to load pins');
      setPins([]);
    } finally {
      setPinsLoading(false);
    }
  }, [pinPeriod]);

  useEffect(() => {
    if (tab === 'accounts') {
      fetchLiveMembers();
    }
  }, [tab, fetchLiveMembers]);

  useEffect(() => {
    if (tab === 'pins') {
      setPinsLoading(true);
      fetchLivePins();
    }
  }, [tab, pinPeriod, fetchLivePins]);

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col bg-white overflow-hidden pointer-events-auto"
      data-container="live-search"
      aria-label="Search"
    >
      <div className="flex-shrink-0 border-b border-gray-200 p-2">
        <div className="flex gap-1 rounded-md bg-gray-100 p-0.5">
          <button
            type="button"
            onClick={() => setTab('accounts')}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tab === 'accounts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            People
          </button>
          <button
            type="button"
            onClick={() => setTab('pins')}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tab === 'pins' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pins
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {tab === 'accounts' && (
          <>
            <div className="flex gap-1 rounded-md bg-gray-100 p-0.5">
              {(['active', 'all'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setPeopleFilter(f)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    peopleFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {f === 'active' ? 'Active' : 'All'}
                </button>
              ))}
            </div>
            {accountsLoading && (
              <div className="p-[10px] border border-gray-200 rounded-md bg-white">
                <p className="text-xs text-gray-500">Loading…</p>
              </div>
            )}
            {!accountsLoading && accountsError && (
              <div className="p-[10px] border border-gray-200 rounded-md bg-white">
                <p className="text-xs text-gray-500">{accountsError}</p>
              </div>
            )}
            {!accountsLoading && !accountsError && (() => {
              const filtered = peopleFilter === 'active' ? members.filter((m) => isAccountReady(m.account)) : members;
              if (filtered.length === 0) {
                return (
                  <div className="p-[10px] border border-gray-200 rounded-md bg-white">
                    <p className="text-xs text-gray-500">
                      {peopleFilter === 'active' ? 'No active members.' : 'No members. Sign in to view the live map member list.'}
                    </p>
                  </div>
                );
              }
              return filtered.map((member) => {
              const account = member.account;
              const ready = isAccountReady(account);
              if (ready && account) {
                return (
                  <Link
                    key={member.id}
                    href={`/${account.username ?? account.id}`}
                    className="flex items-center gap-2 p-[10px] border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors no-underline cursor-pointer"
                  >
                    <ProfilePhoto
                      account={account as unknown as Account}
                      size="xs"
                      editable={false}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        @{account.username ?? 'account'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {[account.first_name, account.last_name].filter(Boolean).join(' ') || 'Account'}
                      </p>
                    </div>
                    <UserIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </Link>
                );
              }
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-2 p-[10px] border border-gray-200 rounded-md bg-white"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      Waiting for Account Setup
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {account ? [account.first_name, account.last_name].filter(Boolean).join(' ') || 'Member' : 'Member'}
                    </p>
                  </div>
                </div>
              );
            });
            })()}
          </>
        )}
        {tab === 'pins' && (
          <>
            <div className="flex gap-1 rounded-md bg-gray-100 p-0.5">
              {(['24h', '7d', 'all'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPinPeriod(p)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    pinPeriod === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {p === '24h' ? '24h' : p === '7d' ? '7 day' : 'All time'}
                </button>
              ))}
            </div>
            {pinsLoading && (
              <div className="p-[10px] border border-gray-200 rounded-md bg-white">
                <p className="text-xs text-gray-500">Loading…</p>
              </div>
            )}
            {!pinsLoading && pinsError && (
              <div className="p-[10px] border border-gray-200 rounded-md bg-white">
                <p className="text-xs text-gray-500">{pinsError}</p>
              </div>
            )}
            {!pinsLoading && !pinsError && pins.length === 0 && (
              <div className="p-[10px] border border-gray-200 rounded-md bg-white">
                <p className="text-xs text-gray-500">No pins in this period.</p>
              </div>
            )}
            {!pinsLoading && !pinsError && pins.length > 0 && pins.map((pin) => {
              const mediaImageUrl = pin.image_url ?? pin.media_url ?? null;
              const hasLocation = typeof pin.lat === 'number' && typeof pin.lng === 'number';
              const handlePinClick = () => {
                if (!hasLocation) return;
                const url = `${pathname}${window.location.search || ''}`;
                window.history.replaceState(null, '', url);
                window.dispatchEvent(new HashChangeEvent('hashchange'));
                window.dispatchEvent(
                  new CustomEvent('live-search-pin-select', {
                    detail: { lat: pin.lat, lng: pin.lng },
                  })
                );
              };
              return (
                <button
                  key={pin.id}
                  type="button"
                  onClick={handlePinClick}
                  className="w-full flex items-center gap-2 p-[10px] border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden">
                    {mediaImageUrl ? (
                      <img
                        src={mediaImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <MapPinIcon className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {pinTitle(pin)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {pin.account?.username ? (
                        <>@{pin.account.username}</>
                      ) : null}
                      {pin.account?.username ? ' · ' : null}
                      Live map · {getRelativeTime(pin.created_at)}
                      {typeof pin.view_count === 'number' && pin.view_count >= 0 && (
                        <> · {pin.view_count} {pin.view_count === 1 ? 'view' : 'views'}</>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
