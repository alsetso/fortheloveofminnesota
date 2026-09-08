/** Shared API shapes for user-generated directory pages (ios-2). */

import type { PageStatus } from '@/lib/directory/launchPageForm';
import type {
  PageClaimStatus,
  PageViewerAccess,
  PageVisibility,
} from '@/lib/directory/pageAudience';

export type DirectoryPagePin = {
  id: string;
  slug: string;
  title: string;
  pageType: string | null;
  /** Display label for page_type (e.g. Business). */
  pageTypeLabel: string | null;
  description: string | null;
  addressLine: string | null;
  /** Resolved http(s) logo, or null (map uses fallback disc). */
  logoUrl: string | null;
  /** Raw icon field — may be emoji or URL. */
  icon: string | null;
  coverUrl: string | null;
  website: string | null;
  lat: number;
  lng: number;
};

export type DirectoryPagesResponse = {
  pages: DirectoryPagePin[];
};

/** Day-keyed hours map from `page.pages.hours` jsonb. */
export type DirectoryPageHours = Record<string, string>;

export type DirectoryPageDetail = Omit<DirectoryPagePin, 'lat' | 'lng'> & {
  phone: string | null;
  email: string | null;
  lat: number | null;
  lng: number | null;
  categoryId: string | null;
  categoryName: string | null;
  cityName: string | null;
  countyName: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  youtubeUrl: string | null;
  mainStreamUrl: string | null;
  hours: DirectoryPageHours | null;
  showHours: boolean;
  isVerified: boolean;
  executivePass: boolean;
  claimStatus: PageClaimStatus;
  visibility: PageVisibility;
  status: PageStatus;
  homeBased: boolean;
  viewer: PageViewerAccess;
};
