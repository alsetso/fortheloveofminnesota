'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useAuthSafe } from '@/features/auth';
import { usePassport } from '@/features/accountTerritories/store/usePassport';
import { useAccountCollections } from '@/features/collections/useAccountCollections';
import {
  formatUnlockedPct,
  passportStanding,
} from '@/features/explore/shared/AreasPlacesSection';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  IconCoin,
  IconHeart,
  IconMapPin,
} from '@/features/map/dockCore/core/icons';
import { useAccountStreak } from '@/features/streaks/useAccountStreak';
import { useAccountLevel } from '@/features/xp/logic/useAccountLevel';
import {
  getPendingXpSnapshot,
  refreshPendingXp,
  subscribePendingXp,
  type PendingXpState,
} from '@/features/xp/store/pendingXpStore';
import { GAME_PATH } from '@/lib/routes/routePolicy';

const COIN_SLUG = 'coin-quaternius';
const AUTO_MS = 4800;
const EMPTY_PENDING: PendingXpState = {
  total: 0,
  count: 0,
  items: [],
  loading: false,
};

type StatSlide = {
  id: string;
  title: string;
  subtitle: string;
  /** Optional mark in the left disc — glyph, number, or icon. */
  mark?: ReactNode;
  progress?: number;
  tone?: 'lake' | 'rose' | 'gold' | 'moss';
};

function ProgressTrack({
  value,
  tone = 'lake',
}: {
  value: number;
  tone?: StatSlide['tone'];
}) {
  const pct = Math.max(0, Math.min(100, value));
  const bar =
    tone === 'rose'
      ? 'bg-[#c45c6a]'
      : tone === 'gold'
        ? 'bg-amber-500'
        : tone === 'moss'
          ? 'bg-[#3d5a40]'
          : 'bg-lake-blue';
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
      <span
        className={`block h-full rounded-full transition-[width] duration-500 ${bar}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MarkDisc({
  children,
  tone = 'lake',
}: {
  children: ReactNode;
  tone?: StatSlide['tone'];
}) {
  const ring =
    tone === 'rose'
      ? 'border-[#c45c6a]/25 bg-[#c45c6a]/10 text-[#c45c6a]'
      : tone === 'gold'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
        : tone === 'moss'
          ? 'border-[#3d5a40]/25 bg-[#3d5a40]/10 text-[#3d5a40]'
          : 'border-lake-blue/25 bg-lake-blue/10 text-lake-blue';
  return (
    <div
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border text-[13px] font-bold tabular-nums ${ring}`}
      aria-hidden
    >
      {children}
    </div>
  );
}

/**
 * Game standing carousel — level / areas / finds / streak.
 * Lives on Discover (idle browse). Snap-scroll + auto-advance; tap opens Today.
 */
