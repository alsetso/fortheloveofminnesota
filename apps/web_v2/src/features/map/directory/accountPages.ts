import type { PageStatus } from '@/lib/directory/launchPageForm';
import type { PageClaimStatus, PageVisibility } from '@/lib/directory/pageAudience';

export type AccountOwnedPage = {
  id: string;
  slug: string;
  title: string;
  pageType: string | null;
  pageTypeLabel: string | null;
  description: string | null;
  addressLine: string | null;
  logoUrl: string | null;
  icon: string | null;
  coverUrl: string | null;
  visibility: PageVisibility;
  status: PageStatus;
  claimStatus: PageClaimStatus;
  lat: number | null;
  lng: number | null;
  isCreator: boolean;
  isClaimedOwner: boolean;
  createdAt: string;
};

export async function fetchAccountOwnedPages(
  signal?: AbortSignal,
): Promise<AccountOwnedPage[]> {
  const res = await fetch('/api/accounts/pages', {
    credentials: 'include',
    signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Failed to load pages');
  }
  const json = (await res.json()) as { pages?: AccountOwnedPage[] };
  return json.pages ?? [];
}

export async function fetchAccountOwnedPageCount(
  signal?: AbortSignal,
): Promise<number> {
  const res = await fetch('/api/accounts/pages?count=1', {
    credentials: 'include',
    signal,
  });
  if (!res.ok) return 0;
  const json = (await res.json()) as { count?: number };
  return typeof json.count === 'number' ? json.count : 0;
}
