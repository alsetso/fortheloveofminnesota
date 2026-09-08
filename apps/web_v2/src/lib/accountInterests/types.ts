export const INTEREST_SECTIONS = [
  'yours',
  'civic',
  'outdoors',
  'water',
  'winter',
  'sports',
  'food',
  'arts',
  'community',
  'home',
  'minnesota',
] as const;

export type InterestSection = (typeof INTEREST_SECTIONS)[number];

export type Interest = {
  id: string;
  slug: string | null;
  name: string;
  section: InterestSection;
  owner_account_id: string | null;
  sort_order: number;
  created_at: string;
  retired_at: string | null;
};

export const INTEREST_SELECT =
  'id, slug, name, section, owner_account_id, sort_order, created_at, retired_at';

export const INTEREST_NAME_MAX = 48;

export const INTEREST_SECTION_LABEL: Record<InterestSection, string> = {
  yours: 'Yours',
  civic: 'Civic',
  outdoors: 'Outdoors',
  water: 'Lakes & water',
  winter: 'Winter',
  sports: 'Sports',
  food: 'Food & drink',
  arts: 'Arts & culture',
  community: 'Community',
  home: 'Home & making',
  minnesota: 'Minnesota',
};

export function isInterestSection(value: string): value is InterestSection {
  return (INTEREST_SECTIONS as readonly string[]).includes(value);
}

export function isCustomInterest(row: Pick<Interest, 'owner_account_id'>): boolean {
  return row.owner_account_id != null;
}

/**
 * Civic channels are the fixed serious register: reports tag with them,
 * and they alert every city-notify account. They are never followed
 * like interests, so follow UIs must skip this section.
 */
export function isCivicInterest(row: Pick<Interest, 'section'>): boolean {
  return row.section === 'civic';
}

export function cleanInterestName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Give this interest a name.');
  if (name.length > INTEREST_NAME_MAX) {
    throw new Error(`Keep it under ${INTEREST_NAME_MAX} characters.`);
  }
  return name;
}
