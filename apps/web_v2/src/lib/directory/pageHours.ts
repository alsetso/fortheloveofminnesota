import type { DirectoryPageHours } from '@/lib/directory/directoryPageTypes';

const DAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
] as const;

function dayRank(key: string): number {
  const i = DAY_ORDER.findIndex((d) => d.toLowerCase() === key.toLowerCase());
  return i === -1 ? 100 + key.charCodeAt(0) : i;
}

/** Compact hours line for dock cards (e.g. "Mon: 9–5 · Tue: 9–5"). */
export function formatHoursPreview(
  hours: DirectoryPageHours | null | undefined,
  max = 4,
): string | null {
  if (!hours || typeof hours !== 'object') return null;
  const entries = Object.entries(hours)
    .filter(([, v]) => String(v).trim())
    .sort(([a], [b]) => dayRank(a) - dayRank(b));
  if (entries.length === 0) return null;
  return entries
    .slice(0, max)
    .map(([k, v]) => `${k}: ${String(v).trim()}`)
    .join(' · ');
}

export function hasHoursContent(
  hours: DirectoryPageHours | null | undefined,
  showHours: boolean,
): boolean {
  if (!showHours) return false;
  return Boolean(formatHoursPreview(hours, 1));
}
