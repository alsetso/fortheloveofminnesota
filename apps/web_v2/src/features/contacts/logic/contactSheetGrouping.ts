/** Client-side A–Z grouping for the Contacts sheet. */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' as const;

export const CONTACT_INDEX_LETTERS = [...LETTERS, '#'] as const;
export type ContactIndexLetter = (typeof CONTACT_INDEX_LETTERS)[number];

export function sectionLetterFor(sortKey: string): ContactIndexLetter {
  const ch = sortKey.trim().charAt(0).toUpperCase();
  if (ch >= 'A' && ch <= 'Z') return ch as ContactIndexLetter;
  return '#';
}

export function groupBySectionLetter<T>(
  items: T[],
  getSortKey: (item: T) => string,
): { letter: ContactIndexLetter; items: T[] }[] {
  const buckets = new Map<ContactIndexLetter, T[]>();
  for (const letter of CONTACT_INDEX_LETTERS) buckets.set(letter, []);

  const sorted = [...items].sort((a, b) =>
    getSortKey(a).localeCompare(getSortKey(b), undefined, { sensitivity: 'base' }),
  );

  for (const item of sorted) {
    const letter = sectionLetterFor(getSortKey(item));
    buckets.get(letter)!.push(item);
  }

  return CONTACT_INDEX_LETTERS.map((letter) => ({
    letter,
    items: buckets.get(letter)!,
  })).filter((g) => g.items.length > 0);
}
