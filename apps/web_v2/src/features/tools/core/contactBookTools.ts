/**
 * Tools registry — Game dock subpages share one source of truth.
 *
 * Contact book = look up / save people & places.
 * Wallet tools = balance / costs (earn-only for V1 — no buy packs).
 * Utilities = everything else under Tools.
 */

export type ContactBookToolKind =
  | 'people'
  | 'addresses'
  | 'saved'
  | 'credits'
  | 'buy-credits'
  | 'transit';

export type ContactBookTool = {
  kind: ContactBookToolKind;
  title: string;
  subtitle: string;
  /** Target dock height when opening from Tools (three-height model). */
  snap: 'half' | 'full';
};

/** Lookups + the durable book — not wallet. */
export const CONTACT_BOOK_TOOLS: ContactBookTool[] = [
  {
    kind: 'people',
    title: 'People',
    subtitle: 'Name, email, or phone',
    snap: 'half',
  },
  {
    kind: 'addresses',
    title: 'Addresses',
    subtitle: 'Property & owner lookup',
    snap: 'half',
  },
  {
    kind: 'saved',
    title: 'Saved',
    subtitle: 'Your contact book',
    snap: 'half',
  },
];

/** Opened from the balance surface — not listed under Contact book. */
export const WALLET_TOOLS: ContactBookTool[] = [
  {
    kind: 'credits',
    title: 'Credits',
    subtitle: 'Balance, costs & activity',
    snap: 'half',
  },
];

/** Utilities that stay under Tools but aren’t the contact book. */
export const TOOL_UTILITIES: ContactBookTool[] = [
  {
    kind: 'transit',
    title: 'Transit',
    subtitle: 'Metro Transit',
    snap: 'half',
  },
];

export function isContactBookToolKind(kind: string): kind is ContactBookToolKind {
  return (
    kind === 'people' ||
    kind === 'addresses' ||
    kind === 'saved' ||
    kind === 'credits' ||
    kind === 'buy-credits' ||
    kind === 'transit'
  );
}

/** Subpages that show the credits chip in title chrome. */
export function showsCreditsChipKind(kind: string): boolean {
  return (
    isContactBookToolKind(kind) ||
    kind === 'tool-result' ||
    kind === 'contact-detail' ||
    kind === 'contact-enrichment'
  );
}

export function getContactBookTool(kind: string): ContactBookTool | undefined {
  return (
    CONTACT_BOOK_TOOLS.find((t) => t.kind === kind) ??
    WALLET_TOOLS.find((t) => t.kind === kind) ??
    TOOL_UTILITIES.find((t) => t.kind === kind)
  );
}
