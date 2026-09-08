'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import { useAuthSafe } from '@/features/auth';
import { useWarmPlacesInterests } from '@/features/discover/useWarmPlacesInterests';
import { IconArrowLeft, IconPlus, IconX } from '@/features/map/dockCore/core/icons';
import {
  addCustomInterest,
  deleteCustomInterest,
  INTEREST_NAME_MAX,
  INTEREST_SECTION_LABEL,
  INTEREST_SECTIONS,
  isCustomInterest,
  toggleInterest,
  type Interest,
} from '@/lib/accountInterests/api';
import {
  useCatalogSelectedIds,
  useSelectedInterestIds,
  useVisibleInterests,
} from '@/lib/accountInterests/store';
import { safePadTop } from '@/lib/despia/safeArea';
import { DISCOVER_PATH } from '@/lib/routes/routePolicy';

/** /discover/interests — follow topics for alert matching. */
export default function DiscoverInterestsPage() {
  const router = useRouter();
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  useWarmPlacesInterests(accountId);

  const visible = useVisibleInterests();
  const selected = useSelectedInterestIds();
  const catalogFollows = useCatalogSelectedIds();

  const [query, setQuery] = useState('');
  const [browse, setBrowse] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needle = query.trim().toLowerCase();
  const showCatalog = browse || needle.length > 0;
  const groups = INTEREST_SECTIONS.flatMap((section) => {
    if (section === 'civic') return [];
    const items = visible.filter((row) => {
      if (row.section !== section) return false;
      if (!needle) return true;
      return row.name.toLowerCase().includes(needle);
    });
    return items.length > 0 ? [{ section, items }] : [];
  });
  const followed = visible.filter((row) => selected.has(row.id));
  const exact = visible.find((row) => row.name.toLowerCase() === needle);
  const canAdd = needle.length > 0 && !exact;

  const onToggle = (row: Interest) => {
    if (!accountId) return;
    setError(null);
    void toggleInterest(accountId, row.id).catch((err) => {
      setError(err instanceof Error ? err.message : 'Could not save.');
    });
  };

  const onAdd = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!accountId || busy) return;
    const name = query.trim();
    if (!name) {
      setBrowse(true);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const added = await addCustomInterest(accountId, name);
      setQuery('');
      setNotice(
        isCustomInterest(added)
          ? 'Saved for you. It can’t tag posts until it’s a public topic.'
          : `Already in the catalog — following ${added.name}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add interest.');
    } finally {
      setBusy(false);
    }
  };

  const onRemoveCustom = (row: Interest) => {
    if (!accountId) return;
    setError(null);
    void deleteCustomInterest(accountId, row).catch((err) => {
      setError(err instanceof Error ? err.message : 'Could not remove.');
    });
  };

  return (
    <PageScroll>
      <header
        className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]"
        style={{ paddingTop: safePadTop('0.2rem') }}
      >
        <div className="relative flex h-11 items-center px-3">
          <button
            type="button"
            onClick={() => router.push(DISCOVER_PATH)}
            aria-label="Back to Discover"
            className="relative z-[1] inline-flex h-9 items-center gap-0.5 rounded-full px-1.5 text-lake-blue transition active:opacity-70"
          >
            <IconArrowLeft className="h-5 w-5" />
            <span className="text-[16px] font-semibold">Discover</span>
          </button>
          <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-bold tracking-tight text-foreground">
            Interests
          </h1>
          <div className="ml-auto w-[88px]" aria-hidden />
        </div>
      </header>

      <div className="space-y-4 px-5 pb-10 pt-4">
        <p className="text-[14px] leading-snug text-foreground-muted">
          {!accountId
            ? 'Sign in to follow topics.'
            : catalogFollows.size === 0
              ? 'Follow topics you want alerts for.'
              : 'You’ll hear about these in cities with notify on.'}
        </p>

        {accountId ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <form
                onSubmit={(event) => void onAdd(event)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-black/[0.08] bg-black/[0.04] px-3"
              >
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={() => setBrowse(true)}
                  maxLength={INTEREST_NAME_MAX}
                  placeholder="Find or add"
                  aria-label="Find or add an interest"
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] text-foreground outline-none placeholder:text-foreground-muted [&::-webkit-search-cancel-button]:hidden"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors active:text-foreground disabled:opacity-40"
                  aria-label="Add interest"
                >
                  <IconPlus className="h-3.5 w-3.5" />
                </button>
              </form>
              <button
                type="button"
                onClick={() => setBrowse((open) => !open)}
                aria-pressed={browse}
                className="shrink-0 text-[12px] font-semibold text-foreground-muted transition-colors active:text-foreground"
              >
                {browse ? 'Following' : 'Browse'}
              </button>
            </div>

            {!showCatalog && followed.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {followed.map((row) => (
                  <InterestChip
                    key={row.id}
                    row={row}
                    selected
                    custom={isCustomInterest(row)}
                    onToggle={() => onToggle(row)}
                    onRemove={isCustomInterest(row) ? () => onRemoveCustom(row) : undefined}
                  />
                ))}
              </div>
            ) : null}

            {showCatalog ? (
              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.section}>
                    <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground-muted">
                      {INTEREST_SECTION_LABEL[group.section]}
                    </h2>
                    {group.section === 'yours' ? (
                      <p className="mb-1.5 text-[12px] leading-snug text-foreground-muted">
                        Just for you until enough people ask for it.
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map((row) => (
                        <InterestChip
                          key={row.id}
                          row={row}
                          selected={selected.has(row.id)}
                          custom={isCustomInterest(row)}
                          onToggle={() => onToggle(row)}
                          onRemove={
                            isCustomInterest(row) ? () => onRemoveCustom(row) : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {groups.length === 0 ? (
                  <p className="py-2 text-[13px] text-foreground-muted">
                    {canAdd
                      ? `Nothing named “${query.trim()}” yet.`
                      : 'No interests to show.'}
                  </p>
                ) : null}
              </div>
            ) : followed.length === 0 ? (
              <p className="rounded-2xl bg-black/[0.04] px-4 py-6 text-center text-[14px] text-foreground-muted">
                No topics yet — browse the catalog or add your own.
              </p>
            ) : null}

            {notice ? (
              <p className="text-[12px] leading-snug text-foreground-muted">{notice}</p>
            ) : null}
            {error ? <p className="text-[12px] text-red-700">{error}</p> : null}
          </>
        ) : null}
      </div>
    </PageScroll>
  );
}

function InterestChip({
  row,
  selected,
  custom,
  onToggle,
  onRemove,
}: {
  row: Interest;
  selected: boolean;
  custom: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border text-[13px] font-semibold transition-colors ${
        selected
          ? 'border-lake-blue/40 bg-lake-blue/10 text-lake-blue'
          : custom
            ? 'border-dashed border-black/20 bg-black/[0.02] text-foreground-muted'
            : 'border-black/[0.1] bg-white text-foreground'
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className={`min-w-0 truncate px-2.5 py-1.5 ${custom && onRemove ? 'pr-1.5' : ''}`}
      >
        {row.name}
      </button>
      {custom && onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${row.name}`}
          onClick={onRemove}
          className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors active:bg-black/[0.06] active:text-foreground"
        >
          <IconX className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}
