/** Normalize stored URL/handle for href (website + socials). */
export function externalHref(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith('www.')) return `https://${v}`;
  if (v.includes('.') && !v.includes(' ')) return `https://${v}`;
  if (v.startsWith('@')) return `https://instagram.com/${v.slice(1)}`;
  return `https://${v}`;
}

export type PageLinkField = {
  key: string;
  label: string;
  value: string;
  href: string;
};

export type PageLinksFields = {
  website?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  mainStreamUrl?: string | null;
};

export function pageLinkItems(links: PageLinksFields): PageLinkField[] {
  const raw = [
    { key: 'website', label: 'Website', value: links.website ?? null },
    { key: 'instagram', label: 'Instagram', value: links.instagramUrl ?? null },
    { key: 'facebook', label: 'Facebook', value: links.facebookUrl ?? null },
    { key: 'linkedin', label: 'LinkedIn', value: links.linkedinUrl ?? null },
    { key: 'youtube', label: 'YouTube', value: links.youtubeUrl ?? null },
    { key: 'stream', label: 'Live stream', value: links.mainStreamUrl ?? null },
  ];
  const out: PageLinkField[] = [];
  for (const item of raw) {
    const href = externalHref(item.value);
    if (!href || !item.value?.trim()) continue;
    out.push({
      key: item.key,
      label: item.label,
      value: item.value.trim(),
      href,
    });
  }
  return out;
}

export function linkDisplayHost(value: string): string {
  return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
}

/** Public web path for a directory page (share / open in browser). */
export function directoryPageSharePath(slug: string | null | undefined): string | null {
  const s = slug?.trim();
  if (!s) return null;
  return `/page/${encodeURIComponent(s)}`;
}

/** Owner manage editor for primary listing fields. */
export function directoryPageManagePath(slug: string | null | undefined): string | null {
  const s = slug?.trim();
  if (!s) return null;
  return `/page/${encodeURIComponent(s)}/manage`;
}

/** Owner advertise surface — credits, creatives, placements for this page. */
export function directoryPageAdvertisePath(slug: string | null | undefined): string | null {
  const s = slug?.trim();
  if (!s) return null;
  return `/page/${encodeURIComponent(s)}/advertise`;
}

/** Absolute share URL when a public site origin is configured. */
export function directoryPageShareUrl(slug: string | null | undefined): string | null {
  const path = directoryPageSharePath(slug);
  if (!path) return null;
  const origin = (
    process.env.NEXT_PUBLIC_WEB_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).replace(/\/+$/, '');
  if (origin) return `${origin}${path}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}
