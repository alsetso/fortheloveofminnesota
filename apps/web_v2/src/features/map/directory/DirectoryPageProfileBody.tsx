'use client';

import type { ReactNode } from 'react';
import type { DirectoryPageDetail } from '@/lib/directory/directoryPageTypes';
import {
  directoryPageShareUrl,
  linkDisplayHost,
  pageLinkItems,
} from '@/lib/directory/pageContactLinks';
import { formatHoursPreview, hasHoursContent } from '@/lib/directory/pageHours';
import {
  canViewPrivatePage,
  pageAudienceChips,
  pagePrivateNote,
  type PageViewerAccess,
} from '@/lib/directory/pageAudience';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { IconEye } from '@/features/map/dockCore/core/icons';

const META =
  'flex w-full items-baseline justify-between gap-3 px-0.5 py-2.5 text-left transition active:opacity-70';

function openExternal(href: string, target: '_blank' | '_self' = '_blank') {
  try {
    window.open(href, target, target === '_blank' ? 'noopener,noreferrer' : undefined);
  } catch {
    /* ignore */
  }
}

async function sharePage(title: string, url: string) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, url });
      return;
    }
  } catch {
    /* fall through to clipboard */
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    openExternal(url);
  }
}

const PUBLIC_VIEWER: PageViewerAccess = { isCreator: false, isClaimedOwner: false };

export type DirectoryPageProfileBodyProps = {
  page: DirectoryPageDetail | null;
  fallback: {
    title: string;
    typeLabel?: string | null;
    address?: string | null;
    summary?: string | null;
    logoUrl?: string | null;
    icon?: string | null;
  };
  loading?: boolean;
  error?: string | null;
  /** Extra rows after the private “Your page” block (creator/owner only). */
  privateActions?: ReactNode;
  /** Optional block under the address facts (e.g. map preview). */
  locationPreview?: ReactNode;
};

/**
 * Compact public page facts. Identity lives in the sticky card header.
 * Creator / owner fields stay in a separate “Your page” block.
 */
export function DirectoryPageProfileBody({
  page,
  fallback,
  loading = false,
  error = null,
  privateActions,
  locationPreview,
}: DirectoryPageProfileBodyProps) {
  const title = page?.title ?? fallback.title;
  const summary = page?.description ?? fallback.summary ?? null;
  const placeLine = [page?.cityName, page?.countyName ? `${page.countyName} County` : null]
    .filter(Boolean)
    .join(' · ');
  const hoursPreview =
    page && hasHoursContent(page.hours, page.showHours)
      ? formatHoursPreview(page.hours)
      : null;
  const links = page
    ? pageLinkItems({
        website: page.website,
        facebookUrl: page.facebookUrl,
        instagramUrl: page.instagramUrl,
        linkedinUrl: page.linkedinUrl,
        youtubeUrl: page.youtubeUrl,
        mainStreamUrl: page.mainStreamUrl,
      })
    : [];
  const phone = page?.phone ?? null;
  const email = page?.email ?? null;
  const shareUrl = directoryPageShareUrl(page?.slug);
  const access = page?.viewer ?? PUBLIC_VIEWER;
  const privateView = canViewPrivatePage(access);
  const note = page ? pagePrivateNote(access, page.claimStatus) : '';

  const facts: Array<{ key: string; label: string; value: string; href?: string; target?: '_self' }> = [];
  const address = page?.addressLine ?? fallback.address ?? null;
  if (page?.pageTypeLabel) {
    facts.push({ key: 'type', label: 'Type', value: page.pageTypeLabel });
  }
  if (page?.categoryName) {
    facts.push({ key: 'subtype', label: 'Category', value: page.categoryName });
  }
  if (address) facts.push({ key: 'address', label: 'Address', value: address });
  if (phone) facts.push({ key: 'phone', label: 'Phone', value: phone, href: `tel:${phone}`, target: '_self' });
  if (email) facts.push({ key: 'email', label: 'Email', value: email, href: `mailto:${email}`, target: '_self' });
  if (hoursPreview) facts.push({ key: 'hours', label: 'Hours', value: hoursPreview });
  if (page?.homeBased) facts.push({ key: 'home', label: 'Based', value: 'Home-based' });
  if (placeLine) facts.push({ key: 'place', label: 'Area', value: placeLine });
  for (const link of links) {
    facts.push({ key: link.key, label: link.label, value: linkDisplayHost(link.value), href: link.href });
  }

  return (
    <>
      {loading && !page ? (
        <p className="px-0.5 text-[13px] text-foreground-muted">Loading…</p>
      ) : null}
      {error && !page ? (
        <p className="px-0.5 text-[13px] text-foreground-muted">{error}</p>
      ) : null}

      {summary ? (
        <p className="px-0.5 text-[14px] leading-relaxed text-foreground/85">{summary}</p>
      ) : null}

      {locationPreview}

      {facts.length > 0 ? (
        <div className={`divide-y divide-black/[0.06] rounded-[1.15rem] px-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}>
          {facts.map((fact) => {
            const body = (
              <>
                <span className="shrink-0 text-[12px] font-semibold text-foreground-muted">
                  {fact.label}
                </span>
                <span className="min-w-0 truncate text-[14px] text-foreground">{fact.value}</span>
              </>
            );
            if (fact.href) {
              return (
                <button
                  key={fact.key}
                  type="button"
                  className={META}
                  onClick={() => openExternal(fact.href!, fact.target ?? '_blank')}
                >
                  {body}
                </button>
              );
            }
            return (
              <div key={fact.key} className={META}>
                {body}
              </div>
            );
          })}
        </div>
      ) : null}

      {shareUrl && page?.status === 'active' && page.visibility === 'public' ? (
        <button
          type="button"
          className={`${META} rounded-[1.15rem] px-3.5 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
          onClick={() => void sharePage(title, shareUrl)}
        >
          <span className="shrink-0 text-[12px] font-semibold text-foreground-muted">Share</span>
          <span className="min-w-0 truncate text-[14px] text-lake-blue">
            {linkDisplayHost(shareUrl)}
          </span>
        </button>
      ) : null}

      {privateView && page ? (
        <section className="space-y-2">
          <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
            <IconEye className="h-3 w-3" />
            Only you
          </p>
          <div
            className={`space-y-2 rounded-[1.15rem] px-3.5 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
          >
            <p className="text-[13px] leading-snug text-foreground">{note}</p>
            <p className="text-[12px] text-foreground-muted">
              {page.status === 'draft'
                ? 'Draft — not on the directory yet.'
                : page.visibility === 'unlisted'
                  ? 'Unlisted — only people with the link can find it.'
                  : 'Public on the directory.'}
              {page.slug ? ` · /${page.slug}` : ''}
            </p>
          </div>
          {privateActions}
        </section>
      ) : null}
    </>
  );
}

export function pageCardChipsFor(page: DirectoryPageDetail | null, fallbackAccess?: PageViewerAccess) {
  if (!page) {
    return pageAudienceChips({
      claimStatus: 'unclaimed',
      visibility: 'public',
      status: 'active',
      access: fallbackAccess ?? PUBLIC_VIEWER,
    });
  }
  return pageAudienceChips({
    claimStatus: page.claimStatus,
    visibility: page.visibility,
    status: page.status,
    access: page.viewer,
    showPublic: canViewPrivatePage(page.viewer),
  });
}
