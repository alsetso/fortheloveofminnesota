/**
 * Profile Types
 * 
 * Shared type definitions for the profile page and related components.
 * Single source of truth for Pin, Account, and Ownership types.
 */

// =============================================================================
// PIN TYPES
// =============================================================================

export interface ProfilePin {
  id: string;
  lat: number;
  lng: number;
  description: string | null;
  media_url: string | null;
  visibility: PinVisibility;
  view_count: number | null;
  created_at: string;
  updated_at: string;
}

export type PinVisibility = 'public' | 'only_me';

// =============================================================================
// ACCOUNT TYPES
// =============================================================================

export interface ProfileAccount {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  cover_image_url: string | null;
  bio: string | null;
  city_id: string | null;
  view_count: number;
  traits: string[] | null;
  user_id: string | null;
  created_at: string;
}

// =============================================================================
// OWNERSHIP TYPES
// =============================================================================

export type ViewerType = 'authenticated' | 'anonymous';

export interface ViewerInfo {
  type: ViewerType;
  userId?: string;
  email?: string;
}

export interface ProfileOwnership {
  /** True if viewer owns this profile (server-confirmed for auth users, client-confirmed for guests) */
  isOwner: boolean;
  /** True if the profile belongs to a guest account (no user_id) */
  isGuestAccount: boolean;
  /** Current view mode - owner can toggle to 'visitor' to preview */
  viewMode: 'owner' | 'visitor';
  /** Effective permissions based on ownership + viewMode */
  canEdit: boolean;
  canCreatePin: boolean;
  canSeePrivatePins: boolean;
  /** Information about who is viewing */
  viewer: ViewerInfo | null;
}

// =============================================================================
// COMPONENT PROP TYPES
// =============================================================================

export interface ProfileMapProps {
  account: ProfileAccount;
  pins: ProfilePin[];
  isOwnProfile: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const TRAIT_OPTIONS = [
  { id: 'homeowner', label: 'Homeowner' },
  { id: 'renter', label: 'Renter' },
  { id: 'buyer', label: 'Buyer' },
  { id: 'investor', label: 'Investor' },
  { id: 'realtor', label: 'Realtor' },
  { id: 'businessowner', label: 'Business Owner' },
  { id: 'wholesaler', label: 'Wholesaler' },
  { id: 'lender', label: 'Lender' },
  { id: 'title', label: 'Title' },
] as const;

export type TraitId = typeof TRAIT_OPTIONS[number]['id'];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/** Get display name from account data */
export function getDisplayName(account: ProfileAccount): string {
  if (account.first_name) {
    return account.last_name 
      ? `${account.first_name} ${account.last_name}`
      : account.first_name;
  }
  return account.username || 'User';
}

/** Format date for display */
export function formatPinDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format join date */
export function formatJoinDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/** Count pins by visibility */
export function countPinsByVisibility(pins: ProfilePin[]): { 
  public: number; 
  private: number; 
  total: number;
} {
  const publicCount = pins.filter(p => p.visibility === 'public').length;
  const privateCount = pins.filter(p => p.visibility === 'only_me').length;
  return {
    public: publicCount,
    private: privateCount,
    total: publicCount + privateCount,
  };
}

/** Filter pins for visitor view (hide private) */
export function filterPinsForVisitor(pins: ProfilePin[]): ProfilePin[] {
  return pins.filter(p => p.visibility === 'public');
}
