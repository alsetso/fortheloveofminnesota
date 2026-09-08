'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchSocialGraph,
  socialAccountLabel,
  type SocialGraphEntry,
} from '@/features/community/devAdminApi';
import { accountProfilePath, profilePathWithFrom } from '@/features/community/profileApi';
import { DISCOVER_PATH } from '@/lib/routes/routePolicy';

function StoryAvatar({ entry }: { entry: SocialGraphEntry }) {
  const src = entry.account.image_url?.trim() || null;
  const label = socialAccountLabel(entry.account);
  const initial = label.replace(/^@/, '').trim().slice(0, 1).toUpperCase() || 'M';

  return (
    <div className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full bg-gradient-to-br from-lake-blue via-[#5b8def] to-[#f4c430] p-[2.5px]">
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[2.5px] border-[#f7f5f1] bg-lake-blue/15">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[18px] font-semibold text-lake-blue">{initial}</span>
        )}
      </div>
    </div>
  );
}

function FindPeopleStory() {
  return (
    <Link
      href={DISCOVER_PATH}
      aria-label="Find people"
      className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 transition active:opacity-70"
    >
      <div className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full border border-dashed border-black/20 bg-white">
        <span
          aria-hidden
          className="text-[28px] font-light leading-none text-foreground-muted"
        >
          +
        </span>
      </div>
      <span className="w-full truncate text-center text-[11px] font-medium leading-tight text-foreground-muted">
        Find
      </span>
    </Link>
  );
}

/**
 * Instagram-style horizontal story row of accounts you follow,
 * with a find-people slot and Following count label.
 * Tapping an account opens their `/:username` profile page.
 */
export function FeedFollowingStories() {
  const [entries, setEntries] = useState<SocialGraphEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    try {
      const graph = await fetchSocialGraph({ signal });
      if (signal?.aborted) return;
      setEntries(graph.following);
    } catch (e: unknown) {
      if (signal?.aborted) return;
      setEntries([]);
      setError(e instanceof Error ? e.message : 'Failed to load following');
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const count = entries?.length ?? null;

  return (
    <div className="border-b border-black/[0.08]">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
        <h2 className="text-[15px] font-bold tracking-tight text-foreground">
          Following
          {count != null ? (
            <span className="ml-1.5 font-semibold text-foreground-muted">
              {count}
            </span>
          ) : null}
        </h2>
      </div>

      {error ? (
        <p className="px-5 py-6 text-center text-[14px] text-foreground-muted">
          {error}
        </p>
      ) : entries === null ? (
        <div className="flex gap-3 overflow-hidden px-4 py-3">
          <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5">
            <div className="h-[4.25rem] w-[4.25rem] animate-pulse rounded-full bg-black/[0.06]" />
            <div className="h-2.5 w-10 animate-pulse rounded bg-black/[0.06]" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5"
            >
              <div className="h-[4.25rem] w-[4.25rem] animate-pulse rounded-full bg-black/[0.06]" />
              <div className="h-2.5 w-10 animate-pulse rounded bg-black/[0.06]" />
            </div>
          ))}
        </div>
      ) : (
        <div
          role="list"
          aria-label="People you follow"
          className="flex gap-3 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <FindPeopleStory />
          {entries.map((entry) => {
            const label = socialAccountLabel(entry.account);
            const handle = entry.account.username?.trim()
              ? `@${entry.account.username.trim()}`
              : label;
            const profilePath = profilePathWithFrom(
              accountProfilePath(entry.account.username),
              'post',
            );
            if (!profilePath) {
              return (
                <div
                  key={entry.account.id}
                  role="listitem"
                  className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 opacity-45"
                >
                  <StoryAvatar entry={entry} />
                  <span className="w-full truncate text-center text-[11px] font-medium leading-tight text-foreground">
                    {handle.replace(/^@/, '')}
                  </span>
                </div>
              );
            }
            return (
              <Link
                key={entry.account.id}
                href={profilePath}
                role="listitem"
                aria-label={`Open profile ${handle}`}
                className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 transition active:opacity-70"
              >
                <StoryAvatar entry={entry} />
                <span className="w-full truncate text-center text-[11px] font-medium leading-tight text-foreground">
                  {handle.replace(/^@/, '')}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
