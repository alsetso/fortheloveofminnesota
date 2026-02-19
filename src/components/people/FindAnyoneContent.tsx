'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  UserCircleIcon,
  DocumentMagnifyingGlassIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import PersonDataModal from './PersonDataModal';
import ProfileDisplayModal from './ProfileDisplayModal';

type SearchTab = 'name' | 'email' | 'phone';

type TerminalPhase =
  | 'idle'
  | 'looking'
  | 'checking_account'
  | 'public_sources'
  | 'results';

interface SearchState {
  type: SearchTab;
  value: string;
  firstName?: string;
  lastName?: string;
}

export interface LookupAccount {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  /** Present for phone lookup: full = 10-digit match, partial = 7-digit suffix match */
  match_type?: 'full' | 'partial';
}

/** Flexible extraction for skip-tracing API response. Handles PeopleDetails, Records, records, data, results. */
function extractPublicRecords(data: Record<string, unknown> | null): { records: Record<string, unknown>[]; count: number } {
  if (!data || 'error' in data) return { records: [], count: 0 };
  const arr =
    (data.PeopleDetails as Record<string, unknown>[] | undefined) ??
    (data.Records as Record<string, unknown>[] | undefined) ??
    (data.records as Record<string, unknown>[] | undefined) ??
    (data.data as Record<string, unknown>[] | undefined) ??
    (data.results as Record<string, unknown>[] | undefined) ??
    (Array.isArray(data) ? data : []);
  const records = Array.isArray(arr) ? arr : [];
  const count = records.length;
  return { records, count };
}

function getRecordDisplayName(r: Record<string, unknown>): string {
  const name =
    (r.Name as string) ??
    (r.name as string) ??
    (r.FullName as string) ??
    (r.full_name as string) ??
    ([r.FirstName, r.LastName].filter(Boolean).join(' ') || [r.first_name, r.last_name].filter(Boolean).join(' ')) ??
    '';
  return String(name || 'Unknown');
}

const TERMINAL_LABEL: Record<SearchTab, string> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
};

function maskValue(type: SearchTab, value: string): string {
  const v = value.trim();
  if (!v) return '—';
  if (type === 'email') {
    const [local, domain] = v.split('@');
    if (!domain) return `${v.slice(0, 2)}***`;
    return `${local.slice(0, 2)}***@${domain}`;
  }
  if (type === 'phone') {
    const digits = v.replace(/\D/g, '');
    if (digits.length < 4) return '***';
    return `***${digits.slice(-4)}`;
  }
  return v.length > 3 ? `${v.slice(0, 2)}***${v.slice(-1)}` : '***';
}

const PHASE_DELAY_MS = 800;

async function fetchLookup(lastSearch: SearchState): Promise<{ accounts: LookupAccount[]; count: number; search_id?: string }> {
  const body =
    lastSearch.type === 'name'
      ? { type: 'name' as const, firstName: lastSearch.firstName?.trim() ?? '', lastName: lastSearch.lastName?.trim() ?? '' }
      : lastSearch.type === 'email'
        ? { type: 'email' as const, email: lastSearch.value }
        : { type: 'phone' as const, phone: lastSearch.value };

  const res = await fetch('/api/people/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Lookup failed');
  }
  return res.json();
}

function buildPublicRecordsBody(lastSearch: SearchState, searchId?: string | null): { type: SearchTab; name?: string; email?: string; phone?: string; search_id?: string } {
  const base = ((): { type: SearchTab; name?: string; email?: string; phone?: string } => {
    switch (lastSearch.type) {
      case 'name': {
        const f = (lastSearch.firstName ?? '').trim();
        const l = (lastSearch.lastName ?? '').trim();
        const name = [f, l].filter(Boolean).join(' ');
        return name ? { type: 'name', name } : { type: 'name', name: lastSearch.value };
      }
      case 'email':
        return { type: 'email', email: lastSearch.value };
      case 'phone':
        return { type: 'phone', phone: lastSearch.value };
    }
  })();
  return searchId ? { ...base, search_id: searchId } : base;
}

