'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  setAllCommunityPinsVisible,
  setYourPinsVisible,
  useAllCommunityPinsVisible,
  useYourPinsVisible,
} from '@/features/map/community';
import { DockCardSubHeader } from '@/features/map/dockCore/dockCard/DockCardSubHeader';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { DockLayerGroupCard, DockLayerToggle } from '@/features/map/dockCore/shell/DockLayerToggle';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconSearch } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import {
  MAP_TIME_FILTER_OPTIONS,
  setMapTimeFilter,
} from '@/features/map/dockCore/store/mapTimeFilterStore';
import { useMapTimeFilter } from '@/features/map/dockCore/hooks/useMapTimeFilter';
import { ToolSegmented } from '@/features/tools/core/toolUi';
import { useAuthSafe } from '@/features/auth';

type MinePin = {
  id: string;
  lat: number | null;
  lng: number | null;
  body: string | null;
  emoji: string | null;
  full_address: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  view_count: number;
};

/**
 * Controls subcard — community pins layer toggle + Your pins (this account).
 */
export default function CommunityPinsDockCard() {
  const { openDockCard, openPinCard, setActivityTab } =
    useMapDock();
  const backToParent = () => openDockCard('controls');
  const { account } = useAuthSafe();
  const yourPinsOn = useYourPinsVisible();
  const allPinsOn = useAllCommunityPinsVisible();
  const { value: timeFilter } = useMapTimeFilter();
  const [pins, setPins] = useState<MinePin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!account?.id) {
      setPins([]);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    void fetch('/api/community/pins/mine', {
      cache: 'no-store',
      credentials: 'include',
      signal: ac.signal,
    })
      .then(async (res) => {
        const json = (await res.json()) as { pins?: MinePin[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? 'Failed to load pins');
        return json.pins ?? [];
      })
      .then((rows) => {
        if (!ac.signal.aborted) setPins(rows);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
        setPins([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [account?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pins;
    return pins.filter((p) => {
      const hay = [p.body, p.full_address, p.emoji]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [pins, query]);

  return (
    <DockCardShell
      header={
        <div className="space-y-4">
          <DockCardSubHeader
            onBack={backToParent}
            eyebrow="Map controls"
            title="Community pins"
            subtitle="Live posts on the map"
          />
          <div
            className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
          >
            <IconSearch className="h-4 w-4 shrink-0 text-foreground-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your pins"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-foreground-muted"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={!account}
            />
          </div>
        </div>
      }
    >
      <DockLayerGroupCard>
        <DockLayerToggle
          label="Your pins"
          on={yourPinsOn}
          onClick={() => setYourPinsVisible(!yourPinsOn)}
          hint="Only pins you have posted"
        />
        <DockLayerToggle
          label="All community pins"
          on={allPinsOn}
          onClick={() => setAllCommunityPinsVisible(!allPinsOn)}
          hint="Everyone's public pins"
        />
      </DockLayerGroupCard>

      {yourPinsOn || allPinsOn ? (
        <div>
          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
            Posted within
          </p>
          <ToolSegmented
            options={MAP_TIME_FILTER_OPTIONS.map((o) => ({ id: o.value, label: o.label }))}
            value={timeFilter}
            onChange={setMapTimeFilter}
          />
        </div>
      ) : null}

      <section>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
            Your pins
          </p>
          {account ? (
            <button
              type="button"
              onClick={() => {
                setActivityTab('pins');
                openDockCard('activity-detail');
              }}
              className="text-[12px] font-semibold text-lake-blue transition active:opacity-70"
            >
              See All
            </button>
          ) : null}
        </div>

        {!account ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
            Sign in to see pins you have posted.
          </p>
        ) : error ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">{error}</p>
        ) : loading && pins.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
            Loading your pins…
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
            {query.trim() ? 'No matching pins' : 'You have not posted any pins yet'}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((pin) => {
              const title = pin.body?.trim() || 'Pin';
              const subtitle = pin.full_address?.trim() || null;
              return (
                <button
                  key={pin.id}
                  type="button"
                  onClick={() =>
                    openPinCard({
                      id: pin.id,
                      kind: 'pin',
                      title: title.slice(0, 80),
                      subtitle: subtitle ?? undefined,
                      kindLabel: 'Pin',
                      summary: pin.body ?? undefined,
                      imageUrl: account.image_url ?? null,
                    })
                  }
                  className={`flex w-full items-center gap-3 rounded-[1.15rem] px-3 py-3 text-left transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} hover:bg-map-glass-hover`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-lake-blue/20 text-lg">
                    {pin.emoji?.trim() ? (
                      <span aria-hidden>{pin.emoji}</span>
                    ) : account.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={account.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-foreground">
                        {(account.username ?? 'P').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[15px] font-medium text-foreground">
                      {title}
                    </span>
                    {subtitle ? (
                      <span className="mt-0.5 block truncate text-[12px] text-foreground-muted">
                        {subtitle}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-foreground-muted" aria-hidden>
                    ›
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </DockCardShell>
  );
}
