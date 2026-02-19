'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  UserIcon,
  DocumentMagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import PeopleLayoutClient from '@/app/people/PeopleLayoutClient';
import PersonDataModal from '@/components/people/PersonDataModal';
import ProfileDisplayModal from '@/components/people/ProfileDisplayModal';
import PublicPullRecordModal from '@/components/people/PublicPullRecordModal';
import PulledDataCard from '@/components/people/PulledDataCard';
import type { LookupAccount } from '@/components/people/FindAnyoneContent';
import type { PeopleSearchFull, PullRequestRow } from '@/app/api/people/search/[id]/route';

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

export default function PeopleSearchByIdPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;
  const [personModalRecord, setPersonModalRecord] = useState<Record<string, unknown> | null>(null);
  const [savedPullModal, setSavedPullModal] = useState<{ pull: PullRequestRow; record: Record<string, unknown> } | null>(null);
  const [profileModalAccountId, setProfileModalAccountId] = useState<string | null>(null);
  const [profileModalInitial, setProfileModalInitial] = useState<LookupAccount | null>(null);

  const { data, isLoading, error, isError } = useQuery({
    queryKey: ['people', 'search', id],
    queryFn: async () => {
      const res = await fetch(`/api/people/search/${id}`, { credentials: 'include' });
      if (res.status === 403 || res.status === 404) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? (res.status === 404 ? 'Not found' : 'Forbidden'));
      }
      if (!res.ok) throw new Error('Failed to load search');
      return res.json() as Promise<{ search: PeopleSearchFull; pull_requests: PullRequestRow[] }>;
    },
    enabled: Boolean(id),
  });

  if (!id) {
    return (
      <PeopleLayoutClient>
        <div className="w-full max-w-2xl mx-auto py-6 px-4">
          <p className="text-xs text-foreground-muted">Invalid search</p>
          <Link href="/people" className="text-xs text-lake-blue hover:underline mt-2 inline-flex items-center gap-1">
            <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to People
          </Link>
        </div>
      </PeopleLayoutClient>
    );
  }

  if (isLoading) {
    return (
      <PeopleLayoutClient>
        <div className="w-full max-w-2xl mx-auto py-6 px-4 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-foreground-muted border-t-transparent rounded-full animate-spin" />
        </div>
      </PeopleLayoutClient>
    );
  }

  if (isError || !data) {
    return (
      <PeopleLayoutClient>
        <div className="w-full max-w-2xl mx-auto py-6 px-4 space-y-2">
          <p className="text-xs text-foreground-muted">{error instanceof Error ? error.message : 'Search not found'}</p>
          <Link href="/people" className="text-xs text-lake-blue hover:underline inline-flex items-center gap-1">
            <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to People
          </Link>
        </div>
      </PeopleLayoutClient>
    );
  }

  const { search, pull_requests } = data;
  const accounts = (search.account_results?.accounts ?? []) as LookupAccount[];
  const records = (search.public_record_results?.records ?? []) as Record<string, unknown>[];
  const pullsByPersonId = new Map(pull_requests.map((p) => [p.person_id, p]));

  return (
    <PeopleLayoutClient>
      <div className="w-full max-w-2xl mx-auto py-6 px-4 space-y-3">
        <div className="flex items-center gap-2">
        <Link
          href="/people"
          className="p-1.5 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-accent transition-colors"
          aria-label="Back to People"
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <h1 className="text-sm font-semibold text-foreground">Saved search</h1>
      </div>

      <section className="border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px]">
        <p className="text-xs text-foreground-muted">
          Search type: <span className="font-medium text-foreground">{search.search_type}</span>
          {' · '}
          <span className="text-foreground-muted">{new Date(search.created_at).toLocaleDateString()}</span>
        </p>
      </section>

      {accounts.length > 0 && (
        <section
          className="border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px]"
          aria-label="Accounts found"
        >
          <h2 className="text-xs font-semibold text-foreground mb-2">Accounts found</h2>
          <ul className="space-y-2">
            {accounts.map((acc) => {
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
                        <img src={acc.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-4 h-4 text-foreground-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
                      {acc.username && (
                        <p className="text-[10px] text-foreground-muted truncate">@{acc.username}</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section
        className="border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface p-[10px]"
        aria-label="Public data found"
      >
        <h2 className="text-xs font-semibold text-foreground mb-1">Public data found</h2>
        <p className="text-[10px] text-foreground-muted mb-2">
          Click a record to pull more details; new pulls are saved to this search.
        </p>
        {records.length === 0 ? (
          <p className="text-xs text-foreground-muted">No public records</p>
        ) : (
          <ul className="space-y-3">
            {records.map((r, i) => {
              const name = getRecordDisplayName(r);
              const personId = (r['Person ID'] ?? r.person_id ?? r.PersonId ?? r.peo_id) as string | undefined;
              const pull = personId ? pullsByPersonId.get(String(personId).trim()) : undefined;
              const age = r.Age != null ? String(r.Age) : (r.age as string) ?? '';
              const livesIn = (r['Lives in'] as string) ?? (r.Address as string) ?? (r.address as string) ?? '';
              const details = [age, livesIn].filter(Boolean);
              const secondary = details.join(' · ');
              return (
                <li key={i} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPersonModalRecord(r)}
                    className="w-full flex items-center gap-2 p-2 rounded-md border border-border-muted dark:border-white/10 hover:bg-surface-accent dark:hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-surface-accent dark:bg-white/10 flex items-center justify-center">
                      <DocumentMagnifyingGlassIcon className="w-4 h-4 text-foreground-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{name}</p>
                      {secondary && (
                        <p className="text-[10px] text-foreground-muted truncate">{secondary}</p>
                      )}
                    </div>
                  </button>
                  {pull && (
                    <button
                      type="button"
                      onClick={() => setSavedPullModal({ pull, record: r })}
                      className="w-full rounded-md border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-[10px] text-left hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide mb-1.5">
                        Saved pull
                        {pull.created_at && (
                          <span className="normal-case font-normal ml-1">
                            · {new Date(pull.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                      <PulledDataCard pulledData={pull.pulled_data} record={r} compact />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <PersonDataModal
        isOpen={personModalRecord !== null}
        onClose={() => setPersonModalRecord(null)}
        record={personModalRecord}
        searchId={id}
        pullRequestLimitReached={(data?.pull_requests?.length ?? 0) >= 1}
      />
      <PublicPullRecordModal
        isOpen={savedPullModal !== null}
        onClose={() => setSavedPullModal(null)}
        pulledData={savedPullModal?.pull.pulled_data ?? {}}
        record={savedPullModal?.record ?? null}
        pulledAt={savedPullModal?.pull.created_at ? new Date(savedPullModal.pull.created_at).toLocaleDateString() : null}
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
    </PeopleLayoutClient>
  );
}
