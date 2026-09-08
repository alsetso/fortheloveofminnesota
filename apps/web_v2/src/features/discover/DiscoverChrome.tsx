'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconChevronRight,
} from '@/features/map/dockCore/core/icons';

/**
 * Shared Discover section title — used by carousels and list blocks.
 * Title left, optional action right (See All / Manage / Edit).
 */
const HEADER_ACTION_CLASS =
  'text-[14px] font-semibold text-lake-blue transition active:opacity-70';

export function DiscoverSectionHeader({
  title,
  actionHref,
  actionLabel = 'See All',
  trailing,
  className,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  /** Optional controls beside the action (e.g. carousel arrows). */
  trailing?: ReactNode;
  /** Override wrapper classes (e.g. `px-0` when already padded). */
  className?: string;
}) {
  return (
    <div
      className={
        className
          ? `flex items-center justify-between gap-3 ${className}`
          : 'flex items-center justify-between gap-3 px-5'
      }
    >
      <h2 className="min-w-0 truncate text-[20px] font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        {actionHref ? (
          <Link href={actionHref} className={HEADER_ACTION_CLASS}>
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export type DiscoverHeroCard = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  href: string;
  /** Soft wash behind the card — lake / pine / clay tones. */
  tone?: 'lake' | 'pine' | 'clay' | 'dusk';
  /** Optional media (e.g. Mapbox zone preview). Replaces the tone wash. */
  media?: ReactNode;
  /** Skip the default media backdrop (e.g. dashed + add tile). */
  mediaBare?: boolean;
  /** Dashed-border add tile (Places / Schools carousel). */
  isAddCard?: boolean;
  /** Runs before navigation (e.g. queue map focus for Venue). */
  onNavigate?: () => void;
};

export const DISCOVER_ADD_BORDER_CLASS = 'border border-dashed border-black/20';

/** Filled follow/name chips — Interests / Places / Schools. */
export const DISCOVER_FOLLOW_PILL_CLASS =
  'rounded-full border border-lake-blue/30 bg-lake-blue/10 px-2.5 py-1 text-[12px] font-semibold text-lake-blue';

/** Shared dashed + chip for user-addable Discover rows (Interests pills). */
export function DiscoverAddChip({
  href,
  label = 'Add',
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full ${DISCOVER_ADD_BORDER_CLASS} px-2.5 py-1 text-[12px] font-semibold text-foreground-muted transition active:opacity-70 ${className ?? ''}`}
    >
      <span aria-hidden className="text-[15px] font-light leading-none">+</span>
      {label}
    </Link>
  );
}

/** Centered + for carousel add tiles — border lives on the media container. */
export function DiscoverCarouselAddMedia() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <span
        aria-hidden
        className="text-[28px] font-light leading-none text-foreground-muted"
      >
        +
      </span>
    </div>
  );
}

/** First-card placeholder linking to a manage / add screen. */
export function discoverAddHeroCard({
  id,
  href,
  title,
  subtitle = '',
}: {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
}): DiscoverHeroCard {
  return {
    id,
    eyebrow: '',
    title,
    subtitle,
    href,
    media: <DiscoverCarouselAddMedia />,
    mediaBare: true,
    isAddCard: true,
  };
}

const TONE_CLASS: Record<NonNullable<DiscoverHeroCard['tone']>, string> = {
  lake: 'from-[#2a6f8f] to-[#1a4a62]',
  pine: 'from-[#2f5d4a] to-[#1c3a2e]',
  clay: 'from-[#8b5a3c] to-[#5c3a26]',
  dusk: 'from-[#3d4a6b] to-[#252e45]',
};

const CAROUSEL_SIZE = {
  /** Full hero — Experience Zones. */
  hero: {
    width: 'w-[min(78vw,320px)]',
    media: 'h-36 rounded-[14px]',
    title: 'text-[15px]',
    subtitle: 'text-[12px]',
    /** Show <> when more than this many cards. */
    scrollArrowAfter: 2,
  },
  /** Compact strip — Places. */
  compact: {
    width: 'w-[min(42vw,168px)]',
    media: 'h-24 rounded-[12px]',
    title: 'text-[13px]',
    subtitle: 'text-[11px]',
    scrollArrowAfter: 3,
  },
} as const;

export type DiscoverHeroCarouselSize = keyof typeof CAROUSEL_SIZE;

function DiscoverCarouselArrows({
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const btn =
    'inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/[0.1] bg-white text-foreground transition active:scale-95 disabled:opacity-30';
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Scroll previous"
        disabled={!canPrev}
        onClick={onPrev}
        className={btn}
      >
        <IconArrowLeft className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Scroll next"
        disabled={!canNext}
        onClick={onNext}
        className={btn}
      >
        <IconChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Horizontal snap carousel — Experience Zones / Places.
 * Cropped map keeps the rounded card shape; title + subtitle sit below (no card chrome).
 * Compact <> arrows appear across from the title when there are enough cards.
 */
export function DiscoverHeroCarousel({
  sectionTitle,
  cards,
  headerHref,
  headerLabel = 'See All',
  size = 'hero',
}: {
  sectionTitle: string;
  cards: DiscoverHeroCard[];
  /** Optional trailing header action (e.g. Manage → places). */
  headerHref?: string;
  headerLabel?: string;
  /** `hero` for Experience Zones; `compact` for Places. */
  size?: DiscoverHeroCarouselSize;
}) {
  const s = CAROUSEL_SIZE[size];
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const showArrows = cards.length > s.scrollArrowAfter;

  const syncArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(max > 4 && el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !showArrows) return;
    syncArrows();
    el.addEventListener('scroll', syncArrows, { passive: true });
    const ro = new ResizeObserver(syncArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', syncArrows);
      ro.disconnect();
    };
  }, [showArrows, syncArrows, cards.length]);

  const scrollByCard = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('[role="listitem"]');
    const step = first ? first.offsetWidth + 12 : el.clientWidth * 0.7;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <section className="pt-5">
      <DiscoverSectionHeader
        title={sectionTitle}
        actionHref={headerHref}
        actionLabel={headerLabel}
        trailing={
          showArrows ? (
            <DiscoverCarouselArrows
              canPrev={canPrev}
              canNext={canNext}
              onPrev={() => scrollByCard(-1)}
              onNext={() => scrollByCard(1)}
            />
          ) : null
        }
      />
      <div
        ref={scrollerRef}
        className="mt-3 flex gap-3 overflow-x-auto px-5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
        role="list"
      >
        {cards.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            role="listitem"
            onClick={() => card.onNavigate?.()}
            className={`${s.width} shrink-0 snap-start transition active:opacity-80`}
          >
            <div
              className={`relative overflow-hidden ${s.media} ${
                card.isAddCard
                  ? DISCOVER_ADD_BORDER_CLASS
                  : card.media
                    ? card.mediaBare
                      ? ''
                      : 'bg-black/[0.04]'
                    : `bg-gradient-to-br ${TONE_CLASS[card.tone ?? 'lake']}`
              }`}
            >
              {card.media ? (
                card.media
              ) : (
                <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_30%,white_0,transparent_45%),radial-gradient(circle_at_80%_70%,white_0,transparent_40%)]" />
              )}
            </div>
            <div className="mt-2 space-y-0.5 px-0.5">
              <p
                className={`${s.title} truncate font-semibold leading-snug tracking-tight text-foreground`}
              >
                {card.title}
              </p>
              {card.subtitle ? (
                <p className={`${s.subtitle} truncate text-foreground-muted`}>
                  {card.subtitle}
                </p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Titled list block — Collectibles / Schools / Interests.
 */
export function DiscoverListSection({
  title,
  seeAllHref,
  seeAllLabel = 'See All',
  children,
}: {
  title: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="pt-5">
      <DiscoverSectionHeader
        title={title}
        actionHref={seeAllHref}
        actionLabel={seeAllLabel}
      />
      <div className="mt-2.5 divide-y divide-black/[0.07] border-y border-black/[0.06] bg-white/70">
        {children}
      </div>
    </section>
  );
}

export type DiscoverListRowProps = {
  title: string;
  subtitle: string;
  href: string;
  icon?: ReactNode;
  /** Optional right-side value (e.g. "12/48") — replaces chevron when set with no link affordance needed; chevron still shows. */
  meta?: string;
};

/**
 * Icon · title/subtitle · meta + chevron.
 */
export function DiscoverListRow({
  title,
  subtitle,
  href,
  icon,
  meta,
}: DiscoverListRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-5 py-3 transition active:bg-black/[0.03]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-black/[0.08] bg-[#f4f6f8] text-lake-blue [&_svg]:h-[18px] [&_svg]:w-[18px]">
        {icon ?? (
          <span className="text-[15px] font-bold text-foreground/40">
            {title.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-snug text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[12px] leading-snug text-foreground-muted">
          {subtitle}
        </span>
      </span>
      {meta ? (
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground-muted">
          {meta}
        </span>
      ) : null}
      <IconChevronRight className="h-4 w-4 shrink-0 text-foreground-muted/70" />
    </Link>
  );
}
