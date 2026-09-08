'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccountAvatar,
  getAccountDisplayName,
  useAuthSafe,
} from '@/features/auth';
import {
  fetchAnalyticsSummary,
  socialAccountLabel,
  type AnalyticsRange,
  type AnalyticsSummary,
  type SightingEvent,
} from '@/features/community/devAdminApi';
import { formatPinCount, formatRelativeTime } from '@/features/community/pinPostApi';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconEye } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { formatAccountPlan } from '@/lib/auth/selectedAccount';
import {
  getDockAvatarInnerClass,
  getDockAvatarRingClass,
  isPaidPlan,
} from '@/lib/billing/planHelpers';

function RangeToggle({
  value,
  onChange,
}: {
  value: AnalyticsRange;
  onChange: (next: AnalyticsRange) => void;
}) {
  const btn = (id: AnalyticsRange, label: string) => {
    const active = value === id;
    return (
      <button
        type="button"
        onClick={() => onChange(id)}
        className={`flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold transition active:scale-[0.99] ${
          active
            ? `${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} text-foreground`
            : 'text-foreground-muted hover:text-foreground'
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="flex gap-1 p-0.5">
      {btn('30d', 'Last 30 days')}
      {btn('all', 'All time')}
    </div>
  );
}

function eventBucketKey(iso: string, range: AnalyticsRange): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  if (range === 'all') return `${y}-${m}`;
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Slim tappable series — selecting a bar filters the who-saw feed. */
function ViewsBarChart({
  series,
  selectedKey,
  onSelectKey,
}: {
  series: AnalyticsSummary['series'];
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
}) {
  const max = Math.max(0, ...series.map((p) => p.views));
  const total = series.reduce((s, p) => s + p.views, 0);

  useEffect(() => {
    if (!selectedKey) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[data-views-bar-chart]')) return;
      if (target?.closest?.('[data-views-timeline]')) return;
      onSelectKey(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [selectedKey, onSelectKey]);

  if (total === 0) return null;

  const selectedIndex = selectedKey
    ? series.findIndex((p) => p.key === selectedKey)
    : -1;
  const popoverSide =
    selectedIndex < 0
      ? 'center'
      : selectedIndex <= 1
        ? 'left'
        : selectedIndex >= series.length - 2
          ? 'right'
          : 'center';
  const selected = selectedKey ? series.find((p) => p.key === selectedKey) : null;

  return (
    <div
      data-views-bar-chart
      className={`relative rounded-2xl px-3 pb-2 pt-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
    >
      <div className="flex h-16 items-end gap-[3px]">
        {series.map((point) => {
          const pct = max > 0 ? Math.max(point.views > 0 ? 10 : 0, (point.views / max) * 100) : 0;
          const active = selectedKey === point.key;
          return (
            <button
              key={point.key}
              type="button"
              aria-label={`${point.label}: ${point.views} view${point.views === 1 ? '' : 's'}`}
              aria-pressed={active}
              onClick={() => onSelectKey(active ? null : point.key)}
              className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-sm transition active:scale-[0.97]"
            >
              <span
                className="relative flex w-full max-w-[12px] flex-col items-center justify-end"
                style={{ height: pct > 0 ? `${pct}%` : 3, minHeight: 3 }}
              >
                {active && selected ? (
                  <span
                    className={`pointer-events-none absolute bottom-[calc(100%+8px)] z-10 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-center shadow-sm backdrop-blur-md ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} ${
                      popoverSide === 'left'
                        ? 'left-0'
                        : popoverSide === 'right'
                          ? 'right-0'
                          : 'left-1/2 -translate-x-1/2'
                    }`}
                  >
                    <span className="block text-[11px] font-medium text-foreground-muted">
                      {point.label}
                    </span>
                    <span className="block text-[13px] font-semibold tabular-nums text-foreground">
                      {point.views} {point.views === 1 ? 'view' : 'views'}
                    </span>
                  </span>
                ) : null}
                <span
                  className={`block h-full w-full rounded-t-sm bg-gradient-to-t from-yellow-600 via-yellow-500 to-yellow-400 transition ${
                    active ? 'opacity-100 ring-2 ring-yellow-500/40' : 'opacity-85'
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>
      {selected ? (
        <button
          type="button"
          onClick={() => onSelectKey(null)}
          className="mt-2 w-full text-center text-[11px] font-medium text-foreground-muted"
        >
          Showing {selected.label} · tap to clear
        </button>
      ) : null}
    </div>
  );
}

function SightingRow({
  event,
  onOpen,
  onOpenProfile,
}: {
  event: SightingEvent;
  onOpen: (event: SightingEvent) => void;
  onOpenProfile: (accountId: string) => void;
}) {
  const actorName = socialAccountLabel(event.actor);
  const isProfile = event.kind === 'profile_view';

  return (
    <button
      type="button"
      onClick={() => {
        if (isProfile) {
          if (event.actor?.id) onOpenProfile(event.actor.id);
          return;
        }
        onOpen(event);
      }}
      className={`flex w-full items-center gap-2.5 rounded-[1.15rem] px-3 py-2.5 text-left transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
    >
      <div className="relative shrink-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-lake-blue/15 text-sm font-semibold text-lake-blue">
          {event.actor?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.actor.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (event.actor?.username ?? '?').slice(0, 1).toUpperCase()
          )}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full ring-2 ring-white ${
            isProfile ? 'bg-violet-500/15 text-violet-700' : 'bg-amber-500/15 text-amber-700'
          }`}
        >
          <IconEye className="h-3 w-3" />
        </span>
      </div>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium leading-snug text-foreground">
          <span className="font-semibold">{actorName}</span>
          <span className="text-foreground-muted">
            {isProfile ? ' viewed your profile' : ' viewed your pin'}
          </span>
        </span>
        {!isProfile && event.post?.body_snippet ? (
          <span className="mt-0.5 line-clamp-1 block text-[12px] text-foreground-muted">
            {event.post.body_snippet}
          </span>
        ) : null}
        <span className="mt-0.5 block text-[11px] font-medium text-foreground-muted">
          {formatRelativeTime(event.occurred_at)}
        </span>
      </span>
      {!isProfile ? (
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-map-ink-subtle">
          {event.post?.media_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.post.media_url} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
      ) : (
        <span className="shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
          Profile
        </span>
      )}
    </button>
  );
}

/**
 * Account → Contributor — who saw your pins and profile.
 */
export default function ContributorDockCard() {
  const { openAccount, openDockCard, openPinCard, openProfileCard } = useMapDock();
  const { account, user, isLoading } = useAuthSafe();
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bucketKey, setBucketKey] = useState<string | null>(null);

  const eligible = isPaidPlan(account?.plan);
  const planLabel = formatAccountPlan(account?.plan);
  const displayName = getAccountDisplayName(account, user?.email);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (!account?.id || !eligible) {
        setSummary(null);
        return;
      }
      setError(null);
      try {
        const res = await fetchAnalyticsSummary(signal, range);
        if (!signal?.aborted) setSummary(res);
      } catch (e: unknown) {
        if (signal?.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
      }
    },
    [account?.id, eligible, range],
  );

  useEffect(() => {
    const ac = new AbortController();
    void reload(ac.signal);
    return () => ac.abort();
  }, [reload]);

  useEffect(() => {
    setBucketKey(null);
  }, [range, summary?.range]);

  const sightings = useMemo(() => {
    const items =
      summary?.sightings?.items ??
      (summary?.views?.items ?? []).map(
        (e): SightingEvent => ({
          kind: 'pin_view',
          actor: e.actor,
          post: e.post,
          occurred_at: e.occurred_at,
        }),
      );
    if (!bucketKey) return items;
    return items.filter((e) => eventBucketKey(e.occurred_at, range) === bucketKey);
  }, [summary, bucketKey, range]);

  const uniqueViewerCount = useMemo(() => {
    const ids = new Set<string>();
    let anon = 0;
    for (const e of sightings) {
      if (e.actor?.id) ids.add(e.actor.id);
      else anon += 1;
    }
    return ids.size + (anon > 0 ? 1 : 0);
  }, [sightings]);

  const onOpenEvent = (event: SightingEvent) => {
    if (!event.post) return;
    openPinCard(
      {
        id: event.post.id,
        kind: 'pin',
        title: (event.post.body_snippet ?? 'Pin').slice(0, 80),
        kindLabel: 'Pin',
        summary: event.post.body_snippet ?? undefined,
        imageUrl: account?.image_url ?? null,
      },
      { fromActivity: true },
    );
  };

  return (
    <DockCardShell
      variant="feed"
      titleMode="sub"
      backLabel="Account"
      onBack={() => openAccount()}
      eyebrow="Account"
      title="Contributor"
      subtitle="Who saw you"
    >
      {!account ? (
        <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
          Sign in to see contributor insights.
        </p>
      ) : !eligible ? (
        <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
          Available on paid plans with the gold border.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <div className={getDockAvatarRingClass(account.plan)}>
              <div className={getDockAvatarInnerClass(account.plan)}>
                <AccountAvatar
                  account={account}
                  email={user?.email}
                  size="lg"
                  loading={isLoading}
                  className="h-full w-full"
                />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold text-foreground">{displayName}</p>
              <p className="mt-0.5 text-[12px] font-medium text-amber-700/90">
                Active · {planLabel}
              </p>
            </div>
          </div>

          <RangeToggle
            value={range}
            onChange={(next) => {
              setSummary(null);
              setBucketKey(null);
              setRange(next);
            }}
          />

          {error ? (
            <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">{error}</p>
          ) : !summary ? (
            <div className="space-y-2">
              <div
                className={`h-20 animate-pulse rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
              />
              <div
                className={`h-24 animate-pulse rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`rounded-2xl px-3.5 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                    Pin views
                  </p>
                  <p className="mt-1 text-[1.35rem] font-semibold tabular-nums tracking-tight text-foreground">
                    {formatPinCount(summary.views_in_range)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-foreground-muted">
                    {range === '30d' ? 'last 30 days' : 'all time'}
                    {uniqueViewerCount > 0
                      ? ` · ${formatPinCount(uniqueViewerCount)} people`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openProfileCard(account.id)}
                  className={`rounded-2xl px-3.5 py-3 text-left transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                    Profile
                  </p>
                  <p className="mt-1 text-[1.35rem] font-semibold tabular-nums tracking-tight text-foreground">
                    {formatPinCount(summary.profile?.views_in_range ?? 0)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-foreground-muted">
                    {range === '30d' ? 'last 30 days' : 'in range'}
                    {' · '}
                    {formatPinCount(summary.profile?.view_count ?? 0)} lifetime
                  </p>
                </button>
              </div>

              <ViewsBarChart
                series={summary.series}
                selectedKey={bucketKey}
                onSelectKey={setBucketKey}
              />

              <section data-views-timeline className="space-y-2">
                <div className="flex items-baseline justify-between gap-2 px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                    Who saw what
                  </p>
                  <p className="text-[11px] font-medium tabular-nums text-foreground-muted">
                    {sightings.length}
                  </p>
                </div>

                {sightings.length > 0 ? (
                  <div className="space-y-2">
                    {sightings.map((event, i) => (
                      <SightingRow
                        key={`${event.kind}-${event.post?.id ?? 'profile'}-${event.actor?.id ?? 'anon'}-${event.occurred_at}-${i}`}
                        event={event}
                        onOpen={onOpenEvent}
                        onOpenProfile={(id) => openProfileCard(id)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
                    {bucketKey
                      ? 'No pin or profile views in that period.'
                      : range === '30d'
                        ? 'No pin or profile views in the last 30 days.'
                        : 'No pin or profile views yet.'}
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </DockCardShell>
  );
}
