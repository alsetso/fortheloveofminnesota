/**
 * Map people.title (denormalized chamber/type) to branch and display label.
 * Canonical position comes from roles table (person_id + org_id + title); when no role row exists,
 * we derive from people.title for legislators only. Executive positions (Governor, Cabinet, etc.)
 * should live in roles linked to orgs under Executive Branch.
 */
export type GovernmentBranch = 'executive' | 'legislative' | 'judicial' | null;

export interface TitleInfo {
  branch: GovernmentBranch;
  /** Display label e.g. "State Senator", "State Representative" */
  label: string;
}

const PEOPLE_TITLE_MAP: Record<string, TitleInfo> = {
  'House of Representatives': { branch: 'legislative', label: 'State Representative' },
  'Senate': { branch: 'legislative', label: 'State Senator' },
};

/**
 * Derive branch and display label from people.title when person has no roles rows.
 */
export function getRoleFromPeopleTitle(title: string | null): TitleInfo | null {
  if (!title?.trim()) return null;
  return PEOPLE_TITLE_MAP[title.trim()] ?? { branch: null, label: title.trim() };
}

/**
 * Display label for a person: prefer first role title, else derived from people.title.
 */
export function getDisplayRole(
  peopleTitle: string | null,
  roleTitles: string[]
): string {
  if (roleTitles.length > 0) return roleTitles[0];
  const info = getRoleFromPeopleTitle(peopleTitle);
  return info?.label ?? peopleTitle ?? '';
}
