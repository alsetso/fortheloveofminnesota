const SMALL_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'by',
  'vs',
]);

/** Title-case a user-entered category label. */
export function formatBusinessCategoryName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';

  return trimmed
    .split(/\s+/)
    .map((word, index) => {
      if (word === '&') return '&';
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      return word
        .split('-')
        .map((part) => {
          if (!part) return part;
          if (part.length <= 3 && part === part.toUpperCase()) return part;
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join('-');
    })
    .join(' ')
    .replace(/\s+&\s+/g, ' & ');
}

export function businessCategorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

export function normalizeBusinessCategoryKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