export function FeedStatsCarousel() {
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  const { openToday } = useMapDock();

  const { level } = useAccountLevel(accountId);
  const { passport } = usePassport(accountId);
  const { collections } = useAccountCollections(accountId);
  const { streak } = useAccountStreak(accountId);
  const pendingXp = useSyncExternalStore(
    subscribePendingXp,
    getPendingXpSnapshot,
    () => EMPTY_PENDING,
  );

  useEffect(() => {
    if (accountId) void refreshPendingXp();
  }, [accountId]);

  const slides = useMemo((): StatSlide[] => {
    if (!accountId) {
      return [
        {
          id: 'map',
          title: 'The map is live',
          subtitle: 'Drop a pin · walk Minnesota',
          mark: 'MN',
        },
      ];
    }

    const out: StatSlide[] = [];
    const { unlockedTotal, areasAvailable, minnesotaUnlockedPct } =
      passportStanding(passport);
    const hearts = collections?.hearts;
    const coins =
      collections?.byModel.find((m) => m.slug === COIN_SLUG)?.count ?? null;

    if (pendingXp.total > 0) {
      out.push({
        id: 'claim',
        title: `${pendingXp.total.toLocaleString()} XP ready`,
        subtitle:
          pendingXp.count === 1
            ? '1 find waiting to claim'
            : `${pendingXp.count} finds waiting to claim`,
        mark: '⚡',
        tone: 'gold',
      });
    }

    if (level) {
      const xpSpan = Math.max(1, level.xpForNextLevel - level.xpForCurrentLevel);
      const xpInto = Math.min(
        xpSpan,
        Math.max(0, level.totalXp - level.xpForCurrentLevel),
      );
      const xpToNext = Math.max(0, level.xpForNextLevel - level.totalXp);
      const atMax = level.level >= 99;
      // API `progressPct` is 0–1; ProgressTrack expects 0–100.
      const levelProgressPct = atMax
        ? 100
        : Math.round(Math.max(0, Math.min(1, level.progressPct)) * 100);
      out.push({
        id: 'level',
        title: `Level ${level.level}`,
        subtitle: atMax
          ? `${level.totalXp.toLocaleString()} XP total`
          : `${xpInto} / ${xpSpan} XP · ${xpToNext} to next`,
        mark: String(level.level),
        progress: levelProgressPct,
        tone: 'lake',
      });
    }

    if (passport && unlockedTotal != null && areasAvailable != null) {
      const pct = minnesotaUnlockedPct ?? 0;
      out.push({
        id: 'minnesota',
        title: `${formatUnlockedPct(pct)} unlocked`,
        subtitle: `${unlockedTotal.toLocaleString()} of ${areasAvailable.toLocaleString()} areas`,
        mark: <IconMapPin className="h-4 w-4" />,
        progress: pct,
        tone: 'moss',
      });
    }

    if (hearts) {
      const heartPct =
        hearts.available > 0
          ? Math.min(100, (hearts.collected / hearts.available) * 100)
          : 0;
      out.push({
        id: 'hearts',
        title: `${hearts.collected.toLocaleString()} hearts`,
        subtitle:
          hearts.available > 0
            ? `${hearts.remaining.toLocaleString()} left on the map`
            : 'Find hearts across Minnesota',
        mark: <IconHeart className="h-4 w-4" solid />,
        progress: heartPct,
        tone: 'rose',
      });
    }

    if (coins != null) {
      out.push({
        id: 'coins',
        title: `${coins.toLocaleString()} coins`,
        subtitle: 'Earn credits from map finds',
        mark: <IconCoin className="h-4 w-4" />,
        tone: 'gold',
      });
    }

    if (streak) {
      out.push({
        id: 'streak',
        title:
          streak.currentStreak > 0
            ? `${streak.currentStreak}-day streak`
            : 'Start a streak',
        subtitle: streak.pendingToday
          ? 'Claim today’s streak on the map'
          : streak.longestStreak > streak.currentStreak
            ? `Best ${streak.longestStreak} days`
            : 'Keep showing up in Minnesota',
        mark: '🔥',
        tone: 'gold',
      });
    }

    if (out.length === 0) {
      out.push({
        id: 'map',
        title: 'Your standing',
        subtitle: 'Level, areas, and finds live here',
        mark: 'MN',
      });
    }

    return out;
  }, [accountId, collections, level, passport, pendingXp, streak]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const userPausedUntilRef = useRef(0);

  const scrollToIndex = useCallback((next: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const width = el.clientWidth;
    el.scrollTo({ left: next * width, behavior: 'smooth' });
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const width = el.clientWidth || 1;
    const next = Math.round(el.scrollLeft / width);
    setIndex(Math.max(0, Math.min(slides.length - 1, next)));
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(() => {
      if (Date.now() < userPausedUntilRef.current) return;
      const next = (index + 1) % slides.length;
      scrollToIndex(next);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [index, scrollToIndex, slides.length]);

  const onPointerDown = () => {
    userPausedUntilRef.current = Date.now() + AUTO_MS * 2;
  };

  const openStanding = () => {
    if (!accountId) return;
    openToday();
  };

  return (
    <div className="border-b border-black/[0.08]">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide) => {
          const body = (
            <>
              <MarkDisc tone={slide.tone}>{slide.mark ?? 'MN'}</MarkDisc>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold leading-snug text-foreground">
                  {slide.title}
                </p>
                <p className="truncate text-[12px] text-foreground-muted">
                  {slide.subtitle}
                </p>
                {typeof slide.progress === 'number' ? (
                  <ProgressTrack value={slide.progress} tone={slide.tone} />
                ) : null}
              </div>
              <span className="shrink-0 text-[13px] font-semibold text-lake-blue">
                {accountId ? 'Today' : 'Open'}
              </span>
            </>
          );

          if (!accountId) {
            return (
              <Link
                key={slide.id}
                href={GAME_PATH}
                className="flex w-full shrink-0 snap-center items-center gap-3 px-4 py-3 transition active:opacity-70"
              >
                {body}
              </Link>
            );
          }

          return (
            <button
              key={slide.id}
              type="button"
              onClick={openStanding}
              className="flex w-full shrink-0 snap-center items-center gap-3 px-4 py-3 text-left transition active:opacity-70"
            >
              {body}
            </button>
          );
        })}
      </div>

      {slides.length > 1 ? (
        <div
          className="flex items-center justify-center gap-1.5 pb-2.5"
          aria-hidden
        >
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Show ${slide.title}`}
              onClick={() => {
                userPausedUntilRef.current = Date.now() + AUTO_MS * 2;
                scrollToIndex(i);
              }}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-4 bg-lake-blue' : 'w-1.5 bg-black/15'
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