async function fetchPublicRecords(lastSearch: SearchState, searchId?: string | null): Promise<Record<string, unknown>> {
  const body = buildPublicRecordsBody(lastSearch, searchId);
  if (body.type === 'name' && !body.name) return { records: [], count: 0 };
  const res = await fetch('/api/people/public-records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Public records failed');
  }
  return res.json();
}

export default function FindAnyoneContent() {
  const { account } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SearchTab>('name');
  const { data: recentData } = useQuery(
    account?.id
      ? {
          queryKey: ['people', 'search', 'recent', account.id],
          queryFn: async () => {
            const res = await fetch('/api/people/search/recent', { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json() as Promise<{ searches: { id: string }[]; search_count: number; pull_request_count: number }>;
          },
          staleTime: 60 * 1000,
        }
      : { queryKey: ['skip'], queryFn: () => null, enabled: false }
  );
  const searchLimitMet = (recentData?.search_count ?? 0) >= 1;
  const savedSearchId = recentData?.searches?.[0]?.id;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [terminalPhase, setTerminalPhase] = useState<TerminalPhase>('idle');
  const [lastSearch, setLastSearch] = useState<SearchState | null>(null);
  const [accountLookupResult, setAccountLookupResult] = useState<{ accounts: LookupAccount[]; count: number } | null>(null);
  const [publicRecordsResult, setPublicRecordsResult] = useState<Record<string, unknown> | null>(null);
  const [searchComplete, setSearchComplete] = useState(false);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const [personModalRecord, setPersonModalRecord] = useState<Record<string, unknown> | null>(null);
  const [profileModalAccountId, setProfileModalAccountId] = useState<string | null>(null);
  const [profileModalInitial, setProfileModalInitial] = useState<LookupAccount | null>(null);
  const lookupDoneRef = useRef(false);
  const publicRecordsDoneRef = useRef(false);
  const phaseTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (searchComplete && currentSearchId) {
      queryClient.invalidateQueries({ queryKey: ['people', 'search', 'recent'] });
    }
  }, [searchComplete, currentSearchId, queryClient]);

  const getNameValue = useCallback(() => {
    const f = firstName.trim();
    const l = lastName.trim();
    return [f, l].filter(Boolean).join(' ');
  }, [firstName, lastName]);

  const getValue = useCallback(() => {
    switch (activeTab) {
      case 'name':
        return getNameValue();
      case 'email':
        return email.trim();
      case 'phone':
        return phone.trim();
    }
  }, [activeTab, getNameValue, email, phone]);

  const canSubmit = useCallback(() => {
    if (activeTab === 'name') return Boolean(firstName.trim() || lastName.trim());
    return Boolean(getValue());
  }, [activeTab, firstName, lastName, getValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;
    const value = getValue();
    if (!value) return;

    const state: SearchState = {
      type: activeTab,
      value,
      ...(activeTab === 'name' ? { firstName: firstName.trim(), lastName: lastName.trim() } : {}),
    };
    setLastSearch(state);
    setTerminalPhase('looking');
    setCurrentSearchId(null);
    setAccountLookupResult(null);
    setPublicRecordsResult(null);
    setSearchComplete(false);
    lookupDoneRef.current = false;
    publicRecordsDoneRef.current = false;
  };

  // After "looking", advance to checking_account
  useEffect(() => {
    if (!lastSearch) return;
    const t = setTimeout(() => setTerminalPhase('checking_account'), PHASE_DELAY_MS);
    return () => clearTimeout(t);
  }, [lastSearch]);

  // When at checking_account, run lookup API then advance to public_sources
  useEffect(() => {
    if (terminalPhase !== 'checking_account' || !lastSearch || lookupDoneRef.current) return;

    lookupDoneRef.current = true;
    phaseTimeoutsRef.current = [];

    fetchLookup(lastSearch)
      .then((data) => {
        setAccountLookupResult(data);
        setCurrentSearchId(data.search_id ?? null);
        const t = setTimeout(() => setTerminalPhase('public_sources'), 400);
        phaseTimeoutsRef.current = [t];
      })
      .catch(() => {
        setAccountLookupResult({ accounts: [], count: 0 });
        setCurrentSearchId(null);
        const t = setTimeout(() => setTerminalPhase('public_sources'), 400);
        phaseTimeoutsRef.current = [t];
      });

    return () => {
      phaseTimeoutsRef.current.forEach(clearTimeout);
      phaseTimeoutsRef.current = [];
    };
  }, [terminalPhase, lastSearch]);

  // When at public_sources, call public records API for all search types; advance to results when done
  useEffect(() => {
    if (terminalPhase !== 'public_sources' || !lastSearch || publicRecordsDoneRef.current) return;

    const body = buildPublicRecordsBody(lastSearch, currentSearchId);
    if (body.type === 'name' && !body.name) {
      publicRecordsDoneRef.current = true;
      setPublicRecordsResult({ records: [], count: 0 });
      setTerminalPhase('results');
      setSearchComplete(true);
      return;
    }

    publicRecordsDoneRef.current = true;
    fetchPublicRecords(lastSearch, currentSearchId)
      .then((data) => {
        setPublicRecordsResult(data);
        setTerminalPhase('results');
        setSearchComplete(true);
      })
      .catch(() => {
        setPublicRecordsResult({ error: 'Public records lookup failed' });
        setTerminalPhase('results');
        setSearchComplete(true);
      });
  }, [terminalPhase, lastSearch, currentSearchId]);

  const tabs: { id: SearchTab; label: string; icon: typeof UserIcon }[] = [
    { id: 'name', label: 'By name', icon: UserIcon },
    { id: 'email', label: 'By email', icon: EnvelopeIcon },
    { id: 'phone', label: 'By phone', icon: PhoneIcon },
  ];

  if (!account) {
    return (
      <div className="w-full max-w-2xl mx-auto py-6 px-4 space-y-3">
        <section className="border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px]">
          <h1 className="text-sm font-semibold text-foreground mb-1">We help you find anyone</h1>
          <p className="text-xs text-foreground-muted mb-3">
            Sign in to search by name, email, or phone. We check accounts and can connect you with skip tracing.
          </p>
          <button
            type="button"
            onClick={openWelcome}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-lake-blue hover:bg-lake-blue/90 rounded-md transition-colors"
          >
            <UserCircleIcon className="w-3.5 h-3.5" />
            Sign in to search
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-6 px-4 space-y-3">
      {/* Hero - theme dynamic */}
      <section className="border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px]">
        <h1 className="text-sm font-semibold text-foreground mb-1">We help you find anyone</h1>
        <p className="text-xs text-foreground-muted mb-3">
          Give us their name, email, or phone number. We&apos;ll try to help you find that Minnesotan.
        </p>
        <p className="text-xs text-foreground-muted">
          We&apos;ll check whether they have an account on the platform, and we can connect you with skip tracing when you need more.
        </p>
      </section>

      {/* Tabs + Form - theme dynamic */}
      <div className="relative border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px] space-y-3">
        {searchLimitMet && (
          <div
            className="absolute inset-0 z-10 rounded-md bg-white/90 dark:bg-surface/90 flex flex-col items-center justify-center gap-2 p-4"
            aria-live="polite"
          >
            <p className="text-sm font-semibold text-foreground text-center">People Search Temporary Limit Met</p>
            {savedSearchId && (
              <Link
                href={`/people/search/${savedSearchId}`}
                className="text-xs text-lake-blue hover:underline"
              >
                View saved search
              </Link>
            )}
          </div>
        )}
        <div className="flex gap-1 p-0.5 rounded-md bg-surface-accent dark:bg-white/10">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md transition-colors ${
                  isActive
                    ? 'bg-white dark:bg-surface text-foreground font-medium shadow-sm'
                    : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          {activeTab === 'name' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-foreground-muted block mb-0.5">First name</span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First"
                  className="w-full h-9 px-3 text-xs text-foreground placeholder:text-foreground-muted border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface-accent focus:outline-none focus:ring-1 focus:ring-foreground-muted focus:border-foreground-muted"
                />
              </label>
              <label className="block">
                <span className="text-xs text-foreground-muted block mb-0.5">Last name</span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last"
                  className="w-full h-9 px-3 text-xs text-foreground placeholder:text-foreground-muted border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface-accent focus:outline-none focus:ring-1 focus:ring-foreground-muted focus:border-foreground-muted"
                />
              </label>
            </div>
          )}
          {activeTab === 'email' && (
            <label className="block">
              <span className="text-xs text-foreground-muted block mb-0.5">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full h-9 px-3 text-xs text-foreground placeholder:text-foreground-muted border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface-accent focus:outline-none focus:ring-1 focus:ring-foreground-muted focus:border-foreground-muted"
              />
            </label>
          )}
          {activeTab === 'phone' && (
            <label className="block">
              <span className="text-xs text-foreground-muted block mb-0.5">Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full h-9 px-3 text-xs text-foreground placeholder:text-foreground-muted border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface-accent focus:outline-none focus:ring-1 focus:ring-foreground-muted focus:border-foreground-muted"
              />
            </label>
          )}
          <button
            type="submit"
            disabled={!canSubmit()}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-lake-blue hover:bg-lake-blue/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            <MagnifyingGlassIcon className="w-3.5 h-3.5" />
            Find this person
          </button>
        </form>
      </div>

      {/* Two ways we help - theme dynamic */}
      <section className="border border-border-muted dark:border-white/10 rounded-md bg-surface-accent dark:bg-white/5 p-[10px]">
        <h2 className="text-xs font-semibold text-foreground mb-1.5">Two ways we help</h2>
        <div className="space-y-2">
          <div className="flex gap-2 items-start">
            <UserCircleIcon className="w-4 h-4 text-foreground-muted flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">Account lookup</p>
              <p className="text-xs text-foreground-muted">We check if this person has an account so you can connect here.</p>
            </div>
          </div>
          <div className="flex gap-2 items-start">
            <DocumentMagnifyingGlassIcon className="w-4 h-4 text-foreground-muted flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">Skip tracing</p>
              <p className="text-xs text-foreground-muted">Need more than an account? Our skip tracing service can help locate and verify contact details.</p>
            </div>
          </div>
        </div>
        <ol className="mt-2 space-y-1 text-xs text-foreground-muted list-decimal list-inside">
          <li>See if they have an account on the platform.</li>
          <li>Connect you with skip tracing when you need deeper lookup.</li>
        </ol>
      </section>

      {/* Search progress list: circle (loading / blue done) + details; step 2 shows real account result */}
      <SearchProgressList
        phase={terminalPhase}
        lastSearch={lastSearch}
        searchComplete={searchComplete}
        accountLookupResult={accountLookupResult}
        publicRecordsResult={publicRecordsResult}
        onReset={() => {
          setTerminalPhase('idle');
          setLastSearch(null);
          setCurrentSearchId(null);
          setAccountLookupResult(null);
          setPublicRecordsResult(null);
          setSearchComplete(false);
          lookupDoneRef.current = false;
          publicRecordsDoneRef.current = false;
        }}
      />

      {/* Accounts found: image, name, username */}
      {accountLookupResult && accountLookupResult.accounts.length > 0 && (
        <section
          className="border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px]"
          aria-label="Accounts found"
        >
          <h2 className="text-xs font-semibold text-foreground mb-2">Accounts found</h2>
          <ul className="space-y-2">
            {accountLookupResult.accounts.map((acc) => {
              const displayName = [acc.first_name, acc.last_name].filter(Boolean).join(' ') || acc.username || 'Account';
              return (
                <li key={acc.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileModalAccountId(acc.id);
                      setProfileModalInitial(acc);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-md border border-border-muted dark:border-white/10 hover:bg-surface-accent dark:hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-surface-accent dark:bg-white/10 flex items-center justify-center">
                      {acc.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={acc.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserIcon className="w-4 h-4 text-foreground-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
                      {acc.username && (
                        <p className="text-[10px] text-foreground-muted truncate">@{acc.username}</p>
                      )}
                      {acc.match_type === 'partial' && (
                        <p className="text-[10px] text-foreground-muted italic">Possible match</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/*
       * extractPublicRecords() normalizes API response to:
       * { records: Record<string, unknown>[]; count: number }
       * Each record may contain: Name/name, Address/address, Phone/phone, Email/email, Age/age,
       * FirstName/LastName, etc. (varies by RapidAPI skip-tracing response; curl test 401 without auth)
       */}
      {/* Public data found - card always renders; matches Accounts found list style */}
      {publicRecordsResult && !('error' in publicRecordsResult) && (
        <section
          className="border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px]"
          aria-label="Public data found"
        >
          <h2 className="text-xs font-semibold text-foreground mb-2">Public data found</h2>
          {(() => {
            const { records } = extractPublicRecords(publicRecordsResult);
            if (records.length === 0) {
              return <p className="text-xs text-foreground-muted">No public records found</p>;
            }
            return (
              <ul className="space-y-2">
                {records.map((r, i) => {
                  const name = getRecordDisplayName(r);
                  const age = r.Age != null ? String(r.Age) : (r.age as string) ?? '';
                  const livesIn = (r['Lives in'] as string) ?? (r.Address as string) ?? (r.address as string) ?? '';
                  const usedToLive = (r['Used to live in'] as string) ?? '';
                  const relatedTo = (r['Related to'] as string) ?? '';
                  const details = [age, livesIn, usedToLive, relatedTo].filter(Boolean);
                  const secondary = details.slice(0, 3).join(' · ');
                  const cardClass =
                    'w-full flex items-center gap-2 p-2 rounded-md border border-border-muted dark:border-white/10 hover:bg-surface-accent dark:hover:bg-white/5 transition-colors text-left';
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => setPersonModalRecord(r)}
                        className={cardClass}
                      >
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-surface-accent dark:bg-white/10 flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-foreground-muted" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{name}</p>
                          {secondary && (
                            <p className="text-[10px] text-foreground-muted truncate" title={details.join(' · ')}>
                              {secondary}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
          <div className="mt-2 pt-2 border-t border-border-muted dark:border-white/10">
            <p className="text-[10px] font-medium text-foreground-muted mb-1">API response (JSON)</p>
            <pre
              className="text-[10px] text-foreground-muted overflow-auto max-h-48 p-2 rounded-md bg-surface-accent dark:bg-white/5 border border-border-muted dark:border-white/10"
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {JSON.stringify(publicRecordsResult, null, 2)}
            </pre>
          </div>
        </section>
      )}

      <PersonDataModal
        isOpen={personModalRecord !== null}
        onClose={() => setPersonModalRecord(null)}
        record={personModalRecord}
        searchId={currentSearchId}
        pullRequestLimitReached={(recentData?.pull_request_count ?? 0) >= 1}
      />
      <ProfileDisplayModal
        isOpen={profileModalAccountId !== null}
        onClose={() => {
          setProfileModalAccountId(null);
          setProfileModalInitial(null);
        }}
        accountId={profileModalAccountId ?? ''}
        initialAccount={profileModalInitial}
      />
    </div>
  );
}

interface SearchProgressListProps {
  phase: TerminalPhase;
  lastSearch: SearchState | null;
  searchComplete: boolean;
  accountLookupResult: { accounts: LookupAccount[]; count: number } | null;
  publicRecordsResult: Record<string, unknown> | null;
  onReset: () => void;
}

const PHASES: TerminalPhase[] = ['looking', 'checking_account', 'public_sources', 'results'];

function SearchProgressList({ phase, lastSearch, searchComplete, accountLookupResult, publicRecordsResult, onReset }: SearchProgressListProps) {
  const entityLabel = lastSearch ? TERMINAL_LABEL[lastSearch.type] : 'entity';
  const masked = lastSearch ? maskValue(lastSearch.type, lastSearch.value) : '—';

  const step2Label = `Checking if this ${entityLabel} has an account on the platform`;
  const step2Done = accountLookupResult !== null;
  const accountCount = accountLookupResult?.count ?? 0;
  const { count: publicRecordsCount } = extractPublicRecords(publicRecordsResult);
  const publicRecordsError = publicRecordsResult && 'error' in publicRecordsResult ? (publicRecordsResult as { error: string }).error : null;
  const resultsLabel =
    lastSearch !== null
      ? `Successful search: found (${accountCount}) accounts and (${publicRecordsCount}) public data records for "${masked}"`
      : 'Successful search: found (0) accounts and (0) public data records for "—"';

  const steps: { key: TerminalPhase; label: string }[] = [
    { key: 'looking', label: `Looking for ${entityLabel}: ${masked}` },
    { key: 'checking_account', label: step2Label },
    { key: 'public_sources', label: `Running ${entityLabel} through public data sources` },
    { key: 'results', label: resultsLabel },
  ];

  const currentIndex = PHASES.indexOf(phase);
  const showList = phase !== 'idle' || lastSearch !== null;

  if (!showList) return null;

  return (
    <section
      className="border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px]"
      aria-live="polite"
      aria-label="Search progress"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-foreground">Lookup</span>
        {phase === 'results' && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-foreground-muted hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {steps.map((step) => {
          const stepIndex = PHASES.indexOf(step.key);
          const isResultsStep = step.key === 'results';
          const isFinalStepComplete = isResultsStep && searchComplete && phase === 'results';
          const isActive = phase === step.key && !isFinalStepComplete;
          const isDone = currentIndex > stepIndex || (phase === 'results' && (isResultsStep ? isFinalStepComplete : true));
          const isPending = stepIndex > currentIndex && phase !== 'results';
          const isStep2 = step.key === 'checking_account';
          const isStep3 = step.key === 'public_sources';

          return (
            <li key={step.key} className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5 flex items-center justify-center w-4 h-4">
                {isActive && (
                  <div
                    className="w-4 h-4 border-2 border-lake-blue border-t-transparent rounded-full animate-spin"
                    aria-hidden
                  />
                )}
                {isDone && (
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${isFinalStepComplete ? 'bg-green-600' : 'bg-lake-blue'}`}
                    aria-hidden
                  >
                    <CheckIcon className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
                  </div>
                )}
                {isPending && (
                  <div
                    className="w-4 h-4 rounded-full border border-border-muted dark:border-white/20"
                    aria-hidden
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-xs block ${
                    isActive ? 'text-foreground font-medium' : isDone ? 'text-foreground' : 'text-foreground-muted'
                  }`}
                >
                  {step.label}
                </span>
                {isStep2 && step2Done && (
                  <div className="mt-1.5 pl-0 text-xs text-foreground-muted">
                    {accountCount === 0 ? (
                      <span>No account found on the platform.</span>
                    ) : (
                      <span className="block">
                        {accountCount} account{accountCount !== 1 ? 's' : ''} found:{' '}
                        {accountLookupResult!.accounts.slice(0, 5).map((acc, i) => (
                          <span key={acc.id}>
                            {i > 0 && ', '}
                            <Link
                              href={acc.username ? `/${encodeURIComponent(acc.username)}` : '#'}
                              className="text-lake-blue hover:underline"
                            >
                              @{acc.username ?? acc.id.slice(0, 8)}
                            </Link>
                          </span>
                        ))}
                        {accountCount > 5 && ` +${accountCount - 5} more`}
                      </span>
                    )}
                  </div>
                )}
                {isStep3 && publicRecordsResult !== null && (
                  <div className="mt-1.5 pl-0 text-xs text-foreground-muted">
                    {publicRecordsError ? (
                      <span>{publicRecordsError}</span>
                    ) : (
                      <span>Public records: {publicRecordsCount} record{publicRecordsCount !== 1 ? 's' : ''}.</span>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
