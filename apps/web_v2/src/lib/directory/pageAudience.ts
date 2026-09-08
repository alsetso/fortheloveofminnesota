import type { PageStatus } from '@/lib/directory/launchPageForm';

export type PageClaimStatus = 'unclaimed' | 'pending' | 'approved';
export type PageVisibility = 'public' | 'unlisted';

export type PageViewerAccess = {
  /** `page.pages.owner_id` — created this listing. */
  isCreator: boolean;
  /** `page.pages.claimed_by` — official entity owner. */
  isClaimedOwner: boolean;
};

export type PageAudienceChipTone = 'lake' | 'amber' | 'muted';

export type PageAudienceChip = {
  key: string;
  label: string;
  tone: PageAudienceChipTone;
};

export function asClaimStatus(value: string | null | undefined): PageClaimStatus {
  if (value === 'pending' || value === 'approved') return value;
  return 'unclaimed';
}

export function asPageStatus(value: string | null | undefined): PageStatus {
  return value === 'draft' ? 'draft' : 'active';
}

export function asVisibility(value: string | null | undefined): PageVisibility {
  return value === 'unlisted' ? 'unlisted' : 'public';
}

export function pageViewerAccess(
  accountId: string | null | undefined,
  ownerId: string | null | undefined,
  claimedBy: string | null | undefined,
): PageViewerAccess {
  const id = accountId?.trim() || null;
  return {
    isCreator: Boolean(id && ownerId && id === ownerId),
    isClaimedOwner: Boolean(id && claimedBy && id === claimedBy),
  };
}

export function canViewPrivatePage(access: PageViewerAccess): boolean {
  return access.isCreator || access.isClaimedOwner;
}

/**
 * Compact chips for My pages + Page Card.
 * Public visitors see claim state. Creators/owners also see publish + relation.
 */
export function pageAudienceChips(input: {
  claimStatus: PageClaimStatus;
  visibility: PageVisibility;
  status: PageStatus;
  access: PageViewerAccess;
  /** Hide “Public” on map cards — default live pages don’t need the chip. */
  showPublic?: boolean;
}): PageAudienceChip[] {
  const { claimStatus, visibility, status, access, showPublic = false } = input;
  const chips: PageAudienceChip[] = [];
  const privateView = canViewPrivatePage(access);

  if (status === 'draft') {
    chips.push({ key: 'draft', label: 'Draft', tone: 'muted' });
  } else if (visibility === 'unlisted' && privateView) {
    chips.push({ key: 'unlisted', label: 'Unlisted', tone: 'muted' });
  } else if (showPublic && visibility === 'public' && privateView) {
    chips.push({ key: 'public', label: 'Public', tone: 'lake' });
  }

  if (access.isClaimedOwner) {
    chips.push({ key: 'owner', label: 'Owner', tone: 'lake' });
  } else if (access.isCreator) {
    chips.push({ key: 'created', label: 'Created', tone: 'lake' });
  }

  if (!access.isClaimedOwner) {
    if (claimStatus === 'pending') {
      chips.push({ key: 'pending', label: 'Claim pending', tone: 'amber' });
    } else if (claimStatus === 'unclaimed') {
      chips.push({ key: 'unclaimed', label: 'Unclaimed', tone: 'muted' });
    } else if (claimStatus === 'approved' && !access.isCreator) {
      chips.push({ key: 'claimed', label: 'Claimed', tone: 'lake' });
    }
  }

  return chips;
}

export function pagePrivateNote(access: PageViewerAccess, claimStatus: PageClaimStatus): string {
  if (access.isCreator && access.isClaimedOwner) {
    return 'You created this page and claimed it as the official owner.';
  }
  if (access.isClaimedOwner) {
    return 'You’re the official owner of this page.';
  }
  if (access.isCreator && claimStatus === 'unclaimed') {
    return 'You created this listing. It is public, but not yet claimed.';
  }
  if (access.isCreator && claimStatus === 'pending') {
    return 'You created this listing. An ownership claim is in review.';
  }
  if (access.isCreator) {
    return 'You created this listing. Official ownership is claimed.';
  }
  return '';
}
