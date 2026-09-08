/** Native share sheet when available; otherwise copy URL to clipboard. */
export async function shareOrCopy(title: string, url: string): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, url });
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    /* ignore */
  }
}

/** Build an absolute share URL from a path on the current origin. */
export function absoluteShareUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  const origin = (
    process.env.NEXT_PUBLIC_WEB_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).replace(/\/+$/, '');
  return origin ? `${origin}${path}` : path;
}
