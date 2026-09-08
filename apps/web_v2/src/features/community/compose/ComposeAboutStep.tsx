'use client';

import { useMemo, useState } from 'react';
import {
  INTEREST_SECTION_LABEL,
  INTEREST_SECTIONS,
  isCustomInterest,
  type Interest,
} from '@/lib/accountInterests/types';
import { haptic } from '@/lib/despia/haptics';

/**
 * Catalog-only about picker. Reports use civic channels; highlights/events use topics.
 */
export function ComposeAboutStep({
  cityName,
  categoryLabel,
  civic,
  selectedId,
  interests,
  onSelect,
  onSkip,
  canSkip,
}: {
  cityName: string | null;
  categoryLabel: string;
  civic: boolean;
  selectedId: string | null;
  interests: Interest[];
  onSelect: (row: Interest) => void;
  onSkip?: () => void;
  canSkip: boolean;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const city = cityName?.trim() || 'this city';

  const groups = useMemo(() => {
    const catalog = interests.filter((row) => !isCustomInterest(row));
    return INTEREST_SECTIONS.flatMap((section) => {
      if (section === 'yours') return [];
      if (civic ? section !== 'civic' : section === 'civic') return [];
      const items = catalog.filter((row) => {
        if (row.section !== section) return false;
        if (!needle) return true;
        return row.name.toLowerCase().includes(needle);
      });
      return items.length > 0 ? [{ section, items }] : [];
    });
  }, [civic, interests, needle]);

  return (
    <div className="mx-auto w-full max-w-lg px-5 pb-4">
      <p className="text-[15px] font-semibold tracking-tight text-[#1C1C1E]">
        What’s this about?
      </p>
      <p className="mt-1 text-[13px] leading-snug text-foreground-muted">
        {civic
          ? `Pick a channel. Reports reach everyone with alerts on in ${city}.`
          : `${categoryLabel} posts are tagged so people who follow that topic can hear about them.`}
      </p>

      {civic ? null : (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a topic"
          aria-label="Find a topic"
          className="mt-3 h-11 w-full rounded-2xl border border-black/[0.08] bg-[#F7F5F1] px-3.5 text-[15px] outline-none placeholder:text-foreground-muted/70 focus:border-lake-blue/40"
        />
      )}

      <div className="mt-4 flex max-h-[min(22rem,calc(100dvh-16rem))] flex-col gap-3 overflow-y-auto overscroll-contain">
        {groups.map((group) => (
          <section key={group.section}>
            <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground-muted">
              {INTEREST_SECTION_LABEL[group.section]}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((row) => {
                const on = selectedId === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      haptic.toggle();
                      onSelect(row);
                    }}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition active:scale-95 ${
                      on
                        ? 'bg-lake-blue text-white'
                        : 'bg-black/[0.06] text-[#1C1C1E]'
                    }`}
                  >
                    {row.name}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-foreground-muted">
            {needle ? 'No topics match.' : 'Loading topics…'}
          </p>
        ) : null}
      </div>

      {canSkip && onSkip ? (
        <button
          type="button"
          onClick={() => {
            haptic.toggle();
            onSkip();
          }}
          className="mt-4 w-full text-center text-[14px] font-semibold text-lake-blue transition active:opacity-70"
        >
          Skip — no topic
        </button>
      ) : null}
    </div>
  );
}
