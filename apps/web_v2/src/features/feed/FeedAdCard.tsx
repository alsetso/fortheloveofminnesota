'use client';

import type { MouseEvent, RefObject } from 'react';
import Link from 'next/link';
import type { FeedAdItem } from '@/features/feed/feedStream';
import { postAdEvent } from '@/features/feed/feedAnalytics';
import { useFeedAdImpression } from '@/features/feed/useFeedVisibility';
import { PAGE_PATH } from '@/lib/routes/routePolicy';

function advertiserHref(ad: FeedAdItem): string {
  if (ad.advertiserSlug) return `${PAGE_PATH}/${encodeURIComponent(ad.advertiserSlug)}`;
  return ad.destinationUrl || '#';
}

function resolveClickHref(ad: FeedAdItem): string {
  const dest = ad.destinationUrl?.trim();
  if (dest) return dest;
  return advertiserHref(ad);
}

/** Sponsored row — same timeline chrome as FeedPostCard. */
export function FeedAdCard({ ad }: { ad: FeedAdItem }) {
  const ref = useFeedAdImpression(ad.creativeId, ad.placementId);
  const href = resolveClickHref(ad);
  const pageHref = advertiserHref(ad);
  const initial = (ad.advertiserTitle.trim().slice(0, 1) || 'S').toUpperCase();
  const isExternal =
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('tel:') ||
    href.startsWith('mailto:');

  const onClick = (e: MouseEvent) => {
    postAdEvent(ad.creativeId, ad.placementId, 'click');
    if (href === '#') e.preventDefault();
  };

  return (
    <article
      ref={ref as RefObject<HTMLElement>}
      data-ad-creative={ad.creativeId}
      data-ad-placement={ad.placementId}
      className="relative transition-colors active:bg-black/[0.03]"
    >
      {isExternal ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Sponsored: ${ad.advertiserTitle}`}
          onClick={onClick}
          className="absolute inset-0 z-0"
        />
      ) : (
        <Link
          href={href}
          aria-label={`Sponsored: ${ad.advertiserTitle}`}
          onClick={onClick}
          className="absolute inset-0 z-0"
        />
      )}

      <div className="pointer-events-none relative z-[1] flex gap-2.5 px-4 py-2.5">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-black/10 bg-lake-blue/15">
          {ad.advertiserLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.advertiserLogoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-foreground">
              {initial}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <Link
              href={pageHref}
              onClick={(e) => {
                e.stopPropagation();
                postAdEvent(ad.creativeId, ad.placementId, 'click');
              }}
              className="pointer-events-auto truncate text-[15px] font-semibold tracking-tight text-foreground"
            >
              {ad.advertiserTitle}
            </Link>
            <span className="shrink-0 text-[12px] font-medium uppercase tracking-wide text-foreground-muted">
              Sponsored
            </span>
          </div>

          <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-snug text-foreground line-clamp-6">
            {ad.caption}
          </p>

          {ad.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.imageUrl}
              alt=""
              className="mt-2.5 aspect-[16/10] w-full rounded-2xl object-cover bg-black/[0.04]"
            />
          ) : null}

          <div className="mt-2.5 flex items-center gap-5 text-[13px] text-foreground-muted">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-lake-blue">
              {ad.ctaLabel}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
